-- =====================================================================
-- 0118_auth_link_events
--
-- CONTEXTE (D-161, provisioning des 252 comptes ISE, tache #140)
--   Aujourd'hui, RIEN ne journalise le clic sur un lien d'e-mail
--   Supabase (activation D-161, confirmation ISE-002, reinitialisation
--   ISE-003). Le seul proxy disponible est `auth.users.last_sign_in_at`
--   / `confirmed_at`, interroge hors application : il confond « jamais
--   clique » et « clique mais lien invalide/expire » (les deux donnent
--   `invited_and_signed_in = false`). C'est ce trou que cette migration
--   comble, en journalisant CHAQUE atterrissage sur
--   `apps/web/src/app/auth/callback/route.ts` — succes ET echec — plutot
--   que de se fier au seul etat final d'`auth.users`.
--
-- CE QUI EST AJOUTE
--   * private.auth_link_events — une ligne par atterrissage sur
--     /auth/callback, avec le type de lien (signup/invite/magiclink/
--     recovery/email_change/email pour le format `?token_hash=&type=`,
--     ou 'code' pour le flux PKCE `?code=` sans type explicite), le
--     resultat (success/error), le user_id resolu si possible (null
--     sinon : un jeton invalide ne resout jamais personne), et le code
--     d'erreur Supabase le cas echeant. Schema `private` : jamais
--     expose a l'API publique (coherent avec D-16).
--   * private.log_auth_link_event(...) — SECURITY DEFINER, search_path
--     fige, seule fonction qui ecrit dans la table. Valide p_link_type
--     et p_outcome contre les memes listes fermees que les CHECK de la
--     table (defense en profondeur). GRANT EXECUTE a `anon` ET
--     `authenticated` : /auth/callback peut etre atteinte par un
--     visiteur pas encore authentifie (lien invalide) ou tout juste
--     authentifie (lien valide), toujours via le client Supabase serveur
--     lie a la requete (jamais le service role).
--   * public.admin_list_auth_link_events(p_since) — exige
--     `promotions.manage` (meme permission que l'ecran campagnes
--     SA-011->015), resume agrege par (link_type, outcome) sur la
--     periode : nombre d'evenements + nombre de user_id distincts en
--     succes. Pas de pagination : un resume, pas une liste d'evenements
--     individuels.
--
-- ANON ET private.security_baseline_violations()
--   Accorder EXECUTE a anon sur une fonction SECURITY DEFINER est un
--   evenement surveille (D-125) : le controle `anon_function_grant` de
--   `private.security_baseline_violations()` fait echouer toute
--   migration qui elargit cette liste blanche sans la mettre a jour
--   explicitement. Avant cette migration, la liste blanche comptait
--   DOUZE fonctions (verifie en base : get_landing_carousel,
--   get_landing_sections, get_landing_news, get_landing_events,
--   get_landing_opportunities, get_landing_featured_profile,
--   get_landing_expertises, get_landing_partners, get_landing_stats,
--   record_public_landing_event, get_landing_carousel_settings,
--   get_landing_pillars — toutes des projections landing public-safe).
--   `log_auth_link_event` n'est PAS une projection landing, mais reste
--   public-safe par construction (aucune lecture, ecriture en boite
--   noire, validee contre des listes fermees) : elle rejoint la meme
--   liste blanche, qui passe a TREIZE fonctions. Documente en D-173.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table.
-- ---------------------------------------------------------------------
create table if not exists private.auth_link_events (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  link_type   text not null check (link_type in (
                'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email', 'code')),
  outcome     text not null check (outcome in ('success', 'error')),
  user_id     uuid references auth.users(id) on delete set null,
  error_code  text
);

create index if not exists auth_link_events_occurred_idx
  on private.auth_link_events (occurred_at desc);
create index if not exists auth_link_events_type_outcome_idx
  on private.auth_link_events (link_type, outcome);

comment on table private.auth_link_events is
  '0118. Une ligne par atterrissage sur /auth/callback (succes ET echec), pour distinguer « jamais clique » de « clique mais lien invalide/expire » (D-161, D-173). Schema prive, jamais expose a l''API publique.';
comment on column private.auth_link_events.link_type is
  'Type reel du lien Supabase (signup/invite/magiclink/recovery/email_change/email) ou ''code'' pour le flux PKCE sans type explicite.';
comment on column private.auth_link_events.user_id is
  'Utilisateur resolu si le jeton etait valide. Null si le jeton etait deja invalide/expire au moment du clic : on ne peut resoudre personne dans ce cas.';
comment on column private.auth_link_events.error_code is
  'Code d''erreur Supabase (error.code) si outcome = ''error''. Null en succes.';

-- Pas de RLS : meme convention que les autres tables du schema `private`
-- (private.profile_contacts, private.rate_limit_counters, etc.) —
-- jamais exposees a PostgREST, jamais accessibles a `authenticated`
-- directement (verifie par le controle `private_exposed` du meme
-- garde-fou). Seule la fonction SECURITY DEFINER ci-dessous y ecrit.

-- ---------------------------------------------------------------------
-- 2. Ecriture — seule fonction qui insere dans la table.
-- ---------------------------------------------------------------------
create or replace function private.log_auth_link_event(
  p_link_type  text,
  p_outcome    text,
  p_user_id    uuid default null,
  p_error_code text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Defense en profondeur : memes listes fermees que les CHECK de la
  -- table, verifiees ici AVANT l'insertion pour renvoyer une erreur
  -- explicite plutot qu'une violation de contrainte brute.
  if p_link_type not in (
       'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email', 'code') then
    raise exception 'invalid_link_type' using errcode = 'P0001';
  end if;
  if p_outcome not in ('success', 'error') then
    raise exception 'invalid_outcome' using errcode = 'P0001';
  end if;

  insert into private.auth_link_events (link_type, outcome, user_id, error_code)
  values (p_link_type, p_outcome, p_user_id, p_error_code);
end
$$;

revoke all on function private.log_auth_link_event(text, text, uuid, text) from public;
grant execute on function private.log_auth_link_event(text, text, uuid, text)
  to anon, authenticated, service_role;

comment on function private.log_auth_link_event(text, text, uuid, text) is
  '0118. Journalise un atterrissage sur /auth/callback (succes ou echec). Exposee a anon ET authenticated : appelee avant ou juste apres l''authentification par le lien lui-meme. Liste blanche anon_function_grant, D-173.';

-- ---------------------------------------------------------------------
-- 3. Lecture admin — resume agrege, permission promotions.manage.
-- ---------------------------------------------------------------------
create or replace function public.admin_list_auth_link_events(
  p_since timestamptz default now() - interval '30 days')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'linkType', t.link_type,
             'outcome', t.outcome,
             'eventCount', t.event_count,
             'distinctUsers', t.distinct_users)
           order by t.link_type, t.outcome),
         '[]'::jsonb)
    into v_rows
  from (
    select link_type, outcome,
           count(*) as event_count,
           count(distinct user_id) as distinct_users
    from private.auth_link_events
    where occurred_at >= p_since
    group by link_type, outcome
  ) t;

  return v_rows;
end
$$;

revoke all on function public.admin_list_auth_link_events(timestamptz) from public, anon;
grant execute on function public.admin_list_auth_link_events(timestamptz) to authenticated;

comment on function public.admin_list_auth_link_events(timestamptz) is
  '0118. Resume agrege des atterrissages sur /auth/callback (succes/echec par type de lien) sur la periode donnee (30 jours par defaut). Vue GLOBALE plateforme, non filtree par campagne. Exige promotions.manage.';

-- ---------------------------------------------------------------------
-- 4. Liste blanche anon de private.security_baseline_violations() :
--    log_auth_link_event rejoint les projections landing public-safe
--    deja autorisees a anon (passage de 12 a 13 fonctions, D-173).
-- ---------------------------------------------------------------------
create or replace function private.security_baseline_violations()
returns table(kind text, object_name text, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'rls_disabled', c.relname::text, 'table public sans RLS'
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  union all
  select 'anon_grant', g.table_schema || '.' || g.table_name, 'privilege ' || g.privilege_type || ' accorde a anon'
  from information_schema.role_table_grants g
  where g.grantee = 'anon' and g.table_schema in ('public', 'private', 'analytics')
  union all
  select 'secdef_no_search_path', n.nspname || '.' || p.proname, 'SECURITY DEFINER sans search_path fige'
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  union all
  select 'private_exposed', g.table_schema || '.' || g.table_name, 'schema prive accessible a authenticated'
  from information_schema.role_table_grants g
  where g.grantee = 'authenticated' and g.table_schema in ('private', 'analytics')
  union all
  select 'private_column_exposed',
         cp.table_schema || '.' || cp.table_name || '.' || cp.column_name,
         'privilege ' || cp.privilege_type || ' accorde a ' || cp.grantee
  from information_schema.column_privileges cp
  join (values
          ('public', 'ise_profiles',         'profile_completion', 'SELECT'),
          ('public', 'ise_profiles',         'profile_completion', 'UPDATE'),
          ('public', 'ise_profiles',         'profile_completion', 'INSERT'),
          ('public', 'network_call_matches', 'score',              'SELECT'),
          ('public', 'network_call_matches', 'component_scores',   'SELECT'),
          ('public', 'opportunity_matches',  'score',              'SELECT'),
          ('public', 'opportunity_matches',  'component_scores',   'SELECT'),
          ('public', 'mentorship_matches',   'score',              'SELECT'),
          ('public', 'events',               'online_url_private', 'SELECT')
       ) as masked(s, t, c, p)
    on masked.s = cp.table_schema
   and masked.t = cp.table_name
   and masked.c = cp.column_name
   and masked.p = cp.privilege_type
  where cp.grantee in ('authenticated', 'anon')
  union all
  select 'anon_function_grant', n.nspname || '.' || p.proname,
         'EXECUTE accorde a anon hors liste blanche des projections public-safe'
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname not in (
      'get_landing_carousel', 'get_landing_sections', 'get_landing_news',
      'get_landing_events', 'get_landing_opportunities', 'get_landing_featured_profile',
      'get_landing_expertises', 'get_landing_partners', 'get_landing_stats',
      'record_public_landing_event', 'get_landing_carousel_settings',
      'get_landing_pillars', 'log_auth_link_event')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Garde-fou CI (0058, etendu par 0118) : toute ligne renvoyee bloque une migration. Liste blanche anon passee a 13 fonctions : log_auth_link_event ajoute par 0118 (D-173), aux cotes des projections landing public-safe.';

-- ---------------------------------------------------------------------
-- 5. Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n integer;
begin
  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0118: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  if not pg_catalog.has_function_privilege(
       'anon', 'private.log_auth_link_event(text, text, uuid, text)', 'EXECUTE') then
    raise exception '0118: anon devrait avoir EXECUTE sur private.log_auth_link_event';
  end if;

  if pg_catalog.has_function_privilege(
       'anon', 'public.admin_list_auth_link_events(timestamptz)', 'EXECUTE') then
    raise exception '0118: anon ne devrait PAS avoir EXECUTE sur admin_list_auth_link_events';
  end if;
end
$verify$;
