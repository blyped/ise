-- 0012_projects
-- Applique le 2026-08-08 (version 20260808004657)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0012_projects
-- Module Projets & Consortiums (ISE-088 -> ISE-091).
--
-- REGLE STRUCTURANTE (MASTER PROMPT §32) :
--   INTERET != MEMBRE CONFIRME. Trois tables, trois etats distincts :
--     * public.project_applications  -> expression d'interet / candidature
--     * public.consortium_requests   -> demande d'une ORGANISATION
--     * public.project_members       -> membre engage (confirmed_at non nul)
--
-- MACHINE D'ETATS (D-53) :
--   draft -> recruiting -> team_ready -> completed | archived | failed
--   etendue de active / paused / cancelled (liste la plus fine, D-53).
-- =====================================================================

create table if not exists public.projects (
  id                      uuid primary key default extensions.gen_random_uuid(),
  owner_profile_id        uuid not null references public.ise_profiles(id) on delete restrict,

  project_type            text not null
                            check (project_type in ('mission', 'tender', 'consortium', 'study',
                                                    'research', 'entrepreneurial', 'product',
                                                    'publication', 'working_group',
                                                    'community_initiative', 'other')),

  title                   text not null,
  restricted_title        text,
  summary                 text not null,
  description             text,
  expected_outcome        text not null,
  qualification_criteria  text,
  tender_reference        text,

  sector_id               bigint references public.sectors(id) on delete set null,

  visibility              text not null default 'network'
                            check (visibility in ('network', 'community', 'promotion',
                                                  'invitation_only', 'team_only')),
  disclosure_level        text not null default 'full'
                            check (disclosure_level in ('full', 'summary_only')),
  requires_nda            boolean not null default false,

  compensation_type       text not null default 'to_be_defined'
                            check (compensation_type in ('paid', 'conditional_on_award',
                                                         'volunteer', 'equity', 'mixed',
                                                         'to_be_defined')),
  compensation_statement  text,

  status                  text not null default 'draft'
                            check (status in ('draft', 'recruiting', 'team_ready', 'active',
                                              'paused', 'completed', 'failed', 'cancelled',
                                              'archived')),

  start_date              date,
  application_deadline    date,
  target_end_date         date,

  source_type             text check (source_type is null or source_type in
                            ('personal_initiative', 'tender', 'opportunity', 'client_request',
                             'community', 'network_call', 'impact_lab', 'other')),
  source_community_id     uuid references public.communities(id) on delete set null,
  source_entity_type      text check (source_entity_type is null or source_entity_type in
                            ('network_call', 'opportunity', 'event', 'internship_need')),
  source_entity_id        uuid,

  published_at            timestamptz,
  team_confirmed_at       timestamptz,
  started_at              timestamptz,
  paused_at               timestamptz,
  closed_at               timestamptz,
  archived_at             timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,

  constraint projects_deadlines_order check (
    application_deadline is null or target_end_date is null
    or application_deadline <= target_end_date
  ),
  constraint projects_dates_order check (
    start_date is null or target_end_date is null or start_date <= target_end_date
  ),
  constraint projects_source_entity_pair check (
    (source_entity_type is null) = (source_entity_id is null)
  ),
  constraint projects_publication_coherence check (
    (status = 'draft' and published_at is null)
    or (status <> 'draft' and published_at is not null)
  )
);

create index if not exists projects_owner_idx   on public.projects(owner_profile_id)
  where deleted_at is null;
create index if not exists projects_sector_idx  on public.projects(sector_id);
create index if not exists projects_type_idx    on public.projects(project_type)
  where deleted_at is null;
create index if not exists projects_status_published_idx
  on public.projects(status, published_at desc, id desc)
  where deleted_at is null;
create index if not exists projects_recruiting_idx
  on public.projects(application_deadline, id desc)
  where status = 'recruiting' and deleted_at is null;
create index if not exists projects_visibility_idx on public.projects(visibility)
  where deleted_at is null;
create index if not exists projects_source_community_idx
  on public.projects(source_community_id) where source_community_id is not null;
create index if not exists projects_source_entity_idx
  on public.projects(source_entity_type, source_entity_id) where source_entity_id is not null;
create index if not exists projects_title_trgm_idx on public.projects
  using gin (public.normalize_text(title) extensions.gin_trgm_ops);

select private.attach_updated_at('public', 'projects');

comment on table public.projects is
  'Collaboration structuree entre membres. Ni Asana, ni Slack, ni ERP : le module gere la decouverte, l''equipe, l''engagement et le resultat [U §3].';
comment on column public.projects.expected_outcome is
  'Resultat attendu, obligatoire (CA-PROJ-01). Sans lui, un projet derive en simple groupe de discussion.';
comment on column public.projects.status is
  'D-53 : draft -> recruiting -> team_ready -> completed | archived | failed, etendu de active/paused/cancelled (liste la plus fine).';

create table if not exists private.project_confidential_details (
  project_id        uuid primary key references public.projects(id) on delete cascade,
  client_name       text,
  funder_name       text,
  budget_estimate   numeric(14, 2) check (budget_estimate is null or budget_estimate >= 0),
  budget_currency   char(3),
  financial_notes   text,
  revenue_generated numeric(14, 2) check (revenue_generated is null or revenue_generated >= 0),
  revenue_currency  char(3),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select private.attach_updated_at('private', 'project_confidential_details');

create table if not exists public.project_countries (
  project_id   uuid    not null references public.projects(id) on delete cascade,
  country_code char(2) not null references public.countries(code),
  primary key (project_id, country_code)
);
create index if not exists project_countries_country_idx on public.project_countries(country_code);

create table if not exists public.project_communities (
  project_id   uuid not null references public.projects(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  primary key (project_id, community_id)
);
create index if not exists project_communities_community_idx
  on public.project_communities(community_id);

-- ---------------------------------------------------------------------
-- Roles recherches (matching PAR ROLE, CA-PROJ-02)
-- ---------------------------------------------------------------------
create table if not exists public.project_roles (
  id                    uuid primary key default extensions.gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,

  title                 text not null,
  description           text,
  seats                 smallint not null default 1 check (seats between 1 and 100),

  commitment_type       text check (commitment_type is null or commitment_type in
                          ('ad_hoc_advice', 'few_hours', 'part_time', 'full_mission', 'cofounder')),
  workload_days         numeric(6, 1) check (workload_days is null or workload_days >= 0),
  workload_hours_week   numeric(5, 1) check (workload_hours_week is null or workload_hours_week >= 0),
  commitment_notes      text,

  experience_min_years  numeric(4, 1) check (experience_min_years is null or experience_min_years >= 0),
  sector_id             bigint references public.sectors(id) on delete set null,
  availability_from     date,
  availability_until    date,

  compensation_type     text check (compensation_type is null or compensation_type in
                          ('paid', 'conditional_on_award', 'volunteer', 'equity', 'mixed',
                           'to_be_defined')),

  application_mode      text not null default 'open'
                          check (application_mode in ('open', 'invitation_only')),
  is_key_expert         boolean not null default false,

  status                text not null default 'open'
                          check (status in ('open', 'partially_filled', 'filled', 'closed')),
  sort_order            integer not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint project_roles_availability_order check (
    availability_from is null or availability_until is null
    or availability_from <= availability_until
  )
);

create index if not exists project_roles_project_idx on public.project_roles(project_id, sort_order);
create index if not exists project_roles_open_idx    on public.project_roles(project_id)
  where status in ('open', 'partially_filled');
create index if not exists project_roles_sector_idx  on public.project_roles(sector_id);

select private.attach_updated_at('public', 'project_roles');

comment on table public.project_roles is
  'Role recherche sur un projet, avec ses competences attendues. Support du matching par role (CA-PROJ-02).';

create table if not exists private.project_role_compensation (
  project_role_id  uuid primary key references public.project_roles(id) on delete cascade,
  details          text,
  amount_min       numeric(14, 2) check (amount_min is null or amount_min >= 0),
  amount_max       numeric(14, 2) check (amount_max is null or amount_max >= 0),
  currency         char(3),
  rate_unit        text check (rate_unit is null or rate_unit in
                     ('fixed', 'per_day', 'per_month', 'range', 'contract_share', 'negotiable')),
  disclosed_from   text not null default 'shortlisted'
                     check (disclosed_from in ('applied', 'shortlisted', 'selected', 'team_only')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint project_role_compensation_amount_order
    check (amount_min is null or amount_max is null or amount_min <= amount_max)
);
select private.attach_updated_at('private', 'project_role_compensation');

create table if not exists public.project_role_skills (
  project_role_id  uuid   not null references public.project_roles(id) on delete cascade,
  skill_id         bigint not null references public.skills(id) on delete cascade,
  requirement_type text   not null default 'required'
                     check (requirement_type in ('required', 'desired')),
  minimum_level    text check (minimum_level is null or minimum_level in
                     ('notion', 'intermediate', 'advanced', 'expert')),
  primary key (project_role_id, skill_id)
);
create index if not exists project_role_skills_skill_idx
  on public.project_role_skills(skill_id, requirement_type);

create table if not exists public.project_role_languages (
  project_role_id uuid        not null references public.project_roles(id) on delete cascade,
  language_code   varchar(10) not null references public.languages(code),
  is_mandatory    boolean     not null default true,
  primary key (project_role_id, language_code)
);
create index if not exists project_role_languages_language_idx
  on public.project_role_languages(language_code);

create table if not exists public.project_role_tools (
  project_role_id uuid   not null references public.project_roles(id) on delete cascade,
  tool_id         bigint not null references public.tools(id) on delete cascade,
  primary key (project_role_id, tool_id)
);
create index if not exists project_role_tools_tool_idx on public.project_role_tools(tool_id);

create table if not exists public.project_role_countries (
  project_role_id uuid    not null references public.project_roles(id) on delete cascade,
  country_code    char(2) not null references public.countries(code),
  primary key (project_role_id, country_code)
);
create index if not exists project_role_countries_country_idx
  on public.project_role_countries(country_code);

-- ---------------------------------------------------------------------
-- Expressions d'interet / candidatures  (JAMAIS une adhesion)
-- ---------------------------------------------------------------------
create table if not exists public.project_applications (
  id                     uuid primary key default extensions.gen_random_uuid(),
  project_id             uuid not null references public.projects(id) on delete cascade,
  project_role_id        uuid references public.project_roles(id) on delete set null,
  applicant_profile_id   uuid not null references public.ise_profiles(id) on delete cascade,

  message                text,
  availability_notes     text,
  availability_confirmed boolean not null default false,
  terms_acknowledged     boolean not null default false,
  cv_consent             boolean not null default false,

  status                 text not null default 'submitted'
                           check (status in ('submitted', 'reviewing', 'shortlisted',
                                             'selected', 'not_selected', 'withdrawn')),

  submitted_at           timestamptz not null default now(),
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint project_applications_review_coherence check (
    status in ('submitted', 'withdrawn') or reviewed_at is not null
  )
);

create unique index if not exists project_applications_role_uidx
  on public.project_applications(project_id, project_role_id, applicant_profile_id)
  where project_role_id is not null and status <> 'withdrawn';
create unique index if not exists project_applications_general_uidx
  on public.project_applications(project_id, applicant_profile_id)
  where project_role_id is null and status <> 'withdrawn';

create index if not exists project_applications_project_idx
  on public.project_applications(project_id, status, submitted_at desc);
create index if not exists project_applications_role_idx
  on public.project_applications(project_role_id, status);
create index if not exists project_applications_applicant_idx
  on public.project_applications(applicant_profile_id, submitted_at desc);

select private.attach_updated_at('public', 'project_applications');

comment on table public.project_applications is
  'Expression d''interet a un projet ou a un role. N''est JAMAIS une adhesion : seule public.project_members avec confirmed_at non nul fait foi (MASTER PROMPT §32).';

create table if not exists public.project_selection_decisions (
  id                     uuid primary key default extensions.gen_random_uuid(),
  application_id         uuid not null references public.project_applications(id) on delete cascade,
  decided_by_profile_id  uuid not null references public.ise_profiles(id) on delete restrict,
  decision               text not null
                           check (decision in ('review', 'shortlist', 'select',
                                               'not_select', 'reopen')),
  rationale              text,
  decided_at             timestamptz not null default now()
);
create index if not exists project_selection_decisions_application_idx
  on public.project_selection_decisions(application_id, decided_at desc);
create index if not exists project_selection_decisions_actor_idx
  on public.project_selection_decisions(decided_by_profile_id, decided_at desc);

comment on table public.project_selection_decisions is
  'Journal des decisions de selection. Aucune selection ni aucun rejet automatique : chaque ligne a un auteur humain (CA-PROJ-11).';

-- ---------------------------------------------------------------------
-- Invitations directes
-- ---------------------------------------------------------------------
create table if not exists public.project_invitations (
  id                     uuid primary key default extensions.gen_random_uuid(),
  project_id             uuid not null references public.projects(id) on delete cascade,
  project_role_id        uuid references public.project_roles(id) on delete set null,
  invited_profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  invited_by_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,

  message                text,
  status                 text not null default 'sent'
                           check (status in ('sent', 'accepted', 'declined', 'question_asked',
                                             'expired', 'revoked')),
  expires_at             timestamptz,
  responded_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint project_invitations_no_self_invite
    check (invited_profile_id <> invited_by_profile_id)
);

create unique index if not exists project_invitations_pending_uidx
  on public.project_invitations(project_id, invited_profile_id, project_role_id)
  where status in ('sent', 'question_asked');
create index if not exists project_invitations_project_idx
  on public.project_invitations(project_id, status);
create index if not exists project_invitations_invited_idx
  on public.project_invitations(invited_profile_id, status);
create index if not exists project_invitations_inviter_idx
  on public.project_invitations(invited_by_profile_id);
create index if not exists project_invitations_role_idx
  on public.project_invitations(project_role_id);

select private.attach_updated_at('public', 'project_invitations');

-- ---------------------------------------------------------------------
-- Consortium : demandes de participation d'une organisation
-- ---------------------------------------------------------------------
create table if not exists public.consortium_requests (
  id                      uuid primary key default extensions.gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  organization_id         uuid not null references public.organizations(id) on delete restrict,
  requested_by_profile_id uuid not null references public.ise_profiles(id) on delete cascade,

  partner_role            text not null default 'partner'
                            check (partner_role in ('lead_firm', 'partner', 'country_partner',
                                                    'subcontractor', 'thematic_specialist')),
  message                 text,
  credentials_summary     text,

  status                  text not null default 'submitted'
                            check (status in ('submitted', 'reviewing', 'shortlisted',
                                              'selected', 'not_selected', 'withdrawn')),
  decided_by_profile_id   uuid references public.ise_profiles(id) on delete set null,
  decided_at              timestamptz,

  submitted_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint consortium_requests_decision_coherence
    check ((decided_at is null) or (decided_by_profile_id is not null))
);

create unique index if not exists consortium_requests_pending_uidx
  on public.consortium_requests(project_id, organization_id)
  where status <> 'withdrawn';
create index if not exists consortium_requests_project_idx
  on public.consortium_requests(project_id, status);
create index if not exists consortium_requests_organization_idx
  on public.consortium_requests(organization_id);
create index if not exists consortium_requests_requester_idx
  on public.consortium_requests(requested_by_profile_id);
create index if not exists consortium_requests_decider_idx
  on public.consortium_requests(decided_by_profile_id);

select private.attach_updated_at('public', 'consortium_requests');

comment on table public.consortium_requests is
  'Demande de participation d''une organisation a un consortium. Etat distinct de l''appartenance : une demande retenue ne cree aucun membre (MASTER PROMPT §32).';

-- ---------------------------------------------------------------------
-- Membres confirmes  (consentement obligatoire, CA-PROJ-05)
-- ---------------------------------------------------------------------
create table if not exists public.project_members (
  id                     uuid primary key default extensions.gen_random_uuid(),
  project_id             uuid not null references public.projects(id) on delete cascade,
  profile_id             uuid not null references public.ise_profiles(id) on delete cascade,
  project_role_id        uuid references public.project_roles(id) on delete set null,
  source_application_id  uuid references public.project_applications(id) on delete set null,
  source_invitation_id   uuid references public.project_invitations(id) on delete set null,

  membership_role        text not null default 'member'
                           check (membership_role in ('owner', 'lead', 'member',
                                                      'advisor', 'observer')),
  membership_status      text not null default 'pending_confirmation'
                           check (membership_status in ('invited', 'pending_confirmation',
                                                        'active', 'withdrawn', 'removed',
                                                        'completed')),

  agreed_terms           jsonb not null default '{}'::jsonb,
  cv_consent             boolean not null default false,
  confirmed_at           timestamptz,

  joined_at              timestamptz,
  left_at                timestamptz,
  removal_reason         text,
  removed_by_profile_id  uuid references public.ise_profiles(id) on delete set null,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint project_members_consent_required check (
    membership_status <> 'active' or confirmed_at is not null
  ),
  constraint project_members_removal_reason_required check (
    membership_status <> 'removed' or removal_reason is not null
  )
);

create unique index if not exists project_members_role_uidx
  on public.project_members(project_id, profile_id, project_role_id)
  where project_role_id is not null;
create unique index if not exists project_members_no_role_uidx
  on public.project_members(project_id, profile_id)
  where project_role_id is null;

create index if not exists project_members_project_idx
  on public.project_members(project_id, membership_status);
create index if not exists project_members_profile_idx
  on public.project_members(profile_id, membership_status);
create index if not exists project_members_role_lookup_idx
  on public.project_members(project_role_id) where project_role_id is not null;
create index if not exists project_members_application_idx
  on public.project_members(source_application_id) where source_application_id is not null;
create index if not exists project_members_invitation_idx
  on public.project_members(source_invitation_id) where source_invitation_id is not null;
create index if not exists project_members_removed_by_idx
  on public.project_members(removed_by_profile_id);

select private.attach_updated_at('public', 'project_members');

comment on table public.project_members is
  'Membre engage sur un projet. confirmed_at non nul = consentement explicite. Une candidature retenue ne cree jamais directement un membre actif (MASTER PROMPT §32, CA-PROJ-05).';
comment on column public.project_members.agreed_terms is
  'Instantane fige des conditions acceptees (role, disponibilite, remuneration, confidentialite) [U §147].';

-- ---------------------------------------------------------------------
-- Suivi synthetique
-- ---------------------------------------------------------------------
create table if not exists public.project_milestones (
  id               uuid primary key default extensions.gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  title            text not null,
  description      text,
  due_date         date,
  status           text not null default 'todo'
                     check (status in ('todo', 'in_progress', 'done', 'blocked')),
  owner_profile_id uuid references public.ise_profiles(id) on delete set null,
  sort_order       integer not null default 0,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint project_milestones_completion_coherence
    check (status <> 'done' or completed_at is not null)
);
create index if not exists project_milestones_project_idx
  on public.project_milestones(project_id, sort_order);
create index if not exists project_milestones_owner_idx
  on public.project_milestones(owner_profile_id);
create index if not exists project_milestones_due_idx
  on public.project_milestones(project_id, due_date)
  where status in ('todo', 'in_progress', 'blocked');
select private.attach_updated_at('public', 'project_milestones');

create table if not exists public.project_links (
  id               uuid primary key default extensions.gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  label            text not null,
  url              text not null,
  link_type        text not null default 'other'
                     check (link_type in ('drive', 'onedrive', 'notion', 'repository',
                                          'document', 'dataset', 'publication', 'other')),
  is_confidential  boolean not null default true,
  added_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists project_links_project_idx on public.project_links(project_id);
create index if not exists project_links_author_idx  on public.project_links(added_by_profile_id);

-- ---------------------------------------------------------------------
-- Cloture et resultat  (aucun etat non constate, D-55)
-- ---------------------------------------------------------------------
create table if not exists public.project_closures (
  project_id                 uuid primary key references public.projects(id) on delete cascade,

  outcome_status             text not null
                               check (outcome_status in ('succeeded', 'partially_succeeded',
                                                         'cancelled', 'failed')),
  expected_outcome_achieved  text not null
                               check (expected_outcome_achieved in ('yes', 'partially', 'no')),
  outcome_code               text check (outcome_code is null or outcome_code in
                               ('contract_won', 'contract_lost', 'study_completed',
                                'report_delivered', 'publication_produced', 'working_paper',
                                'dataset_produced', 'company_created', 'product_launched',
                                'prototype', 'consortium_formed', 'interrupted', 'abandoned',
                                'pending', 'other')),

  deliverable_title          text,
  deliverable_url            text,
  public_result_sheet_allowed boolean not null default false,
  testimonial                text,

  network_attribution        text check (network_attribution is null or network_attribution in
                               ('mainly', 'partially', 'no')),
  collaborators_count        smallint check (collaborators_count is null or collaborators_count >= 0),

  closed_by_profile_id       uuid not null references public.ise_profiles(id) on delete restrict,
  closed_at                  timestamptz not null default now(),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists project_closures_outcome_idx
  on public.project_closures(outcome_status, closed_at desc);
create index if not exists project_closures_closed_by_idx
  on public.project_closures(closed_by_profile_id);
select private.attach_updated_at('public', 'project_closures');

comment on table public.project_closures is
  'Cloture declaree d''un projet : resultat, livrable, attribution au reseau. Aucun etat n''est pose sans constatation (D-55).';

