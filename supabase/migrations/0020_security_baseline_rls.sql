-- 0020_security_baseline_rls
-- Applique le 2026-08-08 (version 20260808005714)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0020_security_baseline_rls
-- 1. Tables manquantes (blocage entre membres, profils enregistres)
-- 2. Retrait total des privileges du role `anon` sur `public`
-- 3. Activation de RLS sur TOUTES les tables `public` -> refus par defaut
-- 4. Politiques de lecture des referentiels
--
-- MASTER PROMPT §11, §47, §71 ; docs/decisions.md D-73, D-100.
-- Principe : refus par defaut. Chaque tranche verticale ouvre explicitement
-- ce dont elle a besoin, et pas davantage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Blocage entre membres (signale manquant par le lot messagerie)
-- ---------------------------------------------------------------------
create table if not exists public.profile_blocks (
  blocker_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  reason             text,
  created_at         timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  constraint profile_blocks_not_self check (blocker_profile_id <> blocked_profile_id)
);
create index if not exists profile_blocks_blocked_idx on public.profile_blocks(blocked_profile_id);

comment on table public.profile_blocks is
  'Blocage unilateral. Effectif cote serveur : aucune sollicitation ne franchit un blocage.';

-- Vrai si l'un des deux profils a bloque l'autre, dans un sens ou dans l'autre.
create or replace function private.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_blocks b
    where (b.blocker_profile_id = p_a and b.blocked_profile_id = p_b)
       or (b.blocker_profile_id = p_b and b.blocked_profile_id = p_a)
  )
$$;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;

create table if not exists public.saved_profiles (
  profile_id       uuid not null references public.ise_profiles(id) on delete cascade,
  saved_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  note             text,
  created_at       timestamptz not null default now(),
  primary key (profile_id, saved_profile_id),
  constraint saved_profiles_not_self check (profile_id <> saved_profile_id)
);

-- ---------------------------------------------------------------------
-- 2. Le role `anon` n'a AUCUN acces aux donnees metier.
--    D-73 : aucun profil n'est visible sur le web public en V1.
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------
-- 3. RLS activee sur toutes les tables `public`, sans exception.
--    Sans politique, une table est totalement fermee : c'est l'etat voulu
--    tant que la tranche verticale correspondante n'est pas developpee.
--    `service_role` continue de contourner RLS (usage serveur uniquement).
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end
$$;

-- Force RLS meme pour le proprietaire des tables (defense en profondeur).
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relforcerowsecurity
  loop
    execute format('alter table public.%I force row level security', r.relname);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Referentiels : lecture ouverte a tout membre authentifie.
--    Ecriture reservee a la permission `settings.manage`.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  ref_tables text[] := array[
    'subregions', 'countries', 'languages', 'sectors', 'sector_adjacencies',
    'job_functions', 'expertise_areas', 'tools',
    'skill_domains', 'skill_categories', 'skills', 'skill_aliases',
    'availability_types', 'promotions', 'organizations', 'organization_aliases',
    'report_reasons', 'profile_visibility_defaults', 'profile_completion_rules',
    'news_categories', 'event_types', 'support_categories',
    'notification_types', 'domain_event_types'
  ];
begin
  foreach t in array ref_tables loop
    if to_regclass('public.' || t) is not null then
      execute format($p$
        drop policy if exists %1$I on public.%2$I;
        create policy %1$I on public.%2$I
          for select to authenticated
          using (true);
      $p$, t || '_read_authenticated', t);

      execute format($p$
        drop policy if exists %1$I on public.%2$I;
        create policy %1$I on public.%2$I
          for all to authenticated
          using (private.has_permission('settings.manage'))
          with check (private.has_permission('settings.manage'));
      $p$, t || '_manage_settings', t);
    end if;
  end loop;
end
$$;

-- Les referentiels taxonomiques metier sont administres par leurs permissions propres.
drop policy if exists promotions_manage on public.promotions;
create policy promotions_manage on public.promotions
  for all to authenticated
  using (private.has_permission('promotions.manage'))
  with check (private.has_permission('promotions.manage'));

-- ---------------------------------------------------------------------
-- 5. Garde-fou : signale toute table `public` sans RLS.
--    Utilise par les tests de securite (MASTER PROMPT §80).
-- ---------------------------------------------------------------------
create or replace function private.tables_without_rls()
returns table (table_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  order by 1
$$;

create or replace function private.tables_without_policy()
returns table (table_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  order by 1
$$;
