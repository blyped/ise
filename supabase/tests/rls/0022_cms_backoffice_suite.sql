-- =====================================================================
-- supabase/tests/rls/0022_cms_backoffice_suite.sql
--
-- Suite NEGATIVE du BACK-OFFICE CMS (ecrans CMS-001 -> CMS-010) et de
-- l'API serveur ajoutee par la migration 0067.
--
-- Elle complete `0021_cms_suite.sql`, qui couvre le modele, les
-- transitions et les automatisations. Celle-ci couvre ce que les ecrans
-- appellent reellement :
--
--   * ADDENDUM §59 — les quatre cas de permission exiges :
--       member    -> CMS interdit
--       editor    -> modifier un brouillon autorise
--       editor    -> publier refuse sans cms.publish
--       publisher -> publier autorise
--   * ADDENDUM §22 — un override de « ISE du jour » est JOURNALISE ;
--   * ADDENDUM §58 — une campagne hors periode n'est pas servie ;
--   * D-128       — la programmation d'une actualite ne touche QUE
--                   `landing_visibility`, jamais `editorial_status` ;
--   * ADDENDUM §38 — un porteur de `cms.media.manage` peut deposer dans
--                   `public-assets` ; un membre ordinaire, non.
--
-- Modele auto-nettoyant, identique a 0021 : bloc DO unique, fixtures,
-- assertions, RAISE EXCEPTION final qui annule toute la transaction.
--
--   succes  ->  ERROR:  P0001: CMS_BO_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: CMS_BO_TESTS_FAILED: N cas, K echec(s)
--
-- La CI doit chercher `CMS_BO_TESTS_OK:` ET `0 echec`, et echouer sur
-- l'absence de l'un des deux.
--
-- DERNIERE EXECUTION SUR LA BASE REELLE (2026-08-08) :
--   ERROR:  P0001: CMS_BO_TESTS_OK: 45 cas, 0 echec
--
-- DEUX DEFAUTS DE CETTE SUITE, TROUVES EN L'EXECUTANT ET CORRIGES ICI
--   1. `text[] || 'litteral'` est ambigu : PostgreSQL resout `array_cat` et
--      tente de caster le litteral en `text[]`. Le message d'echec faisait
--      donc planter la suite AU LIEU d'etre rapporte — exactement au pire
--      moment. Les litteraux sont desormais types (`text '...'`).
--   2. Les verifications sur `news` doivent se faire HORS RLS : un porteur
--      de `cms.publish` ECRIT a travers une fonction SECURITY DEFINER, mais
--      `private.can_see_news()` peut lui refuser la RELECTURE. Verifier sous
--      son identite faisait echouer le test pour une raison etrangere a ce
--      qu'il mesure.
--
-- FIXTURES (D-104)
--   Ada   membre ordinaire, AUCUNE permission CMS
--   Bea   cms_editor    (cms.read, cms.edit, cms.media.manage)
--   Cyp   cms_publisher (les sept permissions CMS)
--   Dia   profil eligible a « ISE du jour »
--   Eve   INELIGIBLE : allow_public_feature = false
--
-- ECART ASSUME SUR D-104 — identique a 0021 et pour la meme raison :
--   `private.featured_profile_eligible()` exclut les comptes de test, donc
--   Dia et Eve sont crees avec `is_test_account = false`. Leurs comptes
--   Auth restent prefixes `test+` et le ROLLBACK final ne laisse rien.
-- =====================================================================

do $cmsbo$
declare
  u_ada uuid := '00000000-0000-4000-8022-000000000001';
  u_bea uuid := '00000000-0000-4000-8022-000000000002';
  u_cyp uuid := '00000000-0000-4000-8022-000000000003';
  u_dia uuid := '00000000-0000-4000-8022-000000000004';
  u_eve uuid := '00000000-0000-4000-8022-000000000005';

  p_ada uuid := '00000000-0000-4000-8022-0000000000a1';
  p_bea uuid := '00000000-0000-4000-8022-0000000000a2';
  p_cyp uuid := '00000000-0000-4000-8022-0000000000a3';
  p_dia uuid := '00000000-0000-4000-8022-0000000000a4';
  p_eve uuid := '00000000-0000-4000-8022-0000000000a5';

  o_org  uuid := '00000000-0000-4000-8022-0000000000b1';
  m_one  uuid := '00000000-0000-4000-8022-0000000000b2';
  s_one  uuid := '00000000-0000-4000-8022-0000000000c1';
  c_live uuid := '00000000-0000-4000-8022-0000000000d1';
  c_soon uuid := '00000000-0000-4000-8022-0000000000d2';
  c_gone uuid := '00000000-0000-4000-8022-0000000000d3';
  n_one  uuid := '00000000-0000-4000-8022-0000000000e1';
  e_one  uuid := '00000000-0000-4000-8022-0000000000f1';

  v_promo    bigint;
  v_category text;
  v_evtype   text;

  v_cases integer := 0;
  v_fail  text[] := array[]::text[];
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_json  jsonb;
  v_txt   text;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id   into v_promo    from public.promotions      order by id   limit 1;
  select code into v_category from public.news_categories order by code limit 1;
  select code into v_evtype   from public.event_types     order by code limit 1;

  -- ---------------- FIXTURES ----------------
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
    ('00000000-0000-0000-0000-000000000000', u_ada, 'authenticated', 'authenticated', 'test+cmsbo.ada@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_bea, 'authenticated', 'authenticated', 'test+cmsbo.bea@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_cyp, 'authenticated', 'authenticated', 'test+cmsbo.cyp@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_dia, 'authenticated', 'authenticated', 'test+cmsbo.dia@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_eve, 'authenticated', 'authenticated', 'test+cmsbo.eve@ise.test', now(), now());

  insert into public.ise_profiles
    (id, user_id, first_name, last_name, promotion_id, profile_status, claim_status, claimed_at,
     is_test_account, current_position, public_summary, allow_public_feature) values
    (p_ada, u_ada, 'Ada', 'Backoffice', v_promo, 'active', 'claimed', now(), true, null, null, false),
    (p_bea, u_bea, 'Bea', 'Backoffice', v_promo, 'active', 'claimed', now(), true, null, null, false),
    (p_cyp, u_cyp, 'Cyp', 'Backoffice', v_promo, 'active', 'claimed', now(), true, null, null, false),
    (p_dia, u_dia, 'Dia', 'Eligible', v_promo, 'active', 'claimed', now(), false, 'Statisticienne principale',
      'Statisticienne principale, elle conduit des enquetes nationales et forme des equipes de terrain.', true),
    (p_eve, u_eve, 'Eve', 'Refusee', v_promo, 'active', 'claimed', now(), false, 'Analyste',
      'Analyste des politiques publiques, elle documente les effets des reformes sur le terrain.', false);

  insert into private.user_roles (profile_id, role_id)
  select p_ada, id from private.roles where code = 'member';
  insert into private.user_roles (profile_id, role_id)
  select p_bea, id from private.roles where code = 'cms_editor';
  insert into private.user_roles (profile_id, role_id)
  select p_cyp, id from private.roles where code = 'cms_publisher';

  insert into public.organizations (id, canonical_name, is_verified)
  values (o_org, 'Organisation partenaire 0022', true);

  insert into public.cms_media_assets (id, storage_path, filename, mime_type, alt_text, created_by_profile_id)
  values (m_one, 'cms/test/0022-visuel.webp', '0022-visuel.webp', 'image/webp',
          'Visuel de test du back-office', p_cyp);

  insert into public.cms_carousel_items (id, title, subtitle, media_id, content_type, priority,
                                         is_sponsored, created_by_profile_id, status)
  values (s_one, 'SLIDE 0022', 'Sous-titre initial', m_one, 'institutional', 10, false, p_cyp, 'draft');

  insert into public.cms_partner_campaigns
    (id, organization_id, campaign_name, placement, title, media_id, cta_label, target_url,
     sponsored_label, start_at, end_at, created_by_profile_id, status)
  values
    (c_live, o_org, 'Campagne 0022 en cours', 'partners_band', 'En diffusion', m_one, 'Decouvrir',
     'https://exemple.test/0022-live', 'Contenu partenaire', now() - interval '1 day', now() + interval '10 day', p_cyp, 'draft'),
    (c_soon, o_org, 'Campagne 0022 a venir', 'partners_band', 'A venir', m_one, 'Decouvrir',
     'https://exemple.test/0022-soon', 'Sponsorise', now() + interval '10 day', now() + interval '20 day', p_cyp, 'draft'),
    (c_gone, o_org, 'Campagne 0022 echue', 'partners_band', 'Terminee', m_one, 'Decouvrir',
     'https://exemple.test/0022-gone', 'Partenaire', now() - interval '10 day', now() - interval '1 day', p_cyp, 'draft');

  -- Une actualite en BROUILLON editorial, masquee de la landing : c'est
  -- exactement le cas ou D-128 doit tenir.
  insert into public.news (id, category_code, title, slug, summary, body, visibility,
                           editorial_status, landing_visibility, landing_priority, is_featured)
  values (n_one, v_category, 'Actualite 0022', 'actualite-0022',
          'Resume public de l''actualite de test du back-office CMS.',
          'CORPS CONFIDENTIEL QUI NE DOIT JAMAIS SORTIR DE list_cms_news.',
          'members', 'draft', 'hidden', 0, false);

  insert into public.events (id, event_type_code, title, slug, organizer_type, organizer_profile_id,
                             format, city, starts_at, timezone, visibility, status,
                             online_url_private, landing_visibility)
  values (e_one, v_evtype, 'Evenement 0022', 'evenement-0022', 'profile', p_cyp,
          'in_person', 'Abidjan', now() + interval '30 day', 'Africa/Abidjan', 'members', 'published',
          'https://secret.test/0022-lien-prive', 'hidden');

  -- =================================================================
  -- A. ADA — membre ordinaire : le CMS lui est INTERDIT (§59)
  -- =================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ada::text, 'role', 'authenticated')::text, true);

  v_json := public.get_my_cms_permissions();
  v_cases := v_cases + 1;
  if jsonb_array_length(v_json) <> 0 then
    v_fail := v_fail || format('A01 un membre ordinaire detient des permissions CMS : %s', v_json);
  end if;

  v_msg := null;
  begin
    perform public.get_cms_dashboard();
    v_ok := false; v_msg := 'tableau de bord lisible sans cms.read';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('A02 ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.list_cms_news(null, 25, 0);
    v_ok := false; v_msg := 'catalogue des actualites lisible sans cms.read';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('A03 ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.list_cms_events(null, 25, 0);
    v_ok := false; v_msg := 'catalogue des evenements lisible sans cms.read';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('A04 ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.get_cms_featured_profile_overview(20);
    v_ok := false; v_msg := 'vue ISE du jour lisible sans cms.read';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('A05 ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.list_cms_featured_profile_candidates(null, 20);
    v_ok := false; v_msg := 'vivier ISE du jour lisible sans cms.featured_profile.manage';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('A06 ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.set_landing_exposure('news', n_one, 'visible', null);
    v_ok := false; v_msg := 'exposition landing modifiee par un membre ordinaire';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('A07 ' || coalesce(v_msg, '')); end if;

  select count(*) into v_n from public.cms_carousel_items;
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('A08 un membre ordinaire voit %s slide(s) de carrousel', v_n);
  end if;

  -- =================================================================
  -- B. BEA — cms_editor : edite, ne publie pas (§59)
  -- =================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bea::text, 'role', 'authenticated')::text, true);

  v_json := public.get_my_cms_permissions();
  v_cases := v_cases + 1;
  if not (v_json @> '["cms.read","cms.edit","cms.media.manage"]'::jsonb
          and jsonb_array_length(v_json) = 3) then
    v_fail := v_fail || format('B01 permissions du cms_editor inattendues : %s', v_json);
  end if;

  update public.cms_carousel_items set subtitle = 'Sous-titre revu' where id = s_one;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('B02 un cms_editor ne peut pas modifier un brouillon (%s ligne(s))', v_n);
  end if;

  v_json := public.get_cms_dashboard();
  v_cases := v_cases + 1;
  if (v_json -> 'carousel' ->> 'total')::int < 1 then
    v_fail := v_fail || format('B03 le tableau de bord ne compte aucune slide : %s', v_json -> 'carousel');
  end if;

  -- Compteurs REELS : le tableau de bord ne fabrique aucune valeur.
  v_cases := v_cases + 1;
  if (v_json -> 'news' ->> 'landing_visible')::int <> 0 then
    v_fail := v_fail || format('B04 landing_visible devrait valoir 0, vaut %s',
                               v_json -> 'news' ->> 'landing_visible');
  end if;

  v_json := public.list_cms_news(null, 50, 0);
  v_txt := v_json::text;
  v_cases := v_cases + 1;
  if position('Actualite 0022' in v_txt) = 0 then
    v_fail := v_fail || text 'B05 list_cms_news ne renvoie pas l''actualite de test';
  end if;
  v_cases := v_cases + 1;
  if position('CORPS CONFIDENTIEL' in v_txt) > 0 then
    v_fail := v_fail || text 'B06 list_cms_news a projete le corps de l''article';
  end if;

  v_json := public.list_cms_events(null, 50, 0);
  v_txt := v_json::text;
  v_cases := v_cases + 1;
  if position('secret.test' in v_txt) > 0 then
    v_fail := v_fail || text 'B07 list_cms_events a projete online_url_private';
  end if;

  v_msg := null;
  begin
    perform public.publish_cms_content('cms_carousel_item', s_one);
    v_ok := false; v_msg := 'un cms_editor a publie sans cms.publish';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('B08 ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    update public.cms_carousel_items set status = 'published' where id = s_one;
    v_ok := false; v_msg := 'statut publie ecrit directement en UPDATE';
  exception when others then v_ok := (sqlerrm = 'invalid_transition');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('B09 ' || coalesce(v_msg, '')); end if;

  -- Exposer sur le web ouvert EST une publication : cms.edit n'y suffit pas.
  v_msg := null;
  begin
    perform public.set_landing_exposure('news', n_one, 'visible', null);
    v_ok := false; v_msg := 'un cms_editor a rendu une actualite visible sans cms.publish';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('B10 ' || coalesce(v_msg, '')); end if;

  -- La priorite editoriale seule, elle, releve bien de cms.edit.
  perform public.set_landing_exposure('news', n_one, null, 40::smallint);

  -- CONSTAT HORS RLS. `news` reste protegee par `private.can_see_news()` :
  -- un porteur de `cms.edit` ECRIT a travers la fonction SECURITY DEFINER,
  -- mais il ne RELIT pas forcement la ligne. Verifier sous son identite
  -- ferait echouer le test pour une raison etrangere a ce qu'il mesure.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select landing_priority into v_n from public.news where id = n_one;
  v_cases := v_cases + 1;
  if v_n <> 40 then
    v_fail := v_fail || format('B11 la priorite editoriale n''a pas ete ecrite (%s)', v_n);
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bea::text, 'role', 'authenticated')::text, true);

  v_msg := null;
  begin
    perform public.set_news_featured(n_one, true);
    v_ok := false; v_msg := 'un cms_editor a mis une actualite a la une';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('B12 ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.override_featured_profile(p_dia, now(), null, 'test');
    v_ok := false; v_msg := 'un cms_editor a force un ISE du jour';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('B13 ' || coalesce(v_msg, '')); end if;

  -- =================================================================
  -- C. CYP — cms_publisher : les chemins legitimes (§59)
  -- =================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_cyp::text, 'role', 'authenticated')::text, true);

  v_json := public.get_my_cms_permissions();
  v_cases := v_cases + 1;
  if jsonb_array_length(v_json) <> 7 then
    v_fail := v_fail || format('C01 le cms_publisher devrait detenir 7 permissions, il en a %s',
                               jsonb_array_length(v_json));
  end if;

  perform public.publish_cms_content('cms_carousel_item', s_one);
  select count(*) into v_n from public.cms_carousel_items
   where id = s_one and status = 'published' and published_snapshot is not null;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || text 'C02 un cms_publisher n''a pas pu publier une slide'; end if;

  perform public.publish_cms_content('cms_partner_campaign', c_live);
  perform public.publish_cms_content('cms_partner_campaign', c_soon);
  perform public.publish_cms_content('cms_partner_campaign', c_gone);

  perform public.set_landing_exposure('news', n_one, 'visible', null);
  perform public.set_news_featured(n_one, true);

  -- CONSTAT HORS RLS, pour la meme raison qu'en B11.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from public.news where id = n_one and landing_visibility = 'visible';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || text 'C03 un cms_publisher n''a pas pu exposer une actualite'; end if;

  -- D-128 : l'exposition landing ne touche PAS le circuit editorial.
  select editorial_status into v_txt from public.news where id = n_one;
  v_cases := v_cases + 1;
  if v_txt <> 'draft' then
    v_fail := v_fail || format('C04 set_landing_exposure a modifie editorial_status (%s)', v_txt);
  end if;

  select count(*) into v_n from public.news
   where id = n_one and is_featured and featured_at is not null;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || text 'C05 la mise a la une n''a pas ete enregistree'; end if;

  select count(*) into v_n from private.audit_log
   where action = 'cms.landing_exposure' and object_id = n_one::text and actor_profile_id = p_cyp;
  v_cases := v_cases + 1;
  if v_n < 1 then
    v_fail := v_fail || text 'C06 l''exposition sur la landing n''a pas ete journalisee avec son acteur';
  end if;

  -- =================================================================
  -- D. ISE DU JOUR — l'override est AUDITABLE (§22)
  -- =================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_cyp::text, 'role', 'authenticated')::text, true);

  v_json := public.override_featured_profile(p_dia, now(), now() + interval '2 day',
                                             'Mise en avant editoriale de test 0022');
  v_cases := v_cases + 1;
  if v_json ->> 'profile_id' <> p_dia::text then
    v_fail := v_fail || format('D01 l''override n''a pas retenu le profil demande : %s', v_json);
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.audit_log
   where action = 'cms.featured_profile.override'
     and object_id = p_dia::text
     and actor_profile_id = p_cyp
     and context ->> 'reason' = 'Mise en avant editoriale de test 0022';
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('D02 l''override ISE du jour n''est pas journalise (%s ligne(s))', v_n);
  end if;

  -- Un profil sans consentement est refuse, meme par un override.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_cyp::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform public.override_featured_profile(p_eve, now(), null, 'test');
    v_ok := false; v_msg := 'un profil sans consentement a ete force en ISE du jour';
  exception when others then v_ok := (sqlerrm = 'profile_not_eligible');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('D03 ' || coalesce(v_msg, '')); end if;

  -- L'historique n'est ecrivable par AUCUN client : la piste d'audit tient
  -- parce que la table n'a pas de politique d'ecriture, pas parce que
  -- l'application se retient.
  -- La table n'a AUCUNE politique d'ecriture : l'insertion est REFUSEE, elle
  -- n'est pas silencieusement ignoree. C'est ce refus bruyant qu'on mesure.
  v_msg := null;
  begin
    insert into public.cms_featured_profile_history
      (profile_id, featured_date, selection_mode, status, published_at)
    values (p_dia, (now() at time zone 'utc')::date + 40, 'automatic', 'published', now());
    v_ok := false; v_msg := 'l''historique ISE du jour est ecrivable directement';
  exception when others then v_ok := (sqlstate = '42501');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('D04 ' || coalesce(v_msg, '')); end if;

  v_json := public.get_cms_featured_profile_overview(20);
  v_txt := v_json::text;
  v_cases := v_cases + 1;
  if position('test+cmsbo' in v_txt) > 0 then
    v_fail := v_fail || text 'D05 la vue ISE du jour projette une adresse e-mail';
  end if;
  v_cases := v_cases + 1;
  if position('"reason": "Mise en avant editoriale de test 0022"' in v_txt) = 0
     and position('Mise en avant editoriale de test 0022' in v_txt) = 0 then
    v_fail := v_fail || text 'D06 la vue ISE du jour ne montre pas l''override et son motif';
  end if;

  -- =================================================================
  -- E. PARTENAIRES — une campagne hors periode n'est pas servie (§58)
  -- =================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  v_json := public.get_landing_partners('partners_band');
  v_txt := v_json::text;

  v_cases := v_cases + 1;
  if position(c_live::text in v_txt) = 0 then
    v_fail := v_fail || text 'E01 la campagne en cours n''est pas servie';
  end if;
  v_cases := v_cases + 1;
  if position(c_soon::text in v_txt) > 0 then
    v_fail := v_fail || text 'E02 une campagne FUTURE est servie';
  end if;
  v_cases := v_cases + 1;
  if position(c_gone::text in v_txt) > 0 then
    v_fail := v_fail || text 'E03 une campagne ECHUE est servie';
  end if;
  v_cases := v_cases + 1;
  if position('Contenu partenaire' in v_txt) = 0 then
    v_fail := v_fail || text 'E04 la mention de transparence est absente de la projection publique';
  end if;

  -- =================================================================
  -- F. MEDIATHEQUE — le bucket public-assets s'ouvre a cms.media.manage
  -- =================================================================
  v_cases := v_cases + 1;
  select count(*) into v_n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'ise_public_assets_cms_write';
  if v_n <> 1 then
    v_fail := v_fail || text 'F01 la politique ise_public_assets_cms_write est absente';
  end if;

  -- La politique d'origine (0027) n'a pas ete touchee.
  v_cases := v_cases + 1;
  select count(*) into v_n from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'ise_public_assets_write';
  if v_n <> 1 then
    v_fail := v_fail || text 'F02 la politique historique ise_public_assets_write a disparu';
  end if;

  -- Bea porte cms.media.manage : le predicat de la politique est vrai pour elle.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bea::text, 'role', 'authenticated')::text, true);
  v_ok := private.has_permission('cms.media.manage');
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || text 'F03 le cms_editor ne porte pas cms.media.manage'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ada::text, 'role', 'authenticated')::text, true);
  v_ok := private.has_permission('cms.media.manage');
  v_cases := v_cases + 1;
  if v_ok then v_fail := v_fail || text 'F04 un membre ordinaire porte cms.media.manage'; end if;

  -- Le media exige un texte alternatif : c'est une contrainte de schema.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bea::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    insert into public.cms_media_assets (storage_path, filename, mime_type, alt_text)
    values ('cms/test/0022-sans-alt.webp', 'sans-alt.webp', 'image/webp', '  ');
    v_ok := false; v_msg := 'un media sans texte alternatif a ete accepte';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1; if not v_ok then v_fail := v_fail || text ('F05 ' || coalesce(v_msg, '')); end if;

  -- =================================================================
  -- G. LIGNE DE BASE DE SECURITE
  -- =================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('G01 security_baseline_violations() renvoie %s ligne(s)', v_n);
  end if;

  -- Les huit fonctions de 0067 ne sont pas exposees a `anon`.
  select count(*) into v_n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('get_my_cms_permissions', 'list_cms_news', 'list_cms_events',
                      'set_landing_exposure', 'set_news_featured', 'get_cms_dashboard',
                      'get_cms_featured_profile_overview', 'list_cms_featured_profile_candidates')
    and has_function_privilege('anon', p.oid, 'execute');
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('G02 %s fonction(s) du back-office CMS sont exposees a anon', v_n);
  end if;

  -- Les huit sont bien executables par `authenticated`.
  select count(*) into v_n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('get_my_cms_permissions', 'list_cms_news', 'list_cms_events',
                      'set_landing_exposure', 'set_news_featured', 'get_cms_dashboard',
                      'get_cms_featured_profile_overview', 'list_cms_featured_profile_candidates')
    and has_function_privilege('authenticated', p.oid, 'execute');
  v_cases := v_cases + 1;
  if v_n <> 8 then
    v_fail := v_fail || format('G03 seules %s fonctions sur 8 sont executables par authenticated', v_n);
  end if;

  if array_length(v_fail, 1) is null then
    raise exception 'CMS_BO_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'CMS_BO_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$cmsbo$;
