-- 0026_security_baseline_reassert
-- Applique le 2026-08-08 (version 20260808012353)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- Reaffirmation de la ligne de base de securite apres l'application
-- concurrente des lots 0007-0025. Idempotent, rejouable a volonte.

-- 1. Aucun privilege pour `anon` sur les donnees metier (D-73 : pas de web public en V1).
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

revoke all on schema private   from anon, authenticated;
revoke all on schema analytics from anon, authenticated;
revoke all on all tables in schema private   from anon, authenticated;
revoke all on all tables in schema analytics from anon, authenticated;
grant usage on schema private to authenticated;  -- necessaire aux helpers, sans acces aux tables

-- 2. RLS activee et forcee sur toute table `public`, y compris celles
--    creees apres 0020.
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('alter table public.%I force row level security', r.relname);
  end loop;
end $$;

-- 3. Les vues materialisees analytiques ne sont jamais servies au client.
do $$
declare r record;
begin
  for r in select matviewname from pg_matviews where schemaname = 'analytics' loop
    execute format('revoke all on analytics.%I from anon, authenticated', r.matviewname);
  end loop;
end $$;

-- 4. Controle : liste les objets qui violeraient la ligne de base.
create or replace function private.security_baseline_violations()
returns table (kind text, object_name text, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'rls_disabled', c.relname::text, 'table public sans RLS'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  union all
  select 'anon_grant', g.table_schema || '.' || g.table_name, 'privilege ' || g.privilege_type || ' accorde a anon'
  from information_schema.role_table_grants g
  where g.grantee = 'anon' and g.table_schema in ('public', 'private', 'analytics')
  union all
  select 'secdef_no_search_path', n.nspname || '.' || p.proname, 'SECURITY DEFINER sans search_path fige'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  union all
  select 'private_exposed', g.table_schema || '.' || g.table_name, 'schema prive accessible a authenticated'
  from information_schema.role_table_grants g
  where g.grantee = 'authenticated' and g.table_schema in ('private', 'analytics')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Controle de securite execute par la CI et les tests (MASTER PROMPT §80, §84). Doit renvoyer 0 ligne.';
