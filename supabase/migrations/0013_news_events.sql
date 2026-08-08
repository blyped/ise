-- 0013_news_events
-- Applique le 2026-08-08 (version 20260808004809)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0013_news_events
-- Module Actualites & Evenements (ISE-092 -> ISE-096).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Taxonomie editoriale des actualites
-- ---------------------------------------------------------------------
create table if not exists public.news_categories (
  code                    text primary key,
  name                    text not null,
  slug                    text not null unique,
  description             text,
  is_navigation_category  boolean not null default true,
  is_submission_type      boolean not null default true,
  default_editorial_level smallint not null default 3
                            check (default_editorial_level between 1 and 3),
  sort_order              integer not null default 0,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.news_categories is
  'Taxonomie editoriale des actualites. Union des listes de navigation et de saisie (DIGEST D 6.3).';

create index if not exists news_categories_active_idx
  on public.news_categories(sort_order) where is_active;

select private.attach_updated_at('public', 'news_categories');

insert into public.news_categories
  (code, name, slug, is_navigation_category, is_submission_type, default_editorial_level, sort_order)
values
  ('ise_spotlight',    'ISE en lumiere',                'ise-en-lumiere',                true,  false, 1,  10),
  ('appointment',      'Nomination',                    'nomination',                    true,  true,  1,  20),
  ('new_position',     'Nouvelle fonction',             'nouvelle-fonction',             false, true,  2,  30),
  ('distinction',      'Distinction',                   'distinction',                   true,  true,  1,  40),
  ('publication',      'Publication',                   'publication',                   true,  true,  2,  50),
  ('entrepreneurship', 'Entrepreneuriat',               'entrepreneuriat',               true,  true,  2,  60),
  ('project',          'Projet',                        'projet',                        true,  true,  2,  70),
  ('research',         'Recherche',                     'recherche',                     true,  true,  2,  80),
  ('international',    'International',                 'international',                 true,  true,  2,  90),
  ('major_mission',    'Mission importante',            'mission-importante',            false, true,  2, 100),
  ('career_path',      'Parcours',                      'parcours',                      false, true,  2, 110),
  ('network_achievement', 'Realisation du reseau',      'realisation-du-reseau',         true,  true,  1, 120),
  ('promotion_life',   'Vie des promotions',            'vie-des-promotions',            true,  true,  3, 130),
  ('community_life',   'Vie des communautes',           'vie-des-communautes',           true,  true,  3, 140),
  ('network_life',     'Vie du reseau',                 'vie-du-reseau',                 true,  true,  3, 150),
  ('event_report',     'Evenement',                     'evenement',                     false, true,  3, 160),
  ('other',            'Autre',                         'autre',                         false, true,  3, 900)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2. Actualites
-- ---------------------------------------------------------------------
create table if not exists public.news (
  id                       uuid primary key default extensions.gen_random_uuid(),
  category_code            text not null references public.news_categories(code) on delete restrict,
  title                    text not null check (length(btrim(title)) between 3 and 240),
  slug                     text not null unique,
  summary                  text not null check (length(summary) <= 400),
  body                     text,
  event_date               date,
  image_path               text,
  source_type              text check (source_type is null or source_type in
                             ('internal', 'linkedin_public', 'organization_site',
                              'media_article', 'scientific_publication',
                              'institutional_site', 'other')),
  source_url               text,
  visibility               text not null default 'members'
                             check (visibility in ('members', 'promotion', 'community')),
  promotion_id             bigint references public.promotions(id) on delete set null,
  community_id             uuid,
  editorial_level          smallint not null default 3
                             check (editorial_level between 1 and 3),
  is_featured              boolean not null default false,
  featured_at              timestamptz,
  editorial_status         text not null default 'draft'
                             check (editorial_status in
                               ('draft', 'submitted', 'under_review', 'approved',
                                'published', 'rejected', 'archived', 'duplicate')),
  duplicate_of_news_id     uuid references public.news(id) on delete set null,
  third_party_consent      text not null default 'not_applicable'
                             check (third_party_consent in
                               ('not_applicable', 'public_information',
                                'consent_given', 'unknown')),
  consent_confirmed_at     timestamptz,
  source_event_id          uuid,
  source_project_id        uuid,
  submitted_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  reviewed_by_profile_id   uuid references public.ise_profiles(id) on delete set null,
  reviewed_at              timestamptz,
  rejection_reason         text,
  published_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  published_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  constraint news_published_needs_date
    check (editorial_status <> 'published' or published_at is not null),
  constraint news_external_source_required
    check (source_type is null or source_type in ('internal', 'other') or source_url is not null),
  constraint news_visibility_scope
    check (
      (visibility <> 'promotion' or promotion_id is not null) and
      (visibility <> 'community' or community_id is not null)
    ),
  constraint news_duplicate_not_self
    check (duplicate_of_news_id is null or duplicate_of_news_id <> id)
);

comment on table public.news is
  'Actualites du reseau (ISE-092..094). Pas de like, pas de compteur de vues : CA-NEWS-01.';
comment on column public.news.third_party_consent is
  'Consentement lorsque l''actualite concerne un tiers. Aucune publication automatique sans controle (DIGEST D 6.6).';

select private.attach_updated_at('public', 'news');

create index if not exists news_published_cursor_idx
  on public.news(published_at desc, id desc)
  where editorial_status = 'published' and deleted_at is null;
create index if not exists news_category_idx
  on public.news(category_code) where deleted_at is null;
create index if not exists news_promotion_idx
  on public.news(promotion_id) where promotion_id is not null and deleted_at is null;
create index if not exists news_community_idx
  on public.news(community_id) where community_id is not null and deleted_at is null;
create index if not exists news_status_idx
  on public.news(editorial_status, created_at desc) where deleted_at is null;
create index if not exists news_submitted_by_idx
  on public.news(submitted_by_profile_id) where submitted_by_profile_id is not null;
create index if not exists news_reviewed_by_idx
  on public.news(reviewed_by_profile_id) where reviewed_by_profile_id is not null;
create index if not exists news_published_by_idx
  on public.news(published_by_profile_id) where published_by_profile_id is not null;
create index if not exists news_duplicate_of_idx
  on public.news(duplicate_of_news_id) where duplicate_of_news_id is not null;
create index if not exists news_source_event_idx
  on public.news(source_event_id) where source_event_id is not null;
create index if not exists news_source_project_idx
  on public.news(source_project_id) where source_project_id is not null;
create index if not exists news_featured_idx
  on public.news(featured_at desc) where is_featured and deleted_at is null;
create index if not exists news_title_trgm_idx
  on public.news using gin (public.normalize_text(title) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. Liaisons d'une actualite
-- ---------------------------------------------------------------------
create table if not exists public.news_profiles (
  news_id      uuid not null references public.news(id) on delete cascade,
  profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  profile_role text not null default 'subject'
                 check (profile_role in ('subject', 'author', 'co_author', 'mentioned')),
  created_at   timestamptz not null default now(),
  primary key (news_id, profile_id, profile_role)
);
create index if not exists news_profiles_profile_idx on public.news_profiles(profile_id);

create table if not exists public.news_organizations (
  news_id         uuid not null references public.news(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (news_id, organization_id)
);
create index if not exists news_organizations_org_idx on public.news_organizations(organization_id);

create table if not exists public.news_promotions (
  news_id      uuid not null references public.news(id) on delete cascade,
  promotion_id bigint not null references public.promotions(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (news_id, promotion_id)
);
create index if not exists news_promotions_promotion_idx on public.news_promotions(promotion_id);

create table if not exists public.news_communities (
  news_id      uuid not null references public.news(id) on delete cascade,
  community_id uuid not null,
  created_at   timestamptz not null default now(),
  primary key (news_id, community_id)
);
create index if not exists news_communities_community_idx on public.news_communities(community_id);

create table if not exists public.news_skills (
  news_id    uuid not null references public.news(id) on delete cascade,
  skill_id   bigint not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, skill_id)
);
create index if not exists news_skills_skill_idx on public.news_skills(skill_id);

create table if not exists public.news_sources (
  id                     uuid primary key default extensions.gen_random_uuid(),
  news_id                uuid not null references public.news(id) on delete cascade,
  source_type            text not null
                           check (source_type in
                             ('official_link', 'institutional_publication', 'press_release',
                              'linkedin_public', 'organization_site', 'media_article',
                              'scientific_publication', 'other_evidence')),
  source_url             text,
  title                  text,
  verified_at            timestamptz,
  verified_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  created_at             timestamptz not null default now()
);
create index if not exists news_sources_news_idx     on public.news_sources(news_id);
create index if not exists news_sources_verifier_idx on public.news_sources(verified_by_profile_id)
  where verified_by_profile_id is not null;
create index if not exists news_sources_unverified_idx on public.news_sources(created_at desc)
  where verified_at is null;

-- ---------------------------------------------------------------------
-- 4. Evenements
-- ---------------------------------------------------------------------
create table if not exists public.event_types (
  code       text primary key,
  name       text not null,
  slug       text not null unique,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select private.attach_updated_at('public', 'event_types');
create index if not exists event_types_active_idx on public.event_types(sort_order) where is_active;

insert into public.event_types (code, name, slug, sort_order) values
  ('conference',              'Conference',                 'conference',                  10),
  ('webinar',                 'Webinaire',                  'webinaire',                   20),
  ('workshop',                'Atelier',                    'atelier',                     30),
  ('training',                'Formation',                  'formation',                   40),
  ('afterwork',               'Afterwork',                  'afterwork',                   50),
  ('promotion_meetup',        'Rencontre de promotion',     'rencontre-de-promotion',      60),
  ('networking',              'Networking',                 'networking',                  70),
  ('roundtable',              'Table ronde',                'table-ronde',                 80),
  ('panel',                   'Panel',                      'panel',                       90),
  ('working_group',           'Groupe de travail',          'groupe-de-travail',          100),
  ('publication_presentation','Presentation de publication','presentation-de-publication',110),
  ('mentoring_session',       'Session de mentorat',        'session-de-mentorat',        120),
  ('sector_meetup',           'Rencontre sectorielle',      'rencontre-sectorielle',      130),
  ('international_event',     'Evenement international',    'evenement-international',    140),
  ('ensea_event',             'Evenement ENSEA',            'evenement-ensea',            150),
  ('other',                   'Autre',                      'autre',                      900)
on conflict (code) do nothing;

create table if not exists public.events (
  id                        uuid primary key default extensions.gen_random_uuid(),
  event_type_code           text not null references public.event_types(code) on delete restrict,
  title                     text not null check (length(btrim(title)) between 3 and 240),
  slug                      text not null unique,
  description               text,
  target_audience           text,
  organizer_type            text not null default 'profile'
                              check (organizer_type in
                                ('profile', 'promotion', 'community', 'project',
                                 'platform', 'partner')),
  organizer_profile_id      uuid   references public.ise_profiles(id) on delete set null,
  organizer_promotion_id    bigint references public.promotions(id)   on delete set null,
  organizer_community_id    uuid,
  organizer_project_id      uuid,
  organizer_external_name   text,
  format                    text not null default 'online'
                              check (format in ('online', 'in_person', 'hybrid')),
  country_code              char(2) references public.countries(code),
  city                      text,
  venue_name                text,
  address                   text,
  online_url_private        text,
  online_url_visibility     text not null default 'registered'
                              check (online_url_visibility in ('registered', 'all_viewers')),
  starts_at                 timestamptz not null,
  ends_at                   timestamptz,
  timezone                  text not null,
  capacity                  integer check (capacity is null or capacity > 0),
  registration_policy       text not null default 'required'
                              check (registration_policy in
                                ('required', 'optional', 'none', 'approval_required')),
  attendee_list_visibility  text not null default 'organizer'
                              check (attendee_list_visibility in
                                ('organizer', 'registered', 'members')),
  visibility                text not null default 'members'
                              check (visibility in
                                ('members', 'promotion', 'community',
                                 'selected_members', 'invitation_only')),
  status                    text not null default 'draft'
                              check (status in
                                ('draft', 'pending_review', 'published', 'full',
                                 'completed', 'cancelled', 'archived')),
  published_at              timestamptz,
  cancelled_at              timestamptz,
  cancellation_reason       text,
  completed_at              timestamptz,
  created_by_profile_id     uuid references public.ise_profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  constraint events_dates_order
    check (ends_at is null or ends_at >= starts_at),
  constraint events_timezone_not_blank
    check (length(btrim(timezone)) > 0),
  constraint events_online_needs_url
    check (format = 'in_person' or online_url_private is not null or status in ('draft', 'pending_review')),
  constraint events_in_person_needs_place
    check (format = 'online' or city is not null or venue_name is not null or status in ('draft', 'pending_review')),
  constraint events_cancelled_needs_timestamp
    check (status <> 'cancelled' or cancelled_at is not null)
);

comment on table public.events is
  'Evenements du reseau (ISE-095, ISE-096). Le fuseau horaire est toujours explicite : CA-EVENT-01.';
comment on column public.events.online_url_private is
  'Lien de visioconference. Non expose avant inscription sauf online_url_visibility = all_viewers.';

select private.attach_updated_at('public', 'events');

create index if not exists events_upcoming_idx
  on public.events(starts_at asc, id desc)
  where status = 'published' and deleted_at is null;
create index if not exists events_starts_cursor_idx
  on public.events(starts_at desc, id desc) where deleted_at is null;
create index if not exists events_type_idx        on public.events(event_type_code) where deleted_at is null;
create index if not exists events_status_idx      on public.events(status) where deleted_at is null;
create index if not exists events_country_idx     on public.events(country_code) where country_code is not null;
create index if not exists events_organizer_profile_idx   on public.events(organizer_profile_id)
  where organizer_profile_id is not null;
create index if not exists events_organizer_promotion_idx on public.events(organizer_promotion_id)
  where organizer_promotion_id is not null;
create index if not exists events_organizer_community_idx on public.events(organizer_community_id)
  where organizer_community_id is not null;
create index if not exists events_organizer_project_idx   on public.events(organizer_project_id)
  where organizer_project_id is not null;
create index if not exists events_created_by_idx  on public.events(created_by_profile_id)
  where created_by_profile_id is not null;
create index if not exists events_title_trgm_idx
  on public.events using gin (public.normalize_text(title) extensions.gin_trgm_ops);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'news_source_event_fk') then
    alter table public.news
      add constraint news_source_event_fk
      foreign key (source_event_id) references public.events(id) on delete set null;
  end if;
end
$$;

create table if not exists public.event_agenda_items (
  id          uuid primary key default extensions.gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  starts_at   timestamptz,
  title       text not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select private.attach_updated_at('public', 'event_agenda_items');
create index if not exists event_agenda_items_event_idx on public.event_agenda_items(event_id, sort_order);

create table if not exists public.event_speakers (
  id                    uuid primary key default extensions.gen_random_uuid(),
  event_id              uuid not null references public.events(id) on delete cascade,
  profile_id            uuid references public.ise_profiles(id) on delete set null,
  external_name         text,
  external_title        text,
  external_organization text,
  speaker_role          text not null default 'speaker'
                          check (speaker_role in
                            ('speaker', 'moderator', 'panelist', 'trainer', 'host', 'guest')),
  status                text not null default 'invited'
                          check (status in ('invited', 'confirmed', 'declined', 'withdrawn')),
  confirmed_at          timestamptz,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint event_speakers_identity
    check (profile_id is not null or length(btrim(coalesce(external_name, ''))) > 0),
  constraint event_speakers_confirmed_timestamp
    check (status <> 'confirmed' or confirmed_at is not null)
);
select private.attach_updated_at('public', 'event_speakers');
create index if not exists event_speakers_event_idx   on public.event_speakers(event_id, sort_order);
create index if not exists event_speakers_profile_idx on public.event_speakers(profile_id)
  where profile_id is not null;
create unique index if not exists event_speakers_event_profile_uidx
  on public.event_speakers(event_id, profile_id) where profile_id is not null;

create table if not exists public.event_questions (
  id          uuid primary key default extensions.gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  question    text not null,
  is_required boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists event_questions_event_idx on public.event_questions(event_id, sort_order);

create table if not exists public.event_registrations (
  event_id      uuid not null references public.events(id) on delete cascade,
  profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  status        text not null default 'registered'
                  check (status in
                    ('registered', 'pending_approval', 'waitlisted',
                     'cancelled', 'attended', 'no_show')),
  registered_at timestamptz not null default now(),
  cancelled_at  timestamptz,
  attended_at   timestamptz,
  checked_in_at timestamptz,
  is_listed     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (event_id, profile_id),
  constraint event_registrations_cancelled_timestamp
    check (status <> 'cancelled' or cancelled_at is not null)
);
select private.attach_updated_at('public', 'event_registrations');
create index if not exists event_registrations_profile_idx
  on public.event_registrations(profile_id, registered_at desc);
create index if not exists event_registrations_event_status_idx
  on public.event_registrations(event_id, status);

create table if not exists public.event_registration_answers (
  event_id    uuid not null,
  profile_id  uuid not null,
  question_id uuid not null references public.event_questions(id) on delete cascade,
  answer      text,
  created_at  timestamptz not null default now(),
  primary key (event_id, profile_id, question_id),
  foreign key (event_id, profile_id)
    references public.event_registrations(event_id, profile_id) on delete cascade
);
create index if not exists event_registration_answers_question_idx
  on public.event_registration_answers(question_id);

-- ---------------------------------------------------------------------
-- 5. Rappels d'evenement
-- ---------------------------------------------------------------------
create table if not exists public.event_reminders (
  id             uuid primary key default extensions.gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  reminder_kind  text not null
                   check (reminder_kind in
                     ('t_minus_24h', 't_minus_1h', 'custom',
                      'cancellation', 'schedule_change')),
  offset_minutes integer,
  scheduled_at   timestamptz not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_at        timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
select private.attach_updated_at('public', 'event_reminders');
create unique index if not exists event_reminders_event_kind_uidx
  on public.event_reminders(event_id, reminder_kind)
  where reminder_kind in ('t_minus_24h', 't_minus_1h');
create index if not exists event_reminders_due_idx
  on public.event_reminders(scheduled_at) where status = 'pending';
create index if not exists event_reminders_event_idx on public.event_reminders(event_id);

-- ---------------------------------------------------------------------
-- 6. Suivi d'apres-evenement
-- ---------------------------------------------------------------------
create table if not exists public.event_followups (
  id                uuid primary key references public.events(id) on delete cascade,
  summary           text,
  conclusions       text,
  decisions         text,
  next_steps        text,
  replay_url        text,
  author_profile_id uuid references public.ise_profiles(id) on delete set null,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.event_followups is
  'Compte rendu d''apres-evenement. Une ligne par evenement (id = events.id).';
select private.attach_updated_at('public', 'event_followups');
create index if not exists event_followups_author_idx on public.event_followups(author_profile_id)
  where author_profile_id is not null;

create table if not exists public.event_resources (
  id            uuid primary key default extensions.gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  title         text not null,
  resource_type text not null default 'document'
                  check (resource_type in
                    ('presentation', 'report', 'document', 'bibliography',
                     'replay', 'photo', 'link')),
  storage_path  text,
  external_url  text,
  visibility    text not null default 'registered'
                  check (visibility in ('organizer', 'registered', 'members')),
  sort_order    integer not null default 0,
  created_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint event_resources_location
    check (storage_path is not null or external_url is not null)
);
select private.attach_updated_at('public', 'event_resources');
create index if not exists event_resources_event_idx      on public.event_resources(event_id, sort_order);
create index if not exists event_resources_created_by_idx on public.event_resources(created_by_profile_id)
  where created_by_profile_id is not null;

create table if not exists public.event_outcomes (
  id                  uuid primary key default extensions.gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  outcome_type        text not null
                        check (outcome_type in
                          ('working_group', 'project', 'news', 'community_discussion',
                           'connection', 'publication', 'mentorship', 'other')),
  target_entity_type  text,
  target_entity_id    uuid,
  notes               text,
  declared_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  declared_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
comment on table public.event_outcomes is
  'Suites professionnelles declarees a la suite d''un evenement (CA-EVENT-05). Etat constate, jamais deduit : D-55.';
create index if not exists event_outcomes_event_idx  on public.event_outcomes(event_id);
create index if not exists event_outcomes_type_idx   on public.event_outcomes(outcome_type, declared_at desc);
create index if not exists event_outcomes_target_idx on public.event_outcomes(target_entity_type, target_entity_id)
  where target_entity_id is not null;
create index if not exists event_outcomes_declared_by_idx on public.event_outcomes(declared_by_profile_id)
  where declared_by_profile_id is not null;

-- ---------------------------------------------------------------------
-- 7. Mesure d'impact d'un evenement
-- ---------------------------------------------------------------------
create table if not exists public.event_impact_snapshots (
  id                       uuid primary key default extensions.gen_random_uuid(),
  event_id                 uuid not null references public.events(id) on delete cascade,
  snapshot_at              timestamptz not null default now(),
  registered_count         integer not null default 0 check (registered_count >= 0),
  attended_count           integer not null default 0 check (attended_count >= 0),
  no_show_count            integer not null default 0 check (no_show_count >= 0),
  promotions_represented   integer not null default 0 check (promotions_represented >= 0),
  countries_represented    integer not null default 0 check (countries_represented >= 0),
  connections_created      integer not null default 0 check (connections_created >= 0),
  projects_initiated       integer not null default 0 check (projects_initiated >= 0),
  mentorships_initiated    integer not null default 0 check (mentorships_initiated >= 0),
  resources_produced       integer not null default 0 check (resources_produced >= 0),
  created_at               timestamptz not null default now()
);
create unique index if not exists event_impact_snapshots_event_at_uidx
  on public.event_impact_snapshots(event_id, snapshot_at);
create index if not exists event_impact_snapshots_event_idx
  on public.event_impact_snapshots(event_id, snapshot_at desc);

-- ---------------------------------------------------------------------
-- 8. Liaisons transverses d'un evenement
-- ---------------------------------------------------------------------
create table if not exists public.event_promotions (
  event_id     uuid not null references public.events(id) on delete cascade,
  promotion_id bigint not null references public.promotions(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (event_id, promotion_id)
);
create index if not exists event_promotions_promotion_idx on public.event_promotions(promotion_id);

create table if not exists public.event_communities (
  event_id     uuid not null references public.events(id) on delete cascade,
  community_id uuid not null,
  created_at   timestamptz not null default now(),
  primary key (event_id, community_id)
);
create index if not exists event_communities_community_idx on public.event_communities(community_id);

-- ---------------------------------------------------------------------
-- 9. Cles etrangeres conditionnelles vers les modules livres separement
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      ('news_community_fk',              'public.news',              'community_id',           'public.communities', 'set null'),
      ('news_source_project_fk',         'public.news',              'source_project_id',      'public.projects',    'set null'),
      ('news_communities_community_fk',  'public.news_communities',  'community_id',           'public.communities', 'cascade'),
      ('events_organizer_community_fk',  'public.events',            'organizer_community_id', 'public.communities', 'set null'),
      ('events_organizer_project_fk',    'public.events',            'organizer_project_id',   'public.projects',    'set null'),
      ('event_communities_community_fk', 'public.event_communities', 'community_id',           'public.communities', 'cascade')
    ) as t(conname, src_table, src_column, target_table, del_action)
  loop
    if to_regclass(r.target_table) is not null
       and not exists (select 1 from pg_constraint where conname = r.conname) then
      execute format(
        'alter table %s add constraint %I foreign key (%I) references %s(id) on delete %s',
        r.src_table, r.conname, r.src_column, r.target_table, r.del_action
      );
    end if;
  end loop;
end
$$;

