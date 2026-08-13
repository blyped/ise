-- =========================================================================
-- 0116 — Extension du consommateur de notifications : candidatures et
-- recommandations (D27, suite de 0105 et de 0115).
-- =========================================================================
-- Constat. 0115 a comble le trou d'emission : `submit_application`,
-- `declare_external_application`, `transition_application_status` et le
-- cycle des demandes de recommandation deposent desormais des lignes dans
-- `public.domain_events`. Cette migration etend le `case` de
-- `private.process_pending_domain_event_notifications()` (0105) pour
-- relayer une partie de ces nouveaux types vers `public.notifications`
-- (canal in-app, D-80), sans toucher au fichier 0105 lui-meme (une
-- migration deja appliquee ne se modifie jamais sur place).
--
-- Perimetre retenu dans ce lot — seuls les evenements avec un destinataire
-- CLAIR et un interet reel a etre notifie :
--   - application.status_changed -> le candidat est informe d'une etape
--     constatee par le recruteur ou l'administration.
--   - application.selected       -> idem, message dedie ("candidature
--     retenue").
--   - recommendation.requested        -> le destinataire de la demande.
--   - recommendation.request_answered -> le demandeur d'origine, redaction
--     ou refus.
--
-- Volontairement NON couverts dans ce lot (le membre est deja l'acteur de
-- son propre geste, ou aucun destinataire pertinent n'existe cote in-app) :
--   - application.submitted, application.declared_external,
--     application.status_declared : le candidat vient lui-meme d'agir.
--   - application.withdrawn : pas de type au catalogue cote recruteur ;
--     a traiter dans un lot ulterieur si le besoin est confirme.
--   - recommendation.withdrawn : le retrait cloture simplement une demande
--     en attente, sans decision a notifier au destinataire.
-- Ces types restent `pending` -> `processed` par la branche `else`
-- existante (semantique outbox inchangee, cf. 0105).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Nouveaux types de notification (catalogue), reutilise :
--    'application_status_changed' existe deja (0015, sort_order 42,
--    jamais emis jusqu'ici) et sert aux deux cas application.*.
-- ---------------------------------------------------------------------
insert into public.notification_types (
  code, category, default_priority, trigger_event, label, default_action_label,
  default_in_app, default_email_mode, default_push,
  is_push_allowed, is_email_allowed,
  is_groupable, group_window_minutes,
  is_user_configurable, supports_expiry, sort_order
) values
  ('recommendation_requested', 'network', 'action_required', 'recommendation.requested',
   'Nouvelle demande de recommandation.', 'Repondre',
   true, 'immediate', true, true, true, false, null, true, true, 21),
  ('recommendation_request_answered', 'network', 'relevant', 'recommendation.request_answered',
   'Reponse a votre demande de recommandation.', 'Voir',
   true, 'immediate', true, true, true, false, null, true, false, 22)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2. Consommateur — meme fonction, meme signature, 4 branches de plus.
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

        -- Candidatures : le recruteur (ou l'administration) fait avancer le
        -- statut -> le candidat est informe (0115).
        when 'application.status_changed' then
          select a.applicant_profile_id into v_recipient
            from public.applications a
           where a.id = v_event.aggregate_id;
          perform private.emit_in_app_notification(
            v_recipient, 'application_status_changed', 'opportunities', 'action_required',
            'Votre candidature a changé d''étape.', null,
            'application', v_event.aggregate_id, 'view',
            '/candidatures/' || v_event.aggregate_id::text,
            'application_status_changed:' || v_event.id::text);

        -- Candidatures : candidature retenue (0115) — message dedie.
        when 'application.selected' then
          select a.applicant_profile_id into v_recipient
            from public.applications a
           where a.id = v_event.aggregate_id;
          perform private.emit_in_app_notification(
            v_recipient, 'application_status_changed', 'opportunities', 'action_required',
            'Votre candidature a été retenue !', null,
            'application', v_event.aggregate_id, 'view',
            '/candidatures/' || v_event.aggregate_id::text,
            'application_status_changed:' || v_event.id::text);

        -- Recommandations : nouvelle demande recue (0115) -> le destinataire.
        when 'recommendation.requested' then
          v_recipient := nullif(v_event.payload->>'recipient_profile_id', '')::uuid;
          perform private.emit_in_app_notification(
            v_recipient, 'recommendation_requested', 'network', 'action_required',
            'Nouvelle demande de recommandation.', null,
            'recommendation_request', v_event.aggregate_id, 'review',
            '/mon-profil/recommandations',
            'recommendation_requested:' || v_event.aggregate_id::text);

        -- Recommandations : reponse (acceptee ou declinee, 0115) -> le demandeur.
        when 'recommendation.request_answered' then
          v_recipient := nullif(v_event.payload->>'requester_profile_id', '')::uuid;
          perform private.emit_in_app_notification(
            v_recipient, 'recommendation_request_answered', 'network', 'relevant',
            case when v_event.payload->>'decision' = 'accepted'
                 then 'Votre demande de recommandation a été acceptée.'
                 else 'Votre demande de recommandation a été déclinée.' end,
            null, 'recommendation_request', v_event.aggregate_id, 'view',
            '/mon-profil/recommandations',
            'recommendation_request_answered:' || v_event.aggregate_id::text);

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
  '13 types d''evenements geres sur ~40 reellement ecrits (9 depuis 0105, 4 de plus depuis 0116 : '
  'application.status_changed, application.selected, recommendation.requested, '
  'recommendation.request_answered) ; le reste est marque processed sans effet. '
  'Appele toutes les 2 minutes par pg_cron (job notifications_process_domain_events, inchange).';

-- ---------------------------------------------------------------------
-- 3. Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n integer;
begin
  select count(*) into v_n
  from public.notification_types
  where code in ('recommendation_requested', 'recommendation_request_answered');
  if v_n <> 2 then
    raise exception '0116: 2 nouveaux notification_types attendus, % trouve(s)', v_n;
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0116: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0116: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
