-- 0005_profile_content
-- Applique le 2026-08-08 (version 20260808003323)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- Contenu du profil : parcours, competences, secteurs, langues, projets,
-- disponibilite, recommandations, completion, index de recherche.

create table if not exists public.experiences (
  id                    uuid primary key default extensions.gen_random_uuid(),
  profile_id            uuid not null references public.ise_profiles(id) on delete cascade,
  organization_id       uuid references public.organizations(id) on delete set null,
  organization_name_raw text,
  position_title        text not null,
  job_function_id       bigint references public.job_functions(id) on delete set null,
  sector_id             bigint references public.sectors(id) on delete set null,
  country_code          char(2) references public.countries(code),
  city                  text,
  start_date            date not null,
  end_date              date,
  is_current            boolean not null default false,
  description           text,
  missions_summary      text,
  visibility            text not null default 'members' check (public.is_visibility_level(visibility)),
  source                text not null default 'member' check (source in ('member', 'import', 'admin')),
  confirmed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint experiences_dates_order check (end_date is null or end_date >= start_date),
  constraint experiences_current_has_no_end check (not is_current or end_date is null),
  constraint experiences_org_present check (organization_id is not null or organization_name_raw is not null)
);
create index if not exists experiences_profile_idx  on public.experiences(profile_id, start_date desc);
create index if not exists experiences_org_idx      on public.experiences(organization_id);
create index if not exists experiences_sector_idx   on public.experiences(sector_id);
create index if not exists experiences_country_idx  on public.experiences(country_code);
create index if not exists experiences_current_idx  on public.experiences(profile_id) where is_current;
select private.attach_updated_at('public', 'experiences');

create table if not exists public.educations (
  id             uuid primary key default extensions.gen_random_uuid(),
  profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  institution    text not null,
  degree         text,
  field_of_study text,
  country_code   char(2) references public.countries(code),
  start_year     integer check (start_year is null or start_year between 1940 and 2100),
  end_year       integer check (end_year is null or end_year between 1940 and 2100),
  description    text,
  visibility     text not null default 'members' check (public.is_visibility_level(visibility)),
  source         text not null default 'member' check (source in ('member', 'import', 'admin')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint educations_years_order check (end_year is null or start_year is null or end_year >= start_year)
);
create index if not exists educations_profile_idx on public.educations(profile_id, end_year desc nulls first);
select private.attach_updated_at('public', 'educations');

create table if not exists public.profile_skills (
  profile_id       uuid not null references public.ise_profiles(id) on delete cascade,
  skill_id         bigint not null references public.skills(id) on delete cascade,
  level            text check (level is null or level in ('notion', 'intermediate', 'advanced', 'expert')),
  years_experience numeric(4,1) check (years_experience is null or years_experience >= 0),
  is_primary       boolean not null default false,
  context          text,
  source           text not null default 'member' check (source in ('member', 'import', 'admin')),
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (profile_id, skill_id)
);
create index if not exists profile_skills_skill_idx   on public.profile_skills(skill_id, profile_id);
create index if not exists profile_skills_primary_idx on public.profile_skills(profile_id) where is_primary;
select private.attach_updated_at('public', 'profile_skills');

comment on column public.profile_skills.level is
  'Niveau DECLARATIF. Jamais transforme automatiquement en certification (MASTER PROMPT §18, D-75).';

create table if not exists public.profile_sectors (
  profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  sector_id  bigint not null references public.sectors(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, sector_id)
);
create index if not exists profile_sectors_sector_idx on public.profile_sectors(sector_id);

create table if not exists public.profile_functions (
  profile_id      uuid not null references public.ise_profiles(id) on delete cascade,
  job_function_id bigint not null references public.job_functions(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (profile_id, job_function_id)
);
create index if not exists profile_functions_fn_idx on public.profile_functions(job_function_id);

create table if not exists public.profile_expertise_areas (
  profile_id        uuid not null references public.ise_profiles(id) on delete cascade,
  expertise_area_id bigint not null references public.expertise_areas(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (profile_id, expertise_area_id)
);
create index if not exists profile_expertise_idx on public.profile_expertise_areas(expertise_area_id);

create table if not exists public.profile_languages (
  profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  language_code varchar(10) not null references public.languages(code) on delete cascade,
  proficiency   text not null check (proficiency in ('basic', 'intermediate', 'professional', 'fluent', 'native')),
  created_at    timestamptz not null default now(),
  primary key (profile_id, language_code)
);

create table if not exists public.profile_tools (
  profile_id       uuid not null references public.ise_profiles(id) on delete cascade,
  tool_id          bigint not null references public.tools(id) on delete cascade,
  proficiency      text check (proficiency is null or proficiency in ('notion', 'intermediate', 'advanced', 'expert')),
  years_experience numeric(4,1) check (years_experience is null or years_experience >= 0),
  created_at       timestamptz not null default now(),
  primary key (profile_id, tool_id)
);
create index if not exists profile_tools_tool_idx on public.profile_tools(tool_id);

create table if not exists public.profile_geographies (
  profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  country_code char(2) not null references public.countries(code) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (profile_id, country_code)
);
create index if not exists profile_geographies_country_idx on public.profile_geographies(country_code);

create table if not exists public.profile_projects (
  id           uuid primary key default extensions.gen_random_uuid(),
  profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  title        text not null,
  summary      text,
  role         text,
  organization_id uuid references public.organizations(id) on delete set null,
  organization_name_raw text,
  sector_id    bigint references public.sectors(id) on delete set null,
  country_code char(2) references public.countries(code),
  start_date   date,
  end_date     date,
  outcome      text,
  link_url     text,
  visibility   text not null default 'members' check (public.is_visibility_level(visibility)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profile_projects_dates_order check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists profile_projects_profile_idx on public.profile_projects(profile_id, start_date desc nulls last);
select private.attach_updated_at('public', 'profile_projects');

create table if not exists public.profile_availabilities (
  id                uuid primary key default extensions.gen_random_uuid(),
  profile_id        uuid not null references public.ise_profiles(id) on delete cascade,
  availability_type text not null references public.availability_types(code) on delete cascade,
  active            boolean not null default true,
  max_per_month     smallint check (max_per_month is null or max_per_month between 1 and 60),
  ideal_delay_days  smallint check (ideal_delay_days is null or ideal_delay_days between 1 and 365),
  preferred_channel text check (preferred_channel is null or preferred_channel in ('message', 'email', 'call', 'video')),
  visibility        text not null default 'members' check (public.is_visibility_level(visibility)),
  available_from    date,
  available_until   date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (profile_id, availability_type),
  constraint profile_availabilities_dates_order
    check (available_until is null or available_from is null or available_until >= available_from)
);
create index if not exists profile_availabilities_type_idx
  on public.profile_availabilities(availability_type) where active;
create index if not exists profile_availabilities_profile_idx
  on public.profile_availabilities(profile_id);
select private.attach_updated_at('public', 'profile_availabilities');

comment on table public.profile_availabilities is
  'Disponibilite declaree. Ne vaut jamais obligation d''accepter (MASTER PROMPT §20).';

create table if not exists public.recommendation_requests (
  id                  uuid primary key default extensions.gen_random_uuid(),
  requester_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  recipient_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  skill_id            bigint references public.skills(id) on delete set null,
  context             text,
  message             text,
  status              text not null default 'pending'
                        check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  expires_at          timestamptz,
  responded_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint recommendation_requests_not_self check (requester_profile_id <> recipient_profile_id)
);
create index if not exists recommendation_requests_recipient_idx
  on public.recommendation_requests(recipient_profile_id, status);
create index if not exists recommendation_requests_requester_idx
  on public.recommendation_requests(requester_profile_id, status);
select private.attach_updated_at('public', 'recommendation_requests');

create table if not exists public.recommendations (
  id                  uuid primary key default extensions.gen_random_uuid(),
  request_id          uuid references public.recommendation_requests(id) on delete set null,
  author_profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  subject_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  relationship_context text not null,
  engagement_context  text,
  skill_id            bigint references public.skills(id) on delete set null,
  body                text not null check (length(body) between 40 and 2000),
  status              text not null default 'published'
                        check (status in ('draft', 'published', 'hidden', 'removed')),
  visibility          text not null default 'members' check (public.is_visibility_level(visibility)),
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint recommendations_not_self check (author_profile_id <> subject_profile_id)
);
create unique index if not exists recommendations_one_per_pair_skill
  on public.recommendations(author_profile_id, subject_profile_id, coalesce(skill_id, 0))
  where status <> 'removed';
create index if not exists recommendations_subject_idx on public.recommendations(subject_profile_id, status);
select private.attach_updated_at('public', 'recommendations');

comment on table public.recommendations is
  'Recommandation contextualisee. Ni like, ni note, ni endorsement de masse (MASTER PROMPT §19).';

-- Regles de completion : ponderations en base, modifiables sans migration. D-71.
create table if not exists public.profile_completion_rules (
  block_key   text primary key,
  label       text not null,
  weight      smallint not null check (weight between 0 and 100),
  hint        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

-- Index de recherche dedie. D-17.
create table if not exists public.profile_search_documents (
  profile_id    uuid primary key references public.ise_profiles(id) on delete cascade,
  search_vector tsvector not null,
  refreshed_at  timestamptz not null default now()
);
create index if not exists profile_search_documents_gin
  on public.profile_search_documents using gin (search_vector);

-- Recherches sauvegardees et alertes.
create table if not exists public.saved_searches (
  id          uuid primary key default extensions.gen_random_uuid(),
  profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  name        text not null,
  criteria    jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, name)
);
select private.attach_updated_at('public', 'saved_searches');

create table if not exists public.search_alerts (
  id               uuid primary key default extensions.gen_random_uuid(),
  saved_search_id  uuid not null references public.saved_searches(id) on delete cascade,
  profile_id       uuid not null references public.ise_profiles(id) on delete cascade,
  frequency        text not null default 'weekly' check (frequency in ('daily', 'weekly', 'monthly')),
  channel          text not null default 'in_app' check (channel in ('in_app', 'email', 'both')),
  status           text not null default 'active' check (status in ('active', 'paused', 'deleted')),
  last_run_at      timestamptz,
  last_notified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (saved_search_id)
);
select private.attach_updated_at('public', 'search_alerts');

-- Empeche de renotifier indefiniment les memes profils. MASTER PROMPT §36.
create table if not exists public.search_alert_seen_results (
  alert_id   uuid not null references public.search_alerts(id) on delete cascade,
  profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  seen_at    timestamptz not null default now(),
  primary key (alert_id, profile_id)
);
