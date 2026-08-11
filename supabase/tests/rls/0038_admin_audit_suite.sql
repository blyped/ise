-- 0038_admin_audit_suite.sql
-- SA-049/050 : journal d'audit (lecture seule) — permission audit.read,
-- filtres (acteur, action, type d'objet, resultat, periode), pagination
-- par curseur composite (created_at, id), auto-journalisation exclue de
-- ses propres resultats, detail d'une entree (et sa propre
-- journalisation, "audit.entry_read"), vue d'ensemble (facettes reelles).
-- Fonctions testees : public.admin_read_audit_log, public.admin_get_audit_entry,
-- public.admin_audit_overview (0083, deja en base — aucune nouvelle logique
-- d'ecriture, lecture seule absolue).
-- succes -> ERROR: P0001: SA049_050_TESTS_OK: N cas, 0 echec

do $sa049050$
declare
  v_admin_auth uuid := '28708d27-78f4-4bc9-bdb3-ead2ce5e5612'; -- bootstrap admin (blyped@gmail.com)
  v_admin_profile uuid;
  u_member uuid := '00000000-0000-4000-9049-000000000002';
  v_member_profile uuid;
  v_promo_id bigint;
  v_bogus bigint := 999999999;
  v_test_start timestamptz := clock_timestamp();
  v_entry1 bigint;
  v_entry2 bigint;
  v_fail text[] := array[]::text[];
  v_cases integer := 0;
  v_n bigint;
  v_n1 bigint;
  v_n2 bigint;
  v_id bigint;
  v_created timestamptz;
  v_id2 bigint;
  v_json jsonb;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email) values (u_member, 'sa049-member@example.test')
    on conflict (id) do nothing;

  insert into public.promotions (name, graduation_year, status) values ('Promo Test Audit RLS', 2098, 'active')
  returning id into v_promo_id;

  insert into public.ise_profiles (promotion_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status, user_id, claimed_at)
  values (v_promo_id, 'Membre', 'Ordinaire', 'graduate', 'active', 'claimed', 'unverified', u_member, now()) returning id into v_member_profile;

  -- ===== 0. Non authentifie =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.admin_audit_overview();
    v_fail := v_fail || 'S00 vue d''ensemble accessible sans authentification'::text;
  exception when others then
    if sqlerrm <> 'not_authenticated' then v_fail := v_fail || ('S00 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 1. Membre ordinaire, sans audit.read =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_member::text, 'role', 'authenticated')::text, true);

  begin
    perform count(*) from public.admin_read_audit_log(p_limit => 10);
    v_fail := v_fail || 'S01 journal accessible sans audit.read'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S01 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_get_audit_entry(v_bogus);
    v_fail := v_fail || 'S02 detail d''entree accessible sans audit.read'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S02 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_audit_overview();
    v_fail := v_fail || 'S03 vue d''ensemble accessible sans audit.read'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S03 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 2. Jeu de donnees deterministe (deux entrees de test) =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select private.current_profile_id() into v_admin_profile; -- null cote postgres, recalcule plus bas

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);
  select private.current_profile_id() into v_admin_profile;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into private.audit_log (actor_kind, actor_user_id, actor_profile_id, action, object_type, object_id, result, context, created_at)
  values ('user', v_admin_auth, v_admin_profile, 'sa049.test_action', 'sa049_test_object', 'obj-1', 'success', '{}'::jsonb, now() - interval '2 minutes')
  returning id into v_entry1;

  insert into private.audit_log (actor_kind, actor_user_id, actor_profile_id, action, object_type, object_id, result, context, created_at)
  values ('user', v_admin_auth, v_admin_profile, 'sa049.test_action_failed', 'sa049_test_object', 'obj-2', 'failure', '{}'::jsonb, now() - interval '1 minute')
  returning id into v_entry2;

  -- ===== 3. Cote admin (bootstrap admin reel) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);

  -- S04 : filtre par type d'objet retrouve exactement les deux entrees.
  select count(*) into v_n from public.admin_read_audit_log(p_object_type => 'sa049_test_object', p_limit => 50);
  v_cases := v_cases + 1;
  if v_n <> 2 then v_fail := v_fail || ('S04 filtre object_type : ' || v_n || ' ligne(s) au lieu de 2')::text; end if;

  -- S05 : filtre par resultat ('failure') ne retrouve que la seconde.
  select count(*) into v_n from public.admin_read_audit_log(p_object_type => 'sa049_test_object', p_result => 'failure', p_limit => 50);
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || ('S05 filtre result : ' || v_n || ' ligne(s) au lieu de 1')::text; end if;

  -- S06 : filtre par action exacte ne retrouve que la premiere.
  select count(*) into v_n from public.admin_read_audit_log(p_action => 'sa049.test_action', p_limit => 50);
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || ('S06 filtre action : ' || v_n || ' ligne(s) au lieu de 1')::text; end if;

  -- S07 : filtre par acteur (profil admin) retrouve les deux.
  select count(*) into v_n from public.admin_read_audit_log(p_actor_profile_id => v_admin_profile, p_object_type => 'sa049_test_object', p_limit => 50);
  v_cases := v_cases + 1;
  if v_n <> 2 then v_fail := v_fail || ('S07 filtre acteur : ' || v_n || ' ligne(s) au lieu de 2')::text; end if;

  -- S08 : periode englobant les deux entrees retrouve deux lignes.
  select count(*) into v_n from public.admin_read_audit_log(
    p_object_type => 'sa049_test_object', p_from => now() - interval '10 minutes', p_to => now(), p_limit => 50);
  v_cases := v_cases + 1;
  if v_n <> 2 then v_fail := v_fail || ('S08 filtre periode (large) : ' || v_n || ' ligne(s) au lieu de 2')::text; end if;

  -- S09 : periode strictement posterieure aux deux entrees ne retrouve rien.
  select count(*) into v_n from public.admin_read_audit_log(
    p_object_type => 'sa049_test_object', p_from => now() + interval '1 minute', p_limit => 50);
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || ('S09 filtre periode (future) : ' || v_n || ' ligne(s) au lieu de 0')::text; end if;

  -- S10 : pagination — premiere page (1 ligne) = l'entree la plus recente.
  select id, created_at into v_id, v_created from public.admin_read_audit_log(p_object_type => 'sa049_test_object', p_limit => 1);
  v_cases := v_cases + 1;
  if v_id <> v_entry2 then v_fail := v_fail || ('S10 pagination page 1 : id ' || coalesce(v_id::text, 'NULL') || ' au lieu de ' || v_entry2)::text; end if;

  -- S11 : page suivante (curseur composite) = l'entree la plus ancienne.
  select id into v_id2 from public.admin_read_audit_log(
    p_object_type => 'sa049_test_object', p_limit => 1, p_before_created => v_created, p_before_id => v_id);
  v_cases := v_cases + 1;
  if v_id2 <> v_entry1 then v_fail := v_fail || ('S11 pagination page 2 : id ' || coalesce(v_id2::text, 'NULL') || ' au lieu de ' || v_entry1)::text; end if;

  -- S12 : auto-journalisation — chaque appel journalise sa propre lecture
  -- ('audit.read') SANS l'inclure dans ses propres resultats : deux appels
  -- successifs sur le meme filtre voient le compte augmenter de 1 (la
  -- lecture precedente devient visible, la lecture courante reste exclue).
  select count(*) into v_n1 from public.admin_read_audit_log(p_action => 'audit.read', p_actor_profile_id => v_admin_profile, p_limit => 1000);
  select count(*) into v_n2 from public.admin_read_audit_log(p_action => 'audit.read', p_actor_profile_id => v_admin_profile, p_limit => 1000);
  v_cases := v_cases + 1;
  if v_n2 <> v_n1 + 1 then
    v_fail := v_fail || ('S12 auto-journalisation : n2=' || v_n2 || ' attendu n1+1=' || (v_n1 + 1))::text;
  end if;

  -- S13 : detail d'une entree — contenu correct.
  select public.admin_get_audit_entry(v_entry1) into v_json;
  v_cases := v_cases + 1;
  if (v_json->>'id')::bigint <> v_entry1
     or (v_json->>'action') <> 'sa049.test_action'
     or (v_json->>'object_type') <> 'sa049_test_object' then
    v_fail := v_fail || 'S13 detail d''entree : contenu incorrect'::text;
  end if;

  -- S14 : la consultation du detail journalise 'audit.entry_read' avec
  -- object_id = l'identifiant consulte.
  select count(*) into v_n from public.admin_read_audit_log(
    p_action => 'audit.entry_read', p_object_type => 'audit_log', p_actor_profile_id => v_admin_profile, p_limit => 1000);
  v_cases := v_cases + 1;
  if v_n < 1 then v_fail := v_fail || 'S14 consultation du detail non journalisee (audit.entry_read absent)'::text; end if;

  -- S15 : entree inexistante refusee (P0002 / 'not_found').
  begin
    perform public.admin_get_audit_entry(v_bogus);
    v_fail := v_fail || 'S15 detail d''une entree inexistante aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'not_found' then v_fail := v_fail || ('S15 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S16 : vue d'ensemble — compteurs coherents et facettes reelles
  -- (les deux entrees de test y figurent forcement, creees < 7 jours).
  select public.admin_audit_overview() into v_json;
  v_cases := v_cases + 1;
  if (v_json->>'total_entries')::bigint < 2
     or (v_json->>'actions_7d')::bigint < 2
     or not (v_json->'object_types' ? 'sa049_test_object')
     or not (v_json->'actions' ? 'sa049.test_action') then
    v_fail := v_fail || 'S16 vue d''ensemble : compteurs ou facettes incorrects'::text;
  end if;

  -- ===== 4. Nettoyage =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  delete from private.audit_log where id in (v_entry1, v_entry2);
  delete from private.audit_log
   where actor_profile_id = v_admin_profile
     and created_at >= v_test_start
     and action in ('audit.read', 'audit.entry_read');
  delete from public.ise_profiles where id = v_member_profile;
  delete from public.promotions where id = v_promo_id;
  delete from auth.users where id = u_member;

  if array_length(v_fail, 1) is null then
    raise exception 'SA049_050_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'SA049_050_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end;
$sa049050$;
