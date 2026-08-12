-- =====================================================================
-- supabase/tests/rls/0039_notification_consumer_suite.sql
--
-- Suite du consommateur domain_events -> notifications (canal in_app,
-- migration 0105). Verifie, pour 5 types d'evenements REELLEMENT ecrits
-- aujourd'hui, que le bon destinataire recoit la bonne notification avec
-- le bon type/categorie/priorite, que la preference membre est respectee,
-- que la deduplication empeche le doublon, et qu'un type non couvert est
-- marque `processed` sans effet (pas de backlog illimite).
--   succes -> ERROR: P0001: NOTIFICATION_CONSUMER_TESTS_OK: N cas, 0 echec
--
-- FIXTURES : Amara/Baco (connexion) · Cael/Dofi (mentorat) ·
--            Elan/Fara (communaute) · Gabo/Hana/Ivo (appel au reseau,
--            fan-out) · Jora/Kofi (preference desactivee)
--
-- Le consommateur (`private.process_pending_domain_event_notifications`)
-- n'est jamais appele par un client : les appels ci-dessous se font en
-- role `postgres`, exactement comme le ferait `pg_cron`.
-- =====================================================================

do $notif_consumer$
declare
  -- Connexion
  u_amara uuid:='00000000-0000-4000-800a-000000000001'; u_baco uuid:='00000000-0000-4000-800a-000000000002';
  p_amara uuid:='00000000-0000-4000-800a-0000000000a1'; p_baco  uuid:='00000000-0000-4000-800a-0000000000a2';
  -- Mentorat
  u_cael uuid:='00000000-0000-4000-800a-000000000003'; u_dofi uuid:='00000000-0000-4000-800a-000000000004';
  p_cael uuid:='00000000-0000-4000-800a-0000000000a3'; p_dofi uuid:='00000000-0000-4000-800a-0000000000a4';
  -- Communaute
  u_elan uuid:='00000000-0000-4000-800a-000000000005'; u_fara uuid:='00000000-0000-4000-800a-000000000006';
  p_elan uuid:='00000000-0000-4000-800a-0000000000a5'; p_fara uuid:='00000000-0000-4000-800a-0000000000a6';
  -- Appel au reseau (fan-out)
  u_gabo uuid:='00000000-0000-4000-800a-000000000007'; u_hana uuid:='00000000-0000-4000-800a-000000000008';
  u_ivo  uuid:='00000000-0000-4000-800a-000000000009';
  p_gabo uuid:='00000000-0000-4000-800a-0000000000a7'; p_hana uuid:='00000000-0000-4000-800a-0000000000a8';
  p_ivo  uuid:='00000000-0000-4000-800a-0000000000a9';
  -- Preference desactivee
  u_jora uuid:='00000000-0000-4000-800a-00000000000a'; u_kofi uuid:='00000000-0000-4000-800a-00000000000b';
  p_jora uuid:='00000000-0000-4000-800a-0000000000aa'; p_kofi uuid:='00000000-0000-4000-800a-0000000000ab';

  v_cr_id      uuid;
  v_mreq_id    uuid;
  v_mship_id   uuid;
  v_mreq2_id   uuid;
  v_community  uuid;
  v_post       uuid;
  v_comment1   uuid;
  v_comment2   uuid;
  v_call       uuid;
  v_event_id   uuid;
  v_dup_event_id uuid;
  v_unmapped_event_id uuid;
  v_format     text;
  v_objective  text;

  v_n          bigint;
  v_processed  integer;
  v_cases      integer := 0;
  v_fail       text[]  := array[]::text[];
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select (public.mentorship_format_codes())[1]   into v_format;
  select (public.mentorship_objective_codes())[1] into v_objective;

  -- -------------------------------------------------------------------
  -- Fixtures : comptes + profils.
  -- -------------------------------------------------------------------
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_amara,'authenticated','authenticated','test+notif.amara@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_baco, 'authenticated','authenticated','test+notif.baco@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_cael, 'authenticated','authenticated','test+notif.cael@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_dofi, 'authenticated','authenticated','test+notif.dofi@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_elan, 'authenticated','authenticated','test+notif.elan@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_fara, 'authenticated','authenticated','test+notif.fara@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_gabo, 'authenticated','authenticated','test+notif.gabo@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_hana, 'authenticated','authenticated','test+notif.hana@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ivo,  'authenticated','authenticated','test+notif.ivo@ise.test',  now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_jora, 'authenticated','authenticated','test+notif.jora@ise.test', now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_kofi, 'authenticated','authenticated','test+notif.kofi@ise.test', now(),now());

  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_amara,u_amara,'Amara','Ntf','active','claimed',now(),true),
    (p_baco, u_baco, 'Baco', 'Ntf','active','claimed',now(),true),
    (p_cael, u_cael, 'Cael', 'Ntf','active','claimed',now(),true),
    (p_dofi, u_dofi, 'Dofi', 'Ntf','active','claimed',now(),true),
    (p_elan, u_elan, 'Elan', 'Ntf','active','claimed',now(),true),
    (p_fara, u_fara, 'Fara', 'Ntf','active','claimed',now(),true),
    (p_gabo, u_gabo, 'Gabo', 'Ntf','active','claimed',now(),true),
    (p_hana, u_hana, 'Hana', 'Ntf','active','claimed',now(),true),
    (p_ivo,  u_ivo,  'Ivo',  'Ntf','active','claimed',now(),true),
    (p_jora, u_jora, 'Jora', 'Ntf','active','claimed',now(),true),
    (p_kofi, u_kofi, 'Kofi', 'Ntf','active','claimed',now(),true);

  insert into public.mentor_profiles (profile_id, is_active) values (p_cael, true), (p_jora, true);

  -- =====================================================================
  -- CAS 1 — connection.requested : Baco (destinataire) recoit une
  --         notification `connection_request_received`.
  -- =====================================================================
  insert into public.connection_requests (requester_profile_id, addressee_profile_id, status)
  values (p_amara, p_baco, 'pending')
  returning id into v_cr_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('connection.requested', 'connection', v_cr_id, p_amara,
          jsonb_build_object('addressee_profile_id', p_baco))
  returning id into v_event_id;

  select private.process_pending_domain_event_notifications(500) into v_processed;

  select count(*) into v_n from public.domain_events where id = v_event_id and status = 'processed';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T01 evenement connection.requested non marque processed (%s)', v_n); end if;

  select count(*) into v_n from public.notifications
   where profile_id = p_baco and notification_type_code = 'connection_request_received'
     and category = 'network' and priority = 'action_required' and entity_id = v_cr_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T02 Baco n''a pas recu sa notification de demande de connexion (%s)', v_n); end if;

  select count(*) into v_n from public.notification_deliveries nd
    join public.notifications n on n.id = nd.notification_id
   where n.profile_id = p_baco and n.entity_id = v_cr_id and nd.channel = 'in_app' and nd.status = 'delivered';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T03 pas de ligne notification_deliveries in_app deliv pour Baco (%s)', v_n); end if;

  -- Deduplication : un deuxieme evenement, meme aggregate_id (rejeu),
  -- ne doit produire NI nouvelle notification NI nouvelle livraison.
  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('connection.requested', 'connection', v_cr_id, p_amara,
          jsonb_build_object('addressee_profile_id', p_baco))
  returning id into v_dup_event_id;

  perform private.process_pending_domain_event_notifications(500);

  select count(*) into v_n from public.domain_events where id = v_dup_event_id and status = 'processed';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T04 evenement rejoue non marque processed (%s)', v_n); end if;

  select count(*) into v_n from public.notifications
   where profile_id = p_baco and notification_type_code = 'connection_request_received' and entity_id = v_cr_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T05 deduplication en echec : %s notification(s) au lieu de 1', v_n); end if;

  -- =====================================================================
  -- CAS 2 — mentorship.request_submitted puis mentorship.started :
  --         Cael (mentor) puis Dofi (mentore) sont notifies tour a tour.
  -- =====================================================================
  insert into public.mentorship_requests (
    mentee_profile_id, mentor_profile_id, objective_type, objective_text,
    requested_format, status
  )
  values (p_dofi, p_cael, v_objective, 'Objectif de test.', v_format, 'pending')
  returning id into v_mreq_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('mentorship.request_submitted', 'mentorship', v_mreq_id, p_dofi,
          jsonb_build_object('mentor_profile_id', p_cael));

  perform private.process_pending_domain_event_notifications(500);

  select count(*) into v_n from public.notifications
   where profile_id = p_cael and notification_type_code = 'mentorship_request_received'
     and category = 'mentorship' and priority = 'action_required' and entity_id = v_mreq_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T06 Cael n''a pas recu la demande de mentorat (%s)', v_n); end if;

  update public.mentorship_requests set status = 'accepted', responded_at = now() where id = v_mreq_id;
  insert into public.mentorships (mentor_profile_id, mentee_profile_id, source_request_id, objective_type,
                                  objective, format, status)
  values (p_cael, p_dofi, v_mreq_id, v_objective, 'Objectif de test.', v_format, 'active')
  returning id into v_mship_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('mentorship.started', 'mentorship', v_mship_id, p_cael,
          jsonb_build_object('request_id', v_mreq_id));

  perform private.process_pending_domain_event_notifications(500);

  select count(*) into v_n from public.notifications
   where profile_id = p_dofi and notification_type_code = 'mentorship_request_accepted'
     and category = 'mentorship' and priority = 'relevant' and entity_type = 'mentorship' and entity_id = v_mship_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T07 Dofi n''a pas recu l''acceptation du mentorat (%s)', v_n); end if;

  -- =====================================================================
  -- CAS 3 — community.comment_created : Elan (auteur du post) est
  --         notifie du commentaire de Fara, mais PAS de son propre
  --         commentaire sur son propre post (pas d'auto-notification).
  -- =====================================================================
  insert into public.communities (name, slug, description, community_type)
  values ('Communaute Test Notif', 'communaute-test-notif-' || substr(gen_random_uuid()::text,1,8),
          'Communaute de test.', 'thematic')
  returning id into v_community;

  insert into public.community_posts (community_id, author_profile_id, post_type, title, body, status, published_at)
  values (v_community, p_elan, 'question', 'Question de test', 'Corps de la question.', 'published', now())
  returning id into v_post;

  insert into public.community_comments (post_id, author_profile_id, body)
  values (v_post, p_fara, 'Reponse de Fara.') returning id into v_comment1;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('community.comment_created', 'community', v_community, p_fara,
          jsonb_build_object('post_id', v_post, 'comment_id', v_comment1));

  insert into public.community_comments (post_id, author_profile_id, body)
  values (v_post, p_elan, 'Elan repond a son propre post.') returning id into v_comment2;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('community.comment_created', 'community', v_community, p_elan,
          jsonb_build_object('post_id', v_post, 'comment_id', v_comment2));

  perform private.process_pending_domain_event_notifications(500);

  select count(*) into v_n from public.notifications
   where profile_id = p_elan and notification_type_code = 'community_activity'
     and category = 'communities' and priority = 'info'
     and entity_type = 'community_post' and entity_id = v_post
     and deduplication_key = 'community_comment:' || v_comment1::text;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T08 Elan n''a pas recu le commentaire de Fara (%s)', v_n); end if;

  select count(*) into v_n from public.notifications
   where deduplication_key = 'community_comment:' || v_comment2::text;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('T09 auto-notification produite pour le commentaire d''Elan sur son propre post (%s)', v_n); end if;

  -- =====================================================================
  -- CAS 4 — network_call.published : FAN-OUT vers les profils matches
  --         (Hana, Ivo), jamais vers l'auteur (Gabo) meme s'il apparait
  --         par erreur dans les matches.
  -- =====================================================================
  insert into public.network_calls (
    author_profile_id, call_type, title, description, status, published_at, visibility
  )
  values (
    p_gabo, 'expert', 'Appel de test au reseau',
    'Description suffisamment longue pour respecter la contrainte de vingt caracteres minimum.',
    'active', now(), 'members'
  )
  returning id into v_call;

  insert into public.network_call_matches (call_id, profile_id, score, relevance_label)
  values
    (v_call, p_hana, 82.5, 'relevant'),
    (v_call, p_ivo,  91.0, 'very_relevant'),
    (v_call, p_gabo, 50.0, 'close_profile');  -- l'auteur ne doit jamais se notifier lui-meme.

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('network_call.published', 'network_call', v_call, p_gabo,
          jsonb_build_object('targeted', 3));

  perform private.process_pending_domain_event_notifications(500);

  select count(*) into v_n from public.notifications
   where notification_type_code = 'network_call_match' and category = 'network_calls'
     and priority = 'relevant' and entity_id = v_call
     and profile_id in (p_hana, p_ivo);
  v_cases := v_cases + 1;
  if v_n <> 2 then v_fail := v_fail || format('T10 fan-out network_call.published incomplet : %s notification(s) au lieu de 2', v_n); end if;

  select count(*) into v_n from public.notifications
   where notification_type_code = 'network_call_match' and entity_id = v_call and profile_id = p_gabo;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('T11 l''auteur de l''appel s''est auto-notifie (%s)', v_n); end if;

  -- =====================================================================
  -- CAS 5 — preference membre respectee : Jora a desactive l'in-app pour
  --         `mentorship_request_received` -> aucune notification, aucune
  --         livraison, meme si l'evenement est bien marque `processed`.
  -- =====================================================================
  insert into public.notification_preferences (profile_id, notification_type_code, in_app_enabled)
  values (p_jora, 'mentorship_request_received', false);

  insert into public.mentorship_requests (
    mentee_profile_id, mentor_profile_id, objective_type, objective_text,
    requested_format, status
  )
  values (p_kofi, p_jora, v_objective, 'Objectif de test 2.', v_format, 'pending')
  returning id into v_mreq2_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('mentorship.request_submitted', 'mentorship', v_mreq2_id, p_kofi,
          jsonb_build_object('mentor_profile_id', p_jora))
  returning id into v_event_id;

  perform private.process_pending_domain_event_notifications(500);

  select count(*) into v_n from public.domain_events where id = v_event_id and status = 'processed';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T12 evenement avec preference desactivee non marque processed (%s)', v_n); end if;

  select count(*) into v_n from public.notifications where profile_id = p_jora and entity_id = v_mreq2_id;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('T13 notification creee malgre in_app_enabled=false (%s)', v_n); end if;

  -- =====================================================================
  -- CAS 6 — type d'evenement non couvert par ce lot : marque `processed`
  --         SANS produire de notification (pas de backlog illimite).
  -- =====================================================================
  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('project.membership_confirmed', 'project', gen_random_uuid(), p_amara, '{}'::jsonb)
  returning id into v_unmapped_event_id;

  perform private.process_pending_domain_event_notifications(500);

  select count(*) into v_n from public.domain_events
   where id = v_unmapped_event_id and status = 'processed' and processed_at is not null;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T14 evenement non couvert non marque processed (%s)', v_n); end if;

  select count(*) into v_n from public.notifications where entity_id = v_unmapped_event_id;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('T15 notification inattendue pour un type non couvert (%s)', v_n); end if;

  -- Plus aucun evenement `pending` en fin de suite (tout a ete consomme).
  select count(*) into v_n from public.domain_events where status = 'pending';
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('T16 %s evenement(s) restent pending apres traitement', v_n); end if;

  -- =====================================================================
  -- CAS 7 — la tache pg_cron est bien planifiee et active.
  -- =====================================================================
  select count(*) into v_n from cron.job
   where jobname = 'notifications_process_domain_events' and active
     and schedule = '*/2 * * * *';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('T17 tache pg_cron notifications_process_domain_events absente ou inactive (%s)', v_n); end if;

  -- Controle de securite global (search_path fige sur les 2 nouvelles fonctions, etc.).
  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('T18 security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'NOTIFICATION_CONSUMER_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'NOTIFICATION_CONSUMER_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$notif_consumer$;
