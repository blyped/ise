-- 0028_rls_fixes
-- Applique le 2026-08-08 (version 20260808041728)
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================
-- 0028_rls_fixes
-- Corrections des defauts reveles par supabase/tests/rls/0001_rls_negative_suite.sql.
-- N'EDITE NI 0020 NI 0021 : les politiques deja appliquees restent telles
-- quelles, cette migration ne fait qu'ajouter les garde-fous manquants.
--
-- Defauts corriges :
--   D1 (cas C07a) — `ise_profiles.profile_completion` etait lisible par tout
--        membre autorise a voir la ligne du profil. La RLS est un controle
--        de LIGNE : elle ne pouvait pas proteger cette colonne. Violation
--        directe de D-72 et du MASTER PROMPT §17.
--        Correctif : privilege de colonne (« colonne masquee »).
--   D2 (cas C07b) — consequence de D1 : le proprietaire lui-meme perdait
--        l'acces a son propre score. Correctif : accesseur dedie
--        `public.my_profile_completion()`.
--   D3 (cas C20b) — aucune voie d'acces au journal d'audit pour un porteur
--        de la permission `audit.read` : `private` n'est pas expose a
--        `authenticated`. La permission existait sans etre exploitable.
--        Correctif : `private.read_audit_log()`, journalisee elle-meme.
--
-- Reference : MASTER PROMPT §17, §40, §72, §80 ; D-72, D-100, D-101, D-102.
-- =====================================================================

-- ---------------------------------------------------------------------
-- D1. Masquage de `ise_profiles.profile_completion`
--
-- ATTENTION COTE CLIENT : `authenticated` n'a plus de privilege SELECT au
-- niveau TABLE sur `public.ise_profiles`, mais un privilege colonne par
-- colonne. Toute requete `select *` sur cette table echoue desormais avec
-- 42501. Les clients (PostgREST, Server Actions) doivent enumerer leurs
-- colonnes. C'est la contrepartie assumee d'une protection reelle.
-- ---------------------------------------------------------------------
do $$
declare
  v_cols text;
begin
  -- Lecture : toutes les colonnes sauf le score.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'ise_profiles'
    and column_name <> 'profile_completion';

  revoke select on public.ise_profiles from authenticated;
  execute format('grant select (%s) on public.ise_profiles to authenticated', v_cols);

  -- Ecriture : idem, et hors colonnes generees (non modifiables par nature).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'ise_profiles'
    and column_name <> 'profile_completion'
    and is_generated = 'NEVER';

  revoke update on public.ise_profiles from authenticated;
  execute format('grant update (%s) on public.ise_profiles to authenticated', v_cols);

  revoke insert on public.ise_profiles from authenticated;
  execute format('grant insert (%s) on public.ise_profiles to authenticated', v_cols);
end
$$;

comment on column public.ise_profiles.profile_completion is
  'Score PRIVE (D-72, MASTER PROMPT §17). Privilege de colonne retire a `authenticated` : '
  'il ne se lit que par public.my_profile_completion(), et ne s''ecrit que cote serveur.';

-- Accesseur du proprietaire.
-- SECURITY DEFINER justifie : la fonction lit une colonne dont le privilege
-- est retire a l'appelant, et ne peut renvoyer que la ligne de l'appelant
-- lui-meme (filtre `= private.current_profile_id()`, non parametrable).
create or replace function public.my_profile_completion()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select p.profile_completion
  from public.ise_profiles p
  where p.id = private.current_profile_id()
$$;

revoke all on function public.my_profile_completion() from public, anon;
grant execute on function public.my_profile_completion() to authenticated;

comment on function public.my_profile_completion() is
  'Score de completion du membre courant, et de lui seul (D-72). Aucun parametre : aucun tiers atteignable.';

-- ---------------------------------------------------------------------
-- D3. Lecture du journal d'audit par un porteur de `audit.read`
--
-- SECURITY DEFINER justifie : `private.audit_log` n'est expose a aucun role
-- client (D-16). La fonction resout l'autorisation par la permission
-- `audit.read` (jamais par un test de role en dur, D-31), borne le volume
-- retourne, et journalise sa propre execution (MASTER PROMPT §40 : l'acces
-- au journal est lui-meme un evenement auditable).
-- ---------------------------------------------------------------------
create or replace function private.read_audit_log(
  p_limit  integer     default 100,
  p_before timestamptz default null
)
returns table (
  id               bigint,
  created_at       timestamptz,
  actor_kind       text,
  actor_user_id    uuid,
  actor_profile_id uuid,
  action           text,
  object_type      text,
  object_id        text,
  result           text,
  error_code       text,
  correlation_id   text,
  request_ip       inet,
  user_agent       text,
  context          jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('audit.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform private.log_audit(
    p_action      => 'audit.read',
    p_object_type => 'audit_log',
    p_object_id   => null,
    p_result      => 'success',
    p_context     => jsonb_build_object('limit', v_limit, 'before', p_before)
  );

  return query
    select a.id, a.created_at, a.actor_kind, a.actor_user_id, a.actor_profile_id,
           a.action, a.object_type, a.object_id, a.result, a.error_code,
           a.correlation_id, a.request_ip, a.user_agent, a.context
    from private.audit_log a
    where (p_before is null or a.created_at < p_before)
    order by a.created_at desc, a.id desc
    limit v_limit;
end
$$;

revoke all on function private.read_audit_log(integer, timestamptz) from public, anon;
grant execute on function private.read_audit_log(integer, timestamptz) to authenticated;

comment on function private.read_audit_log(integer, timestamptz) is
  'Unique voie de lecture du journal d''audit pour un client. Exige `audit.read`, borne a 500 lignes, journalise son propre appel.';

-- ---------------------------------------------------------------------
-- Garde-fou : le controle de ligne de base verifie desormais aussi que les
-- colonnes declarees privees ne sont pas lisibles par `authenticated`.
-- Remplace la version de 0026 (ajout d'un seul controle, le reste a
-- l'identique). MASTER PROMPT §80, §84.
-- ---------------------------------------------------------------------
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
  union all
  -- D-72 : colonnes privees. La RLS ne filtre que des lignes ; ces colonnes
  -- doivent etre protegees par un privilege de colonne.
  select 'private_column_exposed',
         cp.table_schema || '.' || cp.table_name || '.' || cp.column_name,
         'privilege ' || cp.privilege_type || ' accorde a ' || cp.grantee
  from information_schema.column_privileges cp
  join (values ('public', 'ise_profiles', 'profile_completion'))
       as masked(s, t, c)
    on masked.s = cp.table_schema and masked.t = cp.table_name and masked.c = cp.column_name
  where cp.grantee in ('authenticated', 'anon')
    and cp.privilege_type in ('SELECT', 'UPDATE', 'INSERT')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Controle de securite execute par la CI et les tests (MASTER PROMPT §80, §84). Doit renvoyer 0 ligne.';
