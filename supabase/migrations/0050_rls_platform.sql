-- =====================================================================
-- 0050_rls_platform
-- Ouverture des politiques RLS du lot « Plateforme » (0018), reglages de
-- promotion restants (0003, 0019), et EXTENSION du controle de securite.
--
-- `domain_events` reste VOLONTAIREMENT SANS AUCUNE POLITIQUE.
--   C'est le journal d'evenements de domaine : il porte, dans `payload`
--   (jsonb), la charge utile BRUTE de chaque evenement metier — donc, par
--   construction, des donnees appartenant a des tiers (identifiants de
--   profils, contenus de messages d'introduction, motifs de moderation).
--   Une politique de lecture, meme filtree sur `actor_profile_id`,
--   exposerait le payload d'evenements dont le membre n'est que l'ACTEUR
--   et non le destinataire, et la structure meme du bus interne. Le seul
--   consommateur legitime est le worker `service_role`, qui ne quitte
--   jamais le serveur (D-100). Une table de bus n'est pas une table de
--   lecture : elle reste fermee.
--
-- `platform_settings` : seule la portee `member` sort. La portee `admin`
--   porte des seuils d'exploitation (quotas, cles de configuration) qui
--   n'ont aucune raison d'atteindre un client.
-- `feature_flags` : seuls les drapeaux ACTIFS sortent. Un drapeau eteint
--   revelerait le nom d'une fonctionnalite non annoncee.
-- =====================================================================

-- ---------------------------------------------------------------------
-- platform_settings
-- ---------------------------------------------------------------------
drop policy if exists platform_settings_read_member on public.platform_settings;
create policy platform_settings_read_member on public.platform_settings
  for select to authenticated
  using (scope = 'member');

drop policy if exists platform_settings_manage on public.platform_settings;
create policy platform_settings_manage on public.platform_settings
  for all to authenticated
  using (private.has_permission('settings.manage'))
  with check (private.has_permission('settings.manage'));

comment on column public.platform_settings.scope is
  'Portee du reglage. `member` : lisible par tout membre authentifie. `admin` : reserve a `settings.manage`.';

-- ---------------------------------------------------------------------
-- feature_flags
-- ---------------------------------------------------------------------
drop policy if exists feature_flags_read_enabled on public.feature_flags;
create policy feature_flags_read_enabled on public.feature_flags
  for select to authenticated
  using (is_enabled);

drop policy if exists feature_flags_manage on public.feature_flags;
create policy feature_flags_manage on public.feature_flags
  for all to authenticated
  using (private.has_permission('settings.manage'))
  with check (private.has_permission('settings.manage'));

-- Une derogation nominative n'est lisible que par le membre qu'elle vise.
drop policy if exists feature_flag_overrides_own on public.feature_flag_overrides;
create policy feature_flag_overrides_own on public.feature_flag_overrides
  for select to authenticated
  using (profile_id = private.current_profile_id());

drop policy if exists feature_flag_overrides_manage on public.feature_flag_overrides;
create policy feature_flag_overrides_manage on public.feature_flag_overrides
  for all to authenticated
  using (private.has_permission('settings.manage'))
  with check (private.has_permission('settings.manage'));

-- ---------------------------------------------------------------------
-- maintenance_windows : la banniere doit atteindre tout le monde, mais
-- seules les fenetres a venir ou en cours sont pertinentes.
-- ---------------------------------------------------------------------
drop policy if exists maintenance_windows_read on public.maintenance_windows;
create policy maintenance_windows_read on public.maintenance_windows
  for select to authenticated
  using (status in ('scheduled', 'in_progress'));

drop policy if exists maintenance_windows_manage on public.maintenance_windows;
create policy maintenance_windows_manage on public.maintenance_windows
  for all to authenticated
  using (private.has_permission('ops.manage'))
  with check (private.has_permission('ops.manage'));

-- ---------------------------------------------------------------------
-- Animation des promotions (0003, 0019)
-- ---------------------------------------------------------------------
drop policy if exists promotion_activation_campaigns_manage on public.promotion_activation_campaigns;
create policy promotion_activation_campaigns_manage on public.promotion_activation_campaigns
  for all to authenticated
  using (private.has_permission('promotions.manage'))
  with check (private.has_permission('promotions.manage'));

drop policy if exists promotion_membership_confirmations_own on public.promotion_membership_confirmations;
create policy promotion_membership_confirmations_own on public.promotion_membership_confirmations
  for select to authenticated
  using (responder_profile_id = private.current_profile_id()
         or private.has_permission('promotions.manage'));

drop policy if exists promotion_membership_confirmations_create on public.promotion_membership_confirmations;
create policy promotion_membership_confirmations_create on public.promotion_membership_confirmations
  for insert to authenticated
  with check (responder_profile_id = private.current_profile_id()
              and private.is_active_member());

-- Agregat de promotion : jamais servi a un membre ordinaire.
drop policy if exists promotion_stat_snapshots_read on public.promotion_stat_snapshots;
create policy promotion_stat_snapshots_read on public.promotion_stat_snapshots
  for select to authenticated
  using (private.has_permission('promotions.manage')
         or private.has_permission('analytics.read'));

-- ---------------------------------------------------------------------
-- domain_events : aucune politique. Voir l'en-tete.
-- ---------------------------------------------------------------------
comment on table public.domain_events is
  'Bus d''evenements de domaine. VOLONTAIREMENT SANS POLITIQUE RLS : `payload` porte la charge utile '
  'brute d''evenements appartenant a des tiers. Seul `service_role` (worker serveur) y accede (D-100).';

-- ---------------------------------------------------------------------
-- EXTENSION DU CONTROLE DE SECURITE
--
-- Remplace la version de 0028 : meme structure, la liste des colonnes
-- masquees passe de UNE a SEPT entrees, avec le privilege concerne. Toute
-- reapparition d'un `GRANT` sur l'une d'elles fait echouer la CI, y compris
-- apres l'ajout d'une colonne a l'une de ces tables.
--
-- `events.online_url_private` n'est masquee QU'EN LECTURE : l'organisateur
-- doit pouvoir ecrire le lien.
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
  -- D-72 / MASTER PROMPT §15, §17 : colonnes que la RLS ne peut pas
  -- proteger, parce qu'elle filtre des lignes et non des colonnes.
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
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Controle de securite execute par la CI et les tests (MASTER PROMPT §80, §84). Doit renvoyer 0 ligne. '
  'Couvre 9 privileges de colonne masques (score de completion, scores de matching, lien prive d''evenement).';
