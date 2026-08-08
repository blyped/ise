-- 0004_rbac_and_helpers
-- Applique le 2026-08-08 (version 20260808003224)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
create table if not exists private.roles (
  id            smallint generated always as identity primary key,
  code          text not null unique,
  name          text not null,
  description   text,
  is_admin_role boolean not null default false,
  sort_order    integer not null default 0
);

create table if not exists private.permissions (
  id          smallint generated always as identity primary key,
  code        text not null unique,
  domain      text not null,
  action      text not null,
  description text,
  unique (domain, action)
);

create table if not exists private.role_permissions (
  role_id       smallint not null references private.roles(id) on delete cascade,
  permission_id smallint not null references private.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists private.user_roles (
  profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  role_id    smallint not null references private.roles(id) on delete cascade,
  granted_by uuid references public.ise_profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (profile_id, role_id)
);
create index if not exists user_roles_profile_idx on private.user_roles(profile_id);
create index if not exists user_roles_role_idx    on private.user_roles(role_id);

create table if not exists private.rate_limit_counters (
  subject_key  text not null,
  action_key   text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (subject_key, action_key, window_start)
);
create index if not exists rate_limit_counters_window_idx
  on private.rate_limit_counters(window_start);

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.ise_profiles p
  where p.user_id = (select auth.uid())
    and p.deleted_at is null
  limit 1
$$;

comment on function private.current_profile_id() is
  'Profil ISE du compte authentifie courant. NULL si non authentifie ou profil non reclame.';

create or replace function private.has_role(p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles ur
    join private.roles r on r.id = ur.role_id
    join public.ise_profiles p on p.id = ur.profile_id
    where p.user_id = (select auth.uid())
      and r.code = p_role_code
      and (ur.expires_at is null or ur.expires_at > now())
  )
$$;

create or replace function private.has_permission(p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles ur
    join private.role_permissions rp on rp.role_id = ur.role_id
    join private.permissions perm on perm.id = rp.permission_id
    join public.ise_profiles p on p.id = ur.profile_id
    where p.user_id = (select auth.uid())
      and perm.code = p_permission_code
      and (ur.expires_at is null or ur.expires_at > now())
  )
$$;

comment on function private.has_permission(text) is
  'Unique point de resolution des autorisations (D-31). Ne jamais tester un role en dur dans une policy.';

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles ur
    join private.roles r on r.id = ur.role_id
    join public.ise_profiles p on p.id = ur.profile_id
    where p.user_id = (select auth.uid())
      and r.is_admin_role
      and (ur.expires_at is null or ur.expires_at > now())
  )
$$;

create or replace function private.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ise_profiles p
    where p.user_id = (select auth.uid())
      and p.claim_status = 'claimed'
      and p.profile_status = 'active'
      and p.deleted_at is null
  )
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.has_role(text)        to authenticated;
grant execute on function private.has_permission(text)  to authenticated;
grant execute on function private.is_admin()            to authenticated;
grant execute on function private.is_active_member()    to authenticated;
revoke all on all tables in schema private from authenticated, anon;

insert into private.roles (code, name, description, is_admin_role, sort_order) values
  ('member',           'Membre',                   'ISE diplome ayant reclame son profil.',                    false, 10),
  ('student',          'Eleve ISE',                'Eleve en cours de scolarite (promotion sortante).',        false, 20),
  ('promotion_manager','Delegue de promotion',     'Anime sa promotion, valide les appartenances.',            false, 30),
  ('moderator',        'Moderateur',               'Traite les signalements et modere les contenus.',          true,  40),
  ('content_manager',  'Gestionnaire de contenus', 'Publie actualites et evenements.',                         true,  50),
  ('import_manager',   'Gestionnaire des imports', 'Execute et revoit les imports d''annuaire.',               true,  60),
  ('support_agent',    'Agent de support',         'Traite les tickets d''assistance.',                        true,  70),
  ('analyst',          'Analyste',                 'Acces lecture aux tableaux de bord analytiques agreges.',  true,  80),
  ('ops',              'Exploitation',             'Supervision technique de la plateforme.',                  true,  90),
  ('superadmin',       'Superadministrateur',      'Acces complet, journalise.',                               true, 100)
on conflict (code) do nothing;

insert into private.permissions (code, domain, action, description) values
  ('profiles.read',        'profiles',      'read',      'Consulter les profils au-dela de la visibilite membre.'),
  ('profiles.edit',        'profiles',      'edit',      'Modifier administrativement un profil.'),
  ('profiles.moderate',    'profiles',      'moderate',  'Suspendre, archiver, fusionner un profil.'),
  ('profiles.verify',      'profiles',      'verify',    'Valider une reclamation ou une verification.'),
  ('promotions.manage',    'promotions',    'manage',    'Creer et administrer les promotions.'),
  ('calls.moderate',       'calls',         'moderate',  'Moderer les appels au reseau.'),
  ('opportunities.manage', 'opportunities', 'manage',    'Administrer les opportunites et les stages.'),
  ('communities.manage',   'communities',   'manage',    'Administrer les communautes.'),
  ('projects.manage',      'projects',      'manage',    'Administrer les projets et consortiums.'),
  ('mentorship.manage',    'mentorship',    'manage',    'Administrer le mentorat.'),
  ('events.manage',        'events',        'manage',    'Administrer les evenements.'),
  ('content.publish',      'content',       'publish',   'Publier des actualites et contenus editoriaux.'),
  ('imports.execute',      'imports',       'execute',   'Lancer un import d''annuaire.'),
  ('imports.review',       'imports',       'review',    'Revoir les lignes et les doublons d''un import.'),
  ('support.manage',       'support',       'manage',    'Traiter les tickets et les signalements.'),
  ('analytics.read',       'analytics',     'read',      'Consulter les tableaux de bord agreges.'),
  ('settings.manage',      'settings',      'manage',    'Modifier les parametres de la plateforme.'),
  ('audit.read',           'audit',         'read',      'Consulter le journal d''audit.'),
  ('roles.manage',         'roles',         'manage',    'Attribuer et retirer des roles.'),
  ('ops.read',             'ops',           'read',      'Consulter l''etat technique de la plateforme.'),
  ('ops.manage',           'ops',           'manage',    'Agir sur les traitements, files et maintenances.')
on conflict (code) do nothing;

insert into private.role_permissions (role_id, permission_id)
select r.id, p.id from private.roles r cross join private.permissions p
where r.code = 'superadmin'
on conflict do nothing;

insert into private.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('moderator',         array['profiles.read','profiles.moderate','calls.moderate','communities.manage','support.manage']),
  ('content_manager',   array['content.publish','events.manage']),
  ('import_manager',    array['imports.execute','imports.review','profiles.read','profiles.edit','promotions.manage']),
  ('support_agent',     array['support.manage','profiles.read']),
  ('analyst',           array['analytics.read']),
  ('ops',               array['ops.read','ops.manage','analytics.read']),
  ('promotion_manager', array['profiles.verify'])
) as v(role_code, perms)
join private.roles r on r.code = v.role_code
join private.permissions p on p.code = any (v.perms)
on conflict do nothing;
