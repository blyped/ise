-- =====================================================================
-- 0084_admin_maintenance_api
-- API serveur des fenêtres de maintenance (écran SA-048, section
-- « Maintenance planifiée » des paramètres plateforme).
--
-- Sources : migration 0018 (table maintenance_windows), 0050 (RLS) ;
-- MASTER PROMPT §40 (journalisation), §98 (aucun horaire inventé) ;
-- docs/decisions.md C-05 (back-office OPS abandonné, absorbé par le
-- Superadmin), D-126 (REVOKE PUBLIC/anon + GRANT explicite).
--
-- POURQUOI cette migration :
--   * 0050 réservait l'écriture de `maintenance_windows` à `ops.manage`,
--     permission du back-office OPS abandonné (C-05). Aucun rôle actif ne
--     la porte de façon utile : la planification de maintenance est un
--     PARAMÈTRE D'EXPLOITATION, elle revient à `settings.manage`.
--   * 0082 journalise chaque changement de paramètre et de feature flag ;
--     une fenêtre de maintenance annoncée aux membres mérite exactement
--     la même traçabilité. D'où des fonctions dédiées, seules voies
--     recommandées du back-office.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. RLS : la gestion passe de `ops.manage` (OPS abandonné, C-05) à
--    `settings.manage`. La lecture membre (fenêtres à venir/en cours,
--    pour la bannière) reste inchangée.
-- ---------------------------------------------------------------------
drop policy if exists maintenance_windows_manage on public.maintenance_windows;
create policy maintenance_windows_manage on public.maintenance_windows
  for all to authenticated
  using (private.has_permission('settings.manage'))
  with check (private.has_permission('settings.manage'));


-- ---------------------------------------------------------------------
-- 1. Lecture complète (le gestionnaire voit aussi l'historique terminé
--    et les fenêtres annulées, que la RLS membre masque).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_maintenance_windows(
  p_limit integer default 50
)
returns table (
  id                uuid,
  title             text,
  description       text,
  banner_message    text,
  affected_scope    text,
  is_read_only      boolean,
  status            text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  actual_started_at timestamptz,
  actual_ended_at   timestamptz,
  created_by        text,
  created_at        timestamptz,
  updated_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('settings.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select w.id, w.title, w.description, w.banner_message, w.affected_scope,
         w.is_read_only, w.status, w.starts_at, w.ends_at,
         w.actual_started_at, w.actual_ended_at,
         p.display_name, w.created_at, w.updated_at
  from public.maintenance_windows w
  left join public.ise_profiles p on p.id = w.created_by_profile_id
  order by
    case w.status when 'in_progress' then 0 when 'scheduled' then 1 else 2 end,
    w.starts_at desc
  limit v_limit;
end
$$;

revoke all on function public.admin_list_maintenance_windows(integer) from public, anon;
grant execute on function public.admin_list_maintenance_windows(integer) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Planification / modification. Une fenêtre n'est modifiable que tant
--    qu'elle est `scheduled` : une maintenance en cours ou passée est un
--    FAIT, elle ne se réécrit pas (§98).
-- ---------------------------------------------------------------------
create or replace function public.admin_upsert_maintenance_window(
  p_title          text,
  p_starts_at      timestamptz,
  p_ends_at        timestamptz,
  p_id             uuid    default null,
  p_description    text    default null,
  p_banner_message text    default null,
  p_affected_scope text    default 'all',
  p_is_read_only   boolean default false,
  p_reason         text    default null,
  p_correlation_id text    default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me  uuid := private.current_profile_id();
  v_old public.maintenance_windows;
  v_new public.maintenance_windows;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('settings.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = ''
     or p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_affected_scope not in ('all', 'web', 'mobile', 'imports', 'notifications', 'search', 'messaging') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.maintenance_windows
      (title, description, banner_message, affected_scope, is_read_only,
       starts_at, ends_at, created_by_profile_id)
    values
      (btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
       nullif(btrim(coalesce(p_banner_message, '')), ''), p_affected_scope,
       coalesce(p_is_read_only, false), p_starts_at, p_ends_at, v_me)
    returning * into v_new;
  else
    select * into v_old from public.maintenance_windows where id = p_id for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if v_old.status <> 'scheduled' then
      raise exception 'maintenance_not_editable' using errcode = 'P0001';
    end if;
    update public.maintenance_windows
       set title          = btrim(p_title),
           description    = nullif(btrim(coalesce(p_description, '')), ''),
           banner_message = nullif(btrim(coalesce(p_banner_message, '')), ''),
           affected_scope = p_affected_scope,
           is_read_only   = coalesce(p_is_read_only, false),
           starts_at      = p_starts_at,
           ends_at        = p_ends_at
     where id = p_id
    returning * into v_new;
  end if;

  perform private.log_audit(
    p_action => case when p_id is null then 'settings.maintenance_created'
                     else 'settings.maintenance_updated' end,
    p_object_type => 'maintenance_window',
    p_object_id => v_new.id::text,
    p_context => jsonb_strip_nulls(jsonb_build_object(
      'title', v_new.title,
      'old_period', case when p_id is null then null
                         else jsonb_build_object('starts_at', v_old.starts_at, 'ends_at', v_old.ends_at) end,
      'new_period', jsonb_build_object('starts_at', v_new.starts_at, 'ends_at', v_new.ends_at),
      'affected_scope', v_new.affected_scope,
      'is_read_only', v_new.is_read_only,
      'reason', nullif(btrim(coalesce(p_reason, '')), ''))),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('id', v_new.id, 'status', v_new.status,
                            'created', p_id is null);
end
$$;

revoke all on function public.admin_upsert_maintenance_window(text, timestamptz, timestamptz, uuid, text, text, text, boolean, text, text) from public, anon;
grant execute on function public.admin_upsert_maintenance_window(text, timestamptz, timestamptz, uuid, text, text, text, boolean, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Transitions : démarrer / clore / annuler. Les horodatages RÉELS
--    (`actual_started_at`, `actual_ended_at`) sont posés au moment de la
--    transition — jamais recopiés depuis le planning (§98).
-- ---------------------------------------------------------------------
create or replace function public.admin_transition_maintenance_window(
  p_id             uuid,
  p_action         text,
  p_reason         text default null,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.maintenance_windows;
  v_new public.maintenance_windows;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('settings.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_action not in ('start', 'complete', 'cancel') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_old from public.maintenance_windows where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_action = 'start' then
    if v_old.status <> 'scheduled' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.maintenance_windows
       set status = 'in_progress', actual_started_at = now()
     where id = p_id returning * into v_new;
  elsif p_action = 'complete' then
    if v_old.status <> 'in_progress' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.maintenance_windows
       set status = 'completed', actual_ended_at = now()
     where id = p_id returning * into v_new;
  else
    if v_old.status not in ('scheduled', 'in_progress') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.maintenance_windows
       set status = 'cancelled',
           actual_ended_at = case when actual_started_at is not null then now() end
     where id = p_id returning * into v_new;
  end if;

  perform private.log_audit(
    p_action => 'settings.maintenance_' ||
                case p_action when 'start' then 'started'
                              when 'complete' then 'completed'
                              else 'cancelled' end,
    p_object_type => 'maintenance_window',
    p_object_id => p_id::text,
    p_context => jsonb_strip_nulls(jsonb_build_object(
      'title', v_old.title,
      'from_status', v_old.status,
      'to_status', v_new.status,
      'reason', nullif(btrim(coalesce(p_reason, '')), ''))),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('id', v_new.id, 'status', v_new.status);
end
$$;

revoke all on function public.admin_transition_maintenance_window(uuid, text, text, text) from public, anon;
grant execute on function public.admin_transition_maintenance_window(uuid, text, text, text) to authenticated;

comment on function public.admin_upsert_maintenance_window(text, timestamptz, timestamptz, uuid, text, text, text, boolean, text, text) is
  'SA-048 : planification d''une fenêtre de maintenance, journalisée. Gestion sous settings.manage depuis C-05 (OPS abandonné).';


-- ---------------------------------------------------------------------
-- 4. L'historique des paramètres (0082) inclut désormais les fenêtres de
--    maintenance : même écran, même journal.
-- ---------------------------------------------------------------------
create or replace function public.admin_settings_history(
  p_key       text    default null,
  p_limit     integer default 50,
  p_before_id bigint  default null
)
returns table (
  id             bigint,
  created_at     timestamptz,
  action         text,
  object_type    text,
  object_id      text,
  actor_name     text,
  result         text,
  context        jsonb,
  correlation_id text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('settings.manage') or private.has_permission('audit.read')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select a.id, a.created_at, a.action, a.object_type, a.object_id,
         p.display_name, a.result, a.context, a.correlation_id
  from private.audit_log a
  left join public.ise_profiles p on p.id = a.actor_profile_id
  where a.object_type in ('platform_setting', 'feature_flag', 'maintenance_window')
    and (p_key is null or a.object_id = p_key)
    and (p_before_id is null or a.id < p_before_id)
  order by a.id desc
  limit v_limit;
end
$$;

revoke all on function public.admin_settings_history(text, integer, bigint) from public, anon;
grant execute on function public.admin_settings_history(text, integer, bigint) to authenticated;
