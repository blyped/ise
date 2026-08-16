-- =====================================================================
-- 0157_signal_circulation
-- Circulation intelligente des signaux (D-221, 16/08/2026).
--
-- DEMANDE DU PORTEUR : « quand les utilisateurs lancent l'alerte, tout le
-- réseau doit être au courant [...] que ce soient les personnes vraiment
-- intéressées qui reçoivent l'information — pas tout, en même temps, à
-- tous. Une vraie gestion de la circulation intelligente de l'information. »
--
-- CONSTAT — l'architecture prévue existait DÉJÀ mais n'a jamais été
-- branchée de bout en bout :
--   · `compute_opportunity_matches()` / `compute_network_call_matches()`
--     (moteur de matching D-40, paliers de notification : score >= 75 =
--     `immediate`, 60-74 = `digest`, sinon `none`) ne sont JAMAIS appelées
--     à la publication -> les tables de correspondances restent vides ;
--   · le consommateur de notifications (0116) fait bien un fan-out sur
--     `network_call.published`... en lisant une table vide ;
--   · `opportunity.published` est émis mais IGNORÉ par le consommateur ;
--   · le type `weekly_digest` (0015) attend depuis le début un envoi
--     hebdomadaire qui n'a jamais existé.
--
-- CE QUE FAIT CETTE MIGRATION :
--   1. Extrait le coeur des deux fonctions de matching en fonctions
--      PRIVÉES sans contrôle de session (`*_core`), appelables par le
--      consommateur (cron, service) ; les fonctions publiques deviennent
--      de purs guichets d'authentification qui délèguent au coeur.
--   2. Redéfinit le consommateur : au traitement de `*.published`, il
--      CALCULE d'abord les correspondances, puis notifie in-app UNIQUEMENT
--      le palier `immediate` (les meilleurs profils, plafonnés à 50 par
--      signal) — jamais l'auteur, jamais les paliers faibles.
--   3. Ajoute le type de notification `opportunity_match` (0015 n'avait
--      seedé que `network_call_match`).
--   4. Fournit les deux lectures du digest hebdomadaire (destinataires +
--      contenu), réservées à `service_role` — consommées par la route
--      `/api/notifications/digest` (cron Vercel hebdomadaire).
--
-- CE QUE CETTE MIGRATION NE FAIT PAS : aucun e-mail immédiat par signal
-- (anti-spam : l'e-mail n'existe qu'en digest hebdomadaire) ; aucun
-- changement des barèmes de matching (D-40/D-41) ; aucun changement RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. Coeur privé — appels au réseau. Corps identique à la fonction
--     publique (0055), MOINS les contrôles de session/permission : le
--     coeur est réservé aux appels internes (consommateur, service).
-- ---------------------------------------------------------------------
create or replace function private.compute_network_call_matches_core(p_call_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_call  public.network_calls;
  v_count integer := 0;
begin
  select * into v_call from public.network_calls where id = p_call_id;
  if not found or v_call.deleted_at is not null then
    return 0;
  end if;

  delete from public.network_call_matches where call_id = p_call_id;

  insert into public.network_call_matches
    (call_id, profile_id, score, component_scores, reasons, missing_criteria,
     relevance_label, notification_tier, computed_at)
  select
    p_call_id, m.profile_id, m.score, m.component_scores, m.reasons, m.missing_criteria,
    m.relevance_label,
    case when m.score >= 75 then 'immediate'
         when m.score >= 60 then 'digest'
         else 'none' end,
    now()
  from private.profile_match_set(v_call.author_profile_id,
                                 private.network_call_criteria(p_call_id)) m
  where (
    not exists (select 1 from public.network_call_audience_profiles ap where ap.call_id = p_call_id)
    and not exists (select 1 from public.network_call_audience_promotions aq where aq.call_id = p_call_id)
  )
  or exists (select 1 from public.network_call_audience_profiles ap
              where ap.call_id = p_call_id and ap.profile_id = m.profile_id)
  or exists (select 1 from public.network_call_audience_promotions aq
              join public.ise_profiles p on p.id = m.profile_id
             where aq.call_id = p_call_id and p.promotion_id = aq.promotion_id);

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function private.compute_network_call_matches_core(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1b. Coeur privé — opportunités. Même extraction depuis la fonction
--     publique existante.
-- ---------------------------------------------------------------------
create or replace function private.compute_opportunity_matches_core(p_opportunity_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_opp   public.opportunities;
  v_count integer := 0;
begin
  select * into v_opp from public.opportunities where id = p_opportunity_id;
  if not found or v_opp.deleted_at is not null then
    return 0;
  end if;

  delete from public.opportunity_matches where opportunity_id = p_opportunity_id;

  insert into public.opportunity_matches
    (opportunity_id, profile_id, score, component_scores, reasons, missing_criteria,
     relevance_label, notification_tier, computed_at)
  select
    p_opportunity_id, m.profile_id, m.score, m.component_scores, m.reasons, m.missing_criteria,
    m.relevance_label,
    case when m.score >= 75 then 'immediate'
         when m.score >= 60 then 'digest'
         else 'none' end,
    now()
  from private.profile_match_set(v_opp.author_profile_id,
                                 private.opportunity_criteria(p_opportunity_id)) m
  where (
    not exists (select 1 from public.opportunity_audience_profiles ap
                 where ap.opportunity_id = p_opportunity_id)
    and not exists (select 1 from public.opportunity_audience_promotions aq
                     where aq.opportunity_id = p_opportunity_id)
  )
  or exists (select 1 from public.opportunity_audience_profiles ap
              where ap.opportunity_id = p_opportunity_id and ap.profile_id = m.profile_id)
  or exists (select 1 from public.opportunity_audience_promotions aq
              join public.ise_profiles p on p.id = m.profile_id
             where aq.opportunity_id = p_opportunity_id and p.promotion_id = aq.promotion_id);

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function private.compute_opportunity_matches_core(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2a. Guichet public — appels au réseau : contrôles inchangés, corps
--     délégué au coeur (une seule implantation du calcul).
-- ---------------------------------------------------------------------
create or replace function public.compute_network_call_matches(p_call_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_call public.network_calls;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_call from public.network_calls where id = p_call_id;
  if not found or v_call.deleted_at is not null then
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;
  if v_call.author_profile_id <> v_me and not private.has_permission('calls.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return private.compute_network_call_matches_core(p_call_id);
end
$$;

-- ---------------------------------------------------------------------
-- 2b. Guichet public — opportunités : idem.
-- ---------------------------------------------------------------------
create or replace function public.compute_opportunity_matches(p_opportunity_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_me  uuid := private.current_profile_id();
  v_opp public.opportunities;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if not private.is_opportunity_manager(p_opportunity_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return private.compute_opportunity_matches_core(p_opportunity_id);
end
$$;

-- ---------------------------------------------------------------------
-- 3. Type de notification `opportunity_match` (0015 ne l'avait pas seedé,
--    contrairement à `network_call_match`). E-mail en digest hebdomadaire
--    par défaut, jamais immédiat — cohérent avec l'anti-spam voulu.
-- ---------------------------------------------------------------------
insert into public.notification_types
  (code, category, default_priority, trigger_event, label, description,
   default_action_label, default_in_app, default_email_mode, default_push,
   is_push_allowed, is_email_allowed, is_groupable, group_window_minutes,
   is_user_configurable, supports_expiry, is_active, sort_order)
values
  ('opportunity_match', 'opportunities', 'relevant', 'opportunity.published',
   'Opportunité correspondant à votre profil',
   'Une opportunité publiée sur la plateforme correspond fortement à vos compétences, votre secteur ou votre disponibilité.',
   'Voir l''opportunité', true, 'weekly_digest', false,
   false, true, true, 60, true, true, true, 45)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 4. Consommateur v3 — reprend INTÉGRALEMENT la version 0116 (tous les
--    cas existants, inchangés) et ajoute :
--      · `network_call.published`  : calcul du matching AVANT le fan-out,
--        fan-out limité au palier `immediate`, 50 profils max par score ;
--      · `opportunity.published`   : même mécanique (cas absent en 0116).
-- ---------------------------------------------------------------------
create or replace function private.process_pending_domain_event_notifications(p_batch_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path to ''
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

        -- Appels au reseau : CALCUL du matching puis fan-out cible (D-221).
        -- 0116 lisait network_call_matches sans jamais l'alimenter : le
        -- calcul est desormais fait ICI, au traitement de l'evenement, et
        -- seul le palier `immediate` (score >= 75) est notifie, plafonne
        -- aux 50 meilleurs scores. Les paliers `digest` partent dans le
        -- courrier hebdomadaire, jamais en notification instantanee.
        when 'network_call.published' then
          perform private.compute_network_call_matches_core(v_event.aggregate_id);
          for v_recipient in
            select ncm.profile_id
              from public.network_call_matches ncm
             where ncm.call_id = v_event.aggregate_id
               and ncm.notification_tier = 'immediate'
               and ncm.profile_id is distinct from v_event.actor_profile_id
             order by ncm.score desc
             limit 50
          loop
            perform private.emit_in_app_notification(
              v_recipient, 'network_call_match', 'network_calls', 'relevant',
              'Un besoin du réseau correspond à votre profil.', null,
              'network_call', v_event.aggregate_id, 'view',
              '/appels/' || v_event.aggregate_id::text,
              'network_call_match:' || v_event.aggregate_id::text || ':' || v_recipient::text);
          end loop;

        -- Opportunites : meme mecanique (cas ABSENT de 0116 — une
        -- opportunite publiee n'informait personne).
        when 'opportunity.published' then
          perform private.compute_opportunity_matches_core(v_event.aggregate_id);
          for v_recipient in
            select om.profile_id
              from public.opportunity_matches om
             where om.opportunity_id = v_event.aggregate_id
               and om.notification_tier = 'immediate'
               and om.profile_id is distinct from v_event.actor_profile_id
             order by om.score desc
             limit 50
          loop
            perform private.emit_in_app_notification(
              v_recipient, 'opportunity_match', 'opportunities', 'relevant',
              'Une opportunité correspond à votre profil.', null,
              'opportunity', v_event.aggregate_id, 'view',
              '/opportunites/' || v_event.aggregate_id::text,
              'opportunity_match:' || v_event.aggregate_id::text || ':' || v_recipient::text);
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
          -- (vu par le relais) sans production de notification.
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

-- ---------------------------------------------------------------------
-- 5a. Digest hebdomadaire — destinataires. Un membre recoit le digest si
--     son compte est actif, qu'une adresse est connue, et qu'il n'a pas
--     coupe `weekly_digest` (preference explicitement 'off'). L'absence
--     de preference vaut acceptation (defaut du type : weekly_digest).
--     Le compteur de correspondances personnelles (paliers immediate +
--     digest calcules sur les 7 derniers jours) personnalise le courrier.
-- ---------------------------------------------------------------------
create or replace function public.weekly_digest_recipients()
returns table (
  profile_id    uuid,
  email         text,
  display_name  text,
  match_count   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    pc.primary_email,
    coalesce(p.display_name,
             nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), '')),
    (
      (select count(*)::int from public.opportunity_matches om
        where om.profile_id = p.id
          and om.notification_tier in ('immediate','digest')
          and om.computed_at > now() - interval '7 days')
      +
      (select count(*)::int from public.network_call_matches ncm
        where ncm.profile_id = p.id
          and ncm.notification_tier in ('immediate','digest')
          and ncm.computed_at > now() - interval '7 days')
    )
  from public.ise_profiles p
  join private.profile_contacts pc on pc.profile_id = p.id
  where p.user_id is not null
    and p.deleted_at is null
    and pc.primary_email is not null
    and not exists (
      select 1 from public.notification_preferences pr
       where pr.profile_id = p.id
         and pr.notification_type_code = 'weekly_digest'
         and pr.email_mode = 'off'
    );
$$;

revoke all on function public.weekly_digest_recipients() from public, anon, authenticated;
grant execute on function public.weekly_digest_recipients() to service_role;

-- ---------------------------------------------------------------------
-- 5b. Digest hebdomadaire — contenu commun : les signaux publies sur les
--     7 derniers jours (opportunites, appels au reseau) et les evenements
--     a venir. Aucune donnee personnelle : uniquement des contenus que
--     tout membre connecte peut deja voir.
-- ---------------------------------------------------------------------
create or replace function public.weekly_digest_content()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'opportunities', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'title', o.title, 'type', o.opportunity_type,
               'organization', coalesce(org.canonical_name, o.organization_name_raw))
             order by o.published_at desc)
        from public.opportunities o
        left join public.organizations org on org.id = o.organization_id
       where o.status = 'active' and o.deleted_at is null
         and o.published_at > now() - interval '7 days'
    ), '[]'::jsonb),
    'network_calls', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'title', c.title, 'type', c.call_type)
             order by c.published_at desc)
        from public.network_calls c
       where c.status = 'active' and c.deleted_at is null
         and c.published_at > now() - interval '7 days'
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'title', e.title, 'starts_at', e.starts_at)
             order by e.starts_at asc)
        from public.events e
       where e.status = 'published' and e.deleted_at is null
         and e.starts_at > now()
         and e.starts_at < now() + interval '30 days'
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.weekly_digest_content() from public, anon, authenticated;
grant execute on function public.weekly_digest_content() to service_role;

comment on function public.weekly_digest_recipients() is
  'Destinataires du courrier hebdomadaire des signaux (D-221). Reservee a service_role : consommee par /api/notifications/digest (cron Vercel).';
comment on function public.weekly_digest_content() is
  'Contenu commun du courrier hebdomadaire des signaux (D-221) : publications des 7 derniers jours + evenements a venir. Reservee a service_role.';
