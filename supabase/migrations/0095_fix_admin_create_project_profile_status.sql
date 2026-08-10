-- 0095 — Correctif 0094 : ise_profiles.status n'existe pas, la colonne
-- est profile_status (0002/0076). admin_create_project verifiait la mauvaise
-- colonne (echec systematique : "column status does not exist").
create or replace function public.admin_create_project(
  p_owner_profile_id uuid,
  p_project_type text,
  p_title text,
  p_summary text,
  p_expected_outcome text,
  p_description text default null,
  p_qualification_criteria text default null,
  p_sector_id bigint default null,
  p_compensation_type text default 'to_be_defined',
  p_compensation_statement text default null,
  p_visibility text default 'network'
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_owner_status text;
  v_project public.projects;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('projects.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select profile_status into v_owner_status from public.ise_profiles where id = p_owner_profile_id;
  if v_owner_status is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if v_owner_status not in ('referenced', 'active') then
    raise exception 'owner_not_eligible' using errcode = 'P0001';
  end if;

  if nullif(btrim(coalesce(p_title, '')), '') is null
     or nullif(btrim(coalesce(p_summary, '')), '') is null
     or nullif(btrim(coalesce(p_expected_outcome, '')), '') is null then
    raise exception 'missing_required_field' using errcode = 'P0001';
  end if;

  insert into public.projects (
    owner_profile_id, project_type, title, summary, description, expected_outcome,
    qualification_criteria, sector_id, compensation_type, compensation_statement,
    visibility, status
  )
  values (
    p_owner_profile_id, p_project_type, btrim(p_title), btrim(p_summary), p_description,
    btrim(p_expected_outcome), p_qualification_criteria, p_sector_id,
    coalesce(p_compensation_type, 'to_be_defined'), p_compensation_statement,
    coalesce(p_visibility, 'network'), 'draft'
  )
  returning * into v_project;

  return v_project;
end;
$$;

comment on function public.admin_create_project is
  'SA-023 — Creation administrative d''un projet (brouillon), pour le compte d''un profil reference. Reserve a projects.manage.';
