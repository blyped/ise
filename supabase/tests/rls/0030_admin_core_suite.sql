-- =====================================================================
-- supabase/tests/rls/0030_admin_core_suite.sql
--
-- Suite du lot « Back-office Superadmin — coeur » (0076 + 0077).
-- Modele auto-nettoyant : l'exception finale annule la transaction.
--
--   succes -> ERROR: P0001: ADMIN_CORE_TESTS_OK: 72 cas, 0 echec
--
-- LIMITE ASSUMEE — journalisation des REFUS : les fonctions appellent
-- private.log_audit(result => 'denied') AVANT de lever 42501, mais
-- PostgreSQL annule cette ecriture avec la sous-transaction avortee
-- (aucune transaction autonome). Le refus lui-meme est verifie (A06,
-- A07, D02) ; la persistance du refus ne l'est pas, car elle n'existe
-- structurellement pas. Les actions REUSSIES, elles, doivent etre
-- journalisees : C02c, D04, D05, E08 echouent si elles ne le sont pas.
--
-- COUVERTURE
--   A01-A13  un membre sans permission n'accede a AUCUN RPC admin,
--            et les refus d'actions sensibles sont journalises (denied)
--   B01-B06  reclamations : file, prise en charge, rejet motive,
--            approbation par profiles.verify, transitions fermees
--   C01-C04  membres : suspension / reactivation, motif obligatoire,
--            action tracee dans moderation_actions ET private.audit_log
--   D01-D06  moderation : machine d'etats des signalements, action de
--            moderation a effet reel, journalisation d'audit
--   E01-E06  support : file agent, note interne INVISIBLE du demandeur,
--            transitions fermees, notification reelle a la resolution
--   F01-F05  promotions : creation, delegue (role synchronise),
--            revue des membres manquants et des signalements ISE-009
--   G01-G07  moderation des appels et des opportunites (0077) :
--            motif obligatoire, retrait effectif, restauration,
--            file pending, journalisation
--   H01-H06  roles (0077) : un moderator ne peut PAS attribuer, jamais
--            sur soi-meme, attribution/retrait journalises et effectifs
--   I01-I04  notes administratives (schema private) et indice de
--            contact lisible UNIQUEMENT avec promotions.manage,
--            lecture journalisee
--
-- FIXTURES : Mem (membre simple) · Vera (promotion_manager =
-- profiles.verify) · Mod (moderator) · Sam (support_agent) ·
-- Adm (superadmin) · Cli (compte sans profil, demandeur) ·
-- P_u (profil reference non reclame)
-- =====================================================================

do $adm$
declare
  u_m uuid:='00000000-0000-4000-8030-000000000001'; u_v uuid:='00000000-0000-4000-8030-000000000002';
  u_o uuid:='00000000-0000-4000-8030-000000000003'; u_s uuid:='00000000-0000-4000-8030-000000000004';
  u_a uuid:='00000000-0000-4000-8030-000000000005'; u_c uuid:='00000000-0000-4000-8030-000000000006';
  p_m uuid:='00000000-0000-4000-8030-0000000000a1'; p_v uuid:='00000000-0000-4000-8030-0000000000a2';
  p_o uuid:='00000000-0000-4000-8030-0000000000a3'; p_s uuid:='00000000-0000-4000-8030-0000000000a4';
  p_a uuid:='00000000-0000-4000-8030-0000000000a5'; p_u uuid:='00000000-0000-4000-8030-0000000000b1';
  v_promo bigint; v_claim uuid; v_report uuid; v_ticket uuid; v_sug uuid; v_psug uuid;
  v_call uuid:='00000000-0000-4000-8030-0000000000c1';
  v_opp  uuid:='00000000-0000-4000-8030-0000000000c2';
  v_sug2 uuid:='00000000-0000-4000-8030-0000000000c3';
  v_json jsonb; v_msg text; v_n bigint; v_txt text; v_new_promo bigint;
  v_cases integer:=0; v_fail text[]:=array[]::text[];
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);

  insert into auth.users (instance_id,id,aud,role,email,email_confirmed_at,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_m,'authenticated','authenticated','test+adm.mem@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_v,'authenticated','authenticated','test+adm.vera@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_o,'authenticated','authenticated','test+adm.mod@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_s,'authenticated','authenticated','test+adm.sam@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_a,'authenticated','authenticated','test+adm.adm@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_c,'authenticated','authenticated','test+adm.cli@ise.test',now(),now(),now());

  select id into v_promo from public.promotions where graduation_year=2003 and program_code='ISE' limit 1;

  insert into public.ise_profiles (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,is_test_account) values
    (p_m,u_m,'Mem','Adm',v_promo,'active','claimed',now(),true),
    (p_v,u_v,'Vera','Adm',v_promo,'active','claimed',now(),true),
    (p_o,u_o,'Mod','Adm',v_promo,'active','claimed',now(),true),
    (p_s,u_s,'Sam','Adm',v_promo,'active','claimed',now(),true),
    (p_a,u_a,'Adm','Adm',v_promo,'active','claimed',now(),true);
  -- Profil reference NON reclame, avec e-mail historique prive.
  insert into public.ise_profiles (id,first_name,last_name,promotion_id,profile_status,claim_status,is_test_account) values
    (p_u,'Ref','Nonreclame',v_promo,'referenced','unclaimed',true);
  insert into private.profile_contacts (profile_id,primary_email) values (p_u,'historique.ref@ise.test');

  insert into private.user_roles (profile_id,role_id)
  select p_v, r.id from private.roles r where r.code='promotion_manager';
  insert into private.user_roles (profile_id,role_id)
  select p_o, r.id from private.roles r where r.code='moderator';
  insert into private.user_roles (profile_id,role_id)
  select p_s, r.id from private.roles r where r.code='support_agent';
  insert into private.user_roles (profile_id,role_id)
  select p_a, r.id from private.roles r where r.code='superadmin';

  ---------------------------------------------------------------- A. Mem, sans permission
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_m::text,'role','authenticated')::text,true);

  v_msg:=null; begin v_json:=public.admin_dashboard_counters(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A01 tableau de bord ouvert sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_list_profiles(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A02 liste des profils ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_list_profile_claims(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A03 file des reclamations ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_list_reports(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A04 file des signalements ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_list_support_tickets(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A05 file support ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_set_profile_status(p_u,'suspend','tentative interdite de suspension'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A06 suspension possible sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin perform public.approve_profile_claim(extensions.gen_random_uuid()); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A07 approve_profile_claim sans profiles.verify (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_list_network_calls(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A09 file des appels ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_list_opportunities(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A10 file des opportunites ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_set_profile_role(p_u,'moderator',true,'tentative interdite d''attribution'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A11 attribution de role possible sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_list_profile_notes(p_u); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A12 notes administratives lisibles sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_get_missing_member_contact_hint(extensions.gen_random_uuid()); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A13 indice de contact lisible sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- Vera n'a QUE profiles.verify : la liste des membres lui reste fermee.
  perform set_config('request.jwt.claims',json_build_object('sub',u_v::text,'role','authenticated')::text,true);
  v_msg:=null; begin v_json:=public.admin_list_profiles(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A08 profiles.verify ne doit pas ouvrir la liste des membres (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- B. Reclamations
  perform set_config('request.jwt.claims',json_build_object('sub',u_c::text,'role','authenticated')::text,true);
  select claim_id into v_claim
  from public.submit_profile_claim(p_u,'historical_email','{"declared_promotion":"ISE 2003"}'::jsonb);
  v_cases:=v_cases+1;
  if v_claim is null then v_fail:=array_append(v_fail,'B01 soumission de reclamation en echec'); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_v::text,'role','authenticated')::text,true);
  v_json:=public.admin_list_profile_claims();
  v_cases:=v_cases+1;
  select count(*) into v_n from jsonb_array_elements(v_json->'rows') r where (r->>'claim_id')::uuid=v_claim;
  if v_n<>1 then v_fail:=v_fail||format('B02 la reclamation n''apparait pas dans la file (%s)',v_n); end if;

  v_json:=public.admin_start_claim_review(v_claim);
  perform set_config('role','postgres',true);
  select status into v_txt from public.profile_claims where id=v_claim;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_txt is distinct from 'under_review' then v_fail:=v_fail||format('B03 prise en charge inoperante (%s)',v_txt); end if;

  -- Concordance : l'adresse historique ne sort JAMAIS en clair.
  v_json:=public.admin_get_profile_claim(v_claim);
  v_cases:=v_cases+1;
  if v_json::text like '%historique.ref@ise.test%' then v_fail:=array_append(v_fail,'B04 l''adresse historique sort en clair (D-107)'); end if;

  v_msg:=null; begin perform public.reject_profile_claim(v_claim,'Correspondance non etablie avec l''annuaire.'); exception when others then v_msg:=sqlerrm; end;
  perform set_config('role','postgres',true);
  select status into v_txt from public.profile_claims where id=v_claim;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_msg is not null or v_txt is distinct from 'rejected' then
    v_fail:=v_fail||format('B05 rejet motive en echec (%s / %s)',coalesce(v_msg,'ok'),v_txt); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_c::text,'role','authenticated')::text,true);
  select claim_id into v_claim
  from public.submit_profile_claim(p_u,'historical_email','{}'::jsonb);
  perform set_config('request.jwt.claims',json_build_object('sub',u_v::text,'role','authenticated')::text,true);
  perform public.approve_profile_claim(v_claim);
  perform set_config('role','postgres',true);
  select user_id into v_txt from public.ise_profiles where id=p_u;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_txt::uuid is distinct from u_c then v_fail:=v_fail||format('B06 l''approbation n''a pas rattache le compte (%s)',v_txt); end if;
  v_msg:=null; begin perform public.approve_profile_claim(v_claim); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('B07 double approbation acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- C. Membres
  perform set_config('request.jwt.claims',json_build_object('sub',u_o::text,'role','authenticated')::text,true);

  v_msg:=null; begin v_json:=public.admin_set_profile_status(p_m,'suspend','court'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'reason_required' then v_fail:=v_fail||format('C01 motif insuffisant accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.admin_set_profile_status(p_m,'suspend','Comportement signale, mesure conservatoire.');
  perform set_config('role','postgres',true);
  select profile_status into v_txt from public.ise_profiles where id=p_m;
  v_cases:=v_cases+1;
  if v_txt is distinct from 'suspended' then v_fail:=v_fail||format('C02 suspension inoperante (%s)',v_txt); end if;
  select count(*) into v_n from public.moderation_actions
   where target_profile_id=p_m and action_type='account_suspension' and moderator_profile_id=p_o;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('C02b suspension absente de moderation_actions (%s)',v_n); end if;
  select count(*) into v_n from private.audit_log
   where action='admin.profile_status_changed' and result='success' and object_id=p_m::text;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'C02c suspension non journalisee dans private.audit_log'); end if;

  v_msg:=null; begin v_json:=public.admin_set_profile_status(p_m,'suspend','Suspension repetee interdite ici.'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('C03 transition hors machine acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.admin_set_profile_status(p_m,'reactivate','Mesure conservatoire levee apres revue.');
  perform set_config('role','postgres',true);
  select profile_status into v_txt from public.ise_profiles where id=p_m;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_txt is distinct from 'active' then v_fail:=v_fail||format('C04 reactivation inoperante (%s)',v_txt); end if;

  ---------------------------------------------------------------- D. Moderation
  perform set_config('request.jwt.claims',json_build_object('sub',u_m::text,'role','authenticated')::text,true);
  v_json:=public.create_report('profile',p_s,'spam','Sollicitations repetees non pertinentes.');
  v_report:=(v_json->>'report_id')::uuid;
  v_cases:=v_cases+1;
  if v_report is null then v_fail:=array_append(v_fail,'D01 signalement non cree'); end if;

  v_msg:=null; begin perform public.transition_report(v_report,'reviewing'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'permission_denied' then v_fail:=v_fail||format('D02 un membre transitionne un signalement (%s)',coalesce(v_msg,'aucune erreur')); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_o::text,'role','authenticated')::text,true);
  v_msg:=null; begin perform public.transition_report(v_report,'resolved','content_removed'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('D03 open->resolved accepte hors machine (%s)',coalesce(v_msg,'aucune erreur')); end if;

  perform public.transition_report(v_report,'reviewing');
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.audit_log
   where action='moderation.report_transitioned' and result='success' and object_id=v_report::text;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'D04 transition de signalement non journalisee : elle n''existe pas'); end if;

  v_json:=public.admin_record_moderation_action('warn','Rappel formel des regles de messagerie.',v_report,null);
  v_cases:=v_cases+1;
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.audit_log
   where action='moderation.action_recorded' and result='success' and object_id=(v_json->>'action_id');
  if v_n<1 then v_fail:=array_append(v_fail,'D05 action de moderation non journalisee : elle n''existe pas'); end if;
  select count(*) into v_n from public.notifications
   where profile_id=p_s and notification_type_code='moderation_warning';
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('D05b avertissement sans notification reelle (%s)',v_n); end if;

  perform public.transition_report(v_report,'resolved','member_warned');
  perform set_config('role','postgres',true);
  select status into v_txt from public.reports where id=v_report;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_txt is distinct from 'resolved' then v_fail:=v_fail||format('D06 resolution inoperante (%s)',v_txt); end if;

  ---------------------------------------------------------------- E. Support
  perform set_config('request.jwt.claims',json_build_object('sub',u_m::text,'role','authenticated')::text,true);
  v_json:=public.create_support_ticket('account','Probleme d''acces a mon compte',
            'Je ne parviens plus a modifier mes informations depuis hier soir.','{}'::jsonb,null);
  v_ticket:=(v_json->>'ticket_id')::uuid;
  v_cases:=v_cases+1;
  if v_ticket is null then v_fail:=array_append(v_fail,'E01 ticket non cree'); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_s::text,'role','authenticated')::text,true);
  v_json:=public.admin_list_support_tickets();
  v_cases:=v_cases+1;
  select count(*) into v_n from jsonb_array_elements(v_json->'rows') r where (r->>'ticket_id')::uuid=v_ticket;
  if v_n<>1 then v_fail:=v_fail||format('E02 le ticket n''apparait pas dans la file agent (%s)',v_n); end if;

  perform public.admin_reply_support_ticket(v_ticket,'NOTE INTERNE : verifier l''historique de connexion.',true);
  v_json:=public.admin_get_support_ticket(v_ticket);
  v_cases:=v_cases+1;
  select count(*) into v_n from jsonb_array_elements(v_json->'messages') m
   where m->>'body' like 'NOTE INTERNE%' and (m->>'is_internal_note')::boolean;
  if v_n<>1 then v_fail:=v_fail||format('E03 l''agent ne voit pas sa note interne (%s)',v_n); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_m::text,'role','authenticated')::text,true);
  v_json:=public.get_support_ticket(v_ticket);
  v_cases:=v_cases+1;
  select count(*) into v_n from jsonb_array_elements(v_json->'messages') m where m->>'body' like 'NOTE INTERNE%';
  if v_n<>0 then v_fail:=v_fail||format('E04 la note interne atteint le demandeur (%s)',v_n); end if;
  v_msg:=null; begin perform public.transition_support_ticket(v_ticket,'in_progress'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('E05 un membre s''auto-assigne la prise en charge (%s)',coalesce(v_msg,'aucune erreur')); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_s::text,'role','authenticated')::text,true);
  v_msg:=null; begin perform public.transition_support_ticket(v_ticket,'resolved'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('E06 open->resolved accepte hors machine (%s)',coalesce(v_msg,'aucune erreur')); end if;

  perform public.transition_support_ticket(v_ticket,'in_progress');
  perform public.transition_support_ticket(v_ticket,'resolved');
  perform set_config('role','postgres',true);
  select count(*) into v_n from public.notifications
   where profile_id=p_m and notification_type_code='support_ticket_resolved' and entity_id=v_ticket;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('E07 resolution sans notification au demandeur (%s)',v_n); end if;
  select count(*) into v_n from private.audit_log
   where action='support.ticket_transitioned' and result='success' and object_id=v_ticket::text;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<2 then v_fail:=v_fail||format('E08 transitions support non journalisees (%s)',v_n); end if;

  ---------------------------------------------------------------- F. Promotions
  perform set_config('request.jwt.claims',json_build_object('sub',u_a::text,'role','authenticated')::text,true);

  v_json:=public.admin_upsert_promotion(null,'ISE 2050',2050,null,null,null);
  v_new_promo:=(v_json->>'promotion_id')::bigint;
  v_cases:=v_cases+1;
  if v_new_promo is null then v_fail:=array_append(v_fail,'F01 creation de promotion en echec'); end if;
  v_msg:=null; begin v_json:=public.admin_upsert_promotion(null,'ISE 2050 bis',2050,null,null,null); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'promotion_already_exists' then v_fail:=v_fail||format('F02 doublon d''annee accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.admin_set_promotion_manager(v_new_promo,p_m,'delegate',true);
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.user_roles ur join private.roles r on r.id=ur.role_id
   where ur.profile_id=p_m and r.code='promotion_manager';
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('F03 le role promotion_manager n''est pas synchronise (%s)',v_n); end if;
  v_json:=public.admin_set_promotion_manager(v_new_promo,p_m,'delegate',false);
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.user_roles ur join private.roles r on r.id=ur.role_id
   where ur.profile_id=p_m and r.code='promotion_manager';
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('F03b le role n''est pas retire a la desactivation (%s)',v_n); end if;

  perform set_config('role','postgres',true);
  insert into public.missing_member_suggestions (id,promotion_id,submitted_by_profile_id,first_name,last_name)
  values (extensions.gen_random_uuid(),v_promo,p_m,'Ancien','Camarade') returning id into v_sug;
  insert into public.promotion_suggestions (id,submitted_by_profile_id,promotion_label)
  values (extensions.gen_random_uuid(),p_m,'ISE Abidjan 1999') returning id into v_psug;
  perform set_config('role','authenticated',true);

  v_json:=public.admin_review_missing_member_suggestion(v_sug,'matched',p_u);
  perform set_config('role','postgres',true);
  select status into v_txt from public.missing_member_suggestions where id=v_sug;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_txt is distinct from 'matched' then v_fail:=v_fail||format('F04 rapprochement de membre manquant inoperant (%s)',v_txt); end if;
  v_msg:=null; begin v_json:=public.admin_review_missing_member_suggestion(v_sug,'reviewing',null); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('F04b transition arriere acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin v_json:=public.admin_review_promotion_suggestion(v_psug,'rejected',null,null); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'reason_required' then v_fail:=v_fail||format('F05 rejet sans motif accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_json:=public.admin_review_promotion_suggestion(v_psug,'rejected','Promotion introuvable dans les archives.',null);
  perform set_config('role','postgres',true);
  select status into v_txt from public.promotion_suggestions where id=v_psug;
  v_cases:=v_cases+1;
  if v_txt is distinct from 'rejected' then v_fail:=v_fail||format('F05b rejet motive inoperant (%s)',v_txt); end if;

  ---------------------------------------------------------------- G. Moderation des appels & opportunites (0077)
  perform set_config('role','postgres',true);
  insert into public.network_calls (id,author_profile_id,call_type,title,description,status,published_at)
  values (v_call,p_m,'expert','Recherche d''un expert en echantillonnage',
          'Appel de test pour la suite superadmin.','active',now());
  insert into public.opportunities (id,origin,source_type,source_url,opportunity_type,title,description,
                                    application_mode,external_application_url,status,moderation_status)
  values (v_opp,'external','partner_organization','https://exemple.org/offre','job',
          'Statisticien senior — offre relayee','Offre de test pour la suite superadmin.',
          'external_url','https://exemple.org/offre/postuler','draft','pending');
  perform set_config('role','authenticated',true);

  -- Mod detient calls.moderate mais PAS opportunities.manage.
  perform set_config('request.jwt.claims',json_build_object('sub',u_o::text,'role','authenticated')::text,true);
  v_msg:=null; begin v_json:=public.moderate_network_call(v_call,'rejected','court'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'reason_required' then v_fail:=v_fail||format('G01 rejet d''appel sans motif accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.moderate_network_call(v_call,'rejected','Contenu commercial hors charte du reseau.');
  perform set_config('role','postgres',true);
  select status into v_txt from public.network_calls where id=v_call;
  select count(*) into v_n from public.moderation_actions
   where target_type='network_call' and target_id=v_call and action_type='hide_content' and moderator_profile_id=p_o;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_txt is distinct from 'moderated' then v_fail:=v_fail||format('G02 rejet d''appel inoperant (%s)',v_txt); end if;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('G02b rejet d''appel absent de moderation_actions (%s)',v_n); end if;
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.audit_log
   where action='admin.call_moderated' and result='success' and object_id=v_call::text;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'G02c moderation d''appel non journalisee'); end if;

  v_json:=public.moderate_network_call(v_call,'approved','Restauration apres revue contradictoire.');
  perform set_config('role','postgres',true);
  select status into v_txt from public.network_calls where id=v_call;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_txt is distinct from 'active' then v_fail:=v_fail||format('G03 restauration d''appel inoperante (%s)',v_txt); end if;

  v_msg:=null; begin v_json:=public.moderate_opportunity(v_opp,'approved',null); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('G04 moderation d''opportunite sans opportunities.manage (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- Adm : file pending puis rejet motive obligatoire.
  perform set_config('request.jwt.claims',json_build_object('sub',u_a::text,'role','authenticated')::text,true);
  v_json:=public.admin_list_opportunities('pending',null,null,25);
  v_cases:=v_cases+1;
  select count(*) into v_n from jsonb_array_elements(v_json->'rows') r where (r->>'opportunity_id')::uuid=v_opp;
  if v_n<>1 then v_fail:=v_fail||format('G05 l''offre pending n''apparait pas dans la file (%s)',v_n); end if;

  v_msg:=null; begin v_json:=public.moderate_opportunity(v_opp,'rejected',null); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'reason_required' then v_fail:=v_fail||format('G06 rejet d''opportunite sans motif accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.moderate_opportunity(v_opp,'rejected','Source non verifiable, offre retiree de la file.');
  perform set_config('role','postgres',true);
  select moderation_status||'/'||status into v_txt from public.opportunities where id=v_opp;
  select count(*) into v_n from private.audit_log
   where action='admin.opportunity_moderated' and result='success' and object_id=v_opp::text;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  -- L'offre de test n'a jamais ete publiee : un brouillon rejete RESTE
  -- draft (0077) ; le forcer a moderated violait opportunities_published_state.
  if v_txt is distinct from 'rejected/draft' then v_fail:=v_fail||format('G07 rejet d''opportunite inoperant (%s)',v_txt); end if;
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'G07b moderation d''opportunite non journalisee'); end if;

  ---------------------------------------------------------------- H. Attribution de roles (0077)
  -- H01 : un moderator (sans roles.manage) ne peut PAS attribuer de role.
  perform set_config('request.jwt.claims',json_build_object('sub',u_o::text,'role','authenticated')::text,true);
  v_msg:=null; begin v_json:=public.admin_set_profile_role(p_m,'support_agent',true,'tentative d''un moderateur sans droit'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('H01 un moderator attribue un role (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- H02 : jamais sur soi-meme, meme pour un superadmin.
  perform set_config('request.jwt.claims',json_build_object('sub',u_a::text,'role','authenticated')::text,true);
  v_msg:=null; begin v_json:=public.admin_set_profile_role(p_a,'analyst',true,'auto-attribution interdite par principe'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'cannot_target_self' then v_fail:=v_fail||format('H02 auto-attribution acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- H03 : motif obligatoire.
  v_msg:=null; begin v_json:=public.admin_set_profile_role(p_m,'analyst',true,'court'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'reason_required' then v_fail:=v_fail||format('H03 attribution sans motif acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- H04 : attribution effective ET journalisee.
  v_json:=public.admin_set_profile_role(p_m,'analyst',true,'Renfort analytique decide en comite du 08/08.');
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.user_roles ur join private.roles r on r.id=ur.role_id
   where ur.profile_id=p_m and r.code='analyst' and ur.granted_by=p_a;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('H04 attribution de role inoperante (%s)',v_n); end if;
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.audit_log
   where action='admin.role_granted' and result='success' and object_id=p_m::text
     and context->>'role'='analyst';
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'H04b attribution de role non journalisee'); end if;

  -- H05 : le role de base member n'est pas attribuable.
  v_msg:=null; begin v_json:=public.admin_set_profile_role(p_m,'member',true,'tentative sur le role de base member'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'validation_failed' then v_fail:=v_fail||format('H05 le role member est attribuable (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- H06 : retrait effectif ET journalise.
  v_json:=public.admin_set_profile_role(p_m,'analyst',false,'Fin de mission analytique, retrait du role.');
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.user_roles ur join private.roles r on r.id=ur.role_id
   where ur.profile_id=p_m and r.code='analyst';
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('H06 retrait de role inoperant (%s)',v_n); end if;
  select count(*) into v_n from private.audit_log
   where action='admin.role_revoked' and result='success' and object_id=p_m::text;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'H06b retrait de role non journalise'); end if;

  ---------------------------------------------------------------- I. Notes administratives & indice de contact (0077)
  -- I01 : note interne posee par un porteur de profiles.moderate, journalisee.
  perform set_config('request.jwt.claims',json_build_object('sub',u_o::text,'role','authenticated')::text,true);
  v_json:=public.admin_add_profile_note(p_u,'Profil signale deux fois : surveiller la prochaine reclamation.');
  v_cases:=v_cases+1;
  if v_json->>'note_id' is null then v_fail:=array_append(v_fail,'I01 ajout de note administrative en echec'); end if;
  v_json:=public.admin_list_profile_notes(p_u);
  v_cases:=v_cases+1;
  select count(*) into v_n from jsonb_array_elements(v_json) e where e->>'body' like 'Profil signale deux fois%';
  if v_n<>1 then v_fail:=v_fail||format('I02 la note administrative n''est pas relue (%s)',v_n); end if;

  -- Indice de contact d'un membre manquant (donnee d'un TIERS, 0003).
  perform set_config('role','postgres',true);
  insert into public.missing_member_suggestions (id,promotion_id,submitted_by_profile_id,first_name,last_name)
  values (v_sug2,v_promo,p_m,'Awa','Camarade');
  insert into private.missing_member_contact_hints (suggestion_id,contact_hint)
  values (v_sug2,'awa.camarade@exemple.org');
  perform set_config('role','authenticated',true);

  -- I03 : Vera (profiles.verify, PAS promotions.manage) ne lit pas l'indice.
  perform set_config('request.jwt.claims',json_build_object('sub',u_v::text,'role','authenticated')::text,true);
  v_msg:=null; begin v_json:=public.admin_get_missing_member_contact_hint(v_sug2); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('I03 indice de contact lisible sans promotions.manage (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- I04 : promotions.manage lit l'indice, et la LECTURE est journalisee.
  perform set_config('request.jwt.claims',json_build_object('sub',u_a::text,'role','authenticated')::text,true);
  v_json:=public.admin_get_missing_member_contact_hint(v_sug2);
  v_cases:=v_cases+1;
  if v_json->>'contact_hint' is distinct from 'awa.camarade@exemple.org' then
    v_fail:=v_fail||format('I04 indice de contact illisible avec promotions.manage (%s)',v_json->>'contact_hint'); end if;
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.audit_log
   where action='admin.contact_hint_read' and result='success' and object_id=v_sug2::text;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'I04b lecture de l''indice de contact non journalisee'); end if;

  ---------------------------------------------------------------- bilan
  perform set_config('role','postgres',true);
  if array_length(v_fail,1) is null then
    raise exception 'ADMIN_CORE_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception 'ADMIN_CORE_TESTS_KO: % cas, % echec(s) -> %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,' | ');
  end if;
end
$adm$;
