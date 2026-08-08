-- 0010_mentorship
-- Applique le 2026-08-08 (version 20260808004702)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0010_mentorship
-- Module MENTORAT ISE (ISE-078 -> ISE-083).
-- Voir supabase/migrations/0010_mentorship.sql pour les commentaires complets.
-- AUCUN SCORE PUBLIC DE MENTOR (MASTER PROMPT §30). D-54 : alternative_proposed
-- conserve. D-53 : liste d'etats la plus fine retenue. D-42 : score interne.
-- RLS : AUCUNE policy ici ; migration dediee ulterieure.
-- =====================================================================

create or replace function public.mentorship_objective_codes()
returns text[]
language sql
immutable
parallel safe
as $$
  select array[
    'career_orientation',
    'project_definition',
    'first_job',
    'internship_search',
    'career_progression',
    'sector_change',
    'professional_reconversion',
    'senior_role_preparation',
    'management_leadership',
    'international_career',
    'international_organizations',
    'public_service',
    'entrepreneurship',
    'consulting',
    'banking_finance',
    'data_ai',
    'research_phd',
    'technical_skills',
    'professional_network',
    'other'
  ]::text[];
$$;

comment on function public.mentorship_objective_codes() is
  'Referentiel unifie des objectifs de mentorat (union des nomenclatures concurrentes, D-53).';

create or replace function public.mentorship_format_codes()
returns text[]
language sql
immutable
parallel safe
as $$
  select array['single_session', 'one_month', 'three_months', 'six_months']::text[];
$$;

create or replace function public.mentorship_expectation_codes()
returns text[]
language sql
immutable
parallel safe
as $$
  select array[
    'clarify_options',
    'experience_feedback',
    'practical_advice',
    'cv_review',
    'interview_prep',
    'network_development',
    'action_plan',
    'training_choice',
    'other'
  ]::text[];
$$;

create or replace function public.mentorship_audience_codes()
returns text[]
language sql
immutable
parallel safe
as $$
  select array['ise_students', 'young_graduates', 'mid_level_professionals',
               'senior_executives', 'entrepreneurs']::text[];
$$;

create or replace function public.mentorship_channel_codes()
returns text[]
language sql
immutable
parallel safe
as $$
  select array['video', 'phone', 'in_person', 'written']::text[];
$$;

-- 1. Profil mentor
create table if not exists public.mentor_profiles (
  profile_id            uuid primary key references public.ise_profiles(id) on delete cascade,
  is_active             boolean not null default false,
  mentor_statement      text check (mentor_statement is null or length(mentor_statement) <= 500),
  max_active_mentees    smallint not null default 2
                          check (max_active_mentees between 1 and 10),
  preferred_formats     text[] not null default '{}'::text[]
                          check (preferred_formats <@ public.mentorship_format_codes()),
  preferred_frequency   text check (preferred_frequency is null or preferred_frequency in
                          ('monthly', 'twice_monthly', 'flexible')),
  accepted_objectives   text[] not null default '{}'::text[]
                          check (accepted_objectives <@ public.mentorship_objective_codes()),
  accepted_audiences    text[] not null default '{}'::text[]
                          check (accepted_audiences <@ public.mentorship_audience_codes()),
  preferred_channels    text[] not null default '{}'::text[]
                          check (preferred_channels <@ public.mentorship_channel_codes()),
  availability_state    text not null default 'available_now'
                          check (availability_state in ('available_now', 'available_from',
                                                        'temporarily_unavailable')),
  available_from        date,
  available_until       date,
  paused_at             timestamptz,
  activated_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint mentor_profiles_availability_dates
    check (available_from is null or available_until is null or available_until > available_from),
  constraint mentor_profiles_available_from_required
    check (availability_state <> 'available_from' or available_from is not null)
);
create index if not exists mentor_profiles_active_idx
  on public.mentor_profiles(is_active, availability_state)
  where is_active;
select private.attach_updated_at('public', 'mentor_profiles');

comment on table public.mentor_profiles is
  'Profil mentor. Aucun score, aucune note, aucun classement public (MASTER PROMPT §30).';
comment on column public.mentor_profiles.max_active_mentees is
  'Plafond de mentorats actifs. Verifie cote serveur a l''acceptation, pas seulement dans l''UI.';

create table if not exists public.mentor_domains (
  id                  uuid primary key default extensions.gen_random_uuid(),
  mentor_profile_id   uuid not null references public.mentor_profiles(profile_id) on delete cascade,
  skill_id            bigint references public.skills(id) on delete cascade,
  sector_id           bigint references public.sectors(id) on delete cascade,
  mentoring_topic     text,
  expertise_level     text check (expertise_level is null or expertise_level in
                        ('intermediate', 'advanced', 'expert')),
  mentoring_interest  text not null default 'medium'
                        check (mentoring_interest in ('low', 'medium', 'high')),
  created_at          timestamptz not null default now(),
  constraint mentor_domains_subject_present
    check (skill_id is not null or sector_id is not null or mentoring_topic is not null)
);
create unique index if not exists mentor_domains_subject_uidx
  on public.mentor_domains(mentor_profile_id,
                           coalesce(skill_id, 0),
                           coalesce(sector_id, 0),
                           coalesce(mentoring_topic, ''));
create index if not exists mentor_domains_mentor_idx on public.mentor_domains(mentor_profile_id);
create index if not exists mentor_domains_skill_idx  on public.mentor_domains(skill_id);
create index if not exists mentor_domains_sector_idx on public.mentor_domains(sector_id);

create table if not exists public.mentor_countries (
  mentor_profile_id uuid not null references public.mentor_profiles(profile_id) on delete cascade,
  country_code      char(2) not null references public.countries(code),
  created_at        timestamptz not null default now(),
  primary key (mentor_profile_id, country_code)
);
create index if not exists mentor_countries_country_idx on public.mentor_countries(country_code);

-- 2. Demande de mentorat (D-54 : alternative_proposed conserve)
create table if not exists public.mentorship_requests (
  id                        uuid primary key default extensions.gen_random_uuid(),
  mentee_profile_id         uuid not null references public.ise_profiles(id) on delete cascade,
  mentor_profile_id         uuid not null references public.mentor_profiles(profile_id) on delete cascade,
  objective_type            text not null
                              check (array[objective_type] <@ public.mentorship_objective_codes()),
  objective_text            text not null,
  current_situation         text,
  expectations              text[] not null default '{}'::text[]
                              check (expectations <@ public.mentorship_expectation_codes()),
  expectations_text         text,
  requested_format          text not null
                              check (array[requested_format] <@ public.mentorship_format_codes()),
  requested_frequency       text check (requested_frequency is null or requested_frequency in
                              ('monthly', 'twice_monthly', 'flexible')),
  requested_duration_months smallint check (requested_duration_months is null
                              or requested_duration_months between 1 and 12),
  message                   text check (message is null or length(message) <= 800),
  status                    text not null default 'draft'
                              check (status in ('draft', 'pending', 'accepted', 'alternative_proposed',
                                                'declined', 'expired', 'cancelled')),
  decline_reason            text check (decline_reason is null or decline_reason in
                              ('capacity_reached', 'out_of_expertise', 'not_available', 'other')),
  alternative_format        text check (alternative_format is null
                              or array[alternative_format] <@ public.mentorship_format_codes()),
  alternative_message       text,
  alternative_proposed_at   timestamptz,
  submitted_at              timestamptz,
  responded_at              timestamptz,
  expires_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint mentorship_requests_distinct_profiles
    check (mentee_profile_id <> mentor_profile_id),
  constraint mentorship_requests_alternative_payload
    check (status <> 'alternative_proposed' or alternative_format is not null)
);
create unique index if not exists mentorship_requests_open_pair_uidx
  on public.mentorship_requests(mentee_profile_id, mentor_profile_id)
  where status in ('draft', 'pending', 'alternative_proposed');
create index if not exists mentorship_requests_mentor_status_idx
  on public.mentorship_requests(mentor_profile_id, status);
create index if not exists mentorship_requests_mentee_status_idx
  on public.mentorship_requests(mentee_profile_id, status);
create index if not exists mentorship_requests_expiry_idx
  on public.mentorship_requests(expires_at)
  where status in ('pending', 'alternative_proposed');
create index if not exists mentorship_requests_created_idx
  on public.mentorship_requests(created_at desc, id desc);

select private.attach_updated_at('public', 'mentorship_requests');

comment on table public.mentorship_requests is
  'Demande de mentorat. L''etat alternative_proposed est conserve (D-54) : le mentor peut proposer un autre format.';

-- 3. Matching mentoral
create table if not exists public.mentorship_matches (
  id                  uuid primary key default extensions.gen_random_uuid(),
  mentee_profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  mentor_profile_id   uuid not null references public.mentor_profiles(profile_id) on delete cascade,
  objective_type      text check (objective_type is null
                        or array[objective_type] <@ public.mentorship_objective_codes()),
  requested_format    text check (requested_format is null
                        or array[requested_format] <@ public.mentorship_format_codes()),
  score               numeric(5, 2) not null check (score >= 0 and score <= 100),
  relevance_label     text not null
                        check (relevance_label in ('very_relevant', 'relevant', 'close_profile')),
  match_reasons       jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(match_reasons) = 'array'
                               and jsonb_array_length(match_reasons) >= 1),
  mentor_available    boolean not null default true,
  request_id          uuid references public.mentorship_requests(id) on delete set null,
  dismissed_at        timestamptz,
  computed_at         timestamptz not null default now(),
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  constraint mentorship_matches_distinct_profiles
    check (mentee_profile_id <> mentor_profile_id)
);
create unique index if not exists mentorship_matches_pair_uidx
  on public.mentorship_matches(mentee_profile_id, mentor_profile_id);
create index if not exists mentorship_matches_ranking_idx
  on public.mentorship_matches(mentee_profile_id, score desc, id desc)
  where dismissed_at is null;
create index if not exists mentorship_matches_mentor_idx
  on public.mentorship_matches(mentor_profile_id);
create index if not exists mentorship_matches_request_idx
  on public.mentorship_matches(request_id);

comment on table public.mentorship_matches is
  'Suggestions de mentors calculees. Une suggestion n''est jamais une affectation.';
comment on column public.mentorship_matches.score is
  'Score de classement INTERNE. Jamais renvoye au client : seul relevance_label l''est (D-42).';
comment on column public.mentorship_matches.match_reasons is
  'Raisons structurees affichables. Au moins une, sinon exclusion (D-43).';

-- 4. Mentorat
create table if not exists public.mentorships (
  id                          uuid primary key default extensions.gen_random_uuid(),
  mentor_profile_id           uuid not null references public.mentor_profiles(profile_id) on delete cascade,
  mentee_profile_id           uuid not null references public.ise_profiles(id) on delete cascade,
  source_request_id           uuid references public.mentorship_requests(id) on delete set null,
  objective_type              text check (objective_type is null
                                or array[objective_type] <@ public.mentorship_objective_codes()),
  objective                   text not null,
  format                      text not null
                                check (array[format] <@ public.mentorship_format_codes()),
  frequency                   text check (frequency is null or frequency in
                                ('monthly', 'twice_monthly', 'flexible')),
  start_date                  date,
  planned_end_date            date,
  actual_end_date             date,
  status                      text not null default 'planned'
                                check (status in ('planned', 'active', 'paused',
                                                  'completed', 'stopped', 'cancelled')),
  closure_reason              text check (closure_reason is null or closure_reason in
                                ('objective_reached', 'duration_ended', 'availability',
                                 'coordination_difficulty', 'objective_changed',
                                 'incompatibility', 'inactive', 'other')),
  closed_by_profile_id        uuid references public.ise_profiles(id) on delete set null,
  charter_accepted_by_mentor_at timestamptz,
  charter_accepted_by_mentee_at timestamptz,
  renewal_of_mentorship_id    uuid references public.mentorships(id) on delete set null,
  cycle_number                smallint not null default 1 check (cycle_number >= 1),
  paused_at                   timestamptz,
  completed_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint mentorships_distinct_profiles
    check (mentor_profile_id <> mentee_profile_id),
  constraint mentorships_dates_order
    check (planned_end_date is null or start_date is null or planned_end_date >= start_date),
  constraint mentorships_actual_end_order
    check (actual_end_date is null or start_date is null or actual_end_date >= start_date),
  constraint mentorships_no_self_renewal
    check (renewal_of_mentorship_id is null or renewal_of_mentorship_id <> id)
);
create unique index if not exists mentorships_open_pair_uidx
  on public.mentorships(mentor_profile_id, mentee_profile_id)
  where status in ('planned', 'active', 'paused');
create index if not exists mentorships_mentor_status_idx on public.mentorships(mentor_profile_id, status);
create index if not exists mentorships_mentee_status_idx on public.mentorships(mentee_profile_id, status);
create index if not exists mentorships_request_idx       on public.mentorships(source_request_id);
create index if not exists mentorships_renewal_idx       on public.mentorships(renewal_of_mentorship_id);
create index if not exists mentorships_closed_by_idx     on public.mentorships(closed_by_profile_id);
create index if not exists mentorships_planned_end_idx
  on public.mentorships(planned_end_date)
  where status = 'active';
create index if not exists mentorships_created_idx
  on public.mentorships(created_at desc, id desc);

select private.attach_updated_at('public', 'mentorships');

comment on table public.mentorships is
  'Relation de mentorat, bornee dans le temps et orientee objectif.';

-- 5. Objectifs du binome
create table if not exists public.mentorship_goals (
  id             uuid primary key default extensions.gen_random_uuid(),
  mentorship_id  uuid not null references public.mentorships(id) on delete cascade,
  title          text not null,
  description    text,
  status         text not null default 'todo'
                   check (status in ('todo', 'in_progress', 'done', 'abandoned')),
  target_date    date,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists mentorship_goals_mentorship_idx
  on public.mentorship_goals(mentorship_id, sort_order);
select private.attach_updated_at('public', 'mentorship_goals');

-- 6. Sessions, notes et actions
create table if not exists public.mentorship_sessions (
  id              uuid primary key default extensions.gen_random_uuid(),
  mentorship_id   uuid not null references public.mentorships(id) on delete cascade,
  session_number  smallint check (session_number is null or session_number > 0),
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  duration_minutes smallint check (duration_minutes is null or duration_minutes > 0),
  format          text check (format is null or array[format] <@ public.mentorship_channel_codes()),
  topic           text,
  shared_summary  text,
  status          text not null default 'planned'
                    check (status in ('planned', 'completed', 'cancelled', 'no_show')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint mentorship_sessions_completion_coherence
    check (status <> 'completed' or completed_at is not null)
);
create index if not exists mentorship_sessions_mentorship_idx
  on public.mentorship_sessions(mentorship_id, scheduled_at desc);
create index if not exists mentorship_sessions_upcoming_idx
  on public.mentorship_sessions(scheduled_at)
  where status = 'planned';
create unique index if not exists mentorship_sessions_number_uidx
  on public.mentorship_sessions(mentorship_id, session_number)
  where session_number is not null;
select private.attach_updated_at('public', 'mentorship_sessions');

create table if not exists public.mentorship_session_notes (
  id                 uuid primary key default extensions.gen_random_uuid(),
  session_id         uuid not null references public.mentorship_sessions(id) on delete cascade,
  author_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  note               text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists mentorship_session_notes_author_uidx
  on public.mentorship_session_notes(session_id, author_profile_id);
create index if not exists mentorship_session_notes_author_idx
  on public.mentorship_session_notes(author_profile_id);
select private.attach_updated_at('public', 'mentorship_session_notes');

comment on table public.mentorship_session_notes is
  'Notes privees d''un participant. Distinctes de la synthese partagee portee par la session.';

create table if not exists public.mentorship_actions (
  id                  uuid primary key default extensions.gen_random_uuid(),
  mentorship_id       uuid not null references public.mentorships(id) on delete cascade,
  session_id          uuid references public.mentorship_sessions(id) on delete set null,
  assignee_profile_id uuid references public.ise_profiles(id) on delete set null,
  title               text not null,
  status              text not null default 'todo' check (status in ('todo', 'done')),
  due_on              date,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists mentorship_actions_mentorship_idx
  on public.mentorship_actions(mentorship_id, status);
create index if not exists mentorship_actions_session_idx  on public.mentorship_actions(session_id);
create index if not exists mentorship_actions_assignee_idx on public.mentorship_actions(assignee_profile_id, status);
select private.attach_updated_at('public', 'mentorship_actions');

-- 7. Cloture et resultat
create table if not exists public.mentorship_feedback (
  id                        uuid primary key default extensions.gen_random_uuid(),
  mentorship_id             uuid not null references public.mentorships(id) on delete cascade,
  respondent_profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  respondent_role           text not null check (respondent_role in ('mentor', 'mentee')),
  usefulness                text check (usefulness is null or usefulness in
                              ('a_lot', 'yes', 'a_little', 'no')),
  objective_progress        text check (objective_progress is null or objective_progress in
                              ('a_lot', 'yes', 'a_little', 'not_yet')),
  objective_reached         text check (objective_reached is null or objective_reached in
                              ('yes', 'partially', 'no', 'hard_to_assess')),
  outcome_type              text check (outcome_type is null or outcome_type in
                              ('objective_reached', 'career_plan_clarified', 'cv_improved',
                               'better_preparation', 'skills_developed', 'interview_obtained',
                               'internship_obtained', 'job_obtained', 'new_opportunity',
                               'introduction_made', 'network_developed', 'company_created',
                               'other')),
  comment                   text,
  platform_feedback         text,
  public_testimonial_consent boolean not null default false,
  testimonial_text          text,
  is_anonymous_testimonial  boolean not null default true,
  created_at                timestamptz not null default now(),
  constraint mentorship_feedback_testimonial_consent
    check (testimonial_text is null or public_testimonial_consent)
);
create unique index if not exists mentorship_feedback_respondent_uidx
  on public.mentorship_feedback(mentorship_id, respondent_profile_id);
create index if not exists mentorship_feedback_respondent_idx
  on public.mentorship_feedback(respondent_profile_id);

comment on table public.mentorship_feedback is
  'Evaluation de fin de mentorat. Jamais agregee en note publique ni en classement (MASTER PROMPT §30).';

-- 8. Journal des transitions
create table if not exists public.mentorship_events (
  id                 uuid primary key default extensions.gen_random_uuid(),
  mentorship_id      uuid references public.mentorships(id) on delete cascade,
  request_id         uuid references public.mentorship_requests(id) on delete cascade,
  event_type         text not null
                       check (event_type in ('request_submitted', 'request_accepted',
                                             'request_declined', 'alternative_proposed',
                                             'alternative_accepted', 'request_cancelled',
                                             'request_expired', 'mentorship_started',
                                             'mentorship_paused', 'mentorship_resumed',
                                             'mentorship_completed', 'mentorship_stopped',
                                             'mentorship_cancelled', 'mentorship_renewed')),
  actor_profile_id   uuid references public.ise_profiles(id) on delete set null,
  from_status        text,
  to_status          text,
  reason             text,
  created_at         timestamptz not null default now(),
  constraint mentorship_events_subject_present
    check (mentorship_id is not null or request_id is not null)
);
create index if not exists mentorship_events_mentorship_idx
  on public.mentorship_events(mentorship_id, created_at desc);
create index if not exists mentorship_events_request_idx
  on public.mentorship_events(request_id, created_at desc);
create index if not exists mentorship_events_actor_idx
  on public.mentorship_events(actor_profile_id);
