-- =====================================================================
-- supabase/tests/rls/0007_internships_suite.sql
--
-- Suite RLS NEGATIVE du lot « Stages » (migration 0042).
-- Modele auto-nettoyant (voir docs/rls.md).
--   succes -> ERROR: P0001: INTERNSHIP_TESTS_OK: 15 cas, 0 echec
--
-- FIXTURES : Sara (etudiante) · Ali (alumni REELLEMENT sollicite) ·
--   Zoe (membre verifie, non sollicite) · Max (membre non verifie, bloque Sara) ·
--   Tom (etudiant dont le besoin est en `verified_members`)
-- =====================================================================

do $stg$
declare
  u_sara uuid:='00000000-0000-4000-8003-000000000001'; u_ali uuid:='00000000-0000-4000-8003-000000000002';
  u_zoe uuid:='00000000-0000-4000-8003-000000000003'; u_max uuid:='00000000-0000-4000-8003-000000000004';
  u_tom uuid:='00000000-0000-4000-8003-000000000005';
  p_sara uuid:='00000000-0000-4000-8003-0000000000a1'; p_ali uuid:='00000000-0000-4000-8003-0000000000a2';
  p_zoe uuid:='00000000-0000-4000-8003-0000000000a3'; p_max uuid:='00000000-0000-4000-8003-0000000000a4';
  p_tom uuid:='00000000-0000-4000-8003-0000000000a5';
  n_sara uuid:='00000000-0000-4000-8003-0000000000b1'; n_tom uuid:='00000000-0000-4000-8003-0000000000b2';
  o_ali uuid:='00000000-0000-4000-8003-0000000000c1'; h_req uuid:='00000000-0000-4000-8003-0000000000d1';
  a_sara uuid:='00000000-0000-4000-8003-0000000000e1'; pl_sara uuid:='00000000-0000-4000-8003-0000000000f1';
  f_sara uuid:='00000000-0000-4000-8003-0000000000f2';
  v_cc char(2); v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select code into v_cc from public.countries order by code limit 1;
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_sara,'authenticated','authenticated','test+stg.sara@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ali,'authenticated','authenticated','test+stg.ali@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_zoe,'authenticated','authenticated','test+stg.zoe@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_max,'authenticated','authenticated','test+stg.max@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_tom,'authenticated','authenticated','test+stg.tom@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,verification_status,is_test_account) values
    (p_sara,u_sara,'Sara','Stg','active','claimed',now(),'unverified',true),
    (p_ali,u_ali,'Ali','Stg','active','claimed',now(),'unverified',true),
    (p_zoe,u_zoe,'Zoe','Stg','active','claimed',now(),'verified',true),
    (p_max,u_max,'Max','Stg','active','claimed',now(),'unverified',true),
    (p_tom,u_tom,'Tom','Stg','active','claimed',now(),'unverified',true);
  insert into public.internship_needs (id,student_profile_id,visibility,status,activated_at,start_date,duration_months) values
    (n_sara,p_sara,'internship_managers_and_relevant_alumni','active',now(),current_date+30,6),
    (n_tom,p_tom,'verified_members','active',now(),current_date+30,6);
  insert into public.internship_offers (id,offer_type,created_by_profile_id,organization_raw,title,status,published_at) values
    (o_ali,'hosting_possibility',p_ali,'Direction des etudes','Accueil possible en direction des etudes','published',now());
  insert into public.internship_help_requests (id,need_id,student_profile_id,alumni_profile_id,request_type,message,status) values
    (h_req,n_sara,p_sara,p_ali,'advice','Bonjour Ali, aurais-tu un conseil sur ce secteur ?','sent');
  insert into public.internship_applications (id,need_id,student_profile_id,organization_raw,position_title,status) values
    (a_sara,n_sara,p_sara,'Institut national','Stagiaire statisticien','submitted');
  insert into public.internship_placements (id,student_profile_id,need_id,organization_raw,country_code,start_date,end_date,placement_source,status) values
    (pl_sara,p_sara,n_sara,'Institut national',v_cc,current_date,current_date+60,'alumni_contact','confirmed');
  insert into public.internship_followups (id,placement_id,followup_type,scheduled_for) values
    (f_sara,pl_sara,'midterm',now());
  insert into public.profile_blocks (blocker_profile_id,blocked_profile_id) values (p_max,p_sara);

  -- Zoe : membre verifie mais NON sollicite par Sara.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_zoe::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.internship_needs where id=n_sara; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S01 besoin visible par un alumni non sollicite (%s)',v_n); end if;
  select count(*) into v_n from public.internship_needs where id=n_tom; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('S02 besoin verified_members invisible pour un membre verifie (%s)',v_n); end if;
  select count(*) into v_n from public.internship_help_requests where id=h_req; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S03 demande d''aide d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.internship_applications where id=a_sara; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S04 carnet de candidatures d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.internship_placements where id=pl_sara; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S05 placement d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.internship_followups where id=f_sara; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S06 suivi de bien-etre d''un tiers visible (%s)',v_n); end if;
  update public.internship_needs set objective='detourne' where id=n_sara;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S07 besoin d''un tiers modifie (%s ligne(s))',v_n); end if;

  -- Max : membre NON verifie.
  perform set_config('request.jwt.claims',json_build_object('sub',u_max::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.internship_needs where id=n_tom; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S08 besoin verified_members visible par un membre NON verifie (%s)',v_n); end if;

  -- Ali : alumni reellement sollicite (controle positif) — mais rien de plus.
  perform set_config('request.jwt.claims',json_build_object('sub',u_ali::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.internship_needs where id=n_sara; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('S09 besoin invisible pour l''alumni REELLEMENT sollicite (%s)',v_n); end if;
  select count(*) into v_n from public.internship_applications where id=a_sara; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S10 l''alumni lit le carnet declaratif de l''etudiant (%s)',v_n); end if;
  select count(*) into v_n from public.internship_followups where id=f_sara; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S11 l''alumni lit le suivi de bien-etre (%s)',v_n); end if;

  -- Sara : proprietaire.
  perform set_config('request.jwt.claims',json_build_object('sub',u_sara::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.internship_followups where id=f_sara; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('S12 l''etudiante ne lit pas son propre suivi (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.internship_help_requests (need_id,student_profile_id,alumni_profile_id,request_type,message)
    values (n_sara,p_sara,p_max,'advice','Sollicitation malgre un blocage : doit etre refusee.');
    v_ok:=false; v_msg:='sollicitation acceptee malgre le blocage';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('S13 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.internship_help_requests (need_id,student_profile_id,alumni_profile_id,request_type,message,status)
    values (n_sara,p_sara,p_zoe,'advice','Demande directement en statut accepte : doit etre refusee.','accepted');
    v_ok:=false; v_msg:='statut initial force accepte';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('S14 '||coalesce(v_msg,'')); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('S15 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'INTERNSHIP_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'INTERNSHIP_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$stg$;
