-- =====================================================================
-- supabase/tests/rls/0040_public_photo_consent_suite.sql
--
-- Suite NEGATIVE du consentement de publication de photo et du medaillon
-- « ISE du jour » (migration 0120, revision de D-135).
--
-- CE QUI EST VERIFIE, ET POURQUOI
--   * la photo n'est PAS projetee sans le consentement dedie
--     `allow_public_photo` — c'est tout l'objet de la revision : le
--     consentement textuel `allow_public_feature` ne suffit pas ;
--   * elle EST projetee quand le consentement est donne ;
--   * elle est RETIREE des la revocation, et l'objet Storage disparait
--     avec elle : pas de photo orpheline qui survit au retrait ;
--   * elle est retiree de meme a la suppression du compte (D-19) ;
--   * le visuel editorial de l'admin (D-165) reste PRIORITAIRE ;
--   * un profil sans breve description n'est pas eligible ;
--   * un membre ne peut deposer que sous SON prefixe, et seulement s'il a
--     consenti ;
--   * `avatar_path` reste absent du teaser (D-135, partie non revisee).
--
-- Modele auto-nettoyant : bloc DO unique, fixtures, assertions,
-- RAISE EXCEPTION final qui annule toute la transaction.
--
--   succes  ->  ERROR:  P0001: PUBLIC_PHOTO_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: PUBLIC_PHOTO_TESTS_FAILED: N cas, K echec(s)
--
-- DERNIERE EXECUTION SUR LA BASE REELLE (2026-08-14, apres 0120) :
--   ERROR:  P0001: PUBLIC_PHOTO_TESTS_OK: 31 cas, 0 echec
--
-- ECART ASSUME SUR D-104 (identique a 0021)
--   Les profils candidats sont crees avec `is_test_account = false` : le
--   predicat d'eligibilite exclut les comptes de test, et il faut donc des
--   profils « reels » pour eprouver la projection. Leurs comptes Auth
--   restent prefixes `test+`, et le ROLLBACK final garantit qu'aucune ligne
--   ne subsiste.
--
-- FIXTURES
--   Nia   consentement photo DONNE, portrait depose, breve description
--   Omar  consentement photo DONNE, portrait depose (sert au cas D-19)
--   Pau   consentement de parution donne, AUCUNE breve description
-- =====================================================================

do $photo$
declare
  u_nia uuid := '00000000-0000-4000-8040-000000000001';
  u_oma uuid := '00000000-0000-4000-8040-000000000002';
  u_pau uuid := '00000000-0000-4000-8040-000000000003';

  p_nia uuid := '00000000-0000-4000-8040-0000000000a1';
  p_oma uuid := '00000000-0000-4000-8040-0000000000a2';
  p_pau uuid := '00000000-0000-4000-8040-0000000000a3';

  m_edi uuid := '00000000-0000-4000-8040-0000000000b1';

  path_nia text := 'membres/00000000-0000-4000-8040-0000000000a1/portrait-nia.webp';
  path_oma text := 'membres/00000000-0000-4000-8040-0000000000a2/portrait-oma.webp';

  v_promo   bigint;
  v_today   date := (now() at time zone 'utc')::date;

  v_cases integer := 0;
  v_fail  text[] := array[]::text[];
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_json  jsonb;
begin
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  select id into v_promo from public.promotions order by id limit 1;

  -- La selection courante du jour est neutralisee : la suite pilote
  -- elle-meme qui est « ISE du jour ». Tout est annule au ROLLBACK.
  delete from public.cms_featured_profile_history where featured_date >= v_today - 1;

  -- ---------------- FIXTURES ----------------
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_nia,'authenticated','authenticated','test+photo.nia@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_oma,'authenticated','authenticated','test+photo.oma@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_pau,'authenticated','authenticated','test+photo.pau@ise.test',now(),now());

  insert into public.ise_profiles
    (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,
     is_test_account,current_position,public_summary,allow_public_feature,avatar_path,
     allow_public_photo,public_photo_path,public_photo_alt,public_photo_width,public_photo_height)
  values
    -- `avatar_path` est renseigne parce que la regle active exige
    -- `require_avatar`. C'est un chemin du bucket PRIVE `avatars` : les
    -- controles B05/B06 verifient qu'il ne ressort JAMAIS de la projection.
    (p_nia,u_nia,'Nia','Photo',v_promo,'active','claimed',now(),false,'Statisticienne',
     'Statisticienne, elle conduit des enquetes nationales et forme des equipes de terrain.',
     true, p_nia::text || '/avatar-prive.webp',
     true, path_nia, 'Portrait de Nia Photo', 512, 512),
    (p_oma,u_oma,'Omar','Photo',v_promo,'active','claimed',now(),false,'Economiste',
     'Economiste, il modelise les comptes nationaux et accompagne les politiques publiques.',
     true, p_oma::text || '/avatar-prive.webp',
     true, path_oma, 'Portrait d''Omar Photo', 512, 512),
    -- Pau n'a AUCUNE breve description. Le cas « description faite
    -- d'espaces » n'est volontairement pas teste ici : la contrainte
    -- `ise_profiles_public_summary_length` (0057) l'interdit deja a
    -- l'insertion. La condition de non-vacuite ajoutee par 0120 au predicat
    -- d'eligibilite est une ceinture, pas une regle nouvelle.
    (p_pau,u_pau,'Pau','Vide',v_promo,'active','claimed',now(),false,'Analyste',
     null, true, p_pau::text || '/avatar-prive.webp', false, null, null, null, null);

  -- Les deux fichiers existent REELLEMENT dans le bucket public : la
  -- projection refuse un chemin qui ne correspond a aucun objet.
  insert into storage.objects (bucket_id,name,metadata) values
    ('landing-media', path_nia, jsonb_build_object('mimetype','image/webp','size',1024)),
    ('landing-media', path_oma, jsonb_build_object('mimetype','image/webp','size',1024));

  -- Visuel editorial de l'admin (D-165), pour eprouver la priorite.
  insert into public.cms_media_assets (id,storage_path,filename,mime_type,alt_text)
  values (m_edi,'sections/2026/08/0040-editorial.webp','0040-editorial.webp','image/webp',
          'Visuel editorial de test');
  insert into storage.objects (bucket_id,name,metadata) values
    ('landing-media','sections/2026/08/0040-editorial.webp',
     jsonb_build_object('mimetype','image/webp','size',2048));

  -- =================================================================
  -- A. PROJECTION DU PORTRAIT — le consentement, et rien d'autre
  -- =================================================================
  -- A01 — DEFENSE EN PROFONDEUR. L'etat « un chemin de portrait subsiste
  -- alors que le consentement est retire » est normalement IMPOSSIBLE : le
  -- declencheur du §4 de 0120 le detruit a l'ecriture. On le fabrique ici en
  -- desactivant momentanement ce declencheur, pour prouver que la
  -- PROJECTION refuse quand meme de servir la photo. Les deux gardes sont
  -- independantes ; il en faut deux.
  alter table public.ise_profiles disable trigger ise_profiles_public_photo_guard;
  update public.ise_profiles set allow_public_photo = false where id = p_oma;
  alter table public.ise_profiles enable trigger ise_profiles_public_photo_guard;

  v_cases:=v_cases+1;
  if private.landing_member_photo(p_oma) is not null then
    v_fail:=v_fail||('A01 un portrait est projete SANS le consentement allow_public_photo')::text;
  end if;

  alter table public.ise_profiles disable trigger ise_profiles_public_photo_guard;
  update public.ise_profiles set allow_public_photo = true where id = p_oma;
  alter table public.ise_profiles enable trigger ise_profiles_public_photo_guard;

  v_json := private.landing_member_photo(p_nia);
  v_cases:=v_cases+1;
  if v_json is null then
    v_fail:=v_fail||('A02 aucun portrait projete alors que le consentement est donne')::text;
  end if;
  v_cases:=v_cases+1;
  if coalesce(v_json->>'bucket','') <> 'landing-media' then
    v_fail:=v_fail||format('A03 le portrait n''est pas servi depuis le bucket public (%s)',v_json->>'bucket');
  end if;
  v_cases:=v_cases+1;
  if coalesce(v_json->>'path','') <> path_nia then
    v_fail:=v_fail||format('A04 chemin de portrait inattendu (%s)',v_json->>'path');
  end if;
  v_cases:=v_cases+1;
  if char_length(btrim(coalesce(v_json->>'alt_text',''))) < 3 then
    v_fail:=v_fail||('A05 le portrait est projete sans alternative textuelle exploitable')::text;
  end if;

  -- Un fichier absent du bucket ne doit pas produire une image cassee.
  -- `storage.protect_delete()` interdit le DELETE direct : le reglage local
  -- ci-dessous est le meme que celui pose par private.purge_member_public_photo().
  perform set_config('storage.allow_delete_query','true',true);
  delete from storage.objects where bucket_id='landing-media' and name=path_nia;
  perform set_config('storage.allow_delete_query','false',true);
  v_cases:=v_cases+1;
  if private.landing_member_photo(p_nia) is not null then
    v_fail:=v_fail||('A06 un portrait est projete alors que le fichier n''existe plus')::text;
  end if;
  insert into storage.objects (bucket_id,name,metadata)
  values ('landing-media', path_nia, jsonb_build_object('mimetype','image/webp','size',1024));

  -- =================================================================
  -- B. LE TEASER « ISE DU JOUR » PORTE LE MEDAILLON
  -- =================================================================
  insert into public.cms_featured_profile_history
    (profile_id,featured_date,selection_mode,status,published_at)
  values (p_nia, v_today, 'automatic', 'published', now());

  v_json := public.get_landing_featured_profile();
  v_cases:=v_cases+1;
  if v_json is null then
    v_fail:=v_fail||('B01 le teaser est vide alors qu''une mise en avant est publiee')::text;
  end if;
  v_cases:=v_cases+1;
  if v_json is not null and (v_json->>'profile_id')::uuid is distinct from p_nia then
    v_fail:=v_fail||format('B02 le teaser porte un autre profil (%s)',v_json->>'profile_id');
  end if;
  v_cases:=v_cases+1;
  if v_json is not null and (v_json->'photo' is null or v_json->'photo' = 'null'::jsonb) then
    v_fail:=v_fail||('B03 le teaser ne porte AUCUNE photo alors que le consentement est donne')::text;
  end if;
  v_cases:=v_cases+1;
  if v_json is not null and coalesce(v_json->'photo'->>'path','') <> path_nia then
    v_fail:=v_fail||format('B04 la photo du teaser n''est pas le portrait consenti (%s)',
                           v_json->'photo'->>'path');
  end if;
  v_cases:=v_cases+1;
  if v_json is not null and v_json ? 'avatar_path' then
    v_fail:=v_fail||('B05 le teaser projette avatar_path (D-135, partie non revisee)')::text;
  end if;
  v_cases:=v_cases+1;
  -- Le chemin d'avatar des fixtures est `<profile_id>/avatar-prive.webp` :
  -- on cherche ce marqueur, pas le nom du bucket, qui n'apparait pas dans
  -- un chemin d'objet.
  if v_json is not null and v_json::text like '%avatar-prive%' then
    v_fail:=v_fail||('B06 un chemin du bucket prive `avatars` apparait dans le teaser')::text;
  end if;

  -- =================================================================
  -- C. PRIORITE DU VISUEL EDITORIAL (D-165)
  -- =================================================================
  update public.cms_featured_profile_history
     set showcase_media_id = m_edi
   where profile_id = p_nia and featured_date = v_today;

  v_json := public.get_landing_featured_profile();
  v_cases:=v_cases+1;
  if v_json is not null
     and coalesce(v_json->'photo'->>'path','') <> 'sections/2026/08/0040-editorial.webp' then
    v_fail:=v_fail||format('C01 le visuel editorial de l''admin n''est pas prioritaire (%s)',
                           v_json->'photo'->>'path');
  end if;

  update public.cms_featured_profile_history
     set showcase_media_id = null
   where profile_id = p_nia and featured_date = v_today;

  -- =================================================================
  -- D. REVOCATION — la photo part, l'objet aussi
  -- =================================================================
  update public.ise_profiles set allow_public_photo = false where id = p_nia;

  v_cases:=v_cases+1;
  select count(*) into v_n from public.ise_profiles
   where id = p_nia and public_photo_path is not null;
  if v_n <> 0 then
    v_fail:=v_fail||('D01 le chemin du portrait survit a la revocation du consentement')::text;
  end if;

  v_cases:=v_cases+1;
  select count(*) into v_n from storage.objects
   where bucket_id='landing-media' and name = path_nia;
  if v_n <> 0 then
    v_fail:=v_fail||('D02 l''objet Storage survit a la revocation : photo orpheline servie publiquement')::text;
  end if;

  v_cases:=v_cases+1;
  if private.landing_member_photo(p_nia) is not null then
    v_fail:=v_fail||('D03 la projection renvoie encore un portrait apres revocation')::text;
  end if;

  v_json := public.get_landing_featured_profile();
  v_cases:=v_cases+1;
  if v_json is not null and v_json->'photo' is not null and v_json->'photo' <> 'null'::jsonb then
    v_fail:=v_fail||format('D04 le teaser porte encore une photo apres revocation (%s)',
                           v_json->'photo'::text);
  end if;

  -- =================================================================
  -- E. SUPPRESSION DE COMPTE (D-19 : user_id -> NULL)
  -- =================================================================
  -- D-19 : la suppression de compte detache le profil de son compte Auth.
  -- `ise_profiles_claim_coherence` impose de retirer aussi la reclamation.
  update public.ise_profiles
     set user_id = null, claim_status = 'unclaimed', claimed_at = null
   where id = p_oma;

  v_cases:=v_cases+1;
  select count(*) into v_n from public.ise_profiles
   where id = p_oma and public_photo_path is not null;
  if v_n <> 0 then
    v_fail:=v_fail||('E01 le portrait survit a la suppression du compte (D-19)')::text;
  end if;

  v_cases:=v_cases+1;
  select count(*) into v_n from storage.objects
   where bucket_id='landing-media' and name = path_oma;
  if v_n <> 0 then
    v_fail:=v_fail||('E02 l''objet Storage survit a la suppression du compte')::text;
  end if;

  -- =================================================================
  -- F. ELIGIBILITE — « toutes les zones necessaires sont remplies »
  -- =================================================================
  v_cases:=v_cases+1;
  if private.featured_profile_eligible(p_pau, v_today) then
    v_fail:=v_fail||('F01 un profil SANS breve description est declare eligible')::text;
  end if;

  update public.ise_profiles
     set public_summary = 'Analyste des politiques publiques, elle documente les effets des reformes.'
   where id = p_pau;
  v_cases:=v_cases+1;
  if not private.featured_profile_eligible(p_pau, v_today) then
    v_fail:=v_fail||('F02 un profil complet n''est pas declare eligible : la regle est trop stricte')::text;
  end if;

  update public.ise_profiles set allow_public_feature = false where id = p_pau;
  v_cases:=v_cases+1;
  if private.featured_profile_eligible(p_pau, v_today) then
    v_fail:=v_fail||('F03 un profil sans consentement de parution est declare eligible')::text;
  end if;
  update public.ise_profiles set allow_public_feature = true where id = p_pau;

  -- =================================================================
  -- G. DEPOT DANS LE BUCKET PUBLIC — chacun chez soi, et avec accord
  -- =================================================================
  update public.ise_profiles set allow_public_photo = true where id = p_pau;

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub',u_pau::text,'role','authenticated')::text,true);

  -- G01 : le prefixe d'un AUTRE membre est refuse.
  v_msg:=null;
  begin
    insert into storage.objects (bucket_id,name,metadata)
    values ('landing-media', 'membres/' || p_nia::text || '/vol.webp',
            jsonb_build_object('mimetype','image/webp','size',10));
    v_ok:=false; v_msg:='depot accepte sous le prefixe d''un autre membre';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G01 '||coalesce(v_msg,'')); end if;

  -- G02 : un prefixe inconnu du bucket est refuse.
  v_msg:=null;
  begin
    insert into storage.objects (bucket_id,name,metadata)
    values ('landing-media', 'ailleurs/' || p_pau::text || '/hors-usage.webp',
            jsonb_build_object('mimetype','image/webp','size',10));
    v_ok:=false; v_msg:='depot accepte hors des prefixes d''usage du bucket';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G02 '||coalesce(v_msg,'')); end if;

  -- G03 : enregistrer un chemin dont l'objet n'existe pas est refuse.
  v_msg:=null;
  begin
    perform public.set_my_public_photo(
      'membres/' || p_pau::text || '/fantome.webp', 'Portrait de Pau Vide', 512, 512);
    v_ok:=false; v_msg:='un chemin sans fichier a ete enregistre';
  exception when others then v_ok:=(sqlerrm='object_not_found');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G03 '||coalesce(v_msg,'')); end if;

  -- G04 : sans texte alternatif, pas d'enregistrement.
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);
  insert into storage.objects (bucket_id,name,metadata)
  values ('landing-media', 'membres/' || p_pau::text || '/portrait-pau.webp',
          jsonb_build_object('mimetype','image/webp','size',1024));
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub',u_pau::text,'role','authenticated')::text,true);

  v_msg:=null;
  begin
    perform public.set_my_public_photo(
      'membres/' || p_pau::text || '/portrait-pau.webp', '  ', 512, 512);
    v_ok:=false; v_msg:='un portrait a ete enregistre sans alternative textuelle';
  exception when others then v_ok:=(sqlerrm='invalid_alt_text');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G04 '||coalesce(v_msg,'')); end if;

  -- G05 : le chemin nominal fonctionne.
  v_msg:=null;
  begin
    perform public.set_my_public_photo(
      'membres/' || p_pau::text || '/portrait-pau.webp', 'Portrait de Pau Vide', 512, 512);
    v_ok:=true;
  exception when others then v_ok:=false; v_msg:='enregistrement legitime refuse : '||sqlerrm; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G05 '||coalesce(v_msg,'')); end if;

  -- G06 : le retrait volontaire remet tout a zero.
  perform public.clear_my_public_photo();
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  v_cases:=v_cases+1;
  select count(*) into v_n from public.ise_profiles
   where id = p_pau and public_photo_path is not null;
  if v_n <> 0 then v_fail:=v_fail||('G06 le retrait volontaire laisse le chemin en place')::text; end if;

  v_cases:=v_cases+1;
  select count(*) into v_n from storage.objects
   where bucket_id='landing-media' and name like 'membres/' || p_pau::text || '/%';
  if v_n <> 0 then v_fail:=v_fail||('G07 le retrait volontaire laisse l''objet dans le bucket public')::text; end if;

  -- =================================================================
  -- H. LIGNES DE BASE DE SECURITE
  -- =================================================================
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('H01 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  select count(*) into v_n from private.storage_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('H02 storage_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'PUBLIC_PHOTO_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PUBLIC_PHOTO_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$photo$;
