-- =====================================================================
-- supabase/tests/rls/0016_messaging_api_suite.sql
--
-- Suite du lot « Messagerie — couche d'acces » (migration 0052).
-- Meme modele auto-nettoyant que 0001 : un unique bloc DO, des fixtures
-- creees sous `postgres` (BYPASSRLS), des assertions executees sous
-- l'identite reelle des comptes, et une exception FINALE qui annule la
-- transaction. L'exception EST le mecanisme de rollback.
--
--   succes -> ERROR: P0001: MESSAGING_API_TESTS_OK: 16 cas, 0 echec
--   echec  -> ERROR: P0001: MESSAGING_API_TESTS_FAILED: 16 cas, K echec(s)
--
-- COUVERTURE
--   M01  ouverture d'une conversation contextuelle
--   M02  IDEMPOTENCE : rejouer `client_message_id` ne cree pas de doublon (D-83)
--   M03  un message persiste porte `delivery_status = sent`, jamais avant (D-83)
--   M04  le compteur de non-lus du destinataire est REEL
--   M05  ... et celui de l'auteur reste a zero
--   M06  un membre BLOQUE ne peut pas ouvrir de conversation (CA-MSG-04)
--   M07  archivage pose chez l'archiveur (D-82)
--   M08  ... et JAMAIS chez l'autre participant (D-82)
--   M09  un NON-PARTICIPANT ne lit pas l'en-tete
--   M10  ... ni le fil de messages
--   M11  ... ni n'y ecrit
--   M12  ... et sa liste de conversations est vide
--   M13  un SUPERADMIN n'accede pas davantage (MASTER PROMPT §24)
--   M14  `unread_total` conforme
--   M15  le marquage lu remet le compteur a zero
--   M16  un nouveau message reactive une conversation archivee (§A.11)
--
-- FIXTURES : Ada + Bob (participants) · Cid (tiers) · Dia (a bloque Ada) ·
--   Eve (superadmin)
-- =====================================================================

do $mapi$
declare
  u_a uuid:='00000000-0000-4000-8010-000000000001'; u_b uuid:='00000000-0000-4000-8010-000000000002';
  u_c uuid:='00000000-0000-4000-8010-000000000003'; u_d uuid:='00000000-0000-4000-8010-000000000004';
  u_e uuid:='00000000-0000-4000-8010-000000000005';
  p_a uuid:='00000000-0000-4000-8010-0000000000a1'; p_b uuid:='00000000-0000-4000-8010-0000000000a2';
  p_c uuid:='00000000-0000-4000-8010-0000000000a3'; p_d uuid:='00000000-0000-4000-8010-0000000000a4';
  p_e uuid:='00000000-0000-4000-8010-0000000000a5';
  v_role smallint; v_conv uuid; v_json jsonb; v_txt text;
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_a,'authenticated','authenticated','test+mapi.a@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_b,'authenticated','authenticated','test+mapi.b@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_c,'authenticated','authenticated','test+mapi.c@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_d,'authenticated','authenticated','test+mapi.d@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_e,'authenticated','authenticated','test+mapi.e@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_a,u_a,'Ada','Api','active','claimed',now(),true),
    (p_b,u_b,'Bob','Api','active','claimed',now(),true),
    (p_c,u_c,'Cid','Api','active','claimed',now(),true),
    (p_d,u_d,'Dia','Api','active','claimed',now(),true),
    (p_e,u_e,'Eve','Api','active','claimed',now(),true);
  select id into v_role from private.roles where code='superadmin';
  insert into private.user_roles (profile_id,role_id) values (p_e,v_role);
  -- Dia a bloque Ada ; Cid est un simple tiers.
  insert into public.profile_blocks (blocker_profile_id,blocked_profile_id) values (p_d,p_a);
  insert into public.user_settings (profile_id,direct_message_policy) values
    (p_b,'members'),(p_d,'members');

  ---------------------------------------------------------------- Ada ouvre
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_a::text,'role','authenticated')::text,true);

  v_json := public.start_conversation(p_b,'Bonjour Bob, echange sur la structuration Data.','expertise','profile',null,'Expertise Data','cli-1');
  v_conv := (v_json->>'conversation_id')::uuid;
  v_cases:=v_cases+1;
  if v_conv is null or (v_json->>'created') <> 'true' then v_fail:=v_fail||format('M01 ouverture de conversation echouee (%s)',v_json::text); end if;

  perform public.send_message(v_conv,'Bonjour Bob, echange sur la structuration Data.','cli-1');
  select count(*) into v_n from public.messages where conversation_id=v_conv; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M02 idempotence client_message_id cassee (%s messages)',v_n); end if;

  select delivery_status into v_txt from public.messages where conversation_id=v_conv; v_cases:=v_cases+1;
  if v_txt<>'sent' then v_fail:=v_fail||format('M03 delivery_status attendu sent, obtenu %s',v_txt); end if;

  select unread_count into v_n from public.conversation_participants where conversation_id=v_conv and profile_id=p_b; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M04 non-lu du destinataire attendu 1, obtenu %s',v_n); end if;
  select unread_count into v_n from public.conversation_participants where conversation_id=v_conv and profile_id=p_a; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M05 non-lu de l''auteur attendu 0, obtenu %s',v_n); end if;

  v_msg:=null;
  begin perform public.start_conversation(p_d,'Message a une personne qui m''a bloque.','other','profile',null,null,'cli-x');
  exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'blocked' then v_fail:=v_fail||format('M06 blocage non applique (%s)',coalesce(v_msg,'aucune erreur')); end if;

  perform public.set_conversation_archived(v_conv,true);
  select count(*) into v_n from public.conversation_participants where conversation_id=v_conv and profile_id=p_a and archived_at is not null; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M07 archivage non pose chez l''archiveur (%s)',v_n); end if;
  select count(*) into v_n from public.conversation_participants where conversation_id=v_conv and profile_id=p_b and archived_at is not null; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M08 archivage propage a l''autre participant, D-82 viole (%s)',v_n); end if;

  ---------------------------------------------------------------- Cid, tiers
  perform set_config('request.jwt.claims',json_build_object('sub',u_c::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin v_json := public.get_conversation(v_conv); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_found' then v_fail:=v_fail||format('M09 un non-participant lit l''en-tete (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null;
  begin v_json := public.list_conversation_messages(v_conv,null,30); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_found' then v_fail:=v_fail||format('M10 un non-participant lit le fil (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null;
  begin perform public.send_message(v_conv,'Intrusion.',null); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_found' then v_fail:=v_fail||format('M11 un non-participant ecrit dans la conversation (%s)',coalesce(v_msg,'aucune erreur')); end if;
  select coalesce(jsonb_array_length(public.list_my_conversations('all',null,null,20)->'rows'),0) into v_n; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M12 la liste d''un tiers contient %s conversation(s)',v_n); end if;

  ---------------------------------------------------------------- Eve, superadmin
  perform set_config('request.jwt.claims',json_build_object('sub',u_e::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin v_json := public.get_conversation(v_conv); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_found' then v_fail:=v_fail||format('M13 un SUPERADMIN accede a la conversation (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- Bob lit
  perform set_config('request.jwt.claims',json_build_object('sub',u_b::text,'role','authenticated')::text,true);
  v_json := public.list_my_conversations('all',null,null,20); v_cases:=v_cases+1;
  if coalesce((v_json->>'unread_total')::int,0)<>1 then v_fail:=v_fail||format('M14 unread_total attendu 1, obtenu %s',v_json->>'unread_total'); end if;
  perform public.mark_conversation_read(v_conv);
  select unread_count into v_n from public.conversation_participants where conversation_id=v_conv and profile_id=p_b; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('M15 marquage lu inefficace (%s)',v_n); end if;
  perform public.send_message(v_conv,'Bien recu Ada, je reviens vers vous.',null);
  select count(*) into v_n from public.conversation_participants where conversation_id=v_conv and profile_id=p_a and archived_at is null; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('M16 un nouveau message ne reactive pas la conversation archivee (%s)',v_n); end if;

  perform set_config('role','postgres',true);
  if array_length(v_fail,1) is null then
    raise exception 'MESSAGING_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception 'MESSAGING_API_TESTS_FAILED: % cas, % echec(s) - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,' | ');
  end if;
end
$mapi$;
