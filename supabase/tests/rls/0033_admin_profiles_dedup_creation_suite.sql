-- 0033_admin_profiles_dedup_creation_suite.sql
-- SA-005 (fusion de doublons) et SA-007 (creation de profil reference).
-- succes -> ERROR: P0001: SA005_007_TESTS_OK: N cas, 0 echec

do $sa005007$
declare
  v_admin_auth uuid := '28708d27-78f4-4bc9-bdb3-ead2ce5e5612'; -- bootstrap admin (blyped@gmail.com)
  u_member uuid := '00000000-0000-4000-9005-000000000002';
  p_member uuid;
  p_a uuid; p_b uuid;
  v_res jsonb;
  v_cases integer := 0;
  v_fail text[] := array[]::text[];
  v_n bigint;
  v_ok boolean;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email) values (u_member, 'sa005-member@example.test')
    on conflict (id) do nothing;

  insert into public.ise_profiles (user_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status)
  values (u_member, 'Membre', 'DeTestClaimed', 'graduate', 'active', 'claimed', 'verified')
  returning id into p_member;

  insert into public.ise_profiles (first_name, last_name, profile_type, profile_status, claim_status, verification_status, current_organization_raw, current_country_code)
  values ('Doublon', 'Fixture-A', 'graduate', 'referenced', 'unclaimed', 'unverified', 'Fixture Org', 'CI')
  returning id into p_a;
  insert into public.ise_profiles (first_name, last_name, profile_type, profile_status, claim_status, verification_status, current_organization_raw, current_country_code)
  values ('Doublon', 'Fixture-B', 'graduate', 'referenced', 'unclaimed', 'unverified', 'Fixture Org', 'CI')
  returning id into p_b;
  insert into private.profile_contacts (profile_id, primary_email, phone_e164) values
    (p_a, 'sa005.fixture@example.test', '+2250700000001'),
    (p_b, 'sa005.fixture@example.test', '+2250700000001');

  -- ===== 1. Refus sans permission (identite membre ordinaire) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_member::text, 'role', 'authenticated')::text, true);

  begin
    perform public.admin_list_profile_duplicate_candidates(null, 25);
    v_fail := v_fail || 'S01 liste des doublons accessible sans profiles.moderate'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S01 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_merge_profiles(p_a, p_b, 'motif suffisamment long pour le test');
    v_fail := v_fail || 'S02 fusion accessible sans profiles.moderate'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S02 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_dismiss_duplicate_candidate(p_a, p_b, 'motif suffisamment long');
    v_fail := v_fail || 'S03 rejet accessible sans profiles.moderate'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S03 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_create_referenced_profile('Test', 'Sans-Droit');
    v_fail := v_fail || 'S04 creation accessible sans profiles.edit'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S04 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 2. Cote admin (bootstrap admin reel) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);

  select public.admin_list_profile_duplicate_candidates(null, 50) into v_res;
  select count(*) into v_n
  from jsonb_array_elements(v_res->'rows') r
  where (r->>'profileIdA')::uuid in (p_a, p_b) and (r->>'profileIdB')::uuid in (p_a, p_b);
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('S05 paire fixture non trouvee (count=%s)', v_n); end if;

  begin
    perform public.admin_merge_profiles(p_a, p_b, 'court');
    v_fail := v_fail || 'S06 fusion avec motif court aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'reason_required' then v_fail := v_fail || ('S06 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_merge_profiles(p_a, p_a, 'motif suffisamment long pour le test');
    v_fail := v_fail || 'S07 auto-fusion aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'cannot_merge_self' then v_fail := v_fail || ('S07 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_merge_profiles(p_a, p_member, 'motif suffisamment long pour le test');
    v_fail := v_fail || 'S08 fusion d''un profil reclame aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'cannot_merge_claimed_profile' then v_fail := v_fail || ('S08 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  perform public.admin_merge_profiles(p_a, p_b, 'fusion de test, doublons evidents (fixture)');
  v_cases := v_cases + 1;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select (profile_status = 'archived' and merged_into_profile_id = p_a) into v_ok
    from public.ise_profiles where id = p_b;
  v_cases := v_cases + 1;
  if coalesce(v_ok, false) is not true then v_fail := v_fail || 'S09 profil absorbe non archive'::text; end if;

  select not exists (select 1 from private.profile_contacts where profile_id = p_b) into v_ok;
  v_cases := v_cases + 1;
  if coalesce(v_ok, false) is not true then v_fail := v_fail || 'S10 contacts du profil absorbe non nettoyes'::text; end if;

  select exists (select 1 from private.admin_profile_notes where profile_id = p_a and body like 'Fusion :%') into v_ok;
  v_cases := v_cases + 1;
  if coalesce(v_ok, false) is not true then v_fail := v_fail || 'S11 note de fusion absente'::text; end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);

  begin
    perform public.admin_merge_profiles(p_a, p_b, 'deuxieme tentative, doit echouer proprement');
    v_fail := v_fail || 'S12 re-fusion aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'not_found' then v_fail := v_fail || ('S12 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  select public.admin_create_referenced_profile('Cree', 'ParTest') into v_res;
  v_cases := v_cases + 1;
  if v_res->>'profile_id' is null then v_fail := v_fail || 'S13 creation de profil echouee'::text; end if;

  begin
    perform public.admin_create_referenced_profile('', 'SansPrenom');
    v_fail := v_fail || 'S14 creation sans prenom aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'validation_failed' then v_fail := v_fail || ('S14 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('S15 security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  if array_length(v_fail, 1) is null then
    raise exception 'SA005_007_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'SA005_007_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end;
$sa005007$;
