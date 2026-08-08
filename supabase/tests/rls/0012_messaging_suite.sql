-- =====================================================================
-- supabase/tests/rls/0012_messaging_suite.sql
--
-- Suite RLS NEGATIVE du lot « Messagerie » (migration 0047).
--   succes -> ERROR: P0001: MESSAGING_TESTS_OK: 18 cas, 0 echec
--
-- G08 a G10 sont les cas structurants : meme un SUPERADMIN ne lit ni la
-- conversation, ni les messages, ni les pieces jointes (MASTER PROMPT §24).
--
-- FIXTURES : Ana + Bilal (participants) · Chloe (non-participante) ·
--   Diane (`direct_message_policy = none`) · Elias (a BLOQUE Ana) ·
--   Fara (superadmin)
-- =====================================================================

do $msg$
declare
  u_ana uuid:='00000000-0000-4000-8008-000000000001'; u_bil uuid:='00000000-0000-4000-8008-000000000002';
  u_chl uuid:='00000000-0000-4000-8008-000000000003'; u_dia uuid:='00000000-0000-4000-8008-000000000004';
  u_eli uuid:='00000000-0000-4000-8008-000000000005'; u_far uuid:='00000000-0000-4000-8008-000000000006';
  p_ana uuid:='00000000-0000-4000-8008-0000000000a1'; p_bil uuid:='00000000-0000-4000-8008-0000000000a2';
  p_chl uuid:='00000000-0000-4000-8008-0000000000a3'; p_dia uuid:='00000000-0000-4000-8008-0000000000a4';
  p_eli uuid:='00000000-0000-4000-8008-0000000000a5'; p_far uuid:='00000000-0000-4000-8008-0000000000a6';
  cv uuid:='00000000-0000-4000-8008-0000000000b1';
  m1 uuid:='00000000-0000-4000-8008-0000000000c1'; m2 uuid:='00000000-0000-4000-8008-0000000000c2';
  at1 uuid:='00000000-0000-4000-8008-0000000000d1';
  v_role smallint; v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_ana,'authenticated','authenticated','test+msg.ana@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_bil,'authenticated','authenticated','test+msg.bilal@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_chl,'authenticated','authenticated','test+msg.chloe@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_dia,'authenticated','authenticated','test+msg.diane@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_eli,'authenticated','authenticated','test+msg.elias@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_far,'authenticated','authenticated','test+msg.fara@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_ana,u_ana,'Ana','Msg','active','claimed',now(),true),
    (p_bil,u_bil,'Bilal','Msg','active','claimed',now(),true),
    (p_chl,u_chl,'Chloe','Msg','active','claimed',now(),true),
    (p_dia,u_dia,'Diane','Msg','active','claimed',now(),true),
    (p_eli,u_eli,'Elias','Msg','active','claimed',now(),true),
    (p_far,u_far,'Fara','Msg','active','claimed',now(),true);
  select id into v_role from private.roles where code='superadmin';
  insert into private.user_roles (profile_id,role_id) values (p_far,v_role);
  insert into public.user_settings (profile_id,direct_message_policy) values (p_dia,'none');
  insert into public.profile_blocks (blocker_profile_id,blocked_profile_id) values (p_eli,p_ana);
  insert into public.conversations (id,conversation_type,created_by_profile_id) values (cv,'direct',p_ana);
  insert into public.conversation_participants (conversation_id,profile_id,membership_status) values
    (cv,p_ana,'active'),(cv,p_bil,'active');
  insert into public.messages (id,conversation_id,sender_profile_id,message_type,body,delivery_status) values
    (m1,cv,p_ana,'text','Message d''Ana, prive.','sent'),
    (m2,cv,p_bil,'text','Message de Bilal, prive.','sent');
  insert into public.message_attachments (id,message_id,storage_path,original_filename,mime_type,size_bytes) values
    (at1,m1,'message-attachments/'||cv::text||'/piece.pdf','piece.pdf','application/pdf',2048);
  insert into public.message_hides (message_id,profile_id) values (m2,p_ana);

  -- Chloe : non-participante.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_chl::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.conversations where id=cv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G01 conversation visible par un non-participant (%s)',v_n); end if;
  select count(*) into v_n from public.messages where conversation_id=cv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G02 messages visibles par un non-participant (%s)',v_n); end if;
  select count(*) into v_n from public.message_attachments where id=at1; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G03 piece jointe visible par un non-participant (%s)',v_n); end if;
  select count(*) into v_n from public.conversation_participants where conversation_id=cv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G04 liste des participants visible par un tiers (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.conversation_participants (conversation_id,profile_id,membership_status) values (cv,p_chl,'active');
    v_ok:=false; v_msg:='auto-ajout accepte';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G05 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.messages (conversation_id,sender_profile_id,message_type,body,delivery_status)
    values (cv,p_chl,'text','Intrusion dans une conversation privee.','sent');
    v_ok:=false; v_msg:='message accepte';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G06 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.message_reports (message_id,conversation_id,reporter_profile_id,reason_code,description,status)
    values (m1,cv,p_chl,'harassment','Signalement d''une conversation dont on n''est pas participant.','open');
    v_ok:=false; v_msg:='signalement accepte';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G07 '||coalesce(v_msg,'')); end if;

  -- Fara : superadmin. Le contenu des echanges prives ne lui est PAS accessible.
  perform set_config('request.jwt.claims',json_build_object('sub',u_far::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.conversations where id=cv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G08 un superadmin lit une conversation privee (%s)',v_n); end if;
  select count(*) into v_n from public.messages where conversation_id=cv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G09 un superadmin lit des messages prives (%s)',v_n); end if;
  select count(*) into v_n from public.message_attachments where id=at1; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G10 un superadmin lit une piece jointe privee (%s)',v_n); end if;

  -- Ana : participante ; elle a masque m2 pour elle-meme.
  perform set_config('request.jwt.claims',json_build_object('sub',u_ana::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.messages where id=m1; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('G11 la participante ne voit pas son propre message (%s)',v_n); end if;
  select count(*) into v_n from public.messages where id=m2; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G12 message masque encore visible pour celle qui l''a masque (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.messages (conversation_id,sender_profile_id,message_type,body,delivery_status)
    values (cv,p_bil,'text','Message envoye au nom d''un autre.','sent');
    v_ok:=false; v_msg:='usurpation d''expediteur acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G13 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.conversation_participants (conversation_id,profile_id,membership_status) values (cv,p_dia,'active');
    v_ok:=false; v_msg:='ajout accepte malgre direct_message_policy = none';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G14 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.conversation_participants (conversation_id,profile_id,membership_status) values (cv,p_eli,'active');
    v_ok:=false; v_msg:='ajout accepte malgre un blocage';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G15 '||coalesce(v_msg,'')); end if;

  -- Bilal : participant ; le masquage d'Ana ne le concerne pas.
  perform set_config('request.jwt.claims',json_build_object('sub',u_bil::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.messages where id=m2; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('G16 le masquage d''un tiers a masque le message pour tous (%s)',v_n); end if;
  update public.messages set body='Reecrit par Bilal' where id=m1;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G17 message d''un tiers reecrit (%s ligne(s))',v_n); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G18 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'MESSAGING_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'MESSAGING_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$msg$;
