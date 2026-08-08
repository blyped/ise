-- =====================================================================
-- supabase/tests/rls/0013_notifications_settings_suite.sql
--
-- Suite RLS NEGATIVE du lot « Notifications et parametres » (migration 0048).
--   succes -> ERROR: P0001: NOTIFICATIONS_TESTS_OK: 17 cas, 0 echec
--
-- T08 a T10 verifient que le caractere personnel de ces donnees ne cede
-- pas devant un role administratif : un superadmin ne lit ni les
-- notifications, ni les jetons d'appareil, ni les reglages d'un membre.
-- T14 et T15 constatent le caractere APPEND-ONLY des traces de consentement.
--
-- FIXTURES : Gaby (proprietaire) · Hugo (tiers) · Ines (superadmin)
-- =====================================================================

do $ntf$
declare
  u_gaby uuid:='00000000-0000-4000-8009-000000000001'; u_hugo uuid:='00000000-0000-4000-8009-000000000002';
  u_ines uuid:='00000000-0000-4000-8009-000000000003';
  p_gaby uuid:='00000000-0000-4000-8009-0000000000a1'; p_hugo uuid:='00000000-0000-4000-8009-0000000000a2';
  p_ines uuid:='00000000-0000-4000-8009-0000000000a3';
  nt uuid:='00000000-0000-4000-8009-0000000000b1'; cr uuid:='00000000-0000-4000-8009-0000000000c1';
  ta uuid:='00000000-0000-4000-8009-0000000000c2'; dt uuid:='00000000-0000-4000-8009-0000000000c3';
  v_role smallint; v_nt text; v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select code into v_nt from public.notification_types order by code limit 1;
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_gaby,'authenticated','authenticated','test+ntf.gaby@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_hugo,'authenticated','authenticated','test+ntf.hugo@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ines,'authenticated','authenticated','test+ntf.ines@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_gaby,u_gaby,'Gaby','Ntf','active','claimed',now(),true),
    (p_hugo,u_hugo,'Hugo','Ntf','active','claimed',now(),true),
    (p_ines,u_ines,'Ines','Ntf','active','claimed',now(),true);
  select id into v_role from private.roles where code='superadmin';
  insert into private.user_roles (profile_id,role_id) values (p_ines,v_role);
  insert into public.notifications (id,profile_id,notification_type_code,category,priority,title,body) values
    (nt,p_gaby,v_nt,'messages','relevant','Notification de Gaby','Contenu personnel.');
  insert into public.notification_preferences (profile_id,notification_type_code,in_app_enabled) values (p_gaby,v_nt,true);
  insert into public.device_tokens (id,profile_id,platform,expo_push_token) values (dt,p_gaby,'ios','ExponentPushToken[secret-gaby]');
  insert into public.user_settings (profile_id,interface_language) values (p_gaby,'fr');
  insert into public.consent_records (id,profile_id,consent_type,version,is_granted,granted_at) values (cr,p_gaby,'privacy_policy','1.0',true,now());
  insert into public.terms_acceptances (id,profile_id,document_type,version) values (ta,p_gaby,'terms_of_service','1.0');

  -- Hugo : simple tiers.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_hugo::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.notifications where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T01 notifications d''un tiers visibles (%s)',v_n); end if;
  select count(*) into v_n from public.user_settings where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T02 reglages d''un tiers visibles (%s)',v_n); end if;
  select count(*) into v_n from public.device_tokens where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T03 jetons d''appareil d''un tiers visibles (%s)',v_n); end if;
  select count(*) into v_n from public.notification_preferences where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T04 preferences d''un tiers visibles (%s)',v_n); end if;
  select count(*) into v_n from public.consent_records where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T05 consentements d''un tiers visibles (%s)',v_n); end if;
  select count(*) into v_n from public.terms_acceptances where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T06 acceptations d''un tiers visibles (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.notifications (profile_id,notification_type_code,category,priority,title,body)
    values (p_gaby,v_nt,'system','critical','Notification forgee','Contenu injecte par un tiers.');
    v_ok:=false; v_msg:='notification forgee acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('T07 '||coalesce(v_msg,'')); end if;

  -- Ines : superadmin. Aucune de ces donnees ne le concerne davantage.
  perform set_config('request.jwt.claims',json_build_object('sub',u_ines::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.notifications where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T08 un superadmin lit les notifications d''un membre (%s)',v_n); end if;
  select count(*) into v_n from public.device_tokens where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T09 un superadmin lit les jetons d''appareil d''un membre (%s)',v_n); end if;
  select count(*) into v_n from public.user_settings where profile_id=p_gaby; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T10 un superadmin lit les reglages d''un membre (%s)',v_n); end if;

  -- Gaby : proprietaire.
  perform set_config('request.jwt.claims',json_build_object('sub',u_gaby::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.notifications where id=nt; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('T11 la destinataire ne voit pas sa notification (%s)',v_n); end if;
  update public.notifications set read_at=now() where id=nt;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('T12 la destinataire ne peut pas marquer sa notification lue (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.notifications (profile_id,notification_type_code,category,priority,title,body)
    values (p_gaby,v_nt,'system','critical','Auto-notification','Contenu forge par la destinataire.');
    v_ok:=false; v_msg:='auto-notification acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('T13 '||coalesce(v_msg,'')); end if;
  update public.consent_records set is_granted=false where id=cr;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T14 trace de consentement reecrite (%s ligne(s))',v_n); end if;
  delete from public.terms_acceptances where id=ta;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T15 acceptation des CGU supprimee (%s ligne(s))',v_n); end if;
  select count(*) into v_n from public.notification_deliveries; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T16 notification_deliveries n''est plus fermee (%s)',v_n); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('T17 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'NOTIFICATIONS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'NOTIFICATIONS_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$ntf$;
