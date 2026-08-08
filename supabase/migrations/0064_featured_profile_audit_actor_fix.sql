-- =====================================================================
-- 0064_featured_profile_audit_actor_fix
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- DEFAUT TROUVE PAR supabase/tests/rls/0021_cms_suite.sql (cas G15).
--
--   `private.run_daily_featured_profile()` journalisait une selection
--   d'origine MANUELLE avec `p_actor_kind => 'user'`. Mais la fonction est
--   appelee par le cron, hors session : `auth.uid()` et
--   `private.current_profile_id()` sont NULL. La ligne d'audit partait donc
--   avec `actor_kind = 'user'` et aucun acteur, et violait la contrainte
--   `audit_log_actor_required` de 0018 :
--
--     ERROR 23514: new row for relation "audit_log" violates check
--     constraint "audit_log_actor_required"
--
--   Consequence reelle : la tache quotidienne aurait echoue la premiere
--   fois qu'un override editorial etait actif — c'est-a-dire exactement le
--   jour ou le CMS voulait reprendre la main. Le cas G15 l'a revele avant
--   la mise en service.
--
-- CORRECTIF
--   L'acteur d'une selection manuelle est l'auteur de l'override
--   (`cms_content_overrides.created_by_profile_id`), qui est deja lu par la
--   fonction. Il est desormais transmis a `private.log_audit()` :
--     * override avec auteur  -> actor_kind 'user',  acteur = cet auteur ;
--     * override sans auteur  -> actor_kind 'system' (aucun acteur invente).
--
--   Aucune autre ligne de la fonction n'est modifiee. 0059 n'est pas editee.
-- =====================================================================

create or replace function private.run_daily_featured_profile(
  p_for_date date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day       date := coalesce(p_for_date, (now() at time zone 'utc')::date);
  v_rules     public.cms_featured_profile_rules%rowtype;
  v_existing  public.cms_featured_profile_history%rowtype;
  v_pinned    uuid;
  v_chosen    uuid;
  v_mode      text;
  v_pool      integer := 0;
  v_actor     uuid;
begin
  perform pg_advisory_xact_lock(hashtext('cms.featured_profile'), v_day - date '2000-01-01');

  select * into v_existing from public.cms_featured_profile_history
   where featured_date = v_day and status in ('scheduled', 'published');
  if found then
    return jsonb_build_object('date', v_day, 'profile_id', v_existing.profile_id,
                              'selection_mode', v_existing.selection_mode,
                              'status', v_existing.status, 'created', false);
  end if;

  select * into v_rules from public.cms_featured_profile_rules where is_active limit 1;
  if not found then
    return jsonb_build_object('date', v_day, 'profile_id', null, 'created', false,
                              'reason', 'no_active_rule');
  end if;

  select o.entity_id, o.created_by_profile_id into v_pinned, v_actor
    from public.cms_content_overrides o
   where o.section_key = 'featured_profile' and o.override_kind = 'pin'
     and o.entity_type = 'profile'
     and o.starts_at <= (v_day + time '23:59:59') at time zone 'utc'
     and (o.ends_at is null or o.ends_at > v_day::timestamptz)
   order by o.display_position nulls last, o.created_at desc
   limit 1;

  if v_pinned is not null and private.featured_profile_eligible(v_pinned, v_day) then
    v_chosen := v_pinned;
    v_mode   := 'manual';
  elsif not v_rules.is_automation_enabled then
    perform private.log_audit(
      p_action => 'cms.featured_profile.skipped', p_object_type => 'cms_featured_profile_history',
      p_actor_kind => 'system',
      p_context => jsonb_build_object('date', v_day, 'reason', 'automation_suspended'));
    return jsonb_build_object('date', v_day, 'profile_id', null, 'created', false,
                              'reason', 'automation_suspended');
  else
    select count(*) into v_pool
    from public.ise_profiles p
    where private.featured_profile_eligible(p.id, v_day)
      and not exists (
        select 1 from public.cms_featured_profile_history h
        where h.profile_id = p.id
          and h.status in ('scheduled', 'published')
          and h.featured_date > v_day - v_rules.min_days_between_features);

    if v_pool > 0 then
      with candidates as (
        select p.id, p.promotion_id
        from public.ise_profiles p
        where private.featured_profile_eligible(p.id, v_day)
          and not exists (
            select 1 from public.cms_featured_profile_history h
            where h.profile_id = p.id
              and h.status in ('scheduled', 'published')
              and h.featured_date > v_day - v_rules.min_days_between_features)
      ),
      promo_last as (
        select pr.promotion_id, max(h.featured_date) as last_date
        from public.cms_featured_profile_history h
        join public.ise_profiles pr on pr.id = h.profile_id
        where h.status in ('scheduled', 'published')
        group by pr.promotion_id
      )
      select c.id into v_chosen
      from candidates c
      left join promo_last pl
        on v_rules.balance_dimension = 'promotion'
       and pl.promotion_id is not distinct from c.promotion_id
      order by pl.last_date asc nulls first,
               (select max(h2.featured_date) from public.cms_featured_profile_history h2
                 where h2.profile_id = c.id) asc nulls first,
               extensions.digest(v_day::text || c.id::text, 'sha256')
      limit 1;
      v_mode := 'automatic';
    end if;
  end if;

  if v_chosen is null then
    select h.profile_id into v_chosen
    from public.cms_featured_profile_history h
    where h.status = 'published'
      and private.featured_profile_eligible(h.profile_id, v_day)
    order by h.featured_date desc
    limit 1;
    if v_chosen is not null then
      v_mode := 'fallback';
    end if;
  end if;

  if v_chosen is null then
    perform private.log_audit(
      p_action => 'cms.featured_profile.no_candidate',
      p_object_type => 'cms_featured_profile_history', p_actor_kind => 'system',
      p_context => jsonb_build_object('date', v_day, 'pool', v_pool));
    return jsonb_build_object('date', v_day, 'profile_id', null, 'created', false,
                              'reason', 'no_eligible_profile', 'pool', v_pool);
  end if;

  insert into public.cms_featured_profile_history
    (profile_id, featured_date, selection_mode, selected_by_profile_id, status, selection_context)
  values
    (v_chosen, v_day, v_mode,
     case when v_mode = 'manual' then v_actor end,
     'scheduled',
     jsonb_build_object('pool_size', v_pool,
                        'balance_dimension', v_rules.balance_dimension,
                        'min_days_between_features', v_rules.min_days_between_features))
  on conflict do nothing;

  -- CORRECTIF 0064 : l'acteur d'une selection manuelle est l'auteur de
  -- l'override. Sans auteur identifie, la ligne est journalisee comme
  -- systeme : on n'invente jamais un acteur (contrainte audit_log_actor_required).
  perform private.log_audit(
    p_action => 'cms.featured_profile.selected',
    p_object_type => 'cms_featured_profile_history', p_object_id => v_chosen::text,
    p_actor_profile_id => case when v_mode = 'manual' then v_actor end,
    p_actor_kind => case when v_mode = 'manual' and v_actor is not null then 'user' else 'system' end,
    p_context => jsonb_build_object('date', v_day, 'mode', v_mode, 'pool', v_pool));

  return jsonb_build_object('date', v_day, 'profile_id', v_chosen, 'selection_mode', v_mode,
                            'status', 'scheduled', 'created', true, 'pool', v_pool);
end
$$;

revoke all on function private.run_daily_featured_profile(date) from public, anon, authenticated;

comment on function private.run_daily_featured_profile(date) is
  'Selection quotidienne de « ISE du jour » (addendum §20). Idempotente (une seule ligne par jour, verrou consultatif), observable (selection_context + journal d''audit), rejouable (ordre pseudo-aleatoire deterministe seme par la date). Aucun signal de popularite (§19). Correctif 0064 : acteur d''audit correct pour une selection manuelle.';
