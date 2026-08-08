-- =====================================================================
-- 0063_public_landing_analytics
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- Analytics du site public (ADDENDUM §50, §51 ; CDC additionnel §43, §44).
--
-- AUCUNE METRIQUE INVENTEE (addendum §51, MASTER PROMPT §98).
--   Impressions, clics et CTR se CALCULENT depuis les evenements
--   reellement enregistres. Zero impression => CTR NULL, jamais 0 % ni un
--   taux d'illustration.
--
-- PAS DE TRACKING INVASIF (CDC §43).
--   Aucune adresse IP, aucun empreinte de navigateur, aucun identifiant
--   publicitaire. Un visiteur anonyme reste anonyme : `profile_id` est NULL.
--   `metadata` est borne a quelques cles structurelles et plafonne en taille.
--
-- REUTILISATION : la table analytics.profile_activity_events (0019) accueille
-- les huit nouveaux types. Aucune table d'evenements publics n'est creee :
-- ce serait un second entrepot a reconcilier.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Elargissement du vocabulaire d'evenements (D-13).
--    Remplacement de la contrainte CHECK de 0019, sur le modele de D-118 :
--    les quinze valeurs d'origine sont conservees a l'identique, huit sont
--    ajoutees. Aucune ligne existante n'est invalidee.
--    Nouvelle decision : D-121.
-- ---------------------------------------------------------------------
alter table analytics.profile_activity_events
  drop constraint if exists profile_activity_events_event_type_check;

alter table analytics.profile_activity_events
  add constraint profile_activity_events_event_type_check
  check (event_type in (
    'search_performed', 'search_result_opened', 'profile_viewed',
    'connection_requested', 'introduction_requested',
    'network_call_created', 'network_call_resolved',
    'opportunity_viewed', 'application_submitted',
    'mentor_requested', 'internship_placed', 'project_created',
    'event_registered', 'profile_claimed', 'profile_updated',
    'public_landing_view', 'public_content_click', 'public_login_click',
    'public_claim_profile_click', 'public_partner_impression',
    'public_partner_click', 'public_to_login', 'public_login_redirect_success'));

comment on constraint profile_activity_events_event_type_check on analytics.profile_activity_events is
  'Vocabulaire ferme des evenements produit. Etendu en 0063 aux huit evenements publics de PUB-001 (addendum §50). Les quinze valeurs de 0019 sont conservees.';

create index if not exists profile_activity_events_public_entity_idx
  on analytics.profile_activity_events (entity_type, entity_id, event_type, occurred_at desc)
  where entity_id is not null;

-- ---------------------------------------------------------------------
-- 2. ENREGISTREMENT DEPUIS LE SITE PUBLIC
--
--    `anon` n'a aucun privilege sur `analytics` (0026) et n'en recevra
--    aucun : cette fonction SECURITY DEFINER est le seul chemin d'ecriture.
--    Elle n'accepte QUE les huit types publics, ne recopie que des cles
--    structurelles connues, et ne stocke jamais de texte libre.
-- ---------------------------------------------------------------------
create or replace function public.record_public_landing_event(
  p_event_type     text,
  p_entity_type    text    default null,
  p_entity_id      uuid    default null,
  p_correlation_id text    default null,
  p_metadata       jsonb   default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
begin
  if p_event_type not in (
       'public_landing_view', 'public_content_click', 'public_login_click',
       'public_claim_profile_click', 'public_partner_impression',
       'public_partner_click', 'public_to_login', 'public_login_redirect_success') then
    raise exception 'unknown_event_type' using errcode = 'P0002';
  end if;

  -- Liste blanche de cles STRUCTURELLES. Tout le reste est jete : aucune
  -- chaine libre venue du navigateur n'entre dans l'entrepot.
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_meta
  from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) as e(key, value)
  where e.key in ('section_key', 'placement', 'device', 'position', 'content_type')
    and jsonb_typeof(e.value) in ('string', 'number', 'boolean')
    and length(e.value::text) <= 64;

  insert into analytics.profile_activity_events
    (profile_id, event_type, entity_type, entity_id, correlation_id, metadata)
  values
    (private.current_profile_id(), p_event_type, p_entity_type, p_entity_id,
     left(p_correlation_id, 64), v_meta);

  return true;
end
$$;

revoke all on function public.record_public_landing_event(text, text, uuid, text, jsonb) from public;
grant execute on function public.record_public_landing_event(text, text, uuid, text, jsonb)
  to anon, authenticated, service_role;

comment on function public.record_public_landing_event(text, text, uuid, text, jsonb) is
  'Unique chemin d''ecriture des evenements publics de PUB-001 (addendum §50). Huit types autorises, metadonnees limitees a cinq cles structurelles, aucune IP ni empreinte : le visiteur anonyme reste anonyme (CDC §43).';

-- ---------------------------------------------------------------------
-- 3. METRIQUES PARTENAIRES (addendum §51 ; CDC §44)
--    Impressions et clics COMPTES. CTR calcule seulement s'il existe des
--    impressions reelles ; NULL sinon. Jamais 0 % de complaisance.
-- ---------------------------------------------------------------------
create or replace function public.get_partner_campaign_metrics(
  p_campaign_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('cms.partners.manage') or private.has_permission('analytics.read')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(m)::jsonb order by m.campaign_name), '[]'::jsonb)
    into v
  from (
    select pc.id            as campaign_id,
           pc.campaign_name,
           pc.placement,
           pc.status,
           pc.start_at,
           pc.end_at,
           pc.sponsored_label,
           counts.impressions,
           counts.clicks,
           case when counts.impressions > 0
                then round(counts.clicks::numeric / counts.impressions, 4)
           end as ctr,
           'analytics.profile_activity_events (public_partner_impression / public_partner_click)'
             as metrics_source
    from public.cms_partner_campaigns pc
    cross join lateral (
      select
        count(*) filter (where a.event_type = 'public_partner_impression') as impressions,
        count(*) filter (where a.event_type = 'public_partner_click')      as clicks
      from analytics.profile_activity_events a
      where a.entity_type = 'cms_partner_campaign'
        and a.entity_id   = pc.id
        and a.occurred_at >= pc.start_at
        and a.occurred_at <  pc.end_at
    ) counts
    where p_campaign_id is null or pc.id = p_campaign_id
  ) m;

  return jsonb_build_object('campaigns', v, 'computed_at', now());
end
$$;

revoke all on function public.get_partner_campaign_metrics(uuid) from public, anon;
grant execute on function public.get_partner_campaign_metrics(uuid) to authenticated;

comment on function public.get_partner_campaign_metrics(uuid) is
  'CMS-007 : impressions, clics et CTR d''une campagne, COMPTES sur les evenements reellement enregistres (addendum §51). Sans impression, le CTR est NULL : il n''est jamais fabrique.';

-- ---------------------------------------------------------------------
-- 4. CATALOGUE D'INDICATEURS (MASTER PROMPT §98)
--    Chaque indicateur nomme sa source reelle. `is_computable` dit la
--    verite : la source existe desormais en base.
-- ---------------------------------------------------------------------
insert into analytics.metric_definitions
  (code, label_fr, definition_fr, source_objects, unit, is_computable, is_aggregate_only, sort_order)
select v.code, v.label_fr, v.definition_fr, v.source_objects, v.unit, v.is_computable, v.is_aggregate_only, v.sort_order
from (values
  ('public_landing_views', 'Affichages de la landing publique',
   'Nombre d''evenements public_landing_view enregistres sur la periode.',
   array['analytics.profile_activity_events'], 'count', true, true, 200),
  ('public_login_conversion', 'Conversion landing vers connexion',
   'Rapport entre public_login_redirect_success et public_to_login sur la periode. NULL si aucun depart vers le login.',
   array['analytics.profile_activity_events'], 'ratio', true, true, 201),
  ('public_partner_ctr', 'CTR des campagnes partenaires',
   'Rapport entre public_partner_click et public_partner_impression, par campagne et par periode. NULL sans impression.',
   array['analytics.profile_activity_events', 'public.cms_partner_campaigns'], 'ratio', true, true, 202)
) as v(code, label_fr, definition_fr, source_objects, unit, is_computable, is_aggregate_only, sort_order)
where not exists (select 1 from analytics.metric_definitions d where d.code = v.code);

-- ---------------------------------------------------------------------
-- 5. LISTE BLANCHE DES FONCTIONS EXPOSEES A `anon`
--    record_public_landing_event() rejoint les neuf projections de 0061.
--    Dix fonctions, pas une de plus : toute autre ouverture fait echouer
--    la CI (0061 §12, 0062).
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
      'record_public_landing_event')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Controle de securite execute par la CI et les tests (MASTER PROMPT §80, §84). Doit renvoyer 0 ligne. Six controles : RLS, privileges de table anon, search_path fige, schemas prives, neuf colonnes masquees, et liste blanche des DIX fonctions exposees a anon (0061, 0063).';
