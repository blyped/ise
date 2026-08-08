-- =====================================================================
-- supabase/tests/rls/0010_projects_suite.sql
--
-- Suite RLS NEGATIVE du lot « Projets et consortiums » (migration 0045).
--   succes -> ERROR: P0001: PROJECTS_TESTS_OK: 17 cas, 0 echec
--
-- FIXTURES : Paul (porteur) · Qing (equipe) · Remy (candidat) · Theo (tiers)
-- Le blocage est pose APRES les controles positifs : l'ordre des cas
-- compte (voir docs/rls.md, « Ajouter un cas »).
-- =====================================================================

do $prj$
declare
  u_paul uuid:='00000000-0000-4000-8006-000000000001'; u_qing uuid:='00000000-0000-4000-8006-000000000002';
  u_remy uuid:='00000000-0000-4000-8006-000000000003'; u_theo uuid:='00000000-0000-4000-8006-000000000004';
  p_paul uuid:='00000000-0000-4000-8006-0000000000a1'; p_qing uuid:='00000000-0000-4000-8006-0000000000a2';
  p_remy uuid:='00000000-0000-4000-8006-0000000000a3'; p_theo uuid:='00000000-0000-4000-8006-0000000000a4';
  pr_team uuid:='00000000-0000-4000-8006-0000000000b1'; pr_net uuid:='00000000-0000-4000-8006-0000000000b2';
  rl uuid:='00000000-0000-4000-8006-0000000000c1'; ap uuid:='00000000-0000-4000-8006-0000000000c2';
  lk uuid:='00000000-0000-4000-8006-0000000000d1'; ms uuid:='00000000-0000-4000-8006-0000000000d2';
  cr uuid:='00000000-0000-4000-8006-0000000000e1'; org uuid:='00000000-0000-4000-8006-0000000000f1';
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_paul,'authenticated','authenticated','test+prj.paul@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_qing,'authenticated','authenticated','test+prj.qing@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_remy,'authenticated','authenticated','test+prj.remy@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_theo,'authenticated','authenticated','test+prj.theo@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_paul,u_paul,'Paul','Prj','active','claimed',now(),true),
    (p_qing,u_qing,'Qing','Prj','active','claimed',now(),true),
    (p_remy,u_remy,'Remy','Prj','active','claimed',now(),true),
    (p_theo,u_theo,'Theo','Prj','active','claimed',now(),true);
  insert into public.organizations (id,canonical_name) values (org,'Organisation de test consortium');
  insert into public.projects (id,owner_profile_id,project_type,title,summary,expected_outcome,visibility,status,published_at) values
    (pr_team,p_paul,'mission','Projet equipe','Resume du projet reserve a son equipe.','Livrable interne.','team_only','recruiting',now()),
    (pr_net,p_paul,'study','Projet ouvert','Resume du projet ouvert au reseau.','Etude publiee.','network','recruiting',now());
  insert into public.project_roles (id,project_id,title,description,seats,status) values
    (rl,pr_net,'Statisticien','Role ouvert du projet.',1,'open');
  insert into public.project_members (project_id,profile_id,project_role_id,membership_status,confirmed_at,joined_at) values
    (pr_net,p_qing,rl,'active',now(),now());
  insert into public.project_applications (id,project_id,project_role_id,applicant_profile_id,message,status,submitted_at) values
    (ap,pr_net,rl,p_remy,'Candidature de Remy au role ouvert.','submitted',now());
  insert into public.project_links (id,project_id,label,url,is_confidential,added_by_profile_id) values
    (lk,pr_net,'Dossier interne','https://example.test/dossier',true,p_paul);
  insert into public.project_milestones (id,project_id,title,status) values
    (ms,pr_net,'Jalon interne','todo');
  insert into public.consortium_requests (id,project_id,organization_id,requested_by_profile_id,message,status) values
    (cr,pr_net,org,p_qing,'Demande de partenariat.','submitted');

  -- Theo : tiers.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_theo::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.projects where id=pr_team; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J01 projet team_only visible par un tiers (%s)',v_n); end if;
  select count(*) into v_n from public.projects where id=pr_net; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('J02 projet ouvert au reseau invisible (%s)',v_n); end if;
  select count(*) into v_n from public.project_applications where id=ap; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J03 candidature d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.project_links where id=lk; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J04 lien CONFIDENTIEL visible hors de l''equipe (%s)',v_n); end if;
  select count(*) into v_n from public.project_milestones where id=ms; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J05 jalon visible hors de l''equipe (%s)',v_n); end if;
  select count(*) into v_n from public.consortium_requests where id=cr; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J06 demande de consortium visible par un tiers (%s)',v_n); end if;
  update public.projects set title='Detourne par Theo' where id=pr_net;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J07 projet d''un tiers modifie (%s ligne(s))',v_n); end if;
  v_msg:=null;
  begin
    insert into public.projects (owner_profile_id,project_type,title,summary,expected_outcome,visibility,status,published_at)
    values (p_theo,'mission','Projet direct','Resume.','Livrable.','network','recruiting',now());
    v_ok:=false; v_msg:='projet cree directement en statut publie';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('J08 '||coalesce(v_msg,'')); end if;

  -- Qing : membre de l'equipe.
  perform set_config('request.jwt.claims',json_build_object('sub',u_qing::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.project_milestones where id=ms; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('J09 le membre de l''equipe ne voit pas le jalon (%s)',v_n); end if;
  select count(*) into v_n from public.project_links where id=lk; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('J10 le membre de l''equipe ne voit pas le lien confidentiel (%s)',v_n); end if;
  select count(*) into v_n from public.project_applications where id=ap; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J11 un membre d''equipe lit la candidature d''un tiers (%s)',v_n); end if;

  -- Remy : candidat.
  perform set_config('request.jwt.claims',json_build_object('sub',u_remy::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.project_applications where id=ap; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('J12 le candidat ne voit pas sa candidature (%s)',v_n); end if;
  v_msg:=null;
  begin
    update public.project_applications set status='selected', reviewed_at=now() where id=ap;
    get diagnostics v_n=row_count; v_ok:=(v_n=0); v_msg:=format('%s ligne(s) auto-selectionnees',v_n);
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('J13 auto-selection : '||coalesce(v_msg,'')); end if;

  -- Paul : porteur (controle positif).
  perform set_config('request.jwt.claims',json_build_object('sub',u_paul::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.project_applications where id=ap; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('J14 le porteur ne voit pas la candidature (%s)',v_n); end if;

  -- Blocage pose ici : Theo perd l'acces au projet ouvert.
  perform set_config('role','postgres',true);
  insert into public.profile_blocks (blocker_profile_id,blocked_profile_id) values (p_paul,p_theo);
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_theo::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.projects where id=pr_net; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J15 projet visible malgre le blocage du porteur (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.project_applications (project_id,project_role_id,applicant_profile_id,message,status,submitted_at)
    values (pr_net,rl,p_theo,'Candidature malgre un blocage.','submitted',now());
    v_ok:=false; v_msg:='candidature acceptee malgre le blocage';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('J16 '||coalesce(v_msg,'')); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J17 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'PROJECTS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PROJECTS_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$prj$;
