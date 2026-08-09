-- =====================================================================
-- 0081_admin_analytics_api
-- API serveur des tableaux de bord Analytics (écrans SA-046, SA-047).
--
-- Sources : MASTER PROMPT §42 (agrégats, pas de surveillance individuelle),
-- §98 (aucun KPI inventé) ; migration 0019 (schéma analytics) ;
-- docs/decisions.md D-30, D-72, D-102, D-126.
--
-- RÈGLES
--   * Permission `analytics.read` vérifiée en tête de chaque fonction.
--   * UNIQUEMENT des agrégats : aucune fonction ne renvoie de donnée
--     nominative. La ventilation la plus fine est la promotion / le pays.
--   * Chaque valeur est un COUNT réel sur la source déclarée dans
--     `analytics.metric_definitions.source_objects`. Un indicateur
--     `is_computable = false` est renvoyé SANS valeur : l'écran affiche
--     « non calculable pour l'instant » avec la raison (§98).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Mise à jour du catalogue : les sources des indicateurs déclarés non
--    calculables en 0019 (« la source n'existe pas encore en base ») ont
--    été migrées depuis (0007 appels, 0008 opportunités + candidatures,
--    0010 mentorat, 0012 projets, 0013 événements + inscriptions).
--    Ils deviennent calculables — leurs valeurs réelles, même nulles,
--    sont désormais affichables (MASTER PROMPT §42).
-- ---------------------------------------------------------------------
update analytics.metric_definitions
   set is_computable = true
 where code in ('network_calls_helped', 'opportunities_connected',
                'mentorships_started', 'projects_formed', 'events_followed')
   and is_computable = false;


-- ---------------------------------------------------------------------
-- 1. Vue d'ensemble : le catalogue complet, chaque indicateur calculable
--    accompagné de sa valeur réelle calculée sur sa source.
-- ---------------------------------------------------------------------
create or replace function public.admin_analytics_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_values jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('analytics.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Valeurs réelles, indicateur par indicateur, sur les sources de 0019.
  v_values := jsonb_build_object(
    'profiles_claimed', (
      select count(*) from public.ise_profiles p
      where p.claimed_at is not null and p.deleted_at is null),
    'profiles_enriched', (
      select s.enriched_profiles from analytics.v_profile_enrichment_snapshot s),
    'useful_searches', (
      select coalesce(sum(v.useful_searches_count), 0) from analytics.v_useful_searches_daily v),
    'connections_accepted', (
      select count(*) from public.connections),
    'introductions_requested', (
      select count(*) from public.introduction_requests),
    'introductions_completed', (
      select count(*) from public.introduction_requests i where i.completed_at is not null),
    'network_calls_helped', (
      select count(*) from public.network_calls c
      where c.status = 'resolved' and c.resolution in ('resolved', 'partially_resolved')),
    'opportunities_connected', (
      select count(distinct a.opportunity_id) from public.applications a
      where a.status <> 'draft'),
    'mentorships_started', (
      select count(*) from public.mentorships m
      where m.status in ('active', 'paused', 'completed')),
    'projects_formed', (
      select count(*) from public.projects pj
      where pj.status in ('team_ready', 'active', 'paused', 'completed')),
    'events_followed', (
      select count(*) from public.event_registrations er
      where er.status in ('registered', 'attended')),
    'impact_events_recorded', (
      select count(*) from analytics.impact_events)
  );

  return jsonb_build_object(
    'generated_at', now(),
    'metrics', (
      select jsonb_agg(jsonb_build_object(
        'code', md.code,
        'label_fr', md.label_fr,
        'definition_fr', md.definition_fr,
        'unit', md.unit,
        'is_computable', md.is_computable,
        'source_objects', to_jsonb(md.source_objects),
        -- Un indicateur non calculable ne porte AUCUNE valeur : rien
        -- n'est estimé ni inventé (§98).
        'value', case when md.is_computable then v_values -> md.code else null end
      ) order by md.sort_order)
      from analytics.metric_definitions md
    ),
    'enrichment', (
      select to_jsonb(s) from analytics.v_profile_enrichment_snapshot s),
    'impact_by_year', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'impact_year', y.impact_year, 'impact_type', y.impact_type,
        'attribution_level', y.attribution_level, 'impact_count', y.impact_count)
        order by y.impact_year desc, y.impact_type), '[]'::jsonb)
      from analytics.v_impact_summary_by_year y)
  );
end
$$;

revoke all on function public.admin_analytics_overview() from public, anon;
grant execute on function public.admin_analytics_overview() to authenticated;

comment on function public.admin_analytics_overview() is
  'SA-046 : catalogue 0019 + valeurs réellement calculées. Agrégats uniquement (§42), rien d''inventé (§98).';


-- ---------------------------------------------------------------------
-- 2. Séries journalières (calculées en direct depuis les vues de 0019 ;
--    analytics.daily_metrics n''est servie que si un traitement planifié
--    l''alimente un jour — aucune valeur n''est fabriquée ici).
-- ---------------------------------------------------------------------
create or replace function public.admin_analytics_series(
  p_metric_code text,
  p_days        integer default 30
)
returns table (metric_date date, value numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days  integer := least(greatest(coalesce(p_days, 30), 7), 365);
  v_from  date := (now() at time zone 'UTC')::date - v_days;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('analytics.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_metric_code = 'profiles_claimed' then
    return query select v.metric_date, v.claimed_count::numeric
      from analytics.v_profiles_claimed_daily v
      where v.metric_date >= v_from order by v.metric_date;
  elsif p_metric_code = 'connections_accepted' then
    return query select v.metric_date, v.accepted_count::numeric
      from analytics.v_connections_accepted_daily v
      where v.metric_date >= v_from order by v.metric_date;
  elsif p_metric_code = 'introductions_requested' then
    return query select v.metric_date, v.requested_count::numeric
      from analytics.v_introductions_daily v
      where v.metric_date >= v_from order by v.metric_date;
  elsif p_metric_code = 'introductions_completed' then
    return query select v.metric_date, v.completed_count::numeric
      from analytics.v_introductions_daily v
      where v.metric_date >= v_from order by v.metric_date;
  elsif p_metric_code = 'useful_searches' then
    return query select v.metric_date, v.useful_searches_count::numeric
      from analytics.v_useful_searches_daily v
      where v.metric_date >= v_from order by v.metric_date;
  else
    -- Pas de série journalière réelle pour cet indicateur : ensemble
    -- vide. L'écran l'affiche comme « série non disponible », il ne
    -- dessine pas une courbe inventée.
    return;
  end if;
end
$$;

revoke all on function public.admin_analytics_series(text, integer) from public, anon;
grant execute on function public.admin_analytics_series(text, integer) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Segmentation (SA-047) : par promotion et par pays. Agrégats purs.
-- ---------------------------------------------------------------------
create or replace function public.admin_analytics_segmentation()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('analytics.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'by_promotion', (
      select coalesce(jsonb_agg(t.row order by t.graduation_year desc), '[]'::jsonb)
      from (
        select pr.graduation_year,
               jsonb_build_object(
                 'graduation_year', pr.graduation_year,
                 'referenced_count', count(p.id),
                 'claimed_count',   count(p.id) filter (where p.claimed_at is not null),
                 'verified_count',  count(p.id) filter (where p.verification_status = 'verified'),
                 'activation_rate', case when count(p.id) = 0 then null
                   else round(count(p.id) filter (where p.claimed_at is not null)::numeric
                              / count(p.id), 4) end,
                 'country_count',   count(distinct p.current_country_code)) as row
        from public.promotions pr
        left join public.ise_profiles p on p.promotion_id = pr.id and p.deleted_at is null
        group by pr.graduation_year
        having count(p.id) > 0
      ) t),
    'by_country', (
      select coalesce(jsonb_agg(t.row order by t.n desc), '[]'::jsonb)
      from (
        select count(p.id) as n,
               jsonb_build_object(
                 'country_code', c.code,
                 'country_name', c.name_fr,
                 'profile_count', count(p.id),
                 'claimed_count', count(p.id) filter (where p.claimed_at is not null)) as row
        from public.countries c
        join public.ise_profiles p on p.current_country_code = c.code and p.deleted_at is null
        group by c.code, c.name_fr
      ) t),
    'unlocated_count', (
      select count(*) from public.ise_profiles p
      where p.deleted_at is null and p.current_country_code is null),
    'organization_count', (
      select count(distinct p.current_organization_id) from public.ise_profiles p
      where p.deleted_at is null and p.current_organization_id is not null)
  );
end
$$;

revoke all on function public.admin_analytics_segmentation() from public, anon;
grant execute on function public.admin_analytics_segmentation() to authenticated;

comment on function public.admin_analytics_segmentation() is
  'SA-047 : ventilation par promotion et pays. Aucune donnée individuelle (MASTER PROMPT §42, D-72).';
