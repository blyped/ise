-- =====================================================================
-- 0094 — API Superadmin pour les projets & consortiums (SA-023 -> 026)
-- =====================================================================
-- Reutilise directement (sans nouvelle fonction) :
--   * public.get_project                 (private.can_see_project bypass
--     deja `has_permission('projects.manage')`, y compris les brouillons)
--   * public.get_project_confidential_details (private.is_project_member
--     bypass deja le meme droit)
--
-- Nouveau, car aucune fonction (membre ou admin) ne couvrait ces cas :
--   * admin_list_projects            — liste TOUS les statuts, y compris
--     'draft' (public.list_projects exclut les brouillons par construction)
--   * admin_create_project           — la creation n'existait que par
--     insertion RLS directe (owner_profile_id = soi-meme, status = 'draft')
--   * admin_set_project_status       — cycle de vie non terminal
--     (draft -> recruiting -> team_ready -> active <-> paused)
--   * admin_list_consortium_requests — aucune lecture admin des demandes
--     de participation en consortium (0012)
--   * admin_review_consortium_request — aucune decision possible
--   * admin_close_project            — cloture (project_closures) +
--     donnees financieres confidentielles (private.project_confidential_details)
--
-- Conventions (identiques a 0076/0093) : security definer, search_path
-- vide, has_permission('projects.manage'), erreurs 28000/42501/P0001/P0002,
-- revoke public/anon, grant authenticated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_list_projects — tous statuts, pagination par curseur (keyset)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_projects(
  p_status text default null,
  p_project_type text default null,
  p_query text default null,
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
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
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
    select pr.id, coalesce(pr.published_at, pr.created_at) as at
      from public.projects pr
     where pr.deleted_at is null
       and (p_status is null or p_status = 'all' or pr.status = p_status)
       and (p_project_type is null or pr.project_type = p_project_type)
       and (v_q is null or pr.title ilike '%' || v_q || '%' or pr.summary ilike '%' || v_q || '%')
       and (v_c_at is null or (coalesce(pr.published_at, pr.created_at), pr.id) < (v_c_at, v_c_id))
     order by coalesce(pr.published_at, pr.created_at) desc, pr.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(private.project_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
    from base b;

  if jsonb_array_length(v_rows) < v_limit then
    v_next := null;
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_projects(text, text, text, text, integer) from public, anon;
grant execute on function public.admin_list_projects(text, text, text, text, integer) to authenticated;
comment on function public.admin_list_projects is
  'SA-023 — Liste administrative des projets, tous statuts (y compris brouillons). Reserve a projects.manage.';

-- ---------------------------------------------------------------------
-- admin_create_project — creation pour le compte d'un membre reference
-- ---------------------------------------------------------------------
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

  select status into v_owner_status from public.ise_profiles where id = p_owner_profile_id;
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

revoke all on function public.admin_create_project(uuid, text, text, text, text, text, text, bigint, text, text, text) from public, anon;
grant execute on function public.admin_create_project(uuid, text, text, text, text, text, text, bigint, text, text, text) to authenticated;
comment on function public.admin_create_project is
  'SA-023 — Creation administrative d''un projet (brouillon), pour le compte d''un profil reference. Reserve a projects.manage.';

-- ---------------------------------------------------------------------
-- admin_set_project_status — cycle de vie non terminal
-- ---------------------------------------------------------------------
create or replace function public.admin_set_project_status(
  p_project_id uuid,
  p_status text
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_project public.projects;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('projects.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('recruiting', 'team_ready', 'active', 'paused') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_project from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if v_project.status in ('completed', 'failed', 'cancelled', 'archived') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.projects
     set status = p_status,
         published_at = coalesce(published_at, case when p_status <> 'draft' then now() end),
         started_at = case when p_status = 'active' and started_at is null then now() else started_at end,
         paused_at = case when p_status = 'paused' then now() else paused_at end
   where id = p_project_id
  returning * into v_project;

  return v_project;
end;
$$;

revoke all on function public.admin_set_project_status(uuid, text) from public, anon;
grant execute on function public.admin_set_project_status(uuid, text) to authenticated;
comment on function public.admin_set_project_status is
  'SA-024 — Transition de statut non terminale d''un projet (publication, mise en pause, reprise). Reserve a projects.manage.';

-- ---------------------------------------------------------------------
-- admin_list_consortium_requests
-- ---------------------------------------------------------------------
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
               'organization_name', org.name,
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

revoke all on function public.admin_list_consortium_requests(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_list_consortium_requests(uuid, text, text, integer) to authenticated;
comment on function public.admin_list_consortium_requests is
  'SA-025 — Liste administrative des demandes de participation en consortium. Reserve a projects.manage.';

-- ---------------------------------------------------------------------
-- admin_review_consortium_request
-- ---------------------------------------------------------------------
create or replace function public.admin_review_consortium_request(
  p_request_id uuid,
  p_status text,
  p_note text default null
)
returns public.consortium_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_request public.consortium_requests;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('projects.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('reviewing', 'shortlisted', 'selected', 'not_selected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_request from public.consortium_requests where id = p_request_id for update;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if v_request.status in ('selected', 'not_selected', 'withdrawn') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.consortium_requests
     set status = p_status,
         credentials_summary = coalesce(p_note, credentials_summary),
         decided_by_profile_id = case when p_status in ('selected', 'not_selected') then v_me
                                       else decided_by_profile_id end,
         decided_at = case when p_status in ('selected', 'not_selected') then now()
                            else decided_at end
   where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.admin_review_consortium_request(uuid, text, text) from public, anon;
grant execute on function public.admin_review_consortium_request(uuid, text, text) to authenticated;
comment on function public.admin_review_consortium_request is
  'SA-025 — Decision administrative sur une demande de participation en consortium. Reserve a projects.manage.';

-- ---------------------------------------------------------------------
-- admin_close_project — cloture + bilan + donnees confidentielles
-- ---------------------------------------------------------------------
create or replace function public.admin_close_project(
  p_project_id uuid,
  p_outcome_status text,
  p_expected_outcome_achieved text,
  p_outcome_code text default null,
  p_deliverable_title text default null,
  p_deliverable_url text default null,
  p_public_result_sheet_allowed boolean default false,
  p_testimonial text default null,
  p_network_attribution text default null,
  p_collaborators_count smallint default null,
  p_client_name text default null,
  p_funder_name text default null,
  p_budget_estimate numeric default null,
  p_budget_currency character default null,
  p_financial_notes text default null,
  p_revenue_generated numeric default null,
  p_revenue_currency character default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_project public.projects;
  v_new_status text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('projects.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_outcome_status not in ('succeeded', 'partially_succeeded', 'cancelled', 'failed') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_project from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if v_project.status in ('completed', 'failed', 'cancelled', 'archived') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_new_status := case p_outcome_status
                     when 'succeeded' then 'completed'
                     when 'partially_succeeded' then 'completed'
                     when 'cancelled' then 'cancelled'
                     when 'failed' then 'failed'
                   end;

  update public.projects
     set status = v_new_status,
         closed_at = now()
   where id = p_project_id
  returning * into v_project;

  insert into public.project_closures (
    project_id, outcome_status, expected_outcome_achieved, outcome_code,
    deliverable_title, deliverable_url, public_result_sheet_allowed, testimonial,
    network_attribution, collaborators_count, closed_by_profile_id, closed_at
  )
  values (
    p_project_id, p_outcome_status, p_expected_outcome_achieved, p_outcome_code,
    p_deliverable_title, p_deliverable_url, coalesce(p_public_result_sheet_allowed, false),
    p_testimonial, p_network_attribution, p_collaborators_count, v_me, now()
  )
  on conflict (project_id) do update
     set outcome_status = excluded.outcome_status,
         expected_outcome_achieved = excluded.expected_outcome_achieved,
         outcome_code = excluded.outcome_code,
         deliverable_title = excluded.deliverable_title,
         deliverable_url = excluded.deliverable_url,
         public_result_sheet_allowed = excluded.public_result_sheet_allowed,
         testimonial = excluded.testimonial,
         network_attribution = excluded.network_attribution,
         collaborators_count = excluded.collaborators_count,
         closed_by_profile_id = excluded.closed_by_profile_id,
         closed_at = excluded.closed_at;

  if p_client_name is not null or p_funder_name is not null or p_budget_estimate is not null
     or p_financial_notes is not null or p_revenue_generated is not null then
    insert into private.project_confidential_details (
      project_id, client_name, funder_name, budget_estimate, budget_currency,
      financial_notes, revenue_generated, revenue_currency
    )
    values (
      p_project_id, p_client_name, p_funder_name, p_budget_estimate, p_budget_currency,
      p_financial_notes, p_revenue_generated, p_revenue_currency
    )
    on conflict (project_id) do update
       set client_name = excluded.client_name,
           funder_name = excluded.funder_name,
           budget_estimate = excluded.budget_estimate,
           budget_currency = excluded.budget_currency,
           financial_notes = excluded.financial_notes,
           revenue_generated = excluded.revenue_generated,
           revenue_currency = excluded.revenue_currency;
  end if;

  return v_project;
end;
$$;

revoke all on function public.admin_close_project(uuid, text, text, text, text, text, boolean, text, text, smallint, text, text, numeric, character, text, numeric, character) from public, anon;
grant execute on function public.admin_close_project(uuid, text, text, text, text, text, boolean, text, text, smallint, text, text, numeric, character, text, numeric, character) to authenticated;
comment on function public.admin_close_project is
  'SA-026 — Cloture d''un projet : resultat declare, livrable, attribution reseau et donnees financieres confidentielles. Reserve a projects.manage.';
