-- =====================================================================
-- supabase/tests/rls/0017_settings_privacy_suite.sql
--
-- Suite des lots « Notifications » (ISE-098) et « Parametres,
-- confidentialite, preferences » (ISE-099), couche d'acces 0053/0054.
-- Modele auto-nettoyant : l'exception finale annule la transaction.
--
--   succes -> ERROR: P0001: SETTINGS_API_TESTS_OK: 23 cas, 0 echec
--
-- COUVERTURE
--   N01-N03  un membre ne lit ni ne marque lue la notification d'un autre
--   N04      les compteurs viennent de public.notifications, rien n'est simule
--   N05-N07  « Action requise » est une PRIORITE, pas une categorie (D-81)
--   S01-S02  un changement de visibilite est REELLEMENT applique en base
--   S03-S04  un niveau hors `allowed_levels` est refuse PAR LA BASE (D-73)
--   S05      les 36 types ACTIFS du catalogue sont resolus (D-80 ; C-08 a
--            desactive `message_received` avec la messagerie)
--   S06-S07  une preference ecrite bascule le preset en « personnalise »
--   S08      aucune push sur un type qui l'interdit (D-80)
--   S09      un type non configurable ne se coupe pas
--   S10-S11  consentements APPEND-ONLY : la revocation est une ligne de plus
--   A01      SYS-008 : la suppression exige la confirmation exacte
--   A02-A05  SYS-008 / D-19 : le compte disparait, le PROFIL REFERENCE
--            subsiste, `ise_profiles.user_id` repasse a NULL et le profil
--            redevient `unclaimed`
--
-- FIXTURES : Gina (proprietaire) · Hank (tiers) · Iris (compte supprime)
-- =====================================================================

do $sapi$
declare
  u_g uuid:='00000000-0000-4000-8011-000000000001'; u_h uuid:='00000000-0000-4000-8011-000000000002';
  u_i uuid:='00000000-0000-4000-8011-000000000003';
  p_g uuid:='00000000-0000-4000-8011-0000000000a1'; p_h uuid:='00000000-0000-4000-8011-0000000000a2';
  p_i uuid:='00000000-0000-4000-8011-0000000000a3';
  n1 uuid:='00000000-0000-4000-8011-0000000000b1'; n2 uuid:='00000000-0000-4000-8011-0000000000b2';
  v_json jsonb; v_txt text; v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_g,'authenticated','authenticated','test+sapi.g@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_h,'authenticated','authenticated','test+sapi.h@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_i,'authenticated','authenticated','test+sapi.i@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,verification_status,is_test_account) values
    (p_g,u_g,'Gina','Set','active','claimed',now(),'verified',true),
    (p_h,u_h,'Hank','Set','active','claimed',now(),'unverified',true),
    (p_i,u_i,'Iris','Set','active','claimed',now(),'unverified',true);
  insert into public.notifications (id,profile_id,notification_type_code,category,priority,title,body) values
    (n1,p_g,'mentorship_request_received','mentorship','action_required','Nouvelle demande de mentorat.','Contexte.'),
    (n2,p_g,'news_major_published','news','info','Nouvelle actualite du reseau.','Contexte.');

  ---------------------------------------------------------------- Hank, tiers
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_h::text,'role','authenticated')::text,true);
  select coalesce(jsonb_array_length(public.list_my_notifications('all',null,null,20)->'rows'),0) into v_n; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('N01 un tiers lit %s notification(s) d''autrui',v_n); end if;
  v_msg:=null;
  begin perform public.set_notification_read(n1,true); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_found' then v_fail:=v_fail||format('N02 un tiers marque lue la notification d''autrui (%s)',coalesce(v_msg,'aucune erreur')); end if;
  perform public.mark_all_notifications_read();
  select count(*) into v_n from public.notifications where profile_id=p_g and read_at is not null; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('N03 « tout marquer comme lu » d''un tiers a touche %s ligne(s)',v_n); end if;

  ---------------------------------------------------------------- Gina, proprietaire
  perform set_config('request.jwt.claims',json_build_object('sub',u_g::text,'role','authenticated')::text,true);
  v_json := public.my_notification_summary(); v_cases:=v_cases+1;
  if (v_json->>'unread')::int<>2 or (v_json->>'action_required')::int<>1 then
    v_fail:=v_fail||format('N04 compteurs faux (unread=%s action_required=%s)',v_json->>'unread',v_json->>'action_required'); end if;
  select jsonb_array_length(public.list_my_notifications('action_required',null,null,20)->'rows') into v_n; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('N05 le filtre de PRIORITE « action requise » renvoie %s ligne(s)',v_n); end if;
  select jsonb_array_length(public.list_my_notifications('all','news',null,20)->'rows') into v_n; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('N06 le filtre de CATEGORIE renvoie %s ligne(s)',v_n); end if;
  v_msg:=null;
  begin perform public.list_my_notifications('all','action_required',null,20); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('N07 « action_required » accepte comme CATEGORIE, D-81 viole (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- Visibilite par champ (D-73)
  perform public.set_field_visibility('city','promotion');
  select visibility into v_txt from public.profile_visibility where profile_id=p_g and field_key='city'; v_cases:=v_cases+1;
  if v_txt is distinct from 'promotion' then v_fail:=v_fail||format('S01 changement de visibilite non applique en base (%s)',coalesce(v_txt,'aucune ligne')); end if;
  select (x->>'level') into v_txt from jsonb_array_elements(public.list_my_field_visibility()) x where x->>'field_key'='city'; v_cases:=v_cases+1;
  if v_txt is distinct from 'promotion' then v_fail:=v_fail||format('S02 la lecture ne reflete pas le changement (%s)',coalesce(v_txt,'null')); end if;
  v_msg:=null;
  begin perform public.set_field_visibility('phone','members'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('S03 niveau hors allowed_levels accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null;
  begin perform public.set_field_visibility('address','connections'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('S04 adresse postale exposable aux relations (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- Preferences (D-80)
  select count(*) into v_n from jsonb_array_elements(public.list_my_notification_preferences()); v_cases:=v_cases+1;
  if v_n<>36 then v_fail:=v_fail||format('S05 catalogue de preferences : %s types au lieu de 36',v_n); end if;
  perform public.set_notification_preference('connection_request_received',false,'off',false);
  select in_app_enabled::text into v_txt from public.notification_preferences where profile_id=p_g and notification_type_code='connection_request_received'; v_cases:=v_cases+1;
  if v_txt is distinct from 'false' then v_fail:=v_fail||format('S06 preference non enregistree (%s)',coalesce(v_txt,'null')); end if;
  select notification_preset into v_txt from public.user_settings where profile_id=p_g; v_cases:=v_cases+1;
  if v_txt is distinct from 'custom' then v_fail:=v_fail||format('S07 preset non bascule en custom (%s)',coalesce(v_txt,'null')); end if;
  v_msg:=null;
  begin perform public.set_notification_preference('news_major_published',true,'immediate',true); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('S08 push acceptee sur un type qui l''interdit, D-80 (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null;
  begin perform public.set_notification_preference('account_security_event',false,'off',false); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('S09 un type non configurable a pu etre coupe (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- Consentements APPEND-ONLY
  perform public.record_consent('marketing_communication','1.0',true);
  perform public.record_consent('marketing_communication','1.0',false);
  select count(*) into v_n from public.consent_records where profile_id=p_g and consent_type='marketing_communication'; v_cases:=v_cases+1;
  if v_n<>2 then v_fail:=v_fail||format('S10 la revocation n''est pas une nouvelle ligne (%s ligne(s))',v_n); end if;
  select (x->>'granted') into v_txt from jsonb_array_elements(public.list_my_consents()->'consents') x where x->>'consent_type'='marketing_communication'; v_cases:=v_cases+1;
  if v_txt is distinct from 'false' then v_fail:=v_fail||format('S11 la trace faisant foi n''est pas la revocation (%s)',coalesce(v_txt,'null')); end if;

  ---------------------------------------------------------------- SYS-008 / D-19
  v_msg:=null;
  begin perform public.delete_my_account('oui'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('A01 suppression sans confirmation exacte acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_i::text,'role','authenticated')::text,true);
  perform public.delete_my_account('SUPPRIMER');
  perform set_config('role','postgres',true);
  select count(*) into v_n from public.ise_profiles where id=p_i; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('A02 le profil reference a ete detruit, D-19 viole (%s)',v_n); end if;
  select count(*) into v_n from public.ise_profiles where id=p_i and user_id is null; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('A03 ise_profiles.user_id n''est pas repasse a NULL (%s)',v_n); end if;
  select claim_status into v_txt from public.ise_profiles where id=p_i; v_cases:=v_cases+1;
  if v_txt is distinct from 'unclaimed' then v_fail:=v_fail||format('A04 claim_status attendu unclaimed, obtenu %s',v_txt); end if;
  select count(*) into v_n from auth.users where id=u_i; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('A05 le compte Auth existe encore (%s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'SETTINGS_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception 'SETTINGS_API_TESTS_FAILED: % cas, % echec(s) - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,' | ');
  end if;
end
$sapi$;
