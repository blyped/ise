-- =====================================================================
-- supabase/tests/rls/0015_platform_suite.sql
--
-- Suite RLS NEGATIVE du lot « Plateforme » (migration 0050).
--   succes -> ERROR: P0001: PLATFORM_TESTS_OK: 18 cas, 0 echec
--
-- V09 et V13 constatent que `domain_events` reste ferme A TOUT LE MONDE,
-- y compris a un superadmin : c'est un bus serveur, pas une table de
-- lecture. V16 fige le decompte des tables volontairement fermees.
--
-- FIXTURES : Noa (membre) · Otto (superadmin, `settings.manage`)
-- =====================================================================

do $plt$
declare
  u_noa uuid:='00000000-0000-4000-800b-000000000001'; u_ott uuid:='00000000-0000-4000-800b-000000000002';
  p_noa uuid:='00000000-0000-4000-800b-0000000000a1'; p_ott uuid:='00000000-0000-4000-800b-0000000000a2';
  mw_s uuid:='00000000-0000-4000-800b-0000000000b1'; mw_d uuid:='00000000-0000-4000-800b-0000000000b2';
  v_role smallint; v_de text;
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select code into v_de from public.domain_event_types order by code limit 1;
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_noa,'authenticated','authenticated','test+plt.noa@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ott,'authenticated','authenticated','test+plt.otto@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_noa,u_noa,'Noa','Plt','active','claimed',now(),true),
    (p_ott,u_ott,'Otto','Plt','active','claimed',now(),true);
  select id into v_role from private.roles where code='superadmin';
  insert into private.user_roles (profile_id,role_id) values (p_ott,v_role);
  insert into public.platform_settings (key,value,value_kind,scope,description) values
    ('test.rls.member_setting','"visible"'::jsonb,'string','member','Reglage de portee membre.'),
    ('test.rls.admin_setting','"secret"'::jsonb,'string','admin','Reglage de portee administrateur.');
  insert into public.feature_flags (code,name,description,is_enabled) values
    ('test_rls_flag_on','Drapeau actif','Drapeau active.',true),
    ('test_rls_flag_off','Drapeau eteint','Fonctionnalite non annoncee.',false);
  insert into public.feature_flag_overrides (flag_code,profile_id,is_enabled,reason) values
    ('test_rls_flag_on',p_noa,true,'Derogation de Noa.'),
    ('test_rls_flag_on',p_ott,false,'Derogation d''Otto.');
  insert into public.maintenance_windows (id,title,description,status,starts_at,ends_at,created_by_profile_id) values
    (mw_s,'Maintenance a venir','Fenetre planifiee.','scheduled',now()+interval '1 day',now()+interval '1 day 2 hour',p_ott),
    (mw_d,'Maintenance passee','Fenetre terminee.','completed',now()-interval '10 day',now()-interval '10 day' + interval '2 hour',p_ott);
  insert into public.domain_events (event_type,aggregate_type,aggregate_id,actor_profile_id,payload) values
    (v_de,'ise_profile',p_noa,p_noa,'{"secret":"charge utile brute"}'::jsonb);

  -- Noa : membre ordinaire.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_noa::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.platform_settings where key='test.rls.member_setting'; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('V01 reglage de portee membre invisible (%s)',v_n); end if;
  select count(*) into v_n from public.platform_settings where key='test.rls.admin_setting'; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V02 reglage de portee ADMIN visible d''un membre (%s)',v_n); end if;
  select count(*) into v_n from public.feature_flags where code='test_rls_flag_on'; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('V03 drapeau actif invisible (%s)',v_n); end if;
  select count(*) into v_n from public.feature_flags where code='test_rls_flag_off'; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V04 drapeau ETEINT visible d''un membre (%s)',v_n); end if;
  select count(*) into v_n from public.feature_flag_overrides where profile_id=p_ott; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V05 derogation nominative d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.feature_flag_overrides where profile_id=p_noa; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('V06 derogation propre invisible (%s)',v_n); end if;
  select count(*) into v_n from public.maintenance_windows where id=mw_s; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('V07 fenetre de maintenance planifiee invisible (%s)',v_n); end if;
  select count(*) into v_n from public.maintenance_windows where id=mw_d; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V08 fenetre de maintenance terminee visible (%s)',v_n); end if;
  select count(*) into v_n from public.domain_events; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V09 domain_events lisible par un membre (%s)',v_n); end if;
  select count(*) into v_n from public.profile_search_documents; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V10 profile_search_documents lisible par un membre (%s)',v_n); end if;
  update public.platform_settings set value='"detourne"'::jsonb where key='test.rls.member_setting';
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V11 reglage modifie par un membre (%s ligne(s))',v_n); end if;
  update public.feature_flags set is_enabled=true where code='test_rls_flag_off';
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V12 drapeau active par un membre (%s ligne(s))',v_n); end if;

  -- Otto : superadmin. `domain_events` lui reste ferme.
  perform set_config('request.jwt.claims',json_build_object('sub',u_ott::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.domain_events; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V13 domain_events lisible par un superadmin (%s)',v_n); end if;
  select count(*) into v_n from public.platform_settings where key='test.rls.admin_setting'; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('V14 settings.manage ne lit pas un reglage admin (%s)',v_n); end if;
  update public.platform_settings set value='"corrige"'::jsonb where key='test.rls.admin_setting';
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('V15 settings.manage ne peut pas corriger un reglage (%s)',v_n); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.tables_without_policy(); v_cases:=v_cases+1;
  if v_n<>3 then v_fail:=v_fail||format('V16 tables_without_policy() = %s, attendu 3 (domain_events, notification_deliveries, profile_search_documents)',v_n); end if;
  select count(*) into v_n from private.tables_without_rls(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V17 tables_without_rls() renvoie %s ligne(s)',v_n); end if;
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('V18 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'PLATFORM_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PLATFORM_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$plt$;
