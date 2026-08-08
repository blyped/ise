-- 0009_internships
-- Applique le 2026-08-08 (version 20260808004546)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0009_internships
-- Module STAGES & PROMOTION SORTANTE (ISE-072 -> ISE-077, SA-037 -> SA-039).
-- Voir supabase/migrations/0009_internships.sql pour les commentaires complets.
-- D-55 : la plateforme ne pose jamais un etat non constate ; l'eleve declare.
-- RLS : AUCUNE policy ici ; migration dediee ulterieure.
-- =====================================================================

create or replace function public.internship_purpose_codes()
returns text[]
language sql
immutable
parallel safe
as $$
  select array[
    'academic_validation',
    'experience',
    'pre_employment',
    'thesis',
    'sector_discovery',
    'other'
  ]::text[];
$$;

create or replace function public.internship_organization_type_codes()
returns text[]
language sql
immutable
parallel safe
as $$
  select array[
    'public_administration',
    'bank',
    'consulting_firm',
    'international_organization',
    'ngo',
    'insurance',
    'startup',
    'statistical_institution',
    'research',
    'private_company',
    'other'
  ]::text[];
$$;

comment on function public.internship_purpose_codes() is
  'Referentiel ferme des objectifs de stage. Utilise dans les CHECK du module Stages.';

-- 1. Recherche de stage declaree par l'eleve (ISE-073 / ISE-074)
create table if not exists public.internship_needs (
  id                          uuid primary key default extensions.gen_random_uuid(),
  student_profile_id          uuid not null references public.ise_profiles(id) on delete cascade,
  promotion_id                bigint references public.promotions(id) on delete set null,
  internship_type             text not null default 'academic'
                                check (internship_type in
                                  ('academic', 'final_year', 'pre_employment', 'research', 'other')),
  objective                   text check (objective is null or length(objective) <= 500),
  purposes                    text[] not null default '{}'::text[]
                                check (purposes <@ public.internship_purpose_codes()),
  start_date                  date,
  end_date                    date,
  duration_months             numeric(4, 1) check (duration_months is null or duration_months > 0),
  dates_flexible              boolean not null default false,
  duration_flexible           boolean not null default false,
  work_mode                   text not null default 'on_site'
                                check (work_mode in ('on_site', 'hybrid', 'remote')),
  remote_allowed              boolean not null default false,
  mobility_international      text not null default 'no'
                                check (mobility_international in ('yes', 'no', 'conditional')),
  thesis_topic                text,
  thesis_domain               text,
  needs_data_access           boolean not null default false,
  needs_professional_supervisor boolean not null default false,
  cv_source                   text not null default 'profile'
                                check (cv_source in ('profile', 'uploaded')),
  cv_storage_path             text,
  cover_letter_path           text,
  visibility                  text not null default 'internship_managers_and_relevant_alumni'
                                check (visibility in ('internship_managers_and_relevant_alumni',
                                                      'verified_members',
                                                      'partner_organizations')),
  show_profile_badge          boolean not null default true,
  status                      text not null default 'draft'
                                check (status in ('draft', 'active', 'paused', 'matched', 'placed', 'closed')),
  activated_at                timestamptz,
  paused_at                   timestamptz,
  matched_at                  timestamptz,
  placed_at                   timestamptz,
  closed_at                   timestamptz,
  last_reviewed_at            timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz,
  constraint internship_needs_dates_order
    check (start_date is null or end_date is null or end_date > start_date),
  constraint internship_needs_period_present
    check (start_date is not null or duration_months is not null or dates_flexible),
  constraint internship_needs_cv_path_when_uploaded
    check (cv_source <> 'uploaded' or cv_storage_path is not null)
);

create unique index if not exists internship_needs_active_per_student_uidx
  on public.internship_needs(student_profile_id)
  where status in ('draft', 'active', 'paused', 'matched') and deleted_at is null;
create index if not exists internship_needs_student_idx
  on public.internship_needs(student_profile_id);
create index if not exists internship_needs_promotion_status_idx
  on public.internship_needs(promotion_id, status);
create index if not exists internship_needs_status_created_idx
  on public.internship_needs(status, created_at desc, id desc)
  where deleted_at is null;

select private.attach_updated_at('public', 'internship_needs');

comment on table public.internship_needs is
  'Recherche de stage declaree par un eleve ISE (wizard ISE-073). Le badge profil est desactivable.';
comment on column public.internship_needs.visibility is
  'Portee de la recherche. Defaut = le moins expose (MASTER PROMPT §47, D-74). Aucun niveau web public (D-73).';

create table if not exists public.internship_need_skills (
  need_id     uuid not null references public.internship_needs(id) on delete cascade,
  skill_id    bigint not null references public.skills(id) on delete cascade,
  priority    text not null default 'secondary' check (priority in ('primary', 'secondary')),
  intent      text not null default 'apply' check (intent in ('apply', 'develop')),
  created_at  timestamptz not null default now(),
  primary key (need_id, skill_id)
);
create index if not exists internship_need_skills_skill_idx
  on public.internship_need_skills(skill_id);

create table if not exists public.internship_need_sectors (
  need_id          uuid not null references public.internship_needs(id) on delete cascade,
  sector_id        bigint not null references public.sectors(id) on delete cascade,
  preference_rank  smallint not null default 1 check (preference_rank between 1 and 5),
  is_primary       boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (need_id, sector_id)
);
create index if not exists internship_need_sectors_sector_idx
  on public.internship_need_sectors(sector_id);
create unique index if not exists internship_need_sectors_primary_uidx
  on public.internship_need_sectors(need_id) where is_primary;

create table if not exists public.internship_need_countries (
  need_id           uuid not null references public.internship_needs(id) on delete cascade,
  country_code      char(2) not null references public.countries(code),
  preference_level  text not null default 'preferred'
                      check (preference_level in ('required', 'preferred', 'possible')),
  created_at        timestamptz not null default now(),
  primary key (need_id, country_code)
);
create index if not exists internship_need_countries_country_idx
  on public.internship_need_countries(country_code);

create table if not exists public.internship_need_organization_types (
  need_id            uuid not null references public.internship_needs(id) on delete cascade,
  organization_type  text not null
                       check (array[organization_type] <@ public.internship_organization_type_codes()),
  created_at         timestamptz not null default now(),
  primary key (need_id, organization_type)
);

-- 2. Offres et portes ouvertes par le reseau (ISE-075)
create table if not exists public.internship_offers (
  id                        uuid primary key default extensions.gen_random_uuid(),
  offer_type                text not null
                              check (offer_type in ('official_offer',
                                                    'hosting_possibility',
                                                    'introduction_capacity',
                                                    'external_lead')),
  created_by_profile_id     uuid references public.ise_profiles(id) on delete set null,
  organization_id           uuid references public.organizations(id) on delete set null,
  organization_raw          text,
  department                text,
  title                     text not null,
  description               text,
  profile_wanted            text,
  sector_id                 bigint references public.sectors(id) on delete set null,
  country_code              char(2) references public.countries(code),
  city                      text,
  work_mode                 text not null default 'on_site'
                              check (work_mode in ('on_site', 'hybrid', 'remote')),
  start_date                date,
  end_date                  date,
  duration_months           numeric(4, 1) check (duration_months is null or duration_months > 0),
  period_label              text,
  slots                     smallint check (slots is null or slots > 0),
  target_promotion_id       bigint references public.promotions(id) on delete set null,
  academic_stage            boolean not null default false,
  pre_employment            boolean not null default false,
  compensation_details      text,
  supervisor_profile_id     uuid references public.ise_profiles(id) on delete set null,
  decision_role             text check (decision_role is null or decision_role in
                              ('decides', 'can_propose', 'can_refer')),
  conditions_to_confirm     text,
  max_introductions         smallint check (max_introductions is null or max_introductions > 0),
  external_url              text,
  application_deadline      date,
  application_mode          text not null default 'platform'
                              check (application_mode in ('platform', 'email', 'external_url',
                                                          'via_contact', 'not_applicable')),
  application_instructions  text,
  source                    text not null default 'member_direct'
                              check (source in ('member_direct', 'reported_by_ise',
                                                'partner_organization', 'admin_import')),
  status                    text not null default 'draft'
                              check (status in ('draft', 'to_confirm', 'pending_review', 'published',
                                                'paused', 'filled', 'expired', 'closed', 'rejected')),
  published_at              timestamptz,
  closed_at                 timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  opportunity_id            uuid,
  constraint internship_offers_dates_order
    check (start_date is null or end_date is null or end_date > start_date),
  constraint internship_offers_organization_present
    check (organization_id is not null or organization_raw is not null),
  constraint internship_offers_to_confirm_scope
    check (status <> 'to_confirm' or offer_type = 'hosting_possibility'),
  constraint internship_offers_external_url_required
    check (offer_type <> 'external_lead' or external_url is not null)
);

create index if not exists internship_offers_organization_idx on public.internship_offers(organization_id);
create index if not exists internship_offers_creator_idx      on public.internship_offers(created_by_profile_id);
create index if not exists internship_offers_sector_idx       on public.internship_offers(sector_id);
create index if not exists internship_offers_country_idx      on public.internship_offers(country_code);
create index if not exists internship_offers_promotion_idx    on public.internship_offers(target_promotion_id);
create index if not exists internship_offers_supervisor_idx   on public.internship_offers(supervisor_profile_id);
create index if not exists internship_offers_type_status_idx  on public.internship_offers(offer_type, status);
create index if not exists internship_offers_published_idx
  on public.internship_offers(published_at desc, id desc)
  where status = 'published' and deleted_at is null;
create index if not exists internship_offers_deadline_idx
  on public.internship_offers(application_deadline)
  where status = 'published' and deleted_at is null;

select private.attach_updated_at('public', 'internship_offers');

comment on table public.internship_offers is
  'Portes ouvertes par le reseau : offre officielle, possibilite d''accueil, capacite d''introduction, opportunite externe.';
comment on column public.internship_offers.opportunity_id is
  'Rattachement optionnel a la table generique des opportunites. Sans FK tant que public.opportunities n''existe pas.';

create table if not exists public.internship_offer_skills (
  offer_id    uuid not null references public.internship_offers(id) on delete cascade,
  skill_id    bigint not null references public.skills(id) on delete cascade,
  is_required boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (offer_id, skill_id)
);
create index if not exists internship_offer_skills_skill_idx
  on public.internship_offer_skills(skill_id);

-- 3. Interets et invitations a candidater
create table if not exists public.internship_offer_interests (
  id                  uuid primary key default extensions.gen_random_uuid(),
  offer_id            uuid not null references public.internship_offers(id) on delete cascade,
  student_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  need_id             uuid references public.internship_needs(id) on delete set null,
  direction           text not null
                        check (direction in ('student_interest', 'alumni_invitation')),
  invited_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  message             text,
  status              text not null default 'expressed'
                        check (status in ('expressed', 'withdrawn', 'sent', 'viewed',
                                          'accepted', 'declined', 'expired')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  responded_at        timestamptz,
  constraint internship_offer_interests_inviter_required
    check (direction <> 'alumni_invitation' or invited_by_profile_id is not null)
);
create unique index if not exists internship_offer_interests_pair_uidx
  on public.internship_offer_interests(offer_id, student_profile_id, direction);
create index if not exists internship_offer_interests_student_idx
  on public.internship_offer_interests(student_profile_id, status);
create index if not exists internship_offer_interests_offer_idx
  on public.internship_offer_interests(offer_id, status);
create index if not exists internship_offer_interests_need_idx
  on public.internship_offer_interests(need_id);
create index if not exists internship_offer_interests_inviter_idx
  on public.internship_offer_interests(invited_by_profile_id);

select private.attach_updated_at('public', 'internship_offer_interests');

comment on table public.internship_offer_interests is
  'Interet declare sur une porte, ou invitation a candidater emise par un ancien. N''est jamais une candidature (D-55).';

-- 4. Demandes de conseil / relecture / introduction adressees au reseau
create table if not exists public.internship_help_requests (
  id                    uuid primary key default extensions.gen_random_uuid(),
  need_id               uuid references public.internship_needs(id) on delete set null,
  student_profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  alumni_profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  request_type          text not null
                          check (request_type in ('advice',
                                                  'cv_review',
                                                  'organization_info',
                                                  'introduction',
                                                  'internship_possibility')),
  organization_id       uuid references public.organizations(id) on delete set null,
  related_offer_id      uuid references public.internship_offers(id) on delete set null,
  message               text not null,
  status                text not null default 'sent'
                          check (status in ('sent', 'viewed', 'accepted', 'declined',
                                            'answered', 'withdrawn', 'expired')),
  response_message      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  viewed_at             timestamptz,
  responded_at          timestamptz,
  expires_at            timestamptz,
  constraint internship_help_requests_distinct_profiles
    check (student_profile_id <> alumni_profile_id)
);
create unique index if not exists internship_help_requests_open_uidx
  on public.internship_help_requests(student_profile_id, alumni_profile_id, request_type)
  where status in ('sent', 'viewed', 'accepted');
create index if not exists internship_help_requests_student_idx
  on public.internship_help_requests(student_profile_id, status);
create index if not exists internship_help_requests_alumni_idx
  on public.internship_help_requests(alumni_profile_id, status);
create index if not exists internship_help_requests_need_idx
  on public.internship_help_requests(need_id);
create index if not exists internship_help_requests_organization_idx
  on public.internship_help_requests(organization_id);
create index if not exists internship_help_requests_offer_idx
  on public.internship_help_requests(related_offer_id);

select private.attach_updated_at('public', 'internship_help_requests');

comment on table public.internship_help_requests is
  'Sollicitation structuree d''un ancien par un eleve. Ne revele jamais les coordonnees d''un tiers.';

-- 5. Suivi de candidature, DECLARE PAR L'ELEVE (D-55)
create table if not exists public.internship_applications (
  id                    uuid primary key default extensions.gen_random_uuid(),
  need_id               uuid references public.internship_needs(id) on delete set null,
  student_profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  offer_id              uuid references public.internship_offers(id) on delete set null,
  organization_id       uuid references public.organizations(id) on delete set null,
  organization_raw      text,
  position_title        text not null,
  application_channel   text not null default 'platform'
                          check (application_channel in ('platform', 'email', 'external_site',
                                                         'via_introduction', 'other')),
  cv_storage_path       text,
  message               text,
  status                text not null default 'to_prepare'
                          check (status in ('to_prepare', 'submitted', 'reviewed', 'interview',
                                            'offered', 'accepted', 'declined', 'withdrawn')),
  submitted_on          date,
  status_changed_at     timestamptz not null default now(),
  next_action           text,
  next_action_due_on    date,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint internship_applications_target_present
    check (offer_id is not null or organization_id is not null or organization_raw is not null),
  constraint internship_applications_submission_declared
    check ((status = 'to_prepare' and submitted_on is null) or status <> 'to_prepare')
);
create index if not exists internship_applications_student_idx
  on public.internship_applications(student_profile_id, status);
create index if not exists internship_applications_need_idx
  on public.internship_applications(need_id);
create index if not exists internship_applications_offer_idx
  on public.internship_applications(offer_id, status);
create index if not exists internship_applications_organization_idx
  on public.internship_applications(organization_id);
create index if not exists internship_applications_created_idx
  on public.internship_applications(created_at desc, id desc);
create unique index if not exists internship_applications_student_offer_uidx
  on public.internship_applications(student_profile_id, offer_id)
  where offer_id is not null and status <> 'withdrawn';

select private.attach_updated_at('public', 'internship_applications');

comment on table public.internship_applications is
  'Suivi de candidature. L''etat reel est DECLARE par l''eleve : la plateforme ne franchit jamais une etape non constatee (D-55).';
comment on column public.internship_applications.submitted_on is
  'Date d''envoi declaree par l''eleve. Jamais renseignee automatiquement (D-55).';

create table if not exists public.internship_application_events (
  id                    uuid primary key default extensions.gen_random_uuid(),
  application_id        uuid not null references public.internship_applications(id) on delete cascade,
  from_status           text,
  to_status             text not null,
  declared_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  occurred_on           date not null default current_date,
  note                  text,
  created_at            timestamptz not null default now()
);
create index if not exists internship_application_events_application_idx
  on public.internship_application_events(application_id, created_at desc);
create index if not exists internship_application_events_author_idx
  on public.internship_application_events(declared_by_profile_id);

-- 6. Placement (ISE-077)
create table if not exists public.internship_placements (
  id                                uuid primary key default extensions.gen_random_uuid(),
  student_profile_id                uuid not null references public.ise_profiles(id) on delete cascade,
  need_id                           uuid references public.internship_needs(id) on delete set null,
  offer_id                          uuid references public.internship_offers(id) on delete set null,
  application_id                    uuid references public.internship_applications(id) on delete set null,
  organization_id                   uuid references public.organizations(id) on delete set null,
  organization_raw                  text,
  department                        text,
  sector_id                         bigint references public.sectors(id) on delete set null,
  country_code                      char(2) not null references public.countries(code),
  city                              text,
  start_date                        date not null,
  end_date                          date not null,
  work_mode                         text not null default 'on_site'
                                      check (work_mode in ('on_site', 'hybrid', 'remote')),
  thesis_topic                      text,
  professional_supervisor_name      text,
  professional_supervisor_role      text,
  professional_supervisor_profile_id uuid references public.ise_profiles(id) on delete set null,
  academic_supervisor_name          text,
  placement_source                  text not null
                                      check (placement_source in ('ise_offer',
                                                                  'ise_introduction',
                                                                  'alumni_contact',
                                                                  'school',
                                                                  'personal_search',
                                                                  'external_offer',
                                                                  'other')),
  network_attribution               text not null default 'unknown'
                                      check (network_attribution in ('direct', 'partial', 'none', 'unknown')),
  attributed_offer_id               uuid references public.internship_offers(id) on delete set null,
  attributed_helper_profile_id      uuid references public.ise_profiles(id) on delete set null,
  status                            text not null default 'confirmed'
                                      check (status in ('confirmed', 'convention_pending', 'ready_to_start',
                                                        'started', 'active', 'completed',
                                                        'interrupted', 'cancelled')),
  agreement_status                  text not null default 'not_started'
                                      check (agreement_status in ('not_started', 'in_preparation',
                                                                  'signed', 'not_required')),
  agreement_document_path           text,
  confirmed_at                      timestamptz not null default now(),
  started_at                        timestamptz,
  completed_at                      timestamptz,
  interrupted_at                    timestamptz,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),
  constraint internship_placements_dates_order check (end_date > start_date),
  constraint internship_placements_organization_present
    check (organization_id is not null or organization_raw is not null)
);

create unique index if not exists internship_placements_active_per_student_uidx
  on public.internship_placements(student_profile_id)
  where status not in ('completed', 'interrupted', 'cancelled');
create index if not exists internship_placements_student_idx      on public.internship_placements(student_profile_id);
create index if not exists internship_placements_organization_idx on public.internship_placements(organization_id);
create index if not exists internship_placements_need_idx         on public.internship_placements(need_id);
create index if not exists internship_placements_offer_idx        on public.internship_placements(offer_id);
create index if not exists internship_placements_application_idx  on public.internship_placements(application_id);
create index if not exists internship_placements_sector_idx       on public.internship_placements(sector_id);
create index if not exists internship_placements_country_idx      on public.internship_placements(country_code);
create index if not exists internship_placements_supervisor_idx
  on public.internship_placements(professional_supervisor_profile_id);
create index if not exists internship_placements_helper_idx
  on public.internship_placements(attributed_helper_profile_id);
create index if not exists internship_placements_attributed_offer_idx
  on public.internship_placements(attributed_offer_id);
create index if not exists internship_placements_status_idx
  on public.internship_placements(status, start_date desc, id desc);

select private.attach_updated_at('public', 'internship_placements');

comment on table public.internship_placements is
  'Placement confirme. placement_source et network_attribution portent le KPI directeur du module.';

-- 7. Suivi pendant le stage : check-ins et incidents
create table if not exists public.internship_followups (
  id                uuid primary key default extensions.gen_random_uuid(),
  placement_id      uuid not null references public.internship_placements(id) on delete cascade,
  followup_type     text not null
                      check (followup_type in ('start', 'two_weeks', 'midterm', 'monthly', 'end')),
  scheduled_for     date,
  response_status   text not null default 'pending'
                      check (response_status in ('pending', 'answered', 'skipped', 'expired')),
  student_response  text check (student_response is null or student_response in
                      ('very_good', 'good', 'minor_issues', 'need_help')),
  comment           text,
  alert_raised_at   timestamptz,
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  constraint internship_followups_response_coherence
    check ((response_status = 'answered' and student_response is not null)
           or response_status <> 'answered')
);
create index if not exists internship_followups_placement_idx
  on public.internship_followups(placement_id, followup_type);
create index if not exists internship_followups_pending_idx
  on public.internship_followups(scheduled_for)
  where response_status = 'pending';
create index if not exists internship_followups_alert_idx
  on public.internship_followups(alert_raised_at desc)
  where alert_raised_at is not null;
create unique index if not exists internship_followups_milestone_uidx
  on public.internship_followups(placement_id, followup_type)
  where followup_type <> 'monthly';

create table if not exists public.internship_incidents (
  id                    uuid primary key default extensions.gen_random_uuid(),
  placement_id          uuid not null references public.internship_placements(id) on delete cascade,
  reported_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  incident_type         text not null
                          check (incident_type in ('administrative', 'agreement', 'mission_mismatch',
                                                   'advice_needed', 'other')),
  description           text not null,
  status                text not null default 'open'
                          check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  handled_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  resolved_at           timestamptz
);
create index if not exists internship_incidents_placement_idx
  on public.internship_incidents(placement_id, status);
create index if not exists internship_incidents_reporter_idx
  on public.internship_incidents(reported_by_profile_id);
create index if not exists internship_incidents_handler_idx
  on public.internship_incidents(handled_by_profile_id);
select private.attach_updated_at('public', 'internship_incidents');

comment on table public.internship_incidents is
  'Signalement d''un probleme pendant le stage. Confidentiel : jamais expose sur un profil ni a l''organisation.';

-- 8. Fin de stage : issue et evaluation
create table if not exists public.internship_outcomes (
  id                        uuid primary key default extensions.gen_random_uuid(),
  placement_id              uuid not null unique references public.internship_placements(id) on delete cascade,
  completion_status         text not null
                              check (completion_status in ('completed', 'extended', 'interrupted')),
  outcome_type              text not null default 'none'
                              check (outcome_type in ('none', 'hiring', 'job_offer', 'extension',
                                                      'mission', 'recommendation', 'other')),
  final_thesis_topic        text,
  overall_experience        text check (overall_experience is null or overall_experience in
                              ('very_positive', 'positive', 'mixed', 'negative')),
  supervision_quality       text check (supervision_quality is null or supervision_quality in
                              ('very_good', 'good', 'fair', 'poor')),
  mission_relevance         text check (mission_relevance is null or mission_relevance in
                              ('very_good', 'good', 'fair', 'poor')),
  learning_level            text check (learning_level is null or learning_level in
                              ('very_good', 'good', 'fair', 'poor')),
  would_recommend_organization boolean,
  objectives_met            text check (objectives_met is null or objectives_met in
                              ('yes', 'partially', 'no')),
  student_comment           text,
  declared_by_profile_id    uuid references public.ise_profiles(id) on delete set null,
  declared_at               timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists internship_outcomes_placement_idx on public.internship_outcomes(placement_id);
create index if not exists internship_outcomes_author_idx    on public.internship_outcomes(declared_by_profile_id);
select private.attach_updated_at('public', 'internship_outcomes');

comment on table public.internship_outcomes is
  'Issue et evaluation de fin de stage. Aucune note publique d''etudiant ni de tuteur.';

create table if not exists public.internship_outcome_skills (
  outcome_id  uuid not null references public.internship_outcomes(id) on delete cascade,
  skill_id    bigint not null references public.skills(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (outcome_id, skill_id)
);
create index if not exists internship_outcome_skills_skill_idx
  on public.internship_outcome_skills(skill_id);
