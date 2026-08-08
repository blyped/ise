-- =====================================================================
-- supabase/tests/rls/0008_mentorship_suite.sql
--
-- Suite RLS NEGATIVE du lot « Mentorat » (migration 0043).
--   succes -> ERROR: P0001: MENTORSHIP_TESTS_OK: 17 cas, 0 echec
--
-- FIXTURES : Mia (mentoree) · Leo (mentor du binome) ·
--   Ivy (tiers absolu) · Kai (mentor actif qui a BLOQUE Mia)
--
-- Points verifies en propre : les NOTES de seance n'atteignent pas
-- l'autre partie du binome, le BILAN non plus, et le score de suggestion
-- n'atteint aucun client.
-- =====================================================================

do $men$
declare
  u_mia uuid:='00000000-0000-4000-8004-000000000001'; u_leo uuid:='00000000-0000-4000-8004-000000000002';
  u_ivy uuid:='00000000-0000-4000-8004-000000000003'; u_kai uuid:='00000000-0000-4000-8004-000000000004';
  p_mia uuid:='00000000-0000-4000-8004-0000000000a1'; p_leo uuid:='00000000-0000-4000-8004-0000000000a2';
  p_ivy uuid:='00000000-0000-4000-8004-0000000000a3'; p_kai uuid:='00000000-0000-4000-8004-0000000000a4';
  q_req uuid:='00000000-0000-4000-8004-0000000000b1'; m_rel uuid:='00000000-0000-4000-8004-0000000000c1';
  s_sess uuid:='00000000-0000-4000-8004-0000000000d1'; n_note uuid:='00000000-0000-4000-8004-0000000000d2';
  fb uuid:='00000000-0000-4000-8004-0000000000e1';
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text; v_num numeric;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_mia,'authenticated','authenticated','test+men.mia@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_leo,'authenticated','authenticated','test+men.leo@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ivy,'authenticated','authenticated','test+men.ivy@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_kai,'authenticated','authenticated','test+men.kai@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_mia,u_mia,'Mia','Men','active','claimed',now(),true),
    (p_leo,u_leo,'Leo','Men','active','claimed',now(),true),
    (p_ivy,u_ivy,'Ivy','Men','active','claimed',now(),true),
    (p_kai,u_kai,'Kai','Men','active','claimed',now(),true);
  insert into public.mentor_profiles (profile_id,is_active,mentor_statement) values
    (p_leo,true,'Mentor actif, disponible pour accompagner.'),
    (p_kai,true,'Mentor actif, mais a bloque Mia.');
  insert into public.mentorship_requests (id,mentee_profile_id,mentor_profile_id,objective_type,objective_text,requested_format,status,submitted_at) values
    (q_req,p_mia,p_leo,'first_job','Trouver un premier poste en statistique appliquee.','three_months','accepted',now());
  insert into public.mentorships (id,mentor_profile_id,mentee_profile_id,source_request_id,objective_type,objective,format,status) values
    (m_rel,p_leo,p_mia,q_req,'first_job','Accompagnement vers un premier poste.','three_months','active');
  insert into public.mentorship_sessions (id,mentorship_id,session_number,scheduled_at,status,shared_summary) values
    (s_sess,m_rel,1,now(),'planned','Resume partage de la premiere seance.');
  insert into public.mentorship_session_notes (id,session_id,author_profile_id,note) values
    (n_note,s_sess,p_mia,'Note personnelle de la mentoree : ne doit jamais atteindre le mentor.');
  insert into public.mentorship_feedback (id,mentorship_id,respondent_profile_id,respondent_role,usefulness,comment) values
    (fb,m_rel,p_mia,'mentee','a_lot','Bilan confidentiel de la mentoree.');
  insert into public.mentorship_matches (mentee_profile_id,mentor_profile_id,objective_type,score,relevance_label,match_reasons,computed_at) values
    (p_mia,p_leo,'first_job',77.00,'relevant','["objectif commun"]'::jsonb,now());
  insert into public.profile_blocks (blocker_profile_id,blocked_profile_id) values (p_kai,p_mia);

  -- Ivy : tiers absolu.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_ivy::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.mentorships where id=m_rel; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M01 relation de mentorat d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.mentorship_requests where id=q_req; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M02 demande de mentorat d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.mentorship_sessions where id=s_sess; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M03 seance d''un binome tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.mentorship_feedback where id=fb; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M04 bilan d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.mentorship_matches where mentee_profile_id=p_mia; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M05 suggestions de mentors d''un tiers visibles (%s)',v_n); end if;

  -- Leo : le mentor. Il voit la relation, mais ni les notes ni le bilan.
  perform set_config('request.jwt.claims',json_build_object('sub',u_leo::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.mentorships where id=m_rel; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M06 le mentor ne voit pas sa relation (%s)',v_n); end if;
  select count(*) into v_n from public.mentorship_session_notes where id=n_note; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M07 le mentor lit les notes privees de la mentoree (%s)',v_n); end if;
  select count(*) into v_n from public.mentorship_feedback where id=fb; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M08 le mentor lit le bilan confidentiel de la mentoree (%s)',v_n); end if;
  select count(*) into v_n from public.mentorship_sessions where id=s_sess; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M09 le mentor ne voit pas la seance partagee (%s)',v_n); end if;
  v_msg:=null;
  begin
    select score into v_num from public.mentorship_matches where mentee_profile_id=p_mia;
    v_ok:=false; v_msg:=format('score lisible (= %s)',v_num);
  exception when insufficient_privilege then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('M10 score de suggestion expose : '||coalesce(v_msg,'')); end if;

  -- Mia : la mentoree.
  perform set_config('request.jwt.claims',json_build_object('sub',u_mia::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.mentorship_session_notes where id=n_note; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M11 l''auteure ne lit pas sa propre note (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.mentorship_requests (mentee_profile_id,mentor_profile_id,objective_type,objective_text,requested_format,status)
    values (p_mia,p_kai,'first_job','Demande malgre un blocage : doit etre refusee.','one_month','pending');
    v_ok:=false; v_msg:='demande acceptee malgre le blocage';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('M12 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.mentorship_requests (mentee_profile_id,mentor_profile_id,objective_type,objective_text,requested_format,status)
    values (p_mia,p_leo,'consulting','Demande directement acceptee : doit etre refusee.','one_month','accepted');
    v_ok:=false; v_msg:='demande creee directement en statut accepte';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('M13 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.mentorships (mentor_profile_id,mentee_profile_id,objective_type,objective,format,status)
    values (p_ivy,p_mia,'first_job','Relation forgee sans demande.','one_month','planned');
    v_ok:=false; v_msg:='relation creee sans demande acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('M14 '||coalesce(v_msg,'')); end if;
  select count(*) into v_n from public.mentor_profiles where profile_id=p_kai; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M15 profil de mentor visible malgre le blocage (%s)',v_n); end if;
  select count(*) into v_n from public.mentor_profiles where profile_id=p_leo; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M16 annuaire des mentors actifs inaccessible (%s)',v_n); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M17 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'MENTORSHIP_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'MENTORSHIP_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$men$;
