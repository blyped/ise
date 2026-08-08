-- =====================================================================
-- 0018_platform_audit_events
-- Journal d'audit, evenements de domaine, parametres de plateforme,
-- indicateurs de fonctionnalite et fenetres de maintenance.
--
-- Sources : DIGEST A parties X et Y, §5.5 a §5.7 ; MASTER PROMPT §39, §40,
--           §41, §52, §64 ; docs/decisions.md D-13, D-16, D-100, D-102, D-103.
--
-- REGLES STRUCTURANTES
--   * MASTER PROMPT §40 : un evenement d'audit porte acteur, action, type
--     d'objet, identifiant, horodatage, resultat, contexte minimal et
--     correlation_id. AUCUN secret n'y est enregistre : `private.log_audit()`
--     filtre les cles sensibles avant insertion.
--   * MASTER PROMPT §52 : un evenement de domaine est enregistre de maniere
--     fiable AVANT tout traitement asynchrone (table-relais / outbox).
--   * Le RBAC (`private.roles`, `private.permissions`, `private.role_permissions`,
--     `private.user_roles`) existe depuis 0004 : rien n'est recree ici.
--   * Aucune RLS ni policy ici : migration dediee ulterieure.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Journal d'audit  (schema private, jamais expose)
--    Append-only : pas de `updated_at`, aucune mise a jour prevue.
-- ---------------------------------------------------------------------
create table if not exists private.audit_log (
  id                bigint generated always as identity primary key,

  -- Acteur : compte Auth et/ou profil, ou traitement automatique.
  actor_kind        text not null default 'user'
                      check (actor_kind in ('user', 'system', 'job', 'service')),
  actor_user_id     uuid references auth.users(id) on delete set null,
  actor_profile_id  uuid references public.ise_profiles(id) on delete set null,

  -- Action et objet vises. `object_id` est du texte : les objets audites
  -- appartiennent a plusieurs schemas et portent des cles uuid ou bigint.
  action            text not null,
  object_type       text not null,
  object_id         text,

  -- Resultat de l'operation.
  result            text not null default 'success'
                      check (result in ('success', 'failure', 'denied')),
  error_code        text,

  -- Contexte MINIMAL. Jamais de mot de passe, de token, de cle ni de
  -- contenu de message prive : private.log_audit() retire ces cles.
  context           jsonb not null default '{}'::jsonb,

  correlation_id    text,
  request_ip        inet,
  user_agent        text,

  created_at        timestamptz not null default now(),

  constraint audit_log_actor_required check (
    actor_kind <> 'user' or actor_user_id is not null or actor_profile_id is not null
  )
);

create index if not exists audit_log_created_idx     on private.audit_log(created_at desc);
create index if not exists audit_log_actor_user_idx  on private.audit_log(actor_user_id)
  where actor_user_id is not null;
create index if not exists audit_log_actor_profile_idx on private.audit_log(actor_profile_id)
  where actor_profile_id is not null;
create index if not exists audit_log_object_idx      on private.audit_log(object_type, object_id);
create index if not exists audit_log_action_idx      on private.audit_log(action, created_at desc);
create index if not exists audit_log_correlation_idx on private.audit_log(correlation_id)
  where correlation_id is not null;

comment on table private.audit_log is
  'Journal d''audit append-only (MASTER PROMPT §40). Aucun secret, aucun contenu prive.';
comment on column private.audit_log.context is
  'Contexte minimal non sensible. Les cles ressemblant a un secret sont supprimees par private.log_audit().';


-- ---------------------------------------------------------------------
-- 2. private.log_audit() — point d'entree unique de journalisation
--    Reutilisable par toutes les fonctions metier et par les Edge Functions.
-- ---------------------------------------------------------------------
create or replace function private.log_audit(
  p_action          text,
  p_object_type     text,
  p_object_id       text    default null,
  p_result          text    default 'success',
  p_context         jsonb   default '{}'::jsonb,
  p_correlation_id  text    default null,
  p_actor_profile_id uuid   default null,
  p_error_code      text    default null,
  p_actor_kind      text    default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid := auth.uid();
  v_profile_id uuid := coalesce(p_actor_profile_id, private.current_profile_id());
  v_kind       text;
  v_context    jsonb;
  v_id         bigint;
begin
  if p_action is null or p_object_type is null then
    raise exception 'audit_action_required' using errcode = 'P0001';
  end if;

  v_kind := coalesce(
    p_actor_kind,
    case when v_user_id is null and v_profile_id is null then 'system' else 'user' end
  );

  -- Filtrage des secrets : toute cle evoquant un identifiant d'authentification
  -- est retiree du contexte avant ecriture (MASTER PROMPT §40).
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_context
  from jsonb_each(coalesce(p_context, '{}'::jsonb)) as e(key, value)
  where lower(e.key) !~ '(password|passwd|secret|token|api[_-]?key|apikey|authorization|cookie|jwt|otp|private[_-]?key|service[_-]?role|session|credential|signature)';

  -- Le contexte reste minimal : au-dela d'une taille raisonnable, on ne
  -- conserve qu'un marqueur plutot que de recopier une charge utile entiere.
  if length(v_context::text) > 4000 then
    v_context := jsonb_build_object('truncated', true, 'original_keys', (
      select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(v_context) as k
    ));
  end if;

  insert into private.audit_log (
    actor_kind, actor_user_id, actor_profile_id,
    action, object_type, object_id,
    result, error_code, context, correlation_id
  )
  values (
    v_kind, v_user_id, v_profile_id,
    p_action, p_object_type, p_object_id,
    coalesce(p_result, 'success'), p_error_code, v_context, p_correlation_id
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function private.log_audit(text, text, text, text, jsonb, text, uuid, text, text) from public;

comment on function private.log_audit(text, text, text, text, jsonb, text, uuid, text, text) is
  'Ecrit un evenement d''audit. Determine l''acteur, filtre les secrets, borne le contexte. MASTER PROMPT §40.';


-- ---------------------------------------------------------------------
-- 3. Evenements de domaine (relais fiable avant traitement asynchrone)
-- ---------------------------------------------------------------------

-- Catalogue des types d'evenements. Liste evolutive => table de reference
-- (conventions §4), pas un CHECK fige.
create table if not exists public.domain_event_types (
  code          text primary key,
  description   text not null,
  aggregate     text not null,
  is_active     boolean not null default true,
  sort_order    integer not null default 0
);

comment on table public.domain_event_types is
  'Catalogue des evenements de domaine. Union du MASTER PROMPT §52 et de la liste [16 §151].';

insert into public.domain_event_types (code, description, aggregate, sort_order) values
  -- MASTER PROMPT §52
  ('profile.claimed',             'Un profil reference a ete reclame.',                  'profile',       10),
  ('profile.updated',             'Un profil a ete modifie par son proprietaire.',        'profile',       20),
  ('connection.requested',        'Une demande de relation a ete envoyee.',               'connection',    30),
  ('connection.accepted',         'Une demande de relation a ete acceptee.',              'connection',    40),
  ('introduction.requested',      'Une introduction a ete demandee.',                     'introduction',  50),
  ('introduction.accepted',       'L''intermediaire a accepte de presenter.',             'introduction',  60),
  ('introduction.completed',      'L''introduction a ete declaree aboutie.',              'introduction',  70),
  ('network_call.created',        'Un appel au reseau a ete publie.',                     'network_call',  80),
  ('network_call.responded',      'Une reponse a ete apportee a un appel au reseau.',     'network_call',  90),
  ('opportunity.created',         'Une opportunite a ete publiee.',                       'opportunity',  100),
  ('mentorship.matched',          'Un binome de mentorat a ete constitue.',               'mentorship',   110),
  ('message.created',             'Un message a ete envoye.',                             'message',      120),
  ('event.registration_created',  'Une inscription a un evenement a ete enregistree.',    'event',        130),
  -- Complements du digest [16 §151] : evenements decrits par les documents
  -- et sans equivalent dans la liste du MASTER PROMPT.
  ('profile.verified',            'Un profil a ete verifie par un administrateur.',       'profile',      140),
  ('network_call.resolved',       'Un appel au reseau a ete cloture par son auteur.',     'network_call', 150),
  ('application.submitted',       'Une candidature a ete deposee.',                       'application',  160),
  ('application.selected',        'Une candidature a ete retenue.',                       'application',  170),
  ('internship.placed',           'Un placement de stage a ete confirme.',                'internship',   180),
  ('mentorship.started',          'Un mentorat a demarre.',                               'mentorship',   190),
  ('mentorship.completed',        'Un mentorat a ete cloture.',                           'mentorship',   200),
  ('project.completed',           'Un projet a ete cloture.',                             'project',      210)
on conflict (code) do nothing;


create table if not exists public.domain_events (
  id                uuid primary key default extensions.gen_random_uuid(),

  event_type        text not null references public.domain_event_types(code),
  aggregate_type    text not null,
  aggregate_id      uuid,

  actor_profile_id  uuid references public.ise_profiles(id) on delete set null,

  -- Charge utile strictement structurelle : identifiants et codes.
  -- JAMAIS de contenu de message, de coordonnee ni de document (MASTER PROMPT §24).
  payload           jsonb not null default '{}'::jsonb,

  correlation_id    text,
  -- Cle d'idempotence : evite le doublon d'evenement en cas de rejeu.
  dedupe_key        text,

  -- Relais fiable : l'evenement est enregistre dans la transaction metier,
  -- puis consomme par les traitements asynchrones (queues, notifications).
  status            text not null default 'pending'
                      check (status in ('pending', 'processing', 'processed', 'failed')),
  attempts          integer not null default 0 check (attempts >= 0),
  last_error_code   text,

  occurred_at       timestamptz not null default now(),
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),

  constraint domain_events_processed_coherence check (
    (status = 'processed') = (processed_at is not null)
  )
);

create index if not exists domain_events_pending_idx
  on public.domain_events(occurred_at, id) where status = 'pending';
create index if not exists domain_events_type_idx
  on public.domain_events(event_type, occurred_at desc);
create index if not exists domain_events_aggregate_idx
  on public.domain_events(aggregate_type, aggregate_id);
create index if not exists domain_events_actor_idx
  on public.domain_events(actor_profile_id) where actor_profile_id is not null;
create index if not exists domain_events_correlation_idx
  on public.domain_events(correlation_id) where correlation_id is not null;
create unique index if not exists domain_events_dedupe_uidx
  on public.domain_events(dedupe_key) where dedupe_key is not null;

comment on table public.domain_events is
  'Relais d''evenements de domaine (MASTER PROMPT §52). Enregistre avant tout traitement asynchrone.';
comment on column public.domain_events.payload is
  'Identifiants et codes uniquement. Aucun contenu de message, aucune coordonnee, aucun secret.';


-- ---------------------------------------------------------------------
-- 4. Parametres de plateforme
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  key                     text primary key,
  value                   jsonb not null,
  value_kind              text not null default 'json'
                            check (value_kind in ('string', 'number', 'boolean', 'json')),
  -- `member` : lisible par les membres authentifies (ex. bandeau, limites UI).
  -- `admin`  : reserve au back-office.
  scope                   text not null default 'admin'
                            check (scope in ('member', 'admin')),
  description             text not null,
  updated_by_profile_id   uuid references public.ise_profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Interdiction explicite : aucun secret en base (D-100). Les cles d'API et
  -- jetons vivent dans les variables d'environnement serveur.
  constraint platform_settings_no_secret_key check (
    lower(key) !~ '(password|secret|token|api[_-]?key|apikey|private[_-]?key|service[_-]?role|credential)'
  )
);

select private.attach_updated_at('public', 'platform_settings');

comment on table public.platform_settings is
  'Parametres d''exploitation modifiables par le back-office. Aucun secret (D-100) : les secrets restent cote serveur.';


-- ---------------------------------------------------------------------
-- 5. Indicateurs de fonctionnalite (feature flags)
-- ---------------------------------------------------------------------
create table if not exists public.feature_flags (
  code                text primary key,
  name                text not null,
  description         text,
  is_enabled          boolean not null default false,
  -- `off` : desactive · `all` : tout le monde · `role` : porteurs d'un role
  -- · `profile_list` : liste explicite · `percentage` : deploiement progressif.
  rollout_strategy    text not null default 'off'
                        check (rollout_strategy in ('off', 'all', 'role', 'profile_list', 'percentage')),
  -- Code de role RBAC (private.roles.code). Reference logique volontairement
  -- non contrainte : le schema private n'est pas expose a la Data API.
  target_role_code    text,
  rollout_percentage  smallint check (rollout_percentage is null or rollout_percentage between 0 and 100),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint feature_flags_role_strategy check (
    rollout_strategy <> 'role' or target_role_code is not null
  ),
  constraint feature_flags_percentage_strategy check (
    rollout_strategy <> 'percentage' or rollout_percentage is not null
  )
);

select private.attach_updated_at('public', 'feature_flags');

comment on table public.feature_flags is
  'Activation progressive de fonctionnalites. La strategie est evaluee cote serveur, jamais par un if client.';


-- Derogation nominative a un indicateur (D-15 : PK composite).
create table if not exists public.feature_flag_overrides (
  flag_code     text not null references public.feature_flags(code) on delete cascade,
  profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  is_enabled    boolean not null,
  reason        text,
  created_at    timestamptz not null default now(),
  primary key (flag_code, profile_id)
);

create index if not exists feature_flag_overrides_profile_idx
  on public.feature_flag_overrides(profile_id);


-- ---------------------------------------------------------------------
-- 6. Fenetres de maintenance
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_windows (
  id                    uuid primary key default extensions.gen_random_uuid(),
  title                 text not null,
  description           text,
  -- Message affiche aux membres. Aucun engagement chiffre invente (§98) :
  -- seules les dates reellement planifiees sont annoncees.
  banner_message        text,

  affected_scope        text not null default 'all'
                          check (affected_scope in ('all', 'web', 'mobile', 'imports', 'notifications', 'search', 'messaging')),
  is_read_only          boolean not null default false,

  status                text not null default 'scheduled'
                          check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),

  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  actual_started_at     timestamptz,
  actual_ended_at       timestamptz,

  created_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint maintenance_windows_period check (ends_at > starts_at),
  constraint maintenance_windows_actual_period check (
    actual_ended_at is null or actual_started_at is not null
  )
);

create index if not exists maintenance_windows_period_idx
  on public.maintenance_windows(starts_at, ends_at)
  where status in ('scheduled', 'in_progress');
create index if not exists maintenance_windows_status_idx
  on public.maintenance_windows(status);

select private.attach_updated_at('public', 'maintenance_windows');

comment on table public.maintenance_windows is
  'Fenetres de maintenance annoncees. Les horaires affiches sont ceux reellement planifies (MASTER PROMPT §98).';
