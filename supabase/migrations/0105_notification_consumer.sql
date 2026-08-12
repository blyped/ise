-- =====================================================================
-- 0105_notification_consumer
--
-- Consommateur des evenements de domaine pour le CANAL IN-APP UNIQUEMENT
-- (D-80 : « in-app pour toute interaction importante » ; e-mail et push
-- restent hors perimetre de cette migration, cf. commentaire de fin).
--
-- CONSTAT (docs/implementation-status.md §4) : `public.domain_events` est
-- deja alimente par ~40 fonctions RPC metier, mais aucun consommateur ne
-- le lit. `public.notifications` (table lue par ISE-098, cf. 0053
-- `list_my_notifications` / `my_notification_summary`) reste donc vide,
-- et `public.notification_deliveries` (file d'envoi technique, 0015)
-- n'a jamais de ligne non plus.
--
-- MECANISME RETENU : CRON, pas trigger.
--   `domain_events` porte deja `status` ('pending'/'processing'/
--   'processed'/'failed') et `processed_at` (0018) : ces colonnes
--   n'ont jamais ete exploitees. Le pattern d'automatisation existant
--   (0059/0060, D-129, 4 taches `pg_cron` pour le CMS,
--   `private.run_daily_featured_profile()` etc.) est un CRON qui appelle
--   une fonction `private.*`, idempotente, planifiee via `cron.schedule`.
--   On reutilise exactement ce pattern plutot que d'inventer un trigger
--   `AFTER INSERT` : le fan-out d'un `network_call.published` touche un
--   nombre variable de destinataires (`network_call_matches`), ce que le
--   CRON traite en une requete set-based sans bloquer la transaction
--   metier qui a ecrit l'evenement. Une latence de quelques minutes est
--   acceptable pour de l'in-app (le brief le permet explicitement).
--
-- PERIMETRE : evenements REELLEMENT ecrits aujourd'hui (verifie par
-- lecture du code source de chaque fonction RPC, pas par supposition).
-- 9 types traites dans ce lot, sur ~40 fonctions qui ecrivent
-- effectivement dans `domain_events` :
--   - connection.requested        -> destinataire : demande recue
--   - connection.declined         -> demandeur : demande declinee
--   - connection.withdrawn        -> destinataire : demande retiree
--   - introduction.requested      -> intermediaire : introduction demandee
--   - mentorship.request_submitted-> mentor : demande de mentorat recue
--   - mentorship.request_answered -> mentore : refus / autre format propose
--   - mentorship.started          -> mentore : demande acceptee
--   - community.comment_created   -> auteur du post : nouveau commentaire
--   - event.registration_created  -> l'inscrit lui-meme : inscription confirmee
--   - network_call.published      -> FAN-OUT vers `network_call_matches`
--
-- NON COUVERT dans ce lot (documente, pas invente) :
--   - `applications` (candidatures) : `submit_application` et
--     `transition_application_status` (0056) N'ECRIVENT PAS de
--     `domain_events` aujourd'hui malgre le catalogue `application.*`
--     existant dans `domain_event_types` (0018/0039) et le type
--     `application_status_changed` seede dans `notification_types`
--     (0015). C'est un prealable cote emission, distinct du present
--     travail de consommation.
--   - `recommendation_requests` (recommandations demandees) : aucune
--     fonction n'ecrit de `domain_events` pour la creation d'une demande
--     de recommandation.
--   - `opportunity.published`, `internship.*`, `project.invitation_*`,
--     `promotion.invitation_created` (destinataire hors plateforme, pas
--     de profil a notifier en in-app), les evenements `admin.*` /
--     moderation, et tout evenement de digest hebdomadaire/quotidien :
--     laisses `pending`, prets pour un lot ulterieur qui etendra le
--     `case` de `private.process_pending_domain_event_notifications()`.
--
-- Tout evenement `pending` est marque `processed` par ce consommateur,
-- MEME quand aucune notification n'en resulte (branche `else` du
-- `case`) : c'est la semantique standard d'un relais/outbox — « vu par
-- le relais », pas « a produit un effet ». Cela evite un backlog
-- illimite de `pending` pour les types non geres.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Emission d'une notification in-app + trace de livraison.
--
-- Point d'entree UNIQUE pour ecrire dans `public.notifications` /
-- `public.notification_deliveries` depuis le consommateur. Respecte :
--   - la preference membre (`notification_preferences.in_app_enabled`,
--     defaut = `notification_types.default_in_app` si le type est
--     connu du catalogue, sinon `true`) ;
--   - la mise en sourdine (`muted_until`) ;
--   - la deduplication (`notifications.deduplication_key`, index
--     unique partiel deja pose par 0015).
--
-- Le canal in-app n'a pas de fournisseur externe : la ligne de livraison
-- est ecrite directement en `delivered`, sans etape `pending`/`sent`
-- intermediaire (contrairement a push/e-mail, hors perimetre ici).
-- ---------------------------------------------------------------------
create or replace function private.emit_in_app_notification(
  p_profile_id  uuid,
  p_type_code   text,
  p_category    text,
  p_priority    text,
  p_title       text,
  p_body        text,
  p_entity_type text,
  p_entity_id   uuid,
  p_action_type text,
  p_action_path text,
  p_dedupe_key  text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default_in_app boolean := true;
  v_in_app         boolean;
  v_muted          timestamptz;
  v_notification_id uuid;
begin
  if p_profile_id is null or p_dedupe_key is null then
    return null;
  end if;

  if p_type_code is not null then
    select t.default_in_app into v_default_in_app
      from public.notification_types t
     where t.code = p_type_code and t.is_active;
    if not found then
      v_default_in_app := true;
    end if;
  end if;

  select coalesce(pr.in_app_enabled, v_default_in_app), pr.muted_until
    into v_in_app, v_muted
    from (select 1) as d
    left join public.notification_preferences pr
           on pr.profile_id = p_profile_id
          and pr.notification_type_code = p_type_code;

  if not coalesce(v_in_app, true) then
    return null;
  end if;
  if v_muted is not null and v_muted > now() then
    return null;
  end if;

  insert into public.notifications (
    profile_id, notification_type_code, category, priority, title, body,
    entity_type, entity_id, action_type, action_path, deduplication_key
  )
  values (
    p_profile_id, p_type_code, p_category, p_priority, p_title, p_body,
    p_entity_type, p_entity_id, p_action_type, p_action_path, p_dedupe_key
  )
  on conflict (profile_id, deduplication_key) where deduplication_key is not null
    do nothing
  returning id into v_notification_id;

  if v_notification_id is not null then
    insert into public.notification_deliveries (
      notification_id, profile_id, channel, payload_kind, status,
      idempotency_key, sent_at, delivered_at
    )
    values (
      v_notification_id, p_profile_id, 'in_app', 'single', 'delivered',
      'in_app:' || v_notification_id::text, now(), now()
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return v_notification_id;
end
$$;

revoke all on function private.emit_in_app_notification(
  uuid, text, text, text, text, text, text, uuid, text, text, text
) from public, anon, authenticated;

comment on function private.emit_in_app_notification(
  uuid, text, text, text, text, text, text, uuid, text, text, text
) is
  'Point d''entree unique du consommateur pour ecrire notifications + notification_deliveries (canal in_app '
  'uniquement). Respecte preference, sourdine et deduplication. Jamais appele par un client (schema private).';


-- ---------------------------------------------------------------------
-- 2. Consommateur : domain_events (pending) -> notifications (in-app).
--
-- SET-BASED par type d'evenement pour le fan-out (`network_call.published`),
-- boucle simple pour les autres (volume faible, un seul destinataire).
-- `for update skip locked` : un deuxieme worker concurrent ne retraite
-- jamais la meme ligne (idempotence renforcee au-dela de la dedup key).
-- ---------------------------------------------------------------------
create or replace function private.process_pending_domain_event_notifications(
  p_batch_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event      record;
  v_recipient  uuid;
  v_processed  integer := 0;
begin
  for v_event in
    select *
      from public.domain_events
     where status = 'pending'
     order by occurred_at, id
     limit greatest(coalesce(p_batch_limit, 500), 1)
       for update skip locked
  loop
    begin
      case v_event.event_type

        -- Reseau : demande de connexion recue.
        when 'connection.requested' then
          v_recipient := nullif(v_event.payload->>'addressee_profile_id', '')::uuid;
          perform private.emit_in_app_notification(
            v_recipient, 'connection_request_received', 'network', 'action_required',
            'Nouvelle demande de connexion.', null,
            'connection_request', v_event.aggregate_id, 'review', '/reseau/demandes',
            'connection_request_received:' || v_event.aggregate_id::text);

        -- Reseau : demande declinee -> le demandeur est informe.
        when 'connection.declined' then
          select cr.requester_profile_id into v_recipient
            from public.connection_requests cr
           where cr.id = v_event.aggregate_id;
          perform private.emit_in_app_notification(
            v_recipient, null, 'network', 'relevant',
            'Votre demande de connexion a été déclinée.', null,
            'connection_request', v_event.aggregate_id, 'view', '/reseau',
            'connection_declined:' || v_event.aggregate_id::text);

        -- Reseau : demande retiree -> le destinataire initial est informe.
        when 'connection.withdrawn' then
          select cr.addressee_profile_id into v_recipient
            from public.connection_requests cr
           where cr.id = v_event.aggregate_id;
          perform private.emit_in_app_notification(
            v_recipient, null, 'network', 'info',
            'Une demande de connexion a été retirée.', null,
            'connection_request', v_event.aggregate_id, 'view', '/reseau',
            'connection_withdrawn:' || v_event.aggregate_id::text);

        -- Introductions : l'intermediaire doit agir.
        when 'introduction.requested' then
          select ir.intermediary_profile_id into v_recipient
            from public.introduction_requests ir
           where ir.id = v_event.aggregate_id;
          perform private.emit_in_app_notification(
            v_recipient, null, 'introductions', 'action_required',
            'Nouvelle demande d''introduction.', null,
            'introduction_request', v_event.aggregate_id, 'review', '/reseau/introductions',
            'introduction_requested:' || v_event.aggregate_id::text);

        -- Mentorat : nouvelle demande recue par le mentor.
        when 'mentorship.request_submitted' then
          v_recipient := nullif(v_event.payload->>'mentor_profile_id', '')::uuid;
          perform private.emit_in_app_notification(
            v_recipient, 'mentorship_request_received', 'mentorship', 'action_required',
            'Nouvelle demande de mentorat.', null,
            'mentorship_request', v_event.aggregate_id, 'review', '/mentorat/demandes',
            'mentorship_request_received:' || v_event.aggregate_id::text);

        -- Mentorat : refus ou format alternatif propose -> le mentore est informe.
        when 'mentorship.request_answered' then
          select mr.mentee_profile_id into v_recipient
            from public.mentorship_requests mr
           where mr.id = v_event.aggregate_id;
          perform private.emit_in_app_notification(
            v_recipient, null, 'mentorship', 'relevant',
            case when v_event.payload->>'decision' = 'alternative_proposed'
                 then 'Le mentor vous propose un autre format.'
                 else 'Votre demande de mentorat a été déclinée.' end,
            null, 'mentorship_request', v_event.aggregate_id, 'view', '/mentorat/demandes',
            'mentorship_request_answered:' || v_event.aggregate_id::text);

        -- Mentorat : demande acceptee, le mentorat demarre.
        when 'mentorship.started' then
          select m.mentee_profile_id into v_recipient
            from public.mentorships m
           where m.id = v_event.aggregate_id;
          perform private.emit_in_app_notification(
            v_recipient, 'mentorship_request_accepted', 'mentorship', 'relevant',
            'Votre demande de mentorat a été acceptée.', null,
            'mentorship', v_event.aggregate_id, 'view', '/mentorat',
            'mentorship_started:' || v_event.aggregate_id::text);

        -- Communautes : nouveau commentaire sur une publication (jamais a soi-meme).
        when 'community.comment_created' then
          select cp.author_profile_id into v_recipient
            from public.community_posts cp
           where cp.id = nullif(v_event.payload->>'post_id', '')::uuid
             and cp.author_profile_id is distinct from v_event.actor_profile_id;
          perform private.emit_in_app_notification(
            v_recipient, 'community_activity', 'communities', 'info',
            'Nouveau commentaire sur votre publication.', null,
            'community_post', nullif(v_event.payload->>'post_id', '')::uuid, 'view',
            '/communautes/publications/' || (v_event.payload->>'post_id'),
            'community_comment:' || coalesce(v_event.payload->>'comment_id', v_event.id::text));

        -- Evenements : confirmation d'inscription -> l'inscrit lui-meme.
        when 'event.registration_created' then
          if v_event.payload->>'status' = 'registered' then
            perform private.emit_in_app_notification(
              v_event.actor_profile_id, 'event_registration_confirmed', 'events', 'info',
              'Votre inscription est confirmée.', null,
              'event', v_event.aggregate_id, 'view', '/evenements/' || v_event.aggregate_id::text,
              'event_registration_confirmed:' || v_event.id::text);
          end if;

        -- Appels au reseau : FAN-OUT vers les profils matches au moment du traitement.
        when 'network_call.published' then
          for v_recipient in
            select ncm.profile_id
              from public.network_call_matches ncm
             where ncm.call_id = v_event.aggregate_id
               and ncm.profile_id is distinct from v_event.actor_profile_id
          loop
            perform private.emit_in_app_notification(
              v_recipient, 'network_call_match', 'network_calls', 'relevant',
              'Un besoin correspond à vos compétences.', null,
              'network_call', v_event.aggregate_id, 'view',
              '/reseau/appels/' || v_event.aggregate_id::text,
              'network_call_match:' || v_event.aggregate_id::text || ':' || v_recipient::text);
          end loop;

        else
          -- Type non couvert par ce lot : l'evenement est marque `processed`
          -- (vu par le relais) sans production de notification. Voir l'en-tete.
          null;
      end case;

      update public.domain_events
         set status = 'processed', processed_at = now()
       where id = v_event.id;
      v_processed := v_processed + 1;

    exception when others then
      update public.domain_events
         set status          = 'failed',
             attempts        = attempts + 1,
             last_error_code = sqlstate
       where id = v_event.id;
    end;
  end loop;

  return v_processed;
end
$$;

revoke all on function private.process_pending_domain_event_notifications(integer)
  from public, anon, authenticated;

comment on function private.process_pending_domain_event_notifications(integer) is
  'Consommateur cron de domain_events -> notifications (canal in_app uniquement, D-80). '
  '9 types d''evenements geres sur ~40 reellement ecrits ; le reste est marque processed sans effet '
  '(0105). Appele toutes les 2 minutes par pg_cron (job notifications_process_domain_events).';


-- ---------------------------------------------------------------------
-- 3. Planification pg_cron — meme garde et meme idempotence que 0060.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise warning 'pg_cron absent : la planification doit etre assuree a l''exterieur (0105)';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'notifications_process_domain_events') then
    perform cron.unschedule('notifications_process_domain_events');
  end if;

  perform cron.schedule(
    'notifications_process_domain_events',
    '*/2 * * * *',
    'select private.process_pending_domain_event_notifications(500)'
  );
end
$$;
