-- =====================================================================
-- 0111_landing_carousel_autoplay_setting
-- Reglage administratif de la duree de rotation automatique du
-- carrousel de la page d'accueil publique (D-163).
--
-- CONTEXTE
--   La duree etait figee en dur cote client (`AUTOPLAY_MS = 7000` dans
--   LandingCarousel.tsx). Le porteur du projet demande un reglage
--   accessible sans toucher au code.
--
--   Cette migration ne cree PAS de nouvelle table ni de nouvelle
--   colonne : elle reutilise `platform_settings` (0018, API admin
--   generique `admin_list_platform_settings`/`admin_upsert_platform_setting`
--   de 0082, ecran `/administration/parametres`, SA-048), deja generique
--   (cle/valeur libres) et deja pourvue d'un ecran d'edition qui ne
--   necessite AUCUN developpement supplementaire. C'est un reglage
--   GLOBAL de la landing (D-163), pas un attribut par diapositive de
--   `cms_carousel_items` : il n'a donc pas sa place sur cette table.
--
--   `cms_sections` (section_key = 'hero_carousel', colonne `configuration`
--   jsonb) a ete ecarte : cette ligne reste `status = 'draft'`, sans
--   `published_snapshot`, et n'est donc jamais retournee par
--   `get_landing_sections()` (filtre `status = 'published'`) ; sa
--   colonne `configuration` n'est de toute facon ni exposee par
--   `apps/web/src/app/cms/sections/SectionEditor.tsx` ni consommee par
--   `apps/web/src/lib/public/landing-data.ts` (`sectionConfigSchema` ne
--   la retient pas). La reutiliser aurait exige de rouvrir trois couches
--   mortes pour un gain nul face a `platform_settings`.
--
-- SURFACE ANON
--   La landing publique doit pouvoir LIRE ce reglage sans lire
--   `platform_settings` en entier (qui portera d'autres cles non
--   publiques a l'avenir). Une dixieme projection `get_landing_*` est
--   ajoutee, `get_landing_carousel_settings()`, sur le meme modele que
--   les neuf projections de 0061 (SECURITY DEFINER, search_path fige,
--   lecture bornee). La liste blanche du controle `anon_function_grant`
--   (`private.security_baseline_violations()`, derniere forme 0063) est
--   etendue de dix a onze noms dans le meme mouvement : sans cette
--   extension, le controle de securite signalerait lui-meme la nouvelle
--   fonction comme une fuite au premier appel.
-- =====================================================================

insert into public.platform_settings (key, value, value_kind, scope, description)
values (
  'landing.hero_carousel.autoplay_seconds',
  '7'::jsonb,
  'number',
  'member',
  'Duree, en secondes, entre deux diapositives du carrousel de la page d''accueil publique. Bornee entre 3 et 60 secondes a la lecture (public.get_landing_carousel_settings). Modifiable depuis /administration/parametres.'
)
on conflict (key) do nothing;

create or replace function public.get_landing_carousel_settings()
returns jsonb
language sql
stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'autoplay_seconds',
    greatest(3, least(60, coalesce((
      select (value #>> '{}')::integer
      from public.platform_settings
      where key = 'landing.hero_carousel.autoplay_seconds'
    ), 7)))
  )
$$;

comment on function public.get_landing_carousel_settings() is
  'PUB-001 : reglages d''affichage du carrousel (duree de rotation automatique, en secondes, bornee 3-60). Lit platform_settings sans exposer la table (D-163).';

revoke all on function public.get_landing_carousel_settings() from public;
grant execute on function public.get_landing_carousel_settings() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Garde-fou de securite (0061/0062/0063) : etendre la liste blanche
-- `anon_function_grant` a la nouvelle projection. Corps identique a la
-- forme live (derniere reecriture : 0063), seule la liste `not in (...)`
-- change.
-- ---------------------------------------------------------------------
create or replace function private.security_baseline_violations()
returns table(kind text, object_name text, detail text)
language sql
stable security definer
set search_path to ''
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
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname not in (
      'get_landing_carousel', 'get_landing_sections', 'get_landing_news',
      'get_landing_events', 'get_landing_opportunities', 'get_landing_featured_profile',
      'get_landing_expertises', 'get_landing_partners', 'get_landing_stats',
      'record_public_landing_event', 'get_landing_carousel_settings')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Controle de securite (0061-0063, D-125) : liste blanche anon etendue a onze projections public-safe par 0111 (get_landing_carousel_settings, D-163).';
