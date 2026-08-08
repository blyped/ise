-- =====================================================================
-- 0019_analytics_impact
-- Schema `analytics` : mesure de la valeur reelle du reseau et impact.
--
-- Sources : DIGEST A parties AA (impact) et AB (activite produit), §3.4 ;
--           MASTER PROMPT §42, §98 ; docs/decisions.md D-16, D-55, D-72.
--
-- REGLES STRUCTURANTES
--   * MASTER PROMPT §98 : AUCUN KPI invente. Chaque indicateur du catalogue
--     `analytics.metric_definitions` porte la ou les sources reelles qui
--     permettent de le calculer, et un drapeau `is_computable` indiquant si
--     la source existe deja en base. Un indicateur sans source ne se calcule
--     pas : il n'est pas affiche.
--   * MASTER PROMPT §42 : agregats de preference, pas de surveillance
--     individuelle. Les vues exposees agregent ; les tables evenementielles
--     restent dans `analytics`, hors Data API (D-16).
--   * D-55 : aucun etat non constate. Un evenement d'impact est soit lie a
--     une transition metier reelle, soit declare explicitement par une
--     personne identifiee (`attribution_level = 'self_reported'`).
--   * D-72 : le score de completion reste prive et n'entre dans aucun
--     classement individuel.
--   * Aucune RLS ici : le schema `analytics` n'est pas expose a la Data API.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Evenements d'impact
--    Divergence [17] / MASTER PROMPT arbitree : la table est placee dans
--    `analytics` (et non `public`) car elle nomme des beneficiaires et des
--    contributeurs. Non exposee a la Data API, conformement au §42.
-- ---------------------------------------------------------------------
create table if not exists analytics.impact_events (
  id                        uuid primary key default extensions.gen_random_uuid(),

  -- Vocabulaire [17 §153]. Les trois codes divergents de [16 §55]
  -- (mentor_completed / project_created / company_created) y sont mappes :
  -- mentorship_completed / project_team_created / business_created.
  impact_type               text not null check (impact_type in (
                              'connection_created', 'introduction_successful',
                              'network_call_resolved', 'internship_obtained',
                              'job_obtained', 'mission_obtained',
                              'mentorship_completed', 'project_team_created',
                              'contract_won', 'business_created',
                              'publication_created')),

  beneficiary_profile_id    uuid references public.ise_profiles(id) on delete set null,
  contributor_profile_id    uuid references public.ise_profiles(id) on delete set null,

  -- Objet metier a l'origine du constat. Reference polymorphe : les modules
  -- concernes arrivent dans des migrations ulterieures.
  source_type               text not null check (source_type in (
                              'connection', 'introduction', 'network_call',
                              'opportunity', 'application', 'internship',
                              'mentorship', 'project', 'event', 'declaration')),
  source_id                 uuid,

  -- [17 §154]. `self_reported` = declare par la personne elle-meme (D-55).
  attribution_level         text not null default 'self_reported'
                              check (attribution_level in ('direct', 'partial', 'self_reported', 'unknown')),
  declared_by_profile_id    uuid references public.ise_profiles(id) on delete set null,

  organization_id           uuid  references public.organizations(id) on delete set null,
  promotion_id              bigint references public.promotions(id) on delete set null,
  country_code              char(2) references public.countries(code),

  occurred_at               timestamptz not null default now(),
  -- Metadonnees structurelles uniquement : jamais de coordonnee, de CV ni
  -- de contenu de message.
  metadata                  jsonb not null default '{}'::jsonb,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- D-55 : un impact declare exige un declarant identifie.
  constraint impact_events_declaration_traceable check (
    attribution_level <> 'self_reported' or declared_by_profile_id is not null
  ),
  -- Un impact rattache a un objet metier doit designer cet objet.
  constraint impact_events_source_identified check (
    source_type = 'declaration' or source_id is not null
  )
);

-- Un meme fait ne se compte qu'une fois : integrite des chiffres publies.
create unique index if not exists impact_events_source_uidx
  on analytics.impact_events(source_type, source_id, impact_type)
  where source_id is not null;

create index if not exists impact_events_type_time_idx
  on analytics.impact_events(impact_type, occurred_at desc);
create index if not exists impact_events_beneficiary_idx
  on analytics.impact_events(beneficiary_profile_id)
  where beneficiary_profile_id is not null;
create index if not exists impact_events_contributor_idx
  on analytics.impact_events(contributor_profile_id)
  where contributor_profile_id is not null;
create index if not exists impact_events_promotion_idx
  on analytics.impact_events(promotion_id) where promotion_id is not null;
create index if not exists impact_events_country_idx
  on analytics.impact_events(country_code) where country_code is not null;

select private.attach_updated_at('analytics', 'impact_events');

comment on table analytics.impact_events is
  'Faits d''impact constates ou declares. Permet de produire le bilan annuel sans reconstruire l''historique.';
comment on column analytics.impact_events.attribution_level is
  'direct / partial / self_reported / unknown. Aucun impact n''est deduit d''un simple clic (D-55).';


-- ---------------------------------------------------------------------
-- 2. Activite produit (PARTIE AB)
--    Evenements analytiques NON sensibles. Interdiction de stockage :
--    contenu de message, telephone, CV, documents d'identite [17 §157].
-- ---------------------------------------------------------------------
create table if not exists analytics.profile_activity_events (
  id            bigint generated always as identity primary key,

  -- Nullable : certains evenements sont anonymes ou agreges a la source.
  profile_id    uuid references public.ise_profiles(id) on delete set null,

  event_type    text not null check (event_type in (
                  'search_performed', 'search_result_opened', 'profile_viewed',
                  'connection_requested', 'introduction_requested',
                  'network_call_created', 'network_call_resolved',
                  'opportunity_viewed', 'application_submitted',
                  'mentor_requested', 'internship_placed', 'project_created',
                  'event_registered', 'profile_claimed', 'profile_updated')),

  entity_type   text,
  entity_id     uuid,

  -- Relie une recherche a l'ouverture d'un resultat : c'est la seule source
  -- reelle permettant de mesurer « une recherche produisant un resultat utile »
  -- exige par le MASTER PROMPT §42, sans inventer d'indicateur (§98).
  correlation_id text,

  occurred_at   timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb
);

create index if not exists profile_activity_events_time_idx
  on analytics.profile_activity_events(occurred_at desc);
create index if not exists profile_activity_events_type_idx
  on analytics.profile_activity_events(event_type, occurred_at desc);
create index if not exists profile_activity_events_correlation_idx
  on analytics.profile_activity_events(correlation_id)
  where correlation_id is not null;
create index if not exists profile_activity_events_profile_idx
  on analytics.profile_activity_events(profile_id)
  where profile_id is not null;

comment on table analytics.profile_activity_events is
  'Evenements produit non sensibles. Interdit : contenu de message, telephone, CV, piece d''identite.';
comment on column analytics.profile_activity_events.profile_id is
  'Sert au dedoublonnage des agregats, pas au suivi individuel (MASTER PROMPT §42).';


-- ---------------------------------------------------------------------
-- 3. Catalogue des indicateurs — chaque KPI porte sa source reelle
--    MASTER PROMPT §98 : aucun indicateur sans source calculable.
-- ---------------------------------------------------------------------
create table if not exists analytics.metric_definitions (
  code            text primary key,
  label_fr        text not null,
  definition_fr   text not null,
  -- Objets reels d'ou l'indicateur est calcule. Vide = non calculable.
  source_objects  text[] not null default '{}',
  unit            text not null default 'count'
                    check (unit in ('count', 'ratio', 'duration_seconds')),
  -- false tant que la source n'existe pas encore en base : l'indicateur
  -- n'est alors ni calcule ni affiche.
  is_computable   boolean not null default false,
  -- Un indicateur d'agregat ne doit jamais etre restitue par individu.
  is_aggregate_only boolean not null default true,
  sort_order      integer not null default 0
);

comment on table analytics.metric_definitions is
  'Catalogue des indicateurs du MASTER PROMPT §42. Chaque entree nomme sa source reelle (§98).';

insert into analytics.metric_definitions
  (code, label_fr, definition_fr, source_objects, unit, is_computable, sort_order) values
  ('profiles_claimed',
   'Profils reclames',
   'Profils references dont la reclamation a abouti (claimed_at renseigne).',
   array['public.ise_profiles.claimed_at', 'public.profile_claims'], 'count', true, 10),

  ('profiles_enriched',
   'Profils enrichis',
   'Profils portant au moins une competence declaree et une experience saisie.',
   array['public.profile_skills', 'public.experiences'], 'count', true, 20),

  ('useful_searches',
   'Recherches produisant un resultat utile',
   'Recherches suivies de l''ouverture d''au moins un resultat, appariees par correlation_id.',
   array['analytics.profile_activity_events'], 'count', true, 30),

  ('connections_accepted',
   'Connexions acceptees',
   'Relations effectivement etablies (une ligne par paire dans public.connections).',
   array['public.connections'], 'count', true, 40),

  ('introductions_requested',
   'Introductions demandees',
   'Demandes d''introduction creees.',
   array['public.introduction_requests'], 'count', true, 50),

  ('introductions_completed',
   'Introductions realisees',
   'Demandes d''introduction parvenues au statut completed.',
   array['public.introduction_requests.completed_at'], 'count', true, 60),

  ('network_calls_helped',
   'Appels ayant recu de l''aide',
   'Appels au reseau clotures en resolved ou partially_resolved par leur auteur (D-52).',
   array['public.network_calls'], 'count', false, 70),

  ('opportunities_connected',
   'Opportunites mises en relation',
   'Opportunites ayant donne lieu a au moins une candidature ou une mise en relation constatee.',
   array['public.opportunities', 'public.applications'], 'count', false, 80),

  ('mentorships_started',
   'Mentorats demarres',
   'Binomes de mentorat effectivement demarres.',
   array['public.mentorships'], 'count', false, 90),

  ('projects_formed',
   'Projets constitues',
   'Projets ayant atteint l''etat team_ready (D-53).',
   array['public.projects'], 'count', false, 100),

  ('events_followed',
   'Evenements suivis',
   'Inscriptions a un evenement effectivement enregistrees.',
   array['public.event_registrations'], 'count', false, 110),

  ('impact_events_recorded',
   'Faits d''impact enregistres',
   'Evenements d''impact constates ou declares, par type.',
   array['analytics.impact_events'], 'count', true, 120)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 4. Agregats journaliers materialises par les traitements planifies
--    Une valeur n'est ecrite que si l'indicateur est calculable.
-- ---------------------------------------------------------------------
create table if not exists analytics.daily_metrics (
  metric_date     date not null,
  metric_code     text not null references analytics.metric_definitions(code) on delete cascade,
  -- Cle de ventilation optionnelle (ex. 'promotion:2000', 'country:CI').
  -- Chaine vide = valeur globale.
  dimension_key   text not null default '',
  value           numeric not null check (value >= 0),
  computed_at     timestamptz not null default now(),
  primary key (metric_date, metric_code, dimension_key)
);

create index if not exists daily_metrics_code_date_idx
  on analytics.daily_metrics(metric_code, metric_date desc);

comment on table analytics.daily_metrics is
  'Serie journaliere par indicateur. Alimentee par un traitement planifie a partir des sources reelles.';


-- ---------------------------------------------------------------------
-- 5. Vues d'impact et de valeur reelle
--    Uniquement sur des sources deja presentes en base. Les indicateurs
--    dependant de modules non encore migres (appels, opportunites, mentorat,
--    projets, evenements) sont declares non calculables dans le catalogue et
--    recevront leur vue avec la migration du module concerne.
-- ---------------------------------------------------------------------

-- Profils reclames, par jour.
create or replace view analytics.v_profiles_claimed_daily as
select
  (p.claimed_at at time zone 'UTC')::date as metric_date,
  count(*)                                as claimed_count
from public.ise_profiles p
where p.claimed_at is not null
  and p.deleted_at is null
group by 1;

-- Etat de remplissage de l'annuaire. Agrege, jamais nominatif (D-72).
create or replace view analytics.v_profile_enrichment_snapshot as
select
  count(*)                                                          as total_profiles,
  count(*) filter (where p.claimed_at is not null)                  as claimed_profiles,
  count(*) filter (where p.onboarding_completed_at is not null)     as onboarded_profiles,
  count(*) filter (where p.verification_status = 'verified')        as verified_profiles,
  count(*) filter (where s.marker is not null)                      as profiles_with_skills,
  count(*) filter (where e.marker is not null)                      as profiles_with_experience,
  count(*) filter (where s.marker is not null and e.marker is not null)
                                                                    as enriched_profiles,
  now()                                                             as calculated_at
from public.ise_profiles p
left join lateral (
  select 1 as marker from public.profile_skills ps where ps.profile_id = p.id limit 1
) s on true
left join lateral (
  select 1 as marker from public.experiences ex where ex.profile_id = p.id limit 1
) e on true
where p.deleted_at is null;

-- Connexions acceptees, par jour.
create or replace view analytics.v_connections_accepted_daily as
select
  (c.connected_at at time zone 'UTC')::date as metric_date,
  count(*)                                  as accepted_count
from public.connections c
group by 1;

-- Introductions demandees et realisees, par jour.
create or replace view analytics.v_introductions_daily as
select
  d.metric_date,
  sum(d.requested_count) as requested_count,
  sum(d.completed_count) as completed_count
from (
  select (i.created_at at time zone 'UTC')::date as metric_date, 1 as requested_count, 0 as completed_count
  from public.introduction_requests i
  union all
  select (i.completed_at at time zone 'UTC')::date, 0, 1
  from public.introduction_requests i
  where i.completed_at is not null
) d
group by d.metric_date;

-- Recherches utiles : une recherche est utile lorsqu'au moins un resultat
-- a ete ouvert dans la meme sequence (correlation_id partage).
create or replace view analytics.v_useful_searches_daily as
select
  (s.occurred_at at time zone 'UTC')::date as metric_date,
  count(*)                                 as searches_count,
  count(*) filter (where o.marker is not null) as useful_searches_count
from analytics.profile_activity_events s
left join lateral (
  select 1 as marker
  from analytics.profile_activity_events o
  where o.event_type = 'search_result_opened'
    and s.correlation_id is not null
    and o.correlation_id = s.correlation_id
  limit 1
) o on true
where s.event_type = 'search_performed'
group by 1;

-- Bilan d'impact par annee et par type : source directe du message public
-- « Impact Competences ISE 2027 : N stages facilites / N emplois / ... ».
create or replace view analytics.v_impact_summary_by_year as
select
  extract(year from (ie.occurred_at at time zone 'UTC'))::int as impact_year,
  ie.impact_type,
  ie.attribution_level,
  count(*) as impact_count
from analytics.impact_events ie
group by 1, 2, 3;

-- Bilan d'impact par promotion, agrege.
create or replace view analytics.v_impact_by_promotion as
select
  ie.promotion_id,
  pr.graduation_year,
  ie.impact_type,
  count(*) as impact_count
from analytics.impact_events ie
left join public.promotions pr on pr.id = ie.promotion_id
group by 1, 2, 3;

-- Volume d'activite produit, agrege par jour et par type d'evenement.
-- Aucune restitution par individu (MASTER PROMPT §42).
create or replace view analytics.v_activity_daily as
select
  (a.occurred_at at time zone 'UTC')::date as metric_date,
  a.event_type,
  count(*)                                 as event_count,
  count(distinct a.profile_id)             as distinct_profiles
from analytics.profile_activity_events a
group by 1, 2;


-- ---------------------------------------------------------------------
-- 6. Vue materialisee : metriques de promotion
--    Toutes les colonnes proviennent de tables existantes.
--    Rafraichissement par Cron quotidien (refresh materialized view
--    concurrently analytics.promotion_metrics).
-- ---------------------------------------------------------------------
create materialized view if not exists analytics.promotion_metrics as
select
  pr.id                                                             as promotion_id,
  pr.graduation_year,
  count(p.id)                                                       as referenced_count,
  count(p.id) filter (where p.claimed_at is not null)               as activated_count,
  count(p.id) filter (where p.verification_status = 'verified')     as verified_count,
  case
    when count(p.id) = 0 then 0::numeric
    else round(count(p.id) filter (where p.claimed_at is not null)::numeric / count(p.id), 4)
  end                                                               as activation_rate,
  count(distinct p.current_country_code)                            as country_count,
  count(distinct p.current_organization_id)                         as organization_count,
  now()                                                             as calculated_at
from public.promotions pr
left join public.ise_profiles p
  on p.promotion_id = pr.id and p.deleted_at is null
group by pr.id, pr.graduation_year;

create unique index if not exists promotion_metrics_uidx
  on analytics.promotion_metrics(promotion_id);

comment on materialized view analytics.promotion_metrics is
  'Metriques par promotion, calculees depuis ise_profiles. Taux d''activation reel, jamais estime (§98).';
