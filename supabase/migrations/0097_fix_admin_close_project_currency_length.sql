-- 0097 — Correctif 0094 : p_budget_currency/p_revenue_currency etaient
-- declares "character" (= character(1) par defaut SQL), tronquant
-- silencieusement tout code devise ('EUR' -> 'E') avant l'ecriture dans
-- private.project_confidential_details (colonnes character(3)).
drop function if exists public.admin_close_project(uuid, text, text, text, text, text, boolean, text, text, smallint, text, text, numeric, character, text, numeric, character);

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
  p_budget_currency character(3) default null,
  p_financial_notes text default null,
  p_revenue_generated numeric default null,
  p_revenue_currency character(3) default null
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

revoke all on function public.admin_close_project(uuid, text, text, text, text, text, boolean, text, text, smallint, text, text, numeric, character(3), text, numeric, character(3)) from public, anon;
grant execute on function public.admin_close_project(uuid, text, text, text, text, text, boolean, text, text, smallint, text, text, numeric, character(3), text, numeric, character(3)) to authenticated;
comment on function public.admin_close_project is
  'SA-026 — Cloture d''un projet : resultat declare, livrable, attribution reseau et donnees financieres confidentielles. Reserve a projects.manage.';
