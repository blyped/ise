-- =====================================================================
-- supabase/tests/rls/0028_projects_api_suite.sql
--
-- Suite de la couche API PROJETS & CONSORTIUMS (migration 0073,
-- ISE-088 -> ISE-091).
--   succes -> ERROR: P0001: PROJECTS_API_TESTS_OK: 20 cas, 0 echec
--
-- Deux invariants sont verifies frontalement :
--   * une expression d'interet ne cree JAMAIS un membre de projet
--     (cas J09, J10, J12, J13, J14) — MASTER PROMPT 32 ;
--   * les donnees financieres n'atteignent jamais un non-membre
--     (cas J04, J05, J06, J07) — DIGEST D 5.6.
--
-- FIXTURES : Omar (porteur) · Rita (candidate puis membre confirmee).
--   Trois projets : ouvert au reseau, reserve a l'equipe, a divulgation
--   restreinte.
-- =====================================================================

do $prj$
declare
  u_omar uuid:='00000000-0000-4000-8028-000000000001'; u_rita uuid:='00000000-0000-4000-8028-000000000002';
  p_omar uuid:='00000000-0000-4000-8028-0000000000a1'; p_rita uuid:='00000000-0000-4000-8028-0000000000a2';
  pr_open uuid:='00000000-0000-4000-8028-0000000000b1'; pr_team uuid:='00000000-0000-4000-8028-0000000000b2';
  pr_sum  uuid:='00000000-0000-4000-8028-0000000000b3';
  r_open  uuid:='00000000-0000-4000-8028-0000000000c1';
  i_rita  uuid:='00000000-0000-4000-8028-0000000000d1';
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_ok boolean; v_j jsonb; v_n bigint; v_app uuid;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_omar,'authenticated','authenticated','test+papi.omar@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_rita,'authenticated','authenticated','test+papi.rita@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_omar,u_omar,'Omar','Papi','active','claimed',now(),true),
    (p_rita,u_rita,'Rita','Papi','active','claimed',now(),true);
  insert into public.projects (id,owner_profile_id,project_type,title,restricted_title,summary,description,
      expected_outcome,visibility,disclosure_level,compensation_type,status,published_at) values
    (pr_open,p_omar,'consortium','Consortium ouvert au reseau',null,'Resume public du consortium.',
      'Description complete du consortium.','Soumettre une offre technique.','network','full','paid','recruiting',now()),
    (pr_team,p_omar,'mission','Mission reservee a l''equipe',null,'Resume interne.',
      'Description interne.','Livrer une etude.','team_only','full','paid','recruiting',now()),
    (pr_sum,p_omar,'tender','Appel d''offres confidentiel','Mission regionale — secteur finance','Resume public restreint.',
      'Description confidentielle a ne pas divulguer.','Soumettre une proposition.','network','summary_only','paid','recruiting',now());
  insert into public.project_roles (id,project_id,title,description,seats,application_mode,status,sort_order,experience_min_years)
  values (r_open,pr_open,'Expert quantitatif senior','Role ouvert.',1,'open','open',1,5);
  insert into private.project_role_compensation (project_role_id,details,amount_min,amount_max,currency,rate_unit,disclosed_from)
  values (r_open,'Taux journalier negocie.',400,600,'EUR','per_day','selected');
  insert into private.project_confidential_details (project_id,client_name,funder_name,budget_estimate,budget_currency,financial_notes)
  values (pr_open,'Client confidentiel','Bailleur confidentiel',250000,'EUR','Note financiere interne.');
  insert into public.project_members (project_id,profile_id,membership_role,membership_status,agreed_terms,cv_consent,confirmed_at,joined_at)
  values (pr_open,p_omar,'owner','active','{}'::jsonb,false,now(),now()),
         (pr_team,p_omar,'owner','active','{}'::jsonb,false,now(),now());
  insert into public.project_milestones (project_id,title,status,sort_order) values (pr_open,'Equipe constituee','todo',1);
  insert into public.project_invitations (id,project_id,project_role_id,invited_profile_id,invited_by_profile_id,status)
  values (i_rita,pr_open,r_open,p_rita,p_omar,'sent');

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_rita::text,'role','authenticated')::text,true);

  v_cases:=v_cases+1;
  if public.get_project(pr_team) is not null then v_fail:=v_fail||'J01 projet team_only visible hors equipe'::text; end if;

  v_j := public.get_project(pr_sum); v_cases:=v_cases+1;
  if v_j is null or v_j->>'description' is not null or coalesce((v_j->>'is_restricted')::boolean,false) is not true then
    v_fail:=v_fail||'J02 disclosure summary_only non respectee'::text; end if;
  v_cases:=v_cases+1;
  if v_j->>'title' <> 'Mission regionale — secteur finance' then
    v_fail:=v_fail||'J03 titre complet expose sur un projet a divulgation restreinte'::text; end if;

  begin v_j := public.get_project_confidential_details(pr_open); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'J04 donnees financieres lues par un non-membre'::text; end if;

  begin
    select count(*) into v_n from private.project_confidential_details d where d.project_id=pr_open;
    v_ok := (v_n = 0);
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'J05 private.project_confidential_details lisible en direct'::text; end if;

  v_j := public.get_project(pr_open); v_cases:=v_cases+1;
  if (v_j->'roles'->0) ? 'compensation' then v_fail:=v_fail||'J06 remuneration divulguee avant tout fait constate'::text; end if;
  v_cases:=v_cases+1;
  if coalesce(((v_j->'roles'->0)->>'compensation_disclosed')::boolean,true) is not false then
    v_fail:=v_fail||'J07 palier de divulgation ignore'::text; end if;
  v_cases:=v_cases+1;
  if jsonb_array_length(coalesce(v_j->'milestones','[]'::jsonb)) <> 0 then
    v_fail:=v_fail||'J08 jalons visibles hors equipe'::text; end if;

  -- Expression d'interet : elle n'est PAS une adhesion.
  v_j := public.submit_project_interest(pr_open,r_open,'Je peux contribuer.','Disponible en septembre.',true,true,true);
  v_app := (v_j->>'application_id')::uuid;
  v_cases:=v_cases+1;
  if coalesce((v_j->>'creates_membership')::boolean,true) is not false then
    v_fail:=v_fail||'J09 submit_project_interest annonce creer une adhesion'::text; end if;
  v_cases:=v_cases+1;
  select count(*) into v_n from public.project_members m where m.project_id=pr_open and m.profile_id=p_rita;
  if v_n <> 0 then v_fail:=v_fail||format('J10 une expression d''interet a cree %s membre(s)',v_n); end if;

  begin v_j := public.confirm_project_membership(pr_open,'{}'::jsonb,false); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'J11 adhesion confirmee sans invitation ni pre-adhesion'::text; end if;

  begin
    insert into public.project_members (project_id,profile_id,membership_role,membership_status,agreed_terms,cv_consent,confirmed_at)
    values (pr_open,p_rita,'member','active','{}'::jsonb,false,now());
    v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'J12 auto-inscription directe dans project_members'::text; end if;

  -- Meme acceptee, une invitation ne rend pas membre actif.
  v_j := public.respond_project_invitation(i_rita,'accepted'); v_cases:=v_cases+1;
  if v_j->>'membership_status' <> 'pending_confirmation' then
    v_fail:=v_fail||format('J13 invitation acceptee : %s',coalesce(v_j->>'membership_status','null')); end if;
  v_cases:=v_cases+1;
  select count(*) into v_n from public.project_members m
   where m.project_id=pr_open and m.profile_id=p_rita and m.membership_status='active';
  if v_n <> 0 then v_fail:=v_fail||'J14 invitation acceptee rend membre actif sans consentement'::text; end if;

  v_j := public.confirm_project_membership(pr_open,jsonb_build_object('role','Expert'),true); v_cases:=v_cases+1;
  if v_j->>'membership_status' <> 'active' or v_j->>'confirmed_at' is null then
    v_fail:=v_fail||'J15 confirmation sans horodatage'::text; end if;
  v_cases:=v_cases+1;
  select count(*) into v_n from public.project_members m
   where m.project_id=pr_open and m.profile_id=p_rita and m.membership_status='active' and m.confirmed_at is not null;
  if v_n <> 1 then v_fail:=v_fail||'J16 consentement horodate absent en base'::text; end if;

  v_cases:=v_cases+1;
  if public.get_project_confidential_details(pr_open)->>'client_name' <> 'Client confidentiel' then
    v_fail:=v_fail||'J17 un membre confirme ne lit pas les donnees financieres'::text; end if;

  begin v_j := public.withdraw_project_interest(v_app); v_ok:=true;
  exception when others then v_ok:=false; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'J18 retrait d''une expression d''interet refuse'::text; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_omar::text,'role','authenticated')::text,true);
  begin v_j := public.submit_project_interest(pr_open,r_open,'x','y',true,true,false); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'J19 le porteur candidate a son propre projet'::text; end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  v_cases:=v_cases+1;
  if (select count(*) from private.security_baseline_violations()) <> 0 then
    v_fail:=v_fail||'J20 security_baseline_violations() non vide'::text; end if;

  if array_length(v_fail,1) is null then
    raise exception 'PROJECTS_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PROJECTS_API_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$prj$;
