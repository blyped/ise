-- 0035_admin_projects_suite.sql
-- SA-023->026 : projets & consortiums (admin) — liste tous statuts,
-- creation, cycle de vie non terminal, demandes de consortium, cloture.
-- succes -> ERROR: P0001: SA023_026_TESTS_OK: N cas, 0 echec

do $sa023026$
declare
  v_admin_auth uuid := '28708d27-78f4-4bc9-bdb3-ead2ce5e5612'; -- bootstrap admin (blyped@gmail.com)
  v_admin_profile uuid;
  u_member uuid := '00000000-0000-4000-9023-000000000002';
  v_member_profile uuid;
  v_promo_id bigint;
  p1 uuid;
  v_org_id uuid;
  v_project jsonb;
  v_project_id uuid;
  v_bogus uuid := '00000000-0000-4000-9023-000000000099';
  v_list jsonb;
  v_set jsonb;
  v_request_id uuid;
  v_req jsonb;
  v_reqlist jsonb;
  v_close jsonb;
  v_fail text[] := array[]::text[];
  v_cases integer := 0;
  v_n bigint;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email) values (u_member, 'sa023-member@example.test')
    on conflict (id) do nothing;

  insert into public.promotions (name, graduation_year, status) values ('Promo Test Projets RLS', 2097, 'active')
  returning id into v_promo_id;

  insert into public.ise_profiles (promotion_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status)
  values (v_promo_id, 'Porteur', 'Un', 'graduate', 'referenced', 'unclaimed', 'unverified') returning id into p1;

  -- Profil relie a l'auth du membre ordinaire (necessaire a private.current_profile_id()).
  insert into public.ise_profiles (promotion_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status, user_id, claimed_at)
  values (v_promo_id, 'Membre', 'Ordinaire', 'graduate', 'active', 'claimed', 'unverified', u_member, now()) returning id into v_member_profile;

  insert into public.organizations (canonical_name) values ('Organisation Test RLS SA-023') returning id into v_org_id;

  -- ===== 1. Refus sans permission (identite membre ordinaire) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_member::text, 'role', 'authenticated')::text, true);

  begin
    perform public.admin_list_projects(null, null, null, null, 25);
    v_fail := v_fail || 'S01 liste projets accessible sans projects.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S01 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_create_project(p1, 'mission', 'Titre interdit', 'Resume', 'Resultat attendu');
    v_fail := v_fail || 'S02 creation projet accessible sans projects.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S02 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_set_project_status(v_bogus, 'recruiting');
    v_fail := v_fail || 'S03 transition de statut accessible sans projects.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S03 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_list_consortium_requests(null, null, null, 25);
    v_fail := v_fail || 'S04 liste consortiums accessible sans projects.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S04 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_review_consortium_request(v_bogus, 'selected', null);
    v_fail := v_fail || 'S05 decision consortium accessible sans projects.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S05 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_close_project(v_bogus, 'succeeded', 'yes');
    v_fail := v_fail || 'S06 cloture projet accessible sans projects.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S06 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 2. Cote admin (bootstrap admin reel) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);
  select private.current_profile_id() into v_admin_profile;

  -- S07 : creation reussie, brouillon.
  select to_jsonb(public.admin_create_project(p1, 'mission', 'Mission test RLS', 'Resume test', 'Resultat attendu test'))
    into v_project;
  v_project_id := (v_project->>'id')::uuid;
  v_cases := v_cases + 1;
  if v_project_id is null or (v_project->>'status') <> 'draft' then
    v_fail := v_fail || 'S07 creation projet echouee ou statut initial incorrect'::text;
  end if;

  -- S08 : proprietaire inexistant refuse.
  begin
    perform public.admin_create_project(v_bogus, 'mission', 'Titre', 'Resume', 'Resultat');
    v_fail := v_fail || 'S08 creation avec proprietaire inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'profile_not_found' then v_fail := v_fail || ('S08 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S09 : champ obligatoire manquant refuse.
  begin
    perform public.admin_create_project(p1, 'mission', '', 'Resume', 'Resultat');
    v_fail := v_fail || 'S09 creation avec titre vide aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'missing_required_field' then v_fail := v_fail || ('S09 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S10 : le brouillon apparait dans admin_list_projects (invisible de list_projects).
  select public.admin_list_projects('draft', null, null, null, 25) into v_list;
  select count(*) into v_n from jsonb_array_elements(v_list->'rows') r where (r->>'project_id')::uuid = v_project_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S10 brouillon absent de admin_list_projects'::text; end if;

  -- S11 : publication (draft -> recruiting).
  select to_jsonb(public.admin_set_project_status(v_project_id, 'recruiting')) into v_set;
  v_cases := v_cases + 1;
  if (v_set->>'status') <> 'recruiting' or (v_set->>'published_at') is null then
    v_fail := v_fail || 'S11 publication du projet incorrecte'::text;
  end if;

  -- S12 : cible 'draft' refusee par admin_set_project_status.
  begin
    perform public.admin_set_project_status(v_project_id, 'draft');
    v_fail := v_fail || 'S12 retour a draft aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_status' then v_fail := v_fail || ('S12 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S13 : passage a 'active' -> started_at renseigne.
  select to_jsonb(public.admin_set_project_status(v_project_id, 'active')) into v_set;
  v_cases := v_cases + 1;
  if (v_set->>'status') <> 'active' or (v_set->>'started_at') is null then
    v_fail := v_fail || 'S13 passage a active incorrect'::text;
  end if;

  -- S14 : demande de consortium (insertion directe, aucun RPC membre n'existe encore).
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.consortium_requests (
    project_id, organization_id, requested_by_profile_id, partner_role, status, submitted_at, created_at, updated_at
  )
  values (v_project_id, v_org_id, p1, 'partner', 'submitted', now(), now(), now())
  returning id into v_request_id;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);
  v_cases := v_cases + 1;
  if v_request_id is null then v_fail := v_fail || 'S14 insertion demande de consortium echouee'::text; end if;

  -- S15 : la demande apparait dans admin_list_consortium_requests.
  select public.admin_list_consortium_requests(v_project_id, null, null, 25) into v_reqlist;
  select count(*) into v_n from jsonb_array_elements(v_reqlist->'rows') r where (r->>'id')::uuid = v_request_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S15 demande absente de admin_list_consortium_requests'::text; end if;

  -- S16 : mise en revue (non terminale) -> decided_at reste nul.
  select to_jsonb(public.admin_review_consortium_request(v_request_id, 'shortlisted', 'presele test')) into v_req;
  v_cases := v_cases + 1;
  if (v_req->>'status') <> 'shortlisted' or (v_req->>'decided_at') is not null then
    v_fail := v_fail || 'S16 mise en revue (shortlisted) incorrecte'::text;
  end if;

  -- S17 : decision terminale -> decided_by/decided_at renseignes.
  select to_jsonb(public.admin_review_consortium_request(v_request_id, 'selected', null)) into v_req;
  v_cases := v_cases + 1;
  if (v_req->>'status') <> 'selected' or (v_req->>'decided_by_profile_id') <> v_admin_profile::text
     or (v_req->>'decided_at') is null then
    v_fail := v_fail || 'S17 decision terminale (selected) incorrecte'::text;
  end if;

  -- S18 : nouvelle decision sur une demande deja arbitree refusee.
  begin
    perform public.admin_review_consortium_request(v_request_id, 'shortlisted', null);
    v_fail := v_fail || 'S18 decision sur demande deja arbitree aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_transition' then v_fail := v_fail || ('S18 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S19 : cloture reussie avec donnees financieres confidentielles.
  select to_jsonb(public.admin_close_project(
    v_project_id, 'succeeded', 'yes', 'contract_won', 'Livrable final', 'https://example.test/livrable',
    true, 'Temoignage test', 'mainly', 3::smallint,
    'Client test', 'Bailleur test', 15000::numeric, 'EUR'::character, 'Notes financieres test',
    12000::numeric, 'EUR'::character
  )) into v_close;
  v_cases := v_cases + 1;
  if (v_close->>'status') <> 'completed' or (v_close->>'closed_at') is null then
    v_fail := v_fail || 'S19 cloture du projet incorrecte'::text;
  end if;

  -- S20 : nouvelle cloture sur un projet deja termine refusee.
  begin
    perform public.admin_close_project(v_project_id, 'failed', 'no');
    v_fail := v_fail || 'S20 cloture sur projet deja termine aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_transition' then v_fail := v_fail || ('S20 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S21 : transition non terminale sur un projet termine refusee.
  begin
    perform public.admin_set_project_status(v_project_id, 'paused');
    v_fail := v_fail || 'S21 transition sur projet termine aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_transition' then v_fail := v_fail || ('S21 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 3. Verification cote base + nettoyage =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from public.project_closures where project_id = v_project_id and outcome_status = 'succeeded';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S19b project_closures absent ou incorrect'::text; end if;

  select count(*) into v_n from private.project_confidential_details
   where project_id = v_project_id and budget_estimate = 15000 and client_name = 'Client test';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S19c project_confidential_details absent ou incorrect'::text; end if;

  delete from private.project_confidential_details where project_id = v_project_id;
  delete from public.project_closures where project_id = v_project_id;
  delete from public.consortium_requests where id = v_request_id;
  delete from public.projects where id = v_project_id;
  delete from public.organizations where id = v_org_id;
  delete from public.ise_profiles where id in (p1, v_member_profile);
  delete from public.promotions where id = v_promo_id;
  delete from auth.users where id = u_member;

  if array_length(v_fail, 1) is null then
    raise exception 'SA023_026_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'SA023_026_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end;
$sa023026$;
