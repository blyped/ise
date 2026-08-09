-- =====================================================================
-- 0083_admin_audit_api
-- Lecture du journal d'audit pour le back-office (écrans SA-049, SA-050).
--
-- Sources : migration 0018 (private.audit_log, private.log_audit),
-- 0028 (private.read_audit_log, première forme) ; MASTER PROMPT §40 ;
-- docs/decisions.md D-30, D-102, D-126.
--
-- RÈGLES
--   * LECTURE SEULE ABSOLUE : aucune fonction de ce fichier n'écrit dans
--     `private.audit_log`, hormis la journalisation de sa propre
--     consultation (l'accès au journal est lui-même auditable, §40).
--   * `private.read_audit_log()` reste l'unique voie de lecture : la
--     forme filtrée ajoutée ici est une SURCHARGE de la fonction de 0028,
--     avec les mêmes garde-fous (permission `audit.read`, borne de
--     volume, auto-journalisation). Les fonctions `public.admin_*` ne
--     sont que des façades PostgREST qui lui délèguent tout.
--   * Aucun secret : `private.log_audit()` filtre les clés sensibles à
--     l'écriture (0018) ; la lecture restitue le contexte tel quel.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Surcharge filtrée de private.read_audit_log (0028) : filtres par
--    acteur / action / type d'objet / résultat / période, pagination par
--    curseur composite (created_at, id) — stable même à la milliseconde
--    identique, ce que la forme de 0028 ne garantissait pas.
-- ---------------------------------------------------------------------
create or replace function private.read_audit_log(
  p_limit            integer,
  p_before_created   timestamptz,
  p_before_id        bigint,
  p_actor_profile_id uuid,
  p_action           text,
  p_object_type      text,
  p_result           text,
  p_from             timestamptz,
  p_to               timestamptz
)
returns table (
  id               bigint,
  created_at       timestamptz,
  actor_kind       text,
  actor_user_id    uuid,
  actor_profile_id uuid,
  actor_name       text,
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
  v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_self_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('audit.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- La consultation du journal est elle-même journalisée (§40), avec les
  -- filtres utilisés — jamais le contenu retourné.
  v_self_id := private.log_audit(
    p_action      => 'audit.read',
    p_object_type => 'audit_log',
    p_result      => 'success',
    p_context     => jsonb_strip_nulls(jsonb_build_object(
      'limit', v_limit,
      'actor_profile_id', p_actor_profile_id,
      'action', p_action,
      'object_type', p_object_type,
      'result_filter', p_result,
      'from', p_from,
      'to', p_to)));

  return query
  select a.id, a.created_at, a.actor_kind, a.actor_user_id, a.actor_profile_id,
         p.display_name,
         a.action, a.object_type, a.object_id, a.result, a.error_code,
         a.correlation_id, a.request_ip, a.user_agent, a.context
  from private.audit_log a
  left join public.ise_profiles p on p.id = a.actor_profile_id
  where (p_actor_profile_id is null or a.actor_profile_id = p_actor_profile_id)
    and (p_action is null or a.action = p_action)
    and (p_object_type is null or a.object_type = p_object_type)
    and (p_result is null or a.result = p_result)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at < p_to)
    and (p_before_created is null
         or (a.created_at, a.id) < (p_before_created, coalesce(p_before_id, a.id)))
    -- L'auto-journalisation ci-dessus est dans la même transaction : on
    -- ne renvoie pas la ligne qu'on vient d'écrire pour cette lecture.
    and a.id <> v_self_id
  order by a.created_at desc, a.id desc
  limit v_limit;
end
$$;

revoke all on function private.read_audit_log(integer, timestamptz, bigint, uuid, text, text, text, timestamptz, timestamptz) from public, anon;

comment on function private.read_audit_log(integer, timestamptz, bigint, uuid, text, text, text, timestamptz, timestamptz) is
  'Surcharge filtrée de la lecture du journal (0028). Exige audit.read, borne à 200 lignes, journalise sa propre exécution.';


-- ---------------------------------------------------------------------
-- 2. Façade PostgREST : le schéma private n'est pas exposé à la Data
--    API, la lecture passe donc par cette fonction publique qui délègue
--    TOUT à private.read_audit_log().
-- ---------------------------------------------------------------------
create or replace function public.admin_read_audit_log(
  p_limit            integer     default 50,
  p_before_created   timestamptz default null,
  p_before_id        bigint      default null,
  p_actor_profile_id uuid        default null,
  p_action           text        default null,
  p_object_type      text        default null,
  p_result           text        default null,
  p_from             timestamptz default null,
  p_to               timestamptz default null
)
returns table (
  id               bigint,
  created_at       timestamptz,
  actor_kind       text,
  actor_user_id    uuid,
  actor_profile_id uuid,
  actor_name       text,
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
language sql
volatile
security definer
set search_path = ''
as $$
  select * from private.read_audit_log(
    p_limit, p_before_created, p_before_id, p_actor_profile_id,
    nullif(btrim(coalesce(p_action, '')), ''),
    nullif(btrim(coalesce(p_object_type, '')), ''),
    nullif(btrim(coalesce(p_result, '')), ''),
    p_from, p_to)
$$;

revoke all on function public.admin_read_audit_log(integer, timestamptz, bigint, uuid, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_read_audit_log(integer, timestamptz, bigint, uuid, text, text, text, timestamptz, timestamptz) to authenticated;

comment on function public.admin_read_audit_log(integer, timestamptz, bigint, uuid, text, text, text, timestamptz, timestamptz) is
  'SA-049 : façade de private.read_audit_log() (seule voie de lecture). Lecture seule absolue.';


-- ---------------------------------------------------------------------
-- 3. Détail d'une entrée (SA-050) — même voie, filtrée sur l'identifiant.
-- ---------------------------------------------------------------------
create or replace function public.admin_get_audit_entry(p_entry_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('audit.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform private.log_audit(
    p_action      => 'audit.entry_read',
    p_object_type => 'audit_log',
    p_object_id   => p_entry_id::text,
    p_result      => 'success');

  select jsonb_build_object(
    'id', a.id, 'created_at', a.created_at,
    'actor_kind', a.actor_kind, 'actor_user_id', a.actor_user_id,
    'actor_profile_id', a.actor_profile_id, 'actor_name', p.display_name,
    'action', a.action, 'object_type', a.object_type, 'object_id', a.object_id,
    'result', a.result, 'error_code', a.error_code,
    'correlation_id', a.correlation_id,
    'request_ip', a.request_ip::text, 'user_agent', a.user_agent,
    'context', a.context)
    into v_entry
  from private.audit_log a
  left join public.ise_profiles p on p.id = a.actor_profile_id
  where a.id = p_entry_id;

  if v_entry is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_entry;
end
$$;

revoke all on function public.admin_get_audit_entry(bigint) from public, anon;
grant execute on function public.admin_get_audit_entry(bigint) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Vue d'ensemble SA-049 : compteurs réels sur 7 jours + facettes pour
--    les filtres (actions et types d'objet réellement présents).
-- ---------------------------------------------------------------------
create or replace function public.admin_audit_overview()
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
  if not private.has_permission('audit.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'actions_7d', (
      select count(*) from private.audit_log a
      where a.created_at >= now() - interval '7 days'),
    'failures_7d', (
      select count(*) from private.audit_log a
      where a.created_at >= now() - interval '7 days' and a.result in ('failure', 'denied')),
    'distinct_actors_7d', (
      select count(distinct coalesce(a.actor_profile_id::text, a.actor_user_id::text, a.actor_kind))
      from private.audit_log a
      where a.created_at >= now() - interval '7 days'),
    'total_entries', (select count(*) from private.audit_log),
    'actions', (
      select coalesce(jsonb_agg(t.action order by t.action), '[]'::jsonb)
      from (select distinct a.action from private.audit_log a) t),
    'object_types', (
      select coalesce(jsonb_agg(t.object_type order by t.object_type), '[]'::jsonb)
      from (select distinct a.object_type from private.audit_log a) t),
    'actors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profile_id', t.actor_profile_id, 'name', t.display_name) order by t.display_name), '[]'::jsonb)
      from (
        select distinct a.actor_profile_id, p.display_name
        from private.audit_log a
        join public.ise_profiles p on p.id = a.actor_profile_id
        where a.actor_profile_id is not null
      ) t)
  );
end
$$;

revoke all on function public.admin_audit_overview() from public, anon;
grant execute on function public.admin_audit_overview() to authenticated;
