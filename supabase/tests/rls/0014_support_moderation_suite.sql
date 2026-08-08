-- =====================================================================
-- supabase/tests/rls/0014_support_moderation_suite.sql
--
-- Suite RLS NEGATIVE du lot « Support et moderation » (migration 0049).
--   succes -> ERROR: P0001: SUPPORT_TESTS_OK: 18 cas, 0 echec
--
-- Cas structurants :
--   U07 — la NOTE INTERNE de support n'atteint pas le demandeur ;
--   U08 / U12 / U15 — ni le demandeur NI un agent ne changent un `status`
--        par un simple UPDATE : le trigger `guard_status_transition` renvoie
--        `invalid_transition`, seules les fonctions atomiques passent ;
--   U14 — mais l'agent PEUT s'assigner le ticket (controle positif) ;
--   U09 — D-85 : l'urgence n'est pas choisie par le demandeur.
--
-- FIXTURES : Jules (demandeur/signalant) · Karim (signale) ·
--   Lina (support_agent) · Marc (moderator)
-- =====================================================================

do $sup$
declare
  u_jul uuid:='00000000-0000-4000-800a-000000000001'; u_kar uuid:='00000000-0000-4000-800a-000000000002';
  u_lin uuid:='00000000-0000-4000-800a-000000000003'; u_mar uuid:='00000000-0000-4000-800a-000000000004';
  p_jul uuid:='00000000-0000-4000-800a-0000000000a1'; p_kar uuid:='00000000-0000-4000-800a-0000000000a2';
  p_lin uuid:='00000000-0000-4000-800a-0000000000a3'; p_mar uuid:='00000000-0000-4000-800a-0000000000a4';
  t1 uuid:='00000000-0000-4000-800a-0000000000b1';
  sm_pub uuid:='00000000-0000-4000-800a-0000000000c1'; sm_int uuid:='00000000-0000-4000-800a-0000000000c2';
  r1 uuid:='00000000-0000-4000-800a-0000000000d1'; re1 uuid:='00000000-0000-4000-800a-0000000000d2';
  ma1 uuid:='00000000-0000-4000-800a-0000000000e1';
  v_sa smallint; v_mo smallint; v_cat text; v_rr text;
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select code into v_cat from public.support_categories order by code limit 1;
  select code into v_rr from public.report_reasons order by code limit 1;
  select id into v_sa from private.roles where code='support_agent';
  select id into v_mo from private.roles where code='moderator';
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_jul,'authenticated','authenticated','test+sup.jules@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_kar,'authenticated','authenticated','test+sup.karim@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_lin,'authenticated','authenticated','test+sup.lina@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_mar,'authenticated','authenticated','test+sup.marc@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_jul,u_jul,'Jules','Sup','active','claimed',now(),true),
    (p_kar,u_kar,'Karim','Sup','active','claimed',now(),true),
    (p_lin,u_lin,'Lina','Sup','active','claimed',now(),true),
    (p_mar,u_mar,'Marc','Sup','active','claimed',now(),true);
  insert into private.user_roles (profile_id,role_id) values (p_lin,v_sa),(p_mar,v_mo);
  insert into public.support_tickets (id,requester_profile_id,category_code,subject,description,status) values
    (t1,p_jul,v_cat,'Probleme de connexion','Description du probleme rencontre par Jules.','open');
  insert into public.support_messages (id,ticket_id,author_kind,author_profile_id,body,is_internal_note) values
    (sm_pub,t1,'member',p_jul,'Message visible du demandeur.',false),
    (sm_int,t1,'agent',p_lin,'NOTE INTERNE : ne doit jamais atteindre le demandeur.',true);
  insert into public.reports (id,reporter_profile_id,target_type,target_id,target_owner_profile_id,reason_code,description,status) values
    (r1,p_jul,'profile',p_kar,p_kar,v_rr,'Signalement depose par Jules.','open');
  insert into public.report_events (id,report_id,actor_profile_id,from_status,to_status,note) values
    (re1,r1,p_mar,'open','reviewing','Note interne de revue.');
  insert into public.moderation_actions (id,report_id,moderator_profile_id,action_type,target_type,target_id,target_profile_id,reason) values
    (ma1,r1,p_mar,'warn','profile',p_kar,p_kar,'Motif interne de la sanction.');

  -- Karim : tiers, et personne signalee.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_kar::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.support_tickets where id=t1; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U01 ticket d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.support_messages where ticket_id=t1; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U02 fil d''un ticket tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.reports where id=r1; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U03 la personne signalee voit le signalement (%s)',v_n); end if;
  select count(*) into v_n from public.moderation_actions where id=ma1; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U04 la personne sanctionnee lit le motif interne (%s)',v_n); end if;

  -- Jules : demandeur du ticket, signalant.
  perform set_config('request.jwt.claims',json_build_object('sub',u_jul::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.support_tickets where id=t1; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U05 le demandeur ne voit pas son ticket (%s)',v_n); end if;
  select count(*) into v_n from public.support_messages where id=sm_pub; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U06 le demandeur ne voit pas son propre message (%s)',v_n); end if;
  select count(*) into v_n from public.support_messages where id=sm_int; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U07 NOTE INTERNE visible du demandeur (%s)',v_n); end if;
  v_msg:=null;
  begin
    update public.support_tickets set status='resolved', resolved_at=now() where id=t1;
    get diagnostics v_n=row_count; v_ok:=(v_n=0); v_msg:=format('%s ligne(s) transitionnees',v_n);
  exception when others then v_ok:=(sqlerrm='invalid_transition'); v_msg:='erreur obtenue : '||sqlerrm; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('U08 transition_support_ticket contourne : '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.support_tickets (requester_profile_id,category_code,subject,description,status,urgency,urgency_source,urgency_set_by_profile_id)
    values (p_jul,v_cat,'Urgence auto-attribuee','Description.','open','security','member',p_jul);
    v_ok:=false; v_msg:='urgence choisie par le demandeur acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('U09 D-85 non respectee : '||coalesce(v_msg,'')); end if;
  select count(*) into v_n from public.reports where id=r1; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U10 le signalant ne voit pas son signalement (%s)',v_n); end if;
  select count(*) into v_n from public.report_events where id=re1; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U11 le signalant lit le journal interne de revue (%s)',v_n); end if;
  v_msg:=null;
  begin
    update public.reports set status='resolved', resolution_code='no_violation', closed_at=now() where id=r1;
    get diagnostics v_n=row_count; v_ok:=(v_n=0); v_msg:=format('%s ligne(s) transitionnees',v_n);
  exception when others then v_ok:=(sqlerrm='invalid_transition'); v_msg:='erreur obtenue : '||sqlerrm; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('U12 transition_report contourne : '||coalesce(v_msg,'')); end if;

  -- Lina : agent de support.
  perform set_config('request.jwt.claims',json_build_object('sub',u_lin::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.support_messages where id=sm_int; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U13 le support ne lit pas sa propre note interne (%s)',v_n); end if;
  update public.support_tickets set assigned_agent_profile_id=p_lin where id=t1;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U14 le support ne peut pas s''assigner un ticket (%s)',v_n); end if;
  v_msg:=null;
  begin
    update public.support_tickets set status='closed', resolved_at=now(), closed_at=now() where id=t1;
    get diagnostics v_n=row_count; v_ok:=(v_n=0); v_msg:=format('%s ligne(s) transitionnees par un agent',v_n);
  exception when others then v_ok:=(sqlerrm='invalid_transition'); v_msg:='erreur obtenue : '||sqlerrm; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('U15 un agent contourne la machine d''etats : '||coalesce(v_msg,'')); end if;

  -- Marc : moderation (controles positifs).
  perform set_config('request.jwt.claims',json_build_object('sub',u_mar::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.reports where id=r1; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U16 la moderation ne voit pas le signalement (%s)',v_n); end if;
  select count(*) into v_n from public.report_events where id=re1; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U17 la moderation ne voit pas son journal de revue (%s)',v_n); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U18 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'SUPPORT_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'SUPPORT_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$sup$;
