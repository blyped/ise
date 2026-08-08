-- =====================================================================
-- 0002_reference_data
-- Referentiels : geographie, langues, secteurs, fonctions, expertises,
-- outils, taxonomie de competences, types de disponibilite, promotions,
-- organisations.
-- Reference : MASTER PROMPT §8, §9 ; docs/decisions.md D-13, D-60..D-65.
--
-- Note de nommage : le MASTER PROMPT §8 nomme cette table `functions`.
-- Elle est nommee `job_functions` ici : `functions` est trop ambigu dans une
-- base PostgreSQL ou coexistent des fonctions SQL. Consigne en D-21.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Geographie  (D-64 : referentiel absent des specifications, cree ici)
-- ---------------------------------------------------------------------
create table if not exists public.subregions (
  code        text primary key,
  name_fr     text not null,
  name_en     text,
  region_code text not null,
  region_fr   text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);
comment on table public.subregions is 'Sous-regions (decoupage UNSD). Critere de matching geographique (D-41).';

create table if not exists public.countries (
  code           char(2) primary key,
  name_fr        text not null,
  name_en        text,
  subregion_code text references public.subregions(code),
  is_active      boolean not null default true
);
create index if not exists countries_subregion_idx on public.countries(subregion_code) where is_active;
create index if not exists countries_name_trgm_idx on public.countries
  using gin (public.normalize_text(name_fr) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Langues
-- ---------------------------------------------------------------------
create table if not exists public.languages (
  code       varchar(10) primary key,
  name_fr    text not null,
  name_en    text,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

-- ---------------------------------------------------------------------
-- Secteurs (hierarchiques)
-- ---------------------------------------------------------------------
create table if not exists public.sectors (
  id          bigint generated always as identity primary key,
  parent_id   bigint references public.sectors(id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists sectors_parent_idx on public.sectors(parent_id);
select private.attach_updated_at('public', 'sectors');

-- Secteurs connexes : alimente le score « secteur connexe = 9 » (D-41).
create table if not exists public.sector_adjacencies (
  sector_id         bigint not null references public.sectors(id) on delete cascade,
  related_sector_id bigint not null references public.sectors(id) on delete cascade,
  primary key (sector_id, related_sector_id),
  constraint sector_adjacencies_not_self check (sector_id <> related_sector_id)
);

-- ---------------------------------------------------------------------
-- Fonctions professionnelles  (D-64)
-- ---------------------------------------------------------------------
create table if not exists public.job_functions (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

-- ---------------------------------------------------------------------
-- Domaines d'expertise
-- ---------------------------------------------------------------------
create table if not exists public.expertise_areas (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

-- ---------------------------------------------------------------------
-- Outils / technologies
-- ---------------------------------------------------------------------
create table if not exists public.tools (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  slug       text not null unique,
  category   text,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

-- ---------------------------------------------------------------------
-- Taxonomie de competences : domaine > categorie > competence  (D-60, D-61)
-- ---------------------------------------------------------------------
create table if not exists public.skill_domains (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

create table if not exists public.skill_categories (
  id          bigint generated always as identity primary key,
  domain_id   bigint not null references public.skill_domains(id) on delete restrict,
  code        text not null unique,
  name        text not null,
  slug        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  unique (domain_id, slug)
);
create index if not exists skill_categories_domain_idx on public.skill_categories(domain_id);

create table if not exists public.skills (
  id          bigint generated always as identity primary key,
  category_id bigint not null references public.skill_categories(id) on delete restrict,
  code        text unique,
  name        text not null,
  slug        text not null unique,
  description text,
  -- D-61 : tracabilite de la source pour arbitrage back-office ulterieur.
  source      text not null default 'doc20' check (source in ('doc20', 'doc19', 'admin', 'import')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists skills_category_idx on public.skills(category_id) where is_active;
create index if not exists skills_name_trgm_idx on public.skills
  using gin (public.normalize_text(name) extensions.gin_trgm_ops);
select private.attach_updated_at('public', 'skills');

-- Alias de competences (D-46). `normalized_alias` unique : un alias ne peut
-- jamais pointer vers deux competences.
create table if not exists public.skill_aliases (
  id               bigint generated always as identity primary key,
  skill_id         bigint not null references public.skills(id) on delete cascade,
  alias            text not null,
  normalized_alias text not null unique,
  -- Un sigle court (< 4 caracteres) n'est resolu que sur saisie exacte en majuscules.
  is_short_acronym boolean not null generated always as (length(normalized_alias) < 4) stored,
  created_at       timestamptz not null default now()
);
create index if not exists skill_aliases_skill_idx on public.skill_aliases(skill_id);
create index if not exists skill_aliases_trgm_idx on public.skill_aliases
  using gin (normalized_alias extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Types de disponibilite  (D-65 : referentiel pivot = doc 20, 13 codes)
-- ---------------------------------------------------------------------
create table if not exists public.availability_types (
  code        text primary key,
  name        text not null,
  description text,
  -- Canal de sollicitation par defaut associe a ce type d'aide.
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

-- ---------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------
create table if not exists public.promotions (
  id               bigint generated always as identity primary key,
  program_code     text not null default 'ISE',
  graduation_year  integer not null,
  name             text not null,
  description      text,
  estimated_size   integer check (estimated_size is null or estimated_size >= 0),
  cover_image_path text,
  status           text not null default 'active'
                     check (status in ('active', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (program_code, graduation_year),
  constraint promotions_year_range check (graduation_year between 1960 and 2100)
);
create index if not exists promotions_year_idx   on public.promotions(graduation_year desc);
create index if not exists promotions_status_idx on public.promotions(status);
select private.attach_updated_at('public', 'promotions');

-- ---------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id                uuid primary key default extensions.gen_random_uuid(),
  canonical_name    text not null,
  normalized_name   text generated always as (public.normalize_text(canonical_name)) stored,
  slug              text unique,
  organization_type text check (organization_type is null or organization_type in (
                      'public_administration', 'national_statistics_office', 'central_bank',
                      'commercial_bank', 'insurance', 'microfinance', 'international_organization',
                      'ngo', 'consulting', 'research_institute', 'university', 'private_company',
                      'startup', 'foundation', 'cooperative', 'media', 'other')),
  country_code      char(2) references public.countries(code),
  city              text,
  website           text,
  logo_path         text,
  description       text,
  is_verified       boolean not null default false,
  -- Fusion d'organisations : la ligne absorbee pointe vers la canonique.
  merged_into_id    uuid references public.organizations(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint organizations_not_merged_into_self check (merged_into_id is null or merged_into_id <> id)
);
create index if not exists organizations_norm_idx    on public.organizations(normalized_name);
create index if not exists organizations_country_idx on public.organizations(country_code);
create index if not exists organizations_type_idx    on public.organizations(organization_type);
create index if not exists organizations_merged_idx  on public.organizations(merged_into_id)
  where merged_into_id is not null;
create index if not exists organizations_trgm_idx    on public.organizations
  using gin (normalized_name extensions.gin_trgm_ops);
select private.attach_updated_at('public', 'organizations');

create table if not exists public.organization_aliases (
  id               bigint generated always as identity primary key,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  alias            text not null,
  normalized_alias text generated always as (public.normalize_text(alias)) stored,
  source           text not null default 'admin' check (source in ('admin', 'import', 'member')),
  created_at       timestamptz not null default now()
);
create unique index if not exists organization_aliases_norm_uidx
  on public.organization_aliases(normalized_alias);
create index if not exists organization_aliases_org_idx
  on public.organization_aliases(organization_id);

-- ---------------------------------------------------------------------
-- Motifs de signalement  (D-66 : referentiel unique, filtre a l'affichage)
-- ---------------------------------------------------------------------
create table if not exists public.report_reasons (
  code             text primary key,
  name             text not null,
  description      text,
  -- Types d'objets pour lesquels ce motif est propose.
  applies_to       text[] not null default '{}',
  sort_order       integer not null default 0,
  is_active        boolean not null default true
);
