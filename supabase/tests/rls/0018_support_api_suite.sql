-- =====================================================================
-- supabase/tests/rls/0018_support_api_suite.sql
--
-- Suite du lot « Aide & Support » (ISE-100), couche d'acces 0053.
-- Modele auto-nettoyant : l'exception finale annule la transaction.
--
--   succes -> ERROR: P0001: SUPPORT_API_TESTS_OK: 15 cas, 0 echec
--
-- COUVERTURE
--   U00  D-85 : AUCUNE colonne de delai cible sur support_tickets
--   U01  creation d'un ticket et reference lisible « ISE-… »
--   U02  notification « Votre demande a ete recue. » reellement emise
--   U03  categorie inconnue refusee
--   U04  la NOTE INTERNE du support n'atteint pas le demandeur
--   U05  ... et le fil du demandeur ne contient que ses messages
--   U06  un membre ne lit PAS le ticket d'un autre
--   U07  ... ni n'y repond
--   U08  ... et sa liste de demandes est vide
--   U09  signalement cree
--   U10  doublon de signalement ouvert refuse
--   U11  motif hors `report_reasons.applies_to` refuse (D-66)
--   U12  auto-signalement refuse
--   U13  un agent ne change pas `status` par UPDATE direct (trigger 0049)
--   U14  ... la fonction atomique, elle, applique la transition
--
-- FIXTURES : Jo (demandeur) · Kim (tiers) · Lea (support_agent)
-- =====================================================================

do $uapi$
declare
  u_j uuid:='00000000-0000-4000-8012-000000000001'; u_k uuid:='00000000-0000-4000-8012-000000000002';
  u_l uuid:='00000000-0000-4000-8012-000000000003';
  p_j uuid:='00000000-0000-4000-8012-0000000000a1'; p_k uuid:='00000000-0000-4000-8012-0000000000a2';
  p_l uuid:='00000000-0000-4000-8012-0000000000a3';
  v_sa smallint; v_t uuid; v_json jsonb; v_txt text;
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select id into v_sa from private.roles where code='support_agent';
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_j,'authenticated','authenticated','test+uapi.j@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_k,'authenticated','authenticated','test+uapi.k@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_l,'authenticated','authenticated','test+uapi.l@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_j,u_j,'Jo','Sup','active','claimed',now(),true),
    (p_k,u_k,'Kim','Sup','active','claimed',now(),true),
    (p_l,u_l,'Lea','Sup','active','claimed',now(),true);
  insert into private.user_roles (profile_id,role_id) values (p_l,v_sa);

  -- D-85 : aucune colonne de delai cible n'existe sur les tickets.
  select count(*) into v_n from information_schema.columns
   where table_schema='public' and table_name='support_tickets'
     and (column_name like '%sla%' or column_name like '%due%' or column_name like '%target%'
          or column_name like '%deadline%');
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U00 %s colonne(s) de delai cible sur support_tickets (D-85)',v_n); end if;

  ---------------------------------------------------------------- Jo depose
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_j::text,'role','authenticated')::text,true);
  v_json := public.create_support_ticket('account','Impossible de changer mon organisation',
              'Le formulaire refuse la modification de mon organisation actuelle depuis hier.',
              jsonb_build_object('page','/parametres'), 'ISE-TESTCORREL');
  v_t := (v_json->>'ticket_id')::uuid; v_cases:=v_cases+1;
  if v_t is null or (v_json->>'reference_code') not like 'ISE-%' then
    v_fail:=v_fail||format('U01 creation de ticket invalide (%s)',v_json::text); end if;

  select count(*) into v_n from public.notifications
   where profile_id=p_j and entity_type='support_ticket' and entity_id=v_t
     and title='Votre demande a été reçue.';
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U02 notification de reception absente (%s)',v_n); end if;

  v_msg:=null;
  begin perform public.create_support_ticket('categorie_bidon','Sujet de test','Description suffisamment longue.','{}'::jsonb,null);
  exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('U03 categorie inconnue acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- Note interne posee par l'agent.
  perform set_config('role','postgres',true);
  insert into public.support_messages (ticket_id,author_kind,author_profile_id,body,is_internal_note)
  values (v_t,'agent',p_l,'NOTE INTERNE : ne doit jamais atteindre le demandeur.',true);
  perform set_config('role','authenticated',true);

  v_json := public.get_support_ticket(v_t); v_cases:=v_cases+1;
  select count(*) into v_n from jsonb_array_elements(v_json->'messages') m
   where m->>'body' like 'NOTE INTERNE%';
  if v_n<>0 then v_fail:=v_fail||format('U04 la note interne atteint le demandeur (%s)',v_n); end if;
  select jsonb_array_length(v_json->'messages') into v_n; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('U05 le fil du demandeur contient %s message(s) au lieu de 1',v_n); end if;

  ---------------------------------------------------------------- Kim, tiers
  perform set_config('request.jwt.claims',json_build_object('sub',u_k::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin v_json := public.get_support_ticket(v_t); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_found' then v_fail:=v_fail||format('U06 un tiers lit le ticket d''autrui (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null;
  begin perform public.reply_to_support_ticket(v_t,'Reponse intrusive.'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_found' then v_fail:=v_fail||format('U07 un tiers repond au ticket d''autrui (%s)',coalesce(v_msg,'aucune erreur')); end if;
  select coalesce(jsonb_array_length(public.list_my_support_tickets(null,20)->'rows'),0) into v_n; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('U08 la liste d''un tiers contient %s ticket(s)',v_n); end if;

  ---------------------------------------------------------------- Signalements (D-66)
  v_json := public.create_report('profile',p_j,'fake_profile','Ce profil semble fictif.'); v_cases:=v_cases+1;
  if (v_json->>'report_id') is null then v_fail:=v_fail||format('U09 signalement non cree (%s)',v_json::text); end if;
  v_msg:=null;
  begin perform public.create_report('profile',p_j,'fake_profile','Doublon.'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'request_already_sent' then v_fail:=v_fail||format('U10 doublon de signalement accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null;
  begin perform public.create_report('message',gen_random_uuid(),'fake_profile','Motif inapplicable.'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('U11 motif hors applies_to accepte, D-66 (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null;
  begin perform public.create_report('profile',p_k,'spam','Auto-signalement.'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'cannot_target_self' then v_fail:=v_fail||format('U12 auto-signalement accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- Transitions atomiques
  perform set_config('request.jwt.claims',json_build_object('sub',u_l::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin update public.support_tickets set status='in_progress' where id=v_t; exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('U13 un agent change status par UPDATE direct (%s)',coalesce(v_msg,'aucune erreur')); end if;
  perform public.transition_support_ticket(v_t,'in_progress');
  select status into v_txt from public.support_tickets where id=v_t; v_cases:=v_cases+1;
  if v_txt is distinct from 'in_progress' then v_fail:=v_fail||format('U14 la fonction atomique n''a pas applique la transition (%s)',coalesce(v_txt,'null')); end if;

  perform set_config('role','postgres',true);
  if array_length(v_fail,1) is null then
    raise exception 'SUPPORT_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception 'SUPPORT_API_TESTS_FAILED: % cas, % echec(s) - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,' | ');
  end if;
end
$uapi$;
