-- =====================================================================
-- supabase/tests/rls/0023_landing_media_suite.sql
--
-- Suite NEGATIVE du bucket public `landing-media` (migration 0068).
--
-- CE QU'ELLE PROUVE, ET POURQUOI CHAQUE CAS EXISTE
--
--   A. L'ETAT DES BUCKETS. `landing-media` est public, borne, limite aux
--      images, sans SVG ; les huit buckets de 0027 sont prives. C'est la
--      seule chose qui decide de ce qu'un anonyme peut charger : la lecture
--      d'un bucket public passe par
--      `/storage/v1/object/public/...`, que le service Storage sert SANS
--      consulter `storage.objects`. Tester `storage.buckets.public` n'est
--      donc pas un raccourci — c'est tester le mecanisme reel.
--
--   B. L'ECRITURE. Un membre sans `cms.media.manage` ne peut rien deposer
--      ni supprimer dans `landing-media` ; un porteur de la permission le
--      peut, mais UNIQUEMENT sous l'un des quatre prefixes d'usage.
--
--   C. LA LECTURE ANONYME. `anon` ne voit AUCUN objet de `storage.objects`,
--      dans AUCUN bucket. C'est le second volet de A : par la RLS, anon
--      n'atteint rien ; par l'endpoint public, il n'atteint que le seul
--      bucket marque public. Les deux ensemble disent « un anonyme lit
--      landing-media et rien d'autre ».
--
--   D. LE GARDE-FOU. `storage_baseline_violations()` ECHOUE si `avatars`
--      devient public, et ECHOUE aussi si `landing-media` cesse de l'etre.
--      Les deux sont verifies en provoquant reellement la situation, puis
--      en la retablissant — le ROLLBACK final s'en charge de toute facon.
--
--   E. LES PROJECTIONS. Un media hors du bucket public, ou sans texte
--      alternatif, n'est pas projete. Une couverture d'actualite est
--      resolue dans la mediatheque. `avatar_path` a quitte le teaser
--      « ISE du jour » (D-135).
--
-- Modele auto-nettoyant, identique a 0021 et 0022 : bloc DO unique,
-- fixtures, assertions, RAISE EXCEPTION final qui annule la transaction.
--
--   succes  ->  ERROR:  P0001: LANDING_MEDIA_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: LANDING_MEDIA_TESTS_FAILED: N cas, K echec(s)
--
-- La CI doit chercher `LANDING_MEDIA_TESTS_OK:` ET `0 echec`, et echouer
-- sur l'absence de l'un des deux.
--
-- DERNIERE EXECUTION SUR LA BASE REELLE (2026-08-08) :
--   ERROR:  P0001: LANDING_MEDIA_TESTS_OK: 35 cas, 0 echec
--
-- FIXTURES (D-104)
--   Ada   membre ordinaire, AUCUNE permission CMS
--   Bea   cms_editor (cms.read, cms.edit, cms.media.manage)
-- =====================================================================

do $lm$
declare
  u_ada uuid := '00000000-0000-4000-8023-000000000001';
  u_bea uuid := '00000000-0000-4000-8023-000000000002';
  p_ada uuid := '00000000-0000-4000-8023-0000000000a1';
  p_bea uuid := '00000000-0000-4000-8023-0000000000a2';

  m_pub uuid := '00000000-0000-4000-8023-0000000000b1';  -- dans landing-media
  m_old uuid := '00000000-0000-4000-8023-0000000000b2';  -- reste dans public-assets
  n_one uuid := '00000000-0000-4000-8023-0000000000c1';

  c_path_ok    text := 'carousel/2026/08/0023-visuel.webp';
  c_path_bad   text := 'confidentiel/2026/08/0023-visuel.webp';
  c_path_news  text := 'news/2026/08/0023-couverture.webp';

  v_promo    bigint;
  v_category text;

  v_cases integer := 0;
  v_fail  text[] := array[]::text[];
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_json  jsonb;
  v_bucket text;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id   into v_promo    from public.promotions      order by id   limit 1;
  select code into v_category from public.news_categories order by code limit 1;

  -- ---------------- FIXTURES ----------------
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
    ('00000000-0000-0000-0000-000000000000', u_ada, 'authenticated', 'authenticated', 'test+lm.ada@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_bea, 'authenticated', 'authenticated', 'test+lm.bea@ise.test', now(), now());

  insert into public.ise_profiles
    (id, user_id, first_name, last_name, promotion_id, profile_status, claim_status, claimed_at,
     is_test_account) values
    (p_ada, u_ada, 'Ada', 'SansMedia', v_promo, 'active', 'claimed', now(), true),
    (p_bea, u_bea, 'Bea', 'Mediatheque', v_promo, 'active', 'claimed', now(), true);

  insert into private.user_roles (profile_id, role_id)
  select p_ada, id from private.roles where code = 'member';
  insert into private.user_roles (profile_id, role_id)
  select p_bea, id from private.roles where code = 'cms_editor';

  -- Media publiable : bucket public, alternative textuelle, dimensions.
  insert into public.cms_media_assets
    (id, bucket_id, storage_path, filename, mime_type, width, height, size_bytes, alt_text,
     created_by_profile_id)
  values
    (m_pub, 'landing-media', c_path_news, '0023-couverture.webp', 'image/webp', 1440, 810, 120000,
     'Couverture de l''actualite de test 0023', p_bea);

  -- Media reste dans l'ancien bucket PRIVE : il ne doit jamais etre projete.
  insert into public.cms_media_assets
    (id, bucket_id, storage_path, filename, mime_type, width, height, size_bytes, alt_text,
     created_by_profile_id)
  values
    (m_old, 'public-assets', 'cms/2026/01/0023-ancien.webp', '0023-ancien.webp', 'image/webp',
     800, 600, 90000, 'Ancien visuel reste dans public-assets', p_bea);

  insert into public.news (id, category_code, title, slug, summary, body, visibility,
                           editorial_status, landing_visibility, landing_priority, is_featured,
                           image_path, published_at)
  values (n_one, v_category, 'Actualite 0023', 'actualite-0023',
          'Resume public de l''actualite de test des medias.',
          'CORPS CONFIDENTIEL.', 'members', 'published', 'visible', 900, false,
          c_path_news, now() - interval '1 hour');

  -- =================================================================
  -- A. ETAT DES BUCKETS
  -- =================================================================

  -- A01 : landing-media existe, public, borne, images seulement.
  select count(*) into v_n
  from storage.buckets
  where id = 'landing-media' and public
    and file_size_limit = 5242880
    and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || text 'A01 landing-media n''est pas public/borne/limite aux images';
  end if;

  -- A02 : aucun bucket n'accepte de SVG. Un SVG public execute du script
  --       dans le contexte du domaine Supabase.
  select count(*) into v_n
  from storage.buckets
  where allowed_mime_types && array['image/svg+xml', 'text/xml', 'application/xml'];
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('A02 %s bucket(s) acceptent du SVG', v_n);
  end if;

  -- A03 : les huit buckets de 0027 sont TOUS prives.
  select count(*) into v_n
  from storage.buckets
  where id in ('avatars', 'profile-documents', 'project-assets', 'message-attachments',
               'support-attachments', 'verification-documents', 'admin-imports', 'public-assets')
    and public;
  v_cases := v_cases + 1;
  if v_n <> 0 then
    select string_agg(id, ', ') into v_msg from storage.buckets
    where id <> 'landing-media' and public;
    v_fail := v_fail || format('A03 bucket(s) historique(s) devenus publics : %s', coalesce(v_msg, ''));
  end if;

  -- A04 : landing-media est le SEUL bucket public de la plateforme.
  select count(*) into v_n from storage.buckets where public;
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('A04 %s bucket(s) publics au lieu d''un seul', v_n);
  end if;

  -- =================================================================
  -- B. ECRITURE — reservee a cms.media.manage
  -- =================================================================

  -- B01 : Ada, membre ordinaire, ne depose rien dans landing-media.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ada::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('landing-media', c_path_ok, u_ada);
    v_ok := false; v_msg := 'un membre sans cms.media.manage a depose un objet';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('B01 ' || coalesce(v_msg, '')); end if;

  -- B02 : Ada ne lit pas non plus le contenu du bucket par la RLS.
  select count(*) into v_n from storage.objects where bucket_id = 'landing-media';
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('B02 un membre sans cms.read a lu %s objet(s)', v_n);
  end if;

  -- B03 : Bea, porteuse de cms.media.manage, depose sous un prefixe valide.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bea::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('landing-media', c_path_ok, u_bea);
    v_ok := true;
  exception when others then v_ok := false; v_msg := sqlerrm; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('B03 depot refuse a cms.media.manage : ' || coalesce(v_msg, '')); end if;

  -- B04 : le meme depot HORS des quatre usages est refuse. Le rangement
  --       n'est pas une convention : c'est une regle appliquee par la base.
  v_msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('landing-media', c_path_bad, u_bea);
    v_ok := false; v_msg := 'un chemin hors des quatre usages a ete accepte';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('B04 ' || coalesce(v_msg, '')); end if;

  -- B05 : un objet a la racine du bucket est refuse lui aussi.
  v_msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('landing-media', 'a-la-racine.png', u_bea);
    v_ok := false; v_msg := 'un objet a la racine du bucket a ete accepte';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('B05 ' || coalesce(v_msg, '')); end if;

  -- B06 : `cms.media.manage` n'ouvre AUCUN autre bucket. Le bucket prive
  --       des avatars reste ferme a la mediatheque.
  --
  --       LE CHEMIN VISE LE PROFIL D'ADA, PAS CELUI DE BEA. Premiere version
  --       de ce cas : `avatars/{p_bea}/portrait.png`. Il passait — et c'etait
  --       JUSTE. `ise_avatars_write` (0027) autorise chacun a ecrire sous SON
  --       propre identifiant de profil : Bea y ecrivait en tant que
  --       proprietaire de son avatar, pas en tant que gestionnaire de medias.
  --       Le cas ne mesurait donc rien. Vise le profil d'un tiers, il mesure
  --       exactement ce qu'il annonce.
  v_msg := null;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('avatars', p_ada::text || '/portrait.png', u_bea);
    v_ok := false; v_msg := 'cms.media.manage a ouvert le bucket avatars d''un tiers';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('B06 ' || coalesce(v_msg, '')); end if;

  -- B07 : Bea lit bien l'objet qu'elle vient de deposer (cms.read).
  select count(*) into v_n from storage.objects
  where bucket_id = 'landing-media' and name = c_path_ok;
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('B07 cms.read ne lit pas l''objet depose (%s ligne)', v_n);
  end if;

  -- B08 -> B11 : MODIFICATION ET SUPPRESSION.
  --
  --   DEFAUT DE CONCEPTION DE LA PREMIERE VERSION DE CE HARNAIS, ET CE
  --   QU'IL A REVELE. Le plan initial testait la suppression par un DELETE
  --   direct. Supabase pose sur `storage.objects` un declencheur
  --   `protect_objects_delete`, et il est `FOR EACH STATEMENT` : il leve
  --   42501 « Direct deletion from storage tables is not allowed » AVANT
  --   toute evaluation de lignes, donc AVANT la RLS, et meme quand la
  --   commande n'aurait touche personne. Aucun DELETE sur `storage.objects`
  --   n'est observable en SQL, ni permis, ni refuse : la suppression passe
  --   exclusivement par l'API Storage.
  --
  --   On mesure donc :
  --     * le comportement REEL sur l'UPDATE, qui n'a pas de tel garde-fou et
  --       qui porte exactement la meme condition d'autorisation ;
  --     * la FORME de la politique DELETE — commande, roles, permission
  --       exigee. C'est moins qu'un test de comportement, et c'est dit.

  -- B08 : Ada n'atteint pas l'objet en modification. Le UPDATE ne touche
  --       aucune ligne : la RLS a filtre avant.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ada::text, 'role', 'authenticated')::text, true);
  update storage.objects set name = 'carousel/2026/08/0023-detourne.webp'
  where bucket_id = 'landing-media' and name = c_path_ok;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('B08 un membre ordinaire a modifie %s objet(s) de la vitrine', v_n);
  end if;

  -- B09 : Bea, elle, modifie — vers un chemin valide.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bea::text, 'role', 'authenticated')::text, true);
  update storage.objects set name = 'carousel/2026/08/0023-renomme.webp'
  where bucket_id = 'landing-media' and name = c_path_ok;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('B09 cms.media.manage n''a modifie que %s objet(s)', v_n);
  end if;

  -- B10 : mais elle ne peut pas le deplacer HORS des quatre usages. Le
  --       `WITH CHECK` de la politique s'applique a la valeur d'arrivee.
  v_msg := null;
  begin
    update storage.objects set name = 'confidentiel/2026/08/0023-renomme.webp'
    where bucket_id = 'landing-media' and name = 'carousel/2026/08/0023-renomme.webp';
    v_ok := false; v_msg := 'un objet a ete deplace hors des quatre usages';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('B10 ' || coalesce(v_msg, '')); end if;

  -- B11 : la politique de suppression existe, ne vise que `authenticated`,
  --       et exige `cms.media.manage`. Test de FORME, faute de pouvoir
  --       observer un DELETE (voir l'encadre ci-dessus).
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and p.polname = 'ise_landing_media_delete'
    and p.polcmd = 'd'
    and pg_get_expr(p.polqual, p.polrelid) like '%cms.media.manage%'
    and pg_get_expr(p.polqual, p.polrelid) like '%landing-media%'
    and not exists (select 1 from unnest(p.polroles) r where r::regrole::text <> 'authenticated');
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || text 'B11 la politique de suppression de landing-media n''a pas la forme attendue';
  end if;

  -- B12 : la table de metadonnees suit la meme regle. Un membre ordinaire
  --       n'ecrit pas dans cms_media_assets.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ada::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    insert into public.cms_media_assets (storage_path, filename, mime_type, alt_text)
    values ('carousel/2026/08/0023-intrus.webp', 'intrus.webp', 'image/webp', 'Intrusion');
    v_ok := false; v_msg := 'un membre ordinaire a enregistre un media';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('B12 ' || coalesce(v_msg, '')); end if;

  -- B13 : le defaut de bucket_id est bien `landing-media`.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.cms_media_assets (storage_path, filename, mime_type, alt_text)
  values ('sections/2026/08/0023-defaut.webp', 'defaut.webp', 'image/webp', 'Media sans bucket explicite')
  returning bucket_id into v_bucket;
  v_cases := v_cases + 1;
  if v_bucket is distinct from 'landing-media' then
    v_fail := v_fail || format('B13 defaut de bucket_id = %s', coalesce(v_bucket, 'NULL'));
  end if;

  -- =================================================================
  -- C. LECTURE ANONYME
  --    Un anonyme lit `landing-media` — par l'endpoint public, que
  --    `storage.buckets.public` seul autorise (verifie en A01/A04) — et
  --    AUCUN autre bucket : ni par cet endpoint (A03), ni par la RLS.
  -- =================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into storage.objects (bucket_id, name) values
    ('avatars', p_bea::text || '/portrait.png'),
    ('public-assets', 'cms/2026/01/0023-ancien.webp'),
    ('profile-documents', p_bea::text || '/cv.pdf');

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  v_msg := null;
  begin
    select count(*) into v_n from storage.objects;
    v_ok := (v_n = 0);
    v_msg := format('anon a lu %s objet(s) par la RLS', v_n);
  exception when others then
    v_ok := true;  -- refus au niveau privilege : plus strict encore
  end;
  perform set_config('role', 'postgres', true);
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text ('C01 ' || coalesce(v_msg, '')); end if;

  -- C02 : aucune politique de storage.objects n'est ouverte a anon.
  select count(*) into v_n
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and exists (select 1 from unnest(p.polroles) r where r::regrole::text in ('anon', 'public'));
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('C02 %s politique(s) storage.objects ouvertes a anon', v_n);
  end if;

  -- C03 : les quatre politiques de landing-media existent et ciblent
  --       `authenticated` uniquement.
  select count(*) into v_n
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and p.polname in ('ise_landing_media_read', 'ise_landing_media_insert',
                      'ise_landing_media_update', 'ise_landing_media_delete');
  v_cases := v_cases + 1;
  if v_n <> 4 then
    v_fail := v_fail || format('C03 %s/4 politiques landing-media', v_n);
  end if;

  -- =================================================================
  -- D. GARDE-FOU — storage_baseline_violations()
  -- =================================================================

  -- D01 : etat nominal, zero violation.
  select count(*) into v_n from private.storage_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    select string_agg(kind || ':' || object_name, ', ') into v_msg
    from private.storage_baseline_violations();
    v_fail := v_fail || format('D01 storage_baseline_violations() = %s ligne(s) : %s', v_n, coalesce(v_msg, ''));
  end if;

  -- D02 : rendre `avatars` public DOIT faire echouer le controle.
  update storage.buckets set public = true where id = 'avatars';
  select count(*) into v_n
  from private.storage_baseline_violations()
  where kind = 'public_bucket' and object_name = 'avatars';
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || text 'D02 avatars rendu public n''est PAS signale par storage_baseline_violations()';
  end if;
  update storage.buckets set public = false where id = 'avatars';

  -- D03 : et refermer `landing-media` doit l'etre aussi. Sans ce controle,
  --       la vitrine perdrait toutes ses images sans aucune erreur en base.
  update storage.buckets set public = false where id = 'landing-media';
  select count(*) into v_n
  from private.storage_baseline_violations()
  where kind = 'landing_media_not_public';
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || text 'D03 landing-media referme n''est PAS signale par storage_baseline_violations()';
  end if;
  update storage.buckets set public = true where id = 'landing-media';

  -- D04 : retour a zero apres retablissement.
  select count(*) into v_n from private.storage_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('D04 %s violation(s) apres retablissement', v_n);
  end if;

  -- D05 : la ligne de base generale reste a zero.
  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    select string_agg(kind || ':' || object_name, ', ') into v_msg
    from private.security_baseline_violations();
    v_fail := v_fail || format('D05 security_baseline_violations() = %s ligne(s) : %s', v_n, coalesce(v_msg, ''));
  end if;

  -- =================================================================
  -- E. PROJECTIONS PUBLIQUES
  -- =================================================================

  -- E01 : un media du bucket public est projete, avec son alternative.
  v_json := private.landing_media(m_pub);
  v_cases := v_cases + 1;
  if v_json is null
     or v_json->>'bucket' <> 'landing-media'
     or coalesce(v_json->>'alt_text', '') = ''
     or (v_json->>'width')::int <> 1440 then
    v_fail := v_fail || format('E01 landing_media() ne projette pas le media public : %s', coalesce(v_json::text, 'NULL'));
  end if;

  -- E02 : un media reste dans `public-assets` n'est PAS projete. Il serait
  --       une image cassee : le bucket est prive.
  v_cases := v_cases + 1;
  if private.landing_media(m_old) is not null then
    v_fail := v_fail || text 'E02 un media de public-assets est projete sur la vitrine';
  end if;

  -- E03 : un media sans alternative textuelle n'est pas projete non plus.
  --       La colonne est NOT NULL ; on force la situation par la seule voie
  --       possible, une suppression logique, qui doit produire le meme
  --       resultat : rien.
  update public.cms_media_assets set deleted_at = now() where id = m_pub;
  v_cases := v_cases + 1;
  if private.landing_media(m_pub) is not null then
    v_fail := v_fail || text 'E03 un media supprime est encore projete';
  end if;
  update public.cms_media_assets set deleted_at = null where id = m_pub;

  -- E04 : la couverture d'actualite est resolue par son chemin.
  v_json := private.landing_media_by_path(c_path_news);
  v_cases := v_cases + 1;
  if v_json is null or v_json->>'path' <> c_path_news then
    v_fail := v_fail || text 'E04 landing_media_by_path() ne resout pas la couverture';
  end if;

  -- E05 : un chemin inconnu de la mediatheque ne produit rien.
  v_cases := v_cases + 1;
  if private.landing_media_by_path('news/2026/08/jamais-importee.webp') is not null
     or private.landing_media_by_path(null) is not null
     or private.landing_media_by_path('') is not null then
    v_fail := v_fail || text 'E05 landing_media_by_path() invente un media';
  end if;

  -- E06 : get_landing_news() descend un media complet, pas un chemin nu.
  v_json := public.get_landing_news(5);
  v_cases := v_cases + 1;
  if jsonb_typeof(v_json) <> 'array' then
    v_fail := v_fail || text 'E06 get_landing_news() ne renvoie pas un tableau';
  else
    select item into v_json
    from jsonb_array_elements(public.get_landing_news(5)) as item
    where item->>'id' = n_one::text;
    if v_json is null then
      v_fail := v_fail || text 'E06 l''actualite de test n''est pas projetee';
    elsif v_json->'image'->>'bucket' <> 'landing-media'
       or coalesce(v_json->'image'->>'alt_text', '') = '' then
      v_fail := v_fail || format('E06 image mal projetee : %s', coalesce(v_json->'image', 'null'::jsonb)::text);
    end if;
  end if;

  -- E07 : la meme actualite, dont la couverture n'est PAS dans la
  --       mediatheque, n'emporte aucune image — et reste projetee.
  update public.news set image_path = 'news/2026/08/hors-mediatheque.webp' where id = n_one;
  select item into v_json
  from jsonb_array_elements(public.get_landing_news(5)) as item
  where item->>'id' = n_one::text;
  v_cases := v_cases + 1;
  if v_json is null then
    v_fail := v_fail || text 'E07 une actualite sans couverture publiable disparait de la vitrine';
  elsif v_json->'image' is not null and jsonb_typeof(v_json->'image') <> 'null' then
    v_fail := v_fail || text 'E07 une couverture absente de la mediatheque est quand meme projetee';
  end if;
  update public.news set image_path = c_path_news where id = n_one;

  -- E08 : D-135 — `avatar_path` a quitte le teaser « ISE du jour ».
  v_cases := v_cases + 1;
  if pg_get_functiondef('public.get_landing_featured_profile()'::regprocedure)
       like '%''avatar_path''%' then
    v_fail := v_fail || text 'E08 get_landing_featured_profile() projette encore avatar_path (D-135)';
  end if;

  -- E09 : les helpers de media restent fermes a anon.
  select count(*) into v_n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'private'
    and p.proname in ('landing_media', 'landing_media_by_path', 'is_landing_media_path')
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('E09 %s helper(s) media executables par anon', v_n);
  end if;

  -- E10 : les dix projections publiques, et elles seules, restent ouvertes
  --       a anon. 0068 n'en a ajoute aucune.
  select count(*) into v_n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname in ('public', 'private')
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');
  v_cases := v_cases + 1;
  if v_n <> 10 then
    v_fail := v_fail || format('E10 %s fonctions exposees a anon au lieu de 10', v_n);
  end if;

  if array_length(v_fail, 1) is null then
    raise exception 'LANDING_MEDIA_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'LANDING_MEDIA_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$lm$;
