-- 0096 — Correctif 0094 : public.organizations n'a pas de colonne "name",
-- la colonne est "canonical_name" (0012/0018 organisations).
create or replace function public.admin_list_consortium_requests(
  p_project_id uuid default null,
  p_status text default null,
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_c_at timestamptz;
  v_c_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_next text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('projects.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select cr.id, cr.submitted_at as at
      from public.consortium_requests cr
     where (p_project_id is null or cr.project_id = p_project_id)
       and (p_status is null or p_status = 'all' or cr.status = p_status)
       and (v_c_at is null or (cr.submitted_at, cr.id) < (v_c_at, v_c_id))
     order by cr.submitted_at desc, cr.id desc
     limit v_limit
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', cr.id,
               'project_id', cr.project_id,
               'project_title', pr.title,
               'organization_id', cr.organization_id,
               'organization_name', org.canonical_name,
               'requested_by_profile_id', cr.requested_by_profile_id,
               'partner_role', cr.partner_role,
               'message', cr.message,
               'credentials_summary', cr.credentials_summary,
               'status', cr.status,
               'decided_by_profile_id', cr.decided_by_profile_id,
               'decided_at', cr.decided_at,
               'submitted_at', cr.submitted_at
             )
             order by b.at desc, b.id desc
           ),
           '[]'::jsonb
         ),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
    from base b
    join public.consortium_requests cr on cr.id = b.id
    join public.projects pr on pr.id = cr.project_id
    left join public.organizations org on org.id = cr.organization_id;

  if jsonb_array_length(v_rows) < v_limit then
    v_next := null;
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

comment on function public.admin_list_consortium_requests is
  'SA-025 — Liste administrative des demandes de participation en consortium. Reserve a projects.manage.';
