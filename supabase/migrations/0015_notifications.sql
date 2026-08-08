-- 0015_notifications
-- Applique le 2026-08-08 (version 20260808005021)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0015_notifications
-- Notifications, preferences, livraisons, parametres, consentements.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catalogue des types de notification
-- ---------------------------------------------------------------------
create table if not exists public.notification_types (
  code                    text primary key,
  category                text not null
                            check (category in
                              ('network', 'introductions', 'messages', 'network_calls',
                               'opportunities', 'internships', 'mentorship', 'projects',
                               'promotions', 'communities', 'events', 'news', 'system')),
  default_priority        text not null default 'info'
                            check (default_priority in
                              ('critical', 'action_required', 'relevant', 'info', 'digest')),
  trigger_event           text not null,
  label                   text not null,
  description             text,
  default_action_label    text,
  default_in_app          boolean not null default true,
  default_email_mode      text not null default 'off'
                            check (default_email_mode in
                              ('immediate', 'daily_digest', 'weekly_digest', 'off')),
  default_push            boolean not null default false,
  is_push_allowed         boolean not null default false,
  is_email_allowed        boolean not null default true,
  is_groupable            boolean not null default false,
  group_window_minutes    integer check (group_window_minutes is null or group_window_minutes > 0),
  is_user_configurable    boolean not null default true,
  supports_expiry         boolean not null default false,
  is_active               boolean not null default true,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint notification_types_push_coherence
    check (is_push_allowed or not default_push),
  constraint notification_types_email_coherence
    check (is_email_allowed or default_email_mode = 'off'),
  constraint notification_types_group_window
    check (not is_groupable or group_window_minutes is not null)
);

comment on table public.notification_types is
  'Catalogue des types de notification : declencheur, categorie, priorite et canaux par defaut (D-80, D-81).';
comment on column public.notification_types.is_push_allowed is
  'Interdit le canal push au niveau du catalogue. Aucune push par actualite ni par nouvelle communaute.';

select private.attach_updated_at('public', 'notification_types');

create index if not exists notification_types_category_idx
  on public.notification_types(category, sort_order) where is_active;

-- ---------------------------------------------------------------------
-- 2. Notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id                      uuid primary key default extensions.gen_random_uuid(),
  profile_id              uuid not null references public.ise_profiles(id) on delete cascade,
  notification_type_code  text references public.notification_types(code) on delete set null,
  category                text not null
                            check (category in
                              ('network', 'introductions', 'messages', 'network_calls',
                               'opportunities', 'internships', 'mentorship', 'projects',
                               'promotions', 'communities', 'events', 'news', 'system')),
  priority                text not null default 'info'
                            check (priority in
                              ('critical', 'action_required', 'relevant', 'info', 'digest')),
  title                   text not null,
  body                    text,
  reason_code             text,
  reason_text             text,
  entity_type             text,
  entity_id               uuid,
  action_type             text,
  action_path             text,
  deduplication_key       text,
  group_key               text,
  group_count             integer not null default 1 check (group_count >= 1),
  read_at                 timestamptz,
  archived_at             timestamptz,
  expires_at              timestamptz,
  created_at              timestamptz not null default now(),
  constraint notifications_entity_pair
    check ((entity_type is null) = (entity_id is null))
);

comment on table public.notifications is
  'Notification destinee a un membre. Priorite et categorie sont distinctes : « Action requise » est une priorite (D-81).';
comment on column public.notifications.deduplication_key is
  'Cle d''unicite fonctionnelle par destinataire. Empeche d''envoyer trois fois le meme evenement.';

create index if not exists notifications_profile_cursor_idx
  on public.notifications(profile_id, created_at desc, id desc);
create index if not exists notifications_unread_idx
  on public.notifications(profile_id, created_at desc)
  where read_at is null and archived_at is null;
create index if not exists notifications_action_required_idx
  on public.notifications(profile_id, created_at desc)
  where priority in ('critical', 'action_required') and read_at is null and archived_at is null;
create index if not exists notifications_category_idx
  on public.notifications(profile_id, category, created_at desc);
create index if not exists notifications_type_idx
  on public.notifications(notification_type_code) where notification_type_code is not null;
create index if not exists notifications_entity_idx
  on public.notifications(entity_type, entity_id) where entity_id is not null;
create index if not exists notifications_group_idx
  on public.notifications(profile_id, group_key) where group_key is not null;
create index if not exists notifications_expiry_idx
  on public.notifications(expires_at) where expires_at is not null;
create unique index if not exists notifications_dedup_uidx
  on public.notifications(profile_id, deduplication_key)
  where deduplication_key is not null;

-- ---------------------------------------------------------------------
-- 3. Preferences
-- ---------------------------------------------------------------------
create table if not exists public.notification_preferences (
  profile_id             uuid not null references public.ise_profiles(id) on delete cascade,
  notification_type_code text not null references public.notification_types(code) on delete cascade,
  in_app_enabled         boolean not null default true,
  email_mode             text not null default 'off'
                           check (email_mode in
                             ('immediate', 'daily_digest', 'weekly_digest', 'off')),
  push_enabled           boolean not null default false,
  muted_until            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (profile_id, notification_type_code)
);

comment on table public.notification_preferences is
  'Preference d''un membre pour un type de notification. Absence de ligne = valeurs par defaut du catalogue.';

select private.attach_updated_at('public', 'notification_preferences');

create index if not exists notification_preferences_type_idx
  on public.notification_preferences(notification_type_code);
create index if not exists notification_preferences_profile_idx
  on public.notification_preferences(profile_id);

create table if not exists public.notification_community_preferences (
  profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  community_id uuid not null,
  mode         text not null default 'important_only'
                 check (mode in ('all', 'important_only', 'digest', 'none')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (profile_id, community_id)
);
select private.attach_updated_at('public', 'notification_community_preferences');
create index if not exists notification_community_preferences_community_idx
  on public.notification_community_preferences(community_id);

-- ---------------------------------------------------------------------
-- 4. Jetons Expo Push
-- ---------------------------------------------------------------------
create table if not exists public.device_tokens (
  id                     uuid primary key default extensions.gen_random_uuid(),
  profile_id             uuid not null references public.ise_profiles(id) on delete cascade,
  platform               text not null check (platform in ('ios', 'android', 'web')),
  expo_push_token        text not null,
  device_identifier_hash text,
  device_label           text,
  app_version            text,
  is_active              boolean not null default true,
  last_seen_at           timestamptz not null default now(),
  revoked_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint device_tokens_revoked_coherence
    check (is_active or revoked_at is not null)
);

comment on table public.device_tokens is
  'Jetons Expo Push. Web push hors perimetre V1 : la valeur web est reservee a une activation ulterieure.';
comment on column public.device_tokens.device_identifier_hash is
  'Empreinte de l''identifiant d''appareil. Aucun identifiant en clair (conventions §10).';

select private.attach_updated_at('public', 'device_tokens');

create unique index if not exists device_tokens_expo_uidx on public.device_tokens(expo_push_token);
create index if not exists device_tokens_profile_idx
  on public.device_tokens(profile_id) where is_active;

-- ---------------------------------------------------------------------
-- 5. Livraisons
-- ---------------------------------------------------------------------
create table if not exists public.notification_deliveries (
  id                  uuid primary key default extensions.gen_random_uuid(),
  notification_id     uuid references public.notifications(id) on delete cascade,
  profile_id          uuid not null references public.ise_profiles(id) on delete cascade,
  channel             text not null check (channel in ('in_app', 'email', 'push')),
  payload_kind        text not null default 'single'
                        check (payload_kind in ('single', 'daily_digest', 'weekly_digest')),
  status              text not null default 'pending'
                        check (status in
                          ('pending', 'queued', 'sent', 'delivered',
                           'failed', 'skipped', 'cancelled')),
  skip_reason         text,
  attempt_count       integer not null default 0 check (attempt_count >= 0),
  max_attempts        integer not null default 5 check (max_attempts >= 1),
  scheduled_for       timestamptz not null default now(),
  next_attempt_at     timestamptz,
  device_token_id     uuid references public.device_tokens(id) on delete set null,
  provider            text,
  provider_message_id text,
  idempotency_key     text not null,
  last_error_code     text,
  last_error_at       timestamptz,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  failed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint notification_deliveries_push_needs_token
    check (channel <> 'push' or device_token_id is not null or status in ('pending', 'skipped', 'cancelled')),
  constraint notification_deliveries_failed_timestamp
    check (status <> 'failed' or failed_at is not null),
  constraint notification_deliveries_skip_reason
    check (status <> 'skipped' or skip_reason is not null),
  constraint notification_deliveries_single_needs_notification
    check (payload_kind <> 'single' or notification_id is not null)
);

comment on table public.notification_deliveries is
  'Tentative de livraison d''une notification sur un canal. Retries bornes et idempotence par idempotency_key.';

select private.attach_updated_at('public', 'notification_deliveries');

create unique index if not exists notification_deliveries_idempotency_uidx
  on public.notification_deliveries(idempotency_key);
create index if not exists notification_deliveries_notification_idx
  on public.notification_deliveries(notification_id) where notification_id is not null;
create index if not exists notification_deliveries_profile_idx
  on public.notification_deliveries(profile_id, created_at desc);
create index if not exists notification_deliveries_device_idx
  on public.notification_deliveries(device_token_id) where device_token_id is not null;
create index if not exists notification_deliveries_due_idx
  on public.notification_deliveries(coalesce(next_attempt_at, scheduled_for))
  where status in ('pending', 'queued', 'failed');
create index if not exists notification_deliveries_channel_status_idx
  on public.notification_deliveries(channel, status);

-- ---------------------------------------------------------------------
-- 6. Parametres du membre
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
  profile_id                  uuid primary key references public.ise_profiles(id) on delete cascade,
  interface_language          text not null default 'fr',
  timezone                    text not null default 'UTC',
  country_code                char(2) references public.countries(code),
  notification_preset         text not null default 'recommended'
                                check (notification_preset in
                                  ('recommended', 'minimal', 'all', 'custom')),
  email_digest_frequency      text not null default 'weekly'
                                check (email_digest_frequency in ('daily', 'weekly', 'off')),
  quiet_hours_start           time,
  quiet_hours_end             time,
  allow_public_profile        boolean not null default false,
  allow_search_engine_indexing boolean not null default false,
  direct_message_policy       text not null default 'connections'
                                check (direct_message_policy in
                                  ('members', 'connections', 'none')),
  show_read_receipts          boolean not null default true,
  appear_in_matching          boolean not null default true,
  appear_in_attendee_lists    boolean not null default false,
  is_paused                   boolean not null default false,
  paused_at                   timestamptz,
  pause_reason                text,
  deletion_requested_at       timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint user_settings_indexing_requires_public
    check (not allow_search_engine_indexing or allow_public_profile),
  constraint user_settings_pause_timestamp
    check (not is_paused or paused_at is not null),
  constraint user_settings_quiet_hours_pair
    check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

comment on table public.user_settings is
  'Parametres transverses du compte. La visibilite par champ vit dans public.profile_visibility (D-73, D-74).';
comment on column public.user_settings.allow_public_profile is
  'Opt-in explicite, desactive par defaut. Aucun profil expose au web ouvert en V1 (D-73).';

select private.attach_updated_at('public', 'user_settings');

create index if not exists user_settings_paused_idx  on public.user_settings(paused_at) where is_paused;
create index if not exists user_settings_country_idx on public.user_settings(country_code)
  where country_code is not null;
create index if not exists user_settings_deletion_idx
  on public.user_settings(deletion_requested_at) where deletion_requested_at is not null;

-- ---------------------------------------------------------------------
-- 7. Consentements
-- ---------------------------------------------------------------------
create table if not exists public.consent_records (
  id             uuid primary key default extensions.gen_random_uuid(),
  profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  consent_type   text not null
                   check (consent_type in
                     ('terms_of_service', 'privacy_policy', 'marketing_communication',
                      'testimonial_use', 'public_profile', 'data_processing')),
  version        text not null,
  is_granted     boolean not null,
  granted_at     timestamptz,
  revoked_at     timestamptz,
  source         text not null default 'settings'
                   check (source in ('signup', 'onboarding', 'settings', 'import', 'support')),
  locale         text not null default 'fr',
  created_at     timestamptz not null default now(),
  constraint consent_records_granted_timestamp
    check (not is_granted or granted_at is not null),
  constraint consent_records_revoked_timestamp
    check (is_granted or revoked_at is not null)
);

comment on table public.consent_records is
  'Historique des consentements. Une revocation cree une nouvelle ligne, elle n''efface jamais la precedente.';

create index if not exists consent_records_profile_idx
  on public.consent_records(profile_id, consent_type, created_at desc);
create index if not exists consent_records_active_idx
  on public.consent_records(profile_id, consent_type)
  where is_granted and revoked_at is null;

-- ---------------------------------------------------------------------
-- 8. Acceptations de conditions
-- ---------------------------------------------------------------------
create table if not exists public.terms_acceptances (
  id            uuid primary key default extensions.gen_random_uuid(),
  profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  document_type text not null
                  check (document_type in
                    ('terms_of_service', 'privacy_policy', 'code_of_conduct',
                     'cookie_policy')),
  version       text not null,
  document_hash text,
  locale        text not null default 'fr',
  accepted_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

comment on table public.terms_acceptances is
  'Acceptation datee d''une version precise d''un document contractuel.';

create unique index if not exists terms_acceptances_profile_doc_version_uidx
  on public.terms_acceptances(profile_id, document_type, version);
create index if not exists terms_acceptances_profile_idx
  on public.terms_acceptances(profile_id, accepted_at desc);
create index if not exists terms_acceptances_document_idx
  on public.terms_acceptances(document_type, version);

-- ---------------------------------------------------------------------
-- 9. Cle etrangere conditionnelle vers les communautes
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.communities') is not null
     and not exists (select 1 from pg_constraint
                     where conname = 'notification_community_preferences_community_fk') then
    alter table public.notification_community_preferences
      add constraint notification_community_preferences_community_fk
      foreign key (community_id) references public.communities(id) on delete cascade;
  end if;
end
$$;

-- =====================================================================
-- 10. SEED DU CATALOGUE notification_types
-- =====================================================================
insert into public.notification_types (
  code, category, default_priority, trigger_event, label, default_action_label,
  default_in_app, default_email_mode, default_push,
  is_push_allowed, is_email_allowed,
  is_groupable, group_window_minutes,
  is_user_configurable, supports_expiry, sort_order
) values
  ('message_received', 'messages', 'relevant', 'message.created',
   'Nouveau message', 'Ouvrir la conversation',
   true, 'off', true, true, true, false, null, true, false, 10),

  ('connection_request_received', 'network', 'action_required', 'connection_request.created',
   'Nouvelle demande de connexion.', 'Examiner',
   true, 'immediate', false, true, true, false, null, true, true, 20),

  ('network_call_match', 'network_calls', 'relevant', 'network_call.matched',
   'Un besoin correspond a vos competences.', 'Voir l''appel',
   true, 'daily_digest', false, true, true, false, null, true, true, 30),
  ('network_call_match_digest', 'network_calls', 'digest', 'network_call.matched_batch',
   'Plusieurs appels correspondent a vos competences.', 'Voir les appels',
   true, 'daily_digest', false, false, true, true, 1440, true, true, 31),

  ('opportunity_strong_match', 'opportunities', 'relevant', 'opportunity.matched_strong',
   'Une mission correspond a votre profil.', 'Voir la mission',
   true, 'immediate', false, true, true, false, null, true, true, 40),
  ('opportunity_match_digest', 'opportunities', 'digest', 'opportunity.matched_batch',
   'Plusieurs nouvelles opportunites correspondent a votre profil.', 'Voir',
   true, 'daily_digest', false, false, true, true, 1440, true, true, 41),
  ('application_status_changed', 'opportunities', 'action_required', 'application.status_changed',
   'Votre candidature a change d''etape.', 'Voir ma candidature',
   true, 'immediate', true, true, true, false, null, true, false, 42),

  ('internship_invitation_received', 'internships', 'action_required', 'internship_invitation.created',
   'Une entreprise vous invite a candidater.', 'Voir l''invitation',
   true, 'immediate', false, true, true, false, null, true, true, 50),
  ('internship_offers_match', 'internships', 'relevant', 'internship.offers_matched',
   'Des offres correspondent a votre recherche de stage.', 'Voir les offres',
   true, 'daily_digest', false, false, true, true, 1440, true, true, 51),

  ('mentorship_request_received', 'mentorship', 'action_required', 'mentorship_request.created',
   'Nouvelle demande de mentorat.', 'Examiner',
   true, 'immediate', true, true, true, false, null, true, true, 60),
  ('mentorship_request_accepted', 'mentorship', 'relevant', 'mentorship_request.accepted',
   'Votre demande de mentorat a ete acceptee.', 'Ouvrir le mentorat',
   true, 'immediate', true, true, true, false, null, true, false, 61),

  ('project_team_invitation', 'projects', 'action_required', 'project_invitation.created',
   'Invitation a rejoindre une equipe.', 'Examiner',
   true, 'immediate', true, true, true, false, null, true, true, 70),

  ('promotion_important_update', 'promotions', 'info', 'promotion_news.published',
   'Invitation ou actualite importante de votre promotion.', 'Voir',
   true, 'weekly_digest', false, false, true, false, null, true, false, 80),
  ('promotion_members_activated', 'promotions', 'digest', 'promotion.members_activated',
   'Des membres de votre promotion ont active leur profil cette semaine.', 'Voir les membres',
   true, 'weekly_digest', false, false, true, true, 10080, true, false, 81),
  ('promotion_membership_confirmation_requested', 'promotions', 'action_required',
   'promotion_membership.confirmation_requested',
   'Une confirmation d''appartenance a votre promotion vous est demandee.', 'Confirmer',
   true, 'immediate', false, true, true, false, null, true, true, 82),

  ('community_activity', 'communities', 'info', 'community.activity',
   'Activite dans votre communaute.', 'Voir la communaute',
   true, 'weekly_digest', false, false, true, true, 10080, true, false, 90),
  ('community_event_published', 'communities', 'info', 'community_event.published',
   'Un evenement est propose dans votre communaute.', 'Voir l''evenement',
   true, 'weekly_digest', false, false, true, false, null, true, true, 91),

  ('event_invitation', 'events', 'info', 'event.invitation_sent',
   'Vous etes invite a un evenement.', 'Voir l''evenement',
   true, 'immediate', false, false, true, false, null, true, true, 100),
  ('event_registration_confirmed', 'events', 'info', 'event_registration.confirmed',
   'Votre inscription est confirmee.', 'Voir l''evenement',
   true, 'immediate', false, false, true, false, null, true, false, 101),
  ('event_reminder_24h', 'events', 'info', 'event.reminder_24h',
   'Rappel d''evenement.', 'Voir l''evenement',
   true, 'immediate', true, true, true, false, null, true, true, 102),
  ('event_reminder_1h', 'events', 'relevant', 'event.reminder_1h',
   'Votre evenement commence dans une heure.', 'Rejoindre',
   true, 'off', true, true, true, false, null, true, true, 103),
  ('event_cancelled', 'events', 'relevant', 'event.cancelled',
   'Un evenement auquel vous etes inscrit a ete annule.', 'Voir le detail',
   true, 'immediate', true, true, true, false, null, false, false, 104),
  ('event_schedule_changed', 'events', 'relevant', 'event.schedule_changed',
   'La date ou le lieu d''un evenement a ete modifie.', 'Voir le detail',
   true, 'immediate', true, true, true, false, null, false, false, 105),

  ('news_major_published', 'news', 'info', 'news.published_major',
   'Nouvelle actualite du reseau.', 'Lire',
   true, 'weekly_digest', false, false, true, true, 10080, true, false, 110),
  ('news_about_me', 'news', 'relevant', 'news.mentions_profile',
   'Une actualite vous concerne.', 'Lire',
   true, 'immediate', false, false, true, false, null, true, false, 111),

  ('account_security_event', 'system', 'critical', 'account.security_event',
   'Evenement de securite sur votre compte.', 'Verifier',
   true, 'immediate', true, true, true, false, null, false, false, 120),
  ('important_invitation', 'system', 'action_required', 'system.important_invitation',
   'Invitation importante.', 'Voir',
   true, 'immediate', false, true, true, false, null, true, true, 121),
  ('availability_confirmation_reminder', 'system', 'info', 'availability.stale',
   'Votre disponibilite n''a pas ete confirmee depuis plusieurs mois.', 'Mettre a jour',
   true, 'off', false, false, true, false, null, true, false, 122),

  ('support_ticket_created', 'system', 'info', 'support_ticket.created',
   'Votre demande a ete recue.', 'Voir ma demande',
   true, 'off', false, false, true, false, null, true, false, 130),
  ('support_information_requested', 'system', 'action_required', 'support_ticket.waiting_user',
   'L''equipe support vous demande une information complementaire.', 'Repondre',
   true, 'immediate', false, true, true, false, null, true, false, 131),
  ('support_ticket_resolved', 'system', 'info', 'support_ticket.resolved',
   'Votre demande a ete resolue.', 'Voir ma demande',
   true, 'off', false, false, true, false, null, true, false, 132),

  ('daily_digest', 'system', 'digest', 'digest.daily',
   'Votre resume quotidien Competences ISE.', 'Ouvrir',
   false, 'daily_digest', false, false, true, true, 1440, true, false, 140),
  ('weekly_digest', 'system', 'digest', 'digest.weekly',
   'Votre semaine Competences ISE.', 'Ouvrir',
   false, 'weekly_digest', false, false, true, true, 10080, true, false, 141)
on conflict (code) do nothing;

