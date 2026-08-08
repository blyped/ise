-- =====================================================================
-- 0073_projects_api
--
-- Couche base de donnees de la tranche PROJETS & CONSORTIUMS
-- (ISE-088 -> ISE-091). Tables 0012, politiques 0045 : ni l'une ni
-- l'autre n'est modifiee.
--
-- REGLE CARDINALE (MASTER PROMPT 32, CA-PROJ-05)
--   Une expression d'interet (`project_applications`) n'est JAMAIS une
--   adhesion. `submit_project_interest` n'ecrit que dans
--   `project_applications` et renvoie `creates_membership: false`.
--   Le seul chemin vers `project_members.membership_status = 'active'`
--   est `confirm_project_membership`, qui horodate le consentement et
--   l'historise dans `agreed_terms`.
--   Meme une invitation ACCEPTEE ne cree qu'un `pending_confirmation`.
--
-- CONFIDENTIALITE FINANCIERE
--   `private.project_confidential_details` et
--   `private.project_role_compensation` vivent en schema `private`.
--   Elles ne sont projetees que derriere un test explicite :
--     * les details financiers du projet -> membres de l'equipe seuls
--       (`get_project_confidential_details`, 42501 sinon) ;
--     * la remuneration d'un role -> selon `disclosed_from`, c'est-a-dire
--       un FAIT CONSTATE (candidature deposee, preselection, selection,
--       appartenance). DIGEST D 5.6 U 55 et 176 : « ne doit jamais etre
--       retourne a l'ensemble du reseau ».
--
-- CONFIDENTIALITE DU PROJET
--   `disclosure_level = 'summary_only'` : hors equipe, seuls le titre
--   restreint et le resume sortent (DIGEST D 5.6 U 29).
--
-- References : MASTER PROMPT 15, 16, 27, 32, 43, 53, 98, 100, 101, 113 ;
--              D-42, D-43, D-44, D-53, D-55, D-101, D-102, D-103, D-126 ;
--              docs/rls.md 10.6.
-- =====================================================================

insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('project.interest_submitted',  'Un membre a exprime son interet pour un projet ou un role.',        'project', 120),
  ('project.interest_withdrawn',  'Un membre a retire son expression d''interet.',                     'project', 121),
  ('project.invitation_answered', 'Un membre a repondu a une invitation de projet.',                   'project', 122),
  ('project.membership_confirmed','Un membre a confirme sa participation (consentement horodate).',    'project', 123),
  ('project.membership_withdrawn','Un membre s''est retire d''un projet.',                             'project', 124)
on conflict (code) do nothing;

create index if not exists project_applications_applicant_idx
  on public.project_applications (applicant_profile_id, submitted_at desc, id desc);
create index if not exists project_members_profile_status_idx
  on public.project_members (profile_id, membership_status);


-- ---------------------------------------------------------------------
-- private.project_compensation_visible(p_role)
--
-- Quatre paliers de divulgation (`private.project_role_compensation.
-- disclosed_from`). Le porteur et l'equipe voient toujours ; les autres
-- seulement lorsque le fait exige est CONSTATE (D-55).
-- ---------------------------------------------------------------------
create or replace function private.project_compensation_visible(p_role uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_project uuid; v_from text; v_app text;
begin
  if v_me is null or p_role is null then return false; end if;
  select r.project_id, c.disclosed_from into v_project, v_from
    from public.project_roles r
    left join private.project_role_compensation c on c.project_role_id = r.id
   where r.id = p_role;
  if v_project is null or v_from is null then return false; end if;
  if private.is_project_owner(v_project) or private.is_project_member(v_project) then
    return true;
  end if;
  select a.status into v_app
    from public.project_applications a
   where a.project_role_id = p_role and a.applicant_profile_id = v_me
   order by a.submitted_at desc limit 1;
  -- `coalesce` : un candidat sans candidature donne `null`, qui n'est pas
  -- « faux » en SQL. Une valeur indeterminee cote client se lirait comme
  -- « peut-etre » : ici, c'est non.
  return coalesce(case v_from
           when 'applied'     then v_app in ('submitted','reviewing','shortlisted','selected')
           when 'shortlisted' then v_app in ('shortlisted','selected')
           when 'selected'    then v_app = 'selected'
           else false
         end, false);
end
$fn$;
revoke all on function private.project_compensation_visible(uuid) from public, anon, authenticated;
comment on function private.project_compensation_visible(uuid) is
  'Palier de divulgation de la remuneration d''un role. Aucune valeur financiere ne sort sans fait constate.';


-- ---------------------------------------------------------------------
-- private.project_role_card(p_role)
-- ---------------------------------------------------------------------
create or replace function private.project_role_card(p_role uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_row record; v_out jsonb;
begin
  select r.id, r.project_id, r.title, r.description, r.seats, r.commitment_type,
         r.workload_days, r.workload_hours_week, r.commitment_notes,
         r.experience_min_years, r.sector_id, r.availability_from, r.availability_until,
         r.compensation_type, r.application_mode, r.is_key_expert, r.status, r.sort_order
    into v_row
  from public.project_roles r where r.id = p_role;
  if not found then return null; end if;
  if not private.can_see_project(v_row.project_id) then return null; end if;

  v_out := jsonb_build_object(
    'role_id', v_row.id, 'project_id', v_row.project_id, 'title', v_row.title,
    'description', v_row.description, 'seats', v_row.seats,
    'commitment_type', v_row.commitment_type, 'workload_days', v_row.workload_days,
    'workload_hours_week', v_row.workload_hours_week, 'commitment_notes', v_row.commitment_notes,
    'experience_min_years', v_row.experience_min_years,
    'sector', (select s.name from public.sectors s where s.id = v_row.sector_id),
    'availability_from', v_row.availability_from, 'availability_until', v_row.availability_until,
    'compensation_type', v_row.compensation_type, 'application_mode', v_row.application_mode,
    'is_key_expert', v_row.is_key_expert, 'status', v_row.status, 'sort_order', v_row.sort_order,
    'filled_seats', (select count(*) from public.project_members m
                      where m.project_role_id = p_role and m.membership_status = 'active'),
    'skills', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', s.name, 'requirement', rs.requirement_type,
                          'minimum_level', rs.minimum_level) order by rs.requirement_type, s.name)
                          from public.project_role_skills rs
                          join public.skills s on s.id = rs.skill_id
                         where rs.project_role_id = p_role), '[]'::jsonb),
    'languages', coalesce((select jsonb_agg(jsonb_build_object('code', l.code, 'name', l.name_fr,
                                                               'is_mandatory', rl.is_mandatory)
                                            order by l.name_fr)
                             from public.project_role_languages rl
                             join public.languages l on l.code = rl.language_code
                            where rl.project_role_id = p_role), '[]'::jsonb),
    'compensation_disclosed', private.project_compensation_visible(p_role));

  if private.project_compensation_visible(p_role) then
    v_out := v_out || jsonb_build_object('compensation',
      (select jsonb_build_object('details', c.details, 'amount_min', c.amount_min,
                                 'amount_max', c.amount_max, 'currency', c.currency,
                                 'rate_unit', c.rate_unit)
         from private.project_role_compensation c where c.project_role_id = p_role));
  end if;
  return v_out;
end
$fn$;
revoke all on function private.project_role_card(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- private.project_match_score(p_project)
--
-- Ponderation DIGEST D 5.8 : competences 40 / experience 20 /
-- secteur 15 / pays 10 / disponibilite 10 / langues 5. Le score sert a
-- ORDONNER ; il n'est jamais renvoye au client (MASTER PROMPT 15). Seuls
-- sortent le libelle qualitatif (D-42) et les raisons (D-43).
-- ---------------------------------------------------------------------
drop function if exists private.project_match_score(uuid);
create or replace function private.project_match_score(
  p_project uuid, out o_score numeric, out o_reasons jsonb)
returns record language plpgsql stable security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_years numeric;
begin
  o_score := 0; o_reasons := '[]'::jsonb;
  if v_me is null then return; end if;

  if exists (select 1 from public.project_role_skills rs
               join public.project_roles r on r.id = rs.project_role_id
               join public.profile_skills ps on ps.skill_id = rs.skill_id and ps.profile_id = v_me
              where r.project_id = p_project and r.status in ('open','partially_filled')) then
    o_score := o_score + 40;
    o_reasons := o_reasons || jsonb_build_array(jsonb_build_object('code','skill',
      'label',(select s.name from public.project_role_skills rs
                 join public.project_roles r on r.id = rs.project_role_id
                 join public.profile_skills ps on ps.skill_id = rs.skill_id and ps.profile_id = v_me
                 join public.skills s on s.id = rs.skill_id
                where r.project_id = p_project
                order by rs.requirement_type, s.name limit 1)));
  end if;

  v_years := private.profile_years_of_experience(v_me);
  if v_years is not null and exists (select 1 from public.project_roles r
                                      where r.project_id = p_project
                                        and r.experience_min_years is not null
                                        and v_years >= r.experience_min_years) then
    o_score := o_score + 20;
    o_reasons := o_reasons || jsonb_build_array(jsonb_build_object('code','experience',
      'label', round(v_years)::text));
  end if;

  if exists (select 1 from public.projects pr join public.profile_sectors ps
                on ps.sector_id = pr.sector_id and ps.profile_id = v_me
              where pr.id = p_project) then
    o_score := o_score + 15;
    o_reasons := o_reasons || jsonb_build_array(jsonb_build_object('code','sector',
      'label',(select s.name from public.projects pr join public.sectors s on s.id = pr.sector_id
                where pr.id = p_project)));
  end if;

  if exists (select 1 from public.project_countries pc
              where pc.project_id = p_project
                and (exists (select 1 from public.profile_geographies g
                              where g.profile_id = v_me and g.country_code = pc.country_code)
                     or exists (select 1 from public.ise_profiles p
                                 where p.id = v_me and p.current_country_code = pc.country_code))) then
    o_score := o_score + 10;
    o_reasons := o_reasons || jsonb_build_array(jsonb_build_object('code','country',
      'label',(select co.name_fr from public.project_countries pc
                 join public.countries co on co.code = pc.country_code
                where pc.project_id = p_project
                  and (exists (select 1 from public.profile_geographies g
                                where g.profile_id = v_me and g.country_code = pc.country_code)
                       or exists (select 1 from public.ise_profiles p
                                   where p.id = v_me and p.current_country_code = pc.country_code))
                limit 1)));
  end if;

  if exists (select 1 from public.profile_availabilities pa
              where pa.profile_id = v_me and pa.active
                and (pa.available_from is null or pa.available_from <= current_date)
                and (pa.available_until is null or pa.available_until >= current_date)) then
    o_score := o_score + 10;
    o_reasons := o_reasons || jsonb_build_array(jsonb_build_object('code','availability','label',null));
  end if;

  if exists (select 1 from public.project_role_languages rl
               join public.project_roles r on r.id = rl.project_role_id
               join public.profile_languages pl on pl.language_code = rl.language_code and pl.profile_id = v_me
              where r.project_id = p_project) then
    o_score := o_score + 5;
    o_reasons := o_reasons || jsonb_build_array(jsonb_build_object('code','language','label',null));
  end if;
end
$fn$;
revoke all on function private.project_match_score(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- private.project_card(p_project, p_full)
-- ---------------------------------------------------------------------
create or replace function private.project_card(p_project uuid, p_full boolean default false)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_row record; v_out jsonb; v_member boolean; v_restricted boolean; v_match record;
begin
  if p_project is null or not private.can_see_project(p_project) then return null; end if;

  select pr.id, pr.owner_profile_id, pr.project_type, pr.title, pr.restricted_title, pr.summary,
         pr.description, pr.expected_outcome, pr.qualification_criteria, pr.tender_reference,
         pr.sector_id, pr.visibility, pr.disclosure_level, pr.requires_nda,
         pr.compensation_type, pr.compensation_statement, pr.status,
         pr.start_date, pr.application_deadline, pr.target_end_date,
         pr.source_type, pr.source_community_id, pr.published_at, pr.team_confirmed_at,
         pr.closed_at, pr.created_at
    into v_row
  from public.projects pr where pr.id = p_project and pr.deleted_at is null;
  if not found then return null; end if;

  v_member := private.is_project_member(p_project);
  v_restricted := (v_row.disclosure_level = 'summary_only') and not v_member;
  select * into v_match from private.project_match_score(p_project);

  v_out := jsonb_build_object(
    'project_id', v_row.id,
    'title', case when v_restricted then coalesce(v_row.restricted_title, v_row.title) else v_row.title end,
    'is_restricted', v_restricted,
    'project_type', v_row.project_type,
    'summary', v_row.summary,
    'expected_outcome', case when v_restricted then null else v_row.expected_outcome end,
    'sector', (select s.name from public.sectors s where s.id = v_row.sector_id),
    'visibility', v_row.visibility,
    'disclosure_level', v_row.disclosure_level,
    'requires_nda', v_row.requires_nda,
    'compensation_type', v_row.compensation_type,
    'compensation_statement', v_row.compensation_statement,
    'status', v_row.status,
    'start_date', v_row.start_date,
    'application_deadline', v_row.application_deadline,
    'target_end_date', v_row.target_end_date,
    'published_at', v_row.published_at,
    'team_confirmed_at', v_row.team_confirmed_at,
    'created_at', v_row.created_at,
    'owner', private.network_profile_card(v_row.owner_profile_id),
    'is_owner', (v_row.owner_profile_id = v_me),
    'is_member', v_member,
    'countries', coalesce((select jsonb_agg(co.name_fr order by co.name_fr)
                             from public.project_countries pc
                             join public.countries co on co.code = pc.country_code
                            where pc.project_id = p_project), '[]'::jsonb),
    'role_summary', jsonb_build_object(
      'total_seats', coalesce((select sum(r.seats) from public.project_roles r
                                where r.project_id = p_project and r.status <> 'closed'), 0),
      'filled_seats', (select count(*) from public.project_members m
                        where m.project_id = p_project and m.membership_status = 'active'),
      'open_roles', (select count(*) from public.project_roles r
                      where r.project_id = p_project and r.status in ('open','partially_filled'))),
    'sought_roles', coalesce((select jsonb_agg(r.title order by r.sort_order, r.title)
                                from public.project_roles r
                               where r.project_id = p_project
                                 and r.status in ('open','partially_filled')), '[]'::jsonb),
    'relevance_label', private.relevance_label(v_match.o_score),
    'reasons', v_match.o_reasons,
    'my_application', (select jsonb_build_object('application_id', a.id, 'status', a.status,
                                                 'role_id', a.project_role_id,
                                                 'submitted_at', a.submitted_at)
                         from public.project_applications a
                        where a.project_id = p_project and a.applicant_profile_id = v_me
                        order by a.submitted_at desc limit 1),
    'my_invitation', (select jsonb_build_object('invitation_id', i.id, 'status', i.status,
                                                'role_id', i.project_role_id)
                        from public.project_invitations i
                       where i.project_id = p_project and i.invited_profile_id = v_me
                       order by i.created_at desc limit 1),
    'my_membership', (select jsonb_build_object('member_id', m.id, 'status', m.membership_status,
                                                'membership_role', m.membership_role,
                                                'role_id', m.project_role_id,
                                                'confirmed_at', m.confirmed_at)
                        from public.project_members m
                       where m.project_id = p_project and m.profile_id = v_me
                       order by m.created_at desc limit 1));

  if not p_full then return v_out; end if;

  v_out := v_out || jsonb_build_object(
    'description', case when v_restricted then null else v_row.description end,
    'qualification_criteria', case when v_restricted then null else v_row.qualification_criteria end,
    'tender_reference', case when v_member then v_row.tender_reference else null end,
    'source_type', v_row.source_type,
    'source_community', (select c.name from public.communities c where c.id = v_row.source_community_id),
    'roles', coalesce((select jsonb_agg(private.project_role_card(r.id) order by r.sort_order, r.title)
                         from public.project_roles r where r.project_id = p_project
                          and private.project_role_card(r.id) is not null), '[]'::jsonb),
    'team', coalesce((select jsonb_agg(jsonb_build_object(
                        'member_id', m.id, 'membership_role', m.membership_role,
                        'membership_status', m.membership_status,
                        'role_title', (select r.title from public.project_roles r where r.id = m.project_role_id),
                        'confirmed_at', m.confirmed_at,
                        'profile', private.network_profile_card(m.profile_id))
                      order by m.created_at)
                        from public.project_members m
                       where m.project_id = p_project
                         and m.membership_status in ('invited','pending_confirmation','active','completed')), '[]'::jsonb),
    'milestones', case when v_member then coalesce((
                    select jsonb_agg(jsonb_build_object('milestone_id', ms.id, 'title', ms.title,
                             'description', ms.description, 'due_date', ms.due_date,
                             'status', ms.status, 'sort_order', ms.sort_order,
                             'is_mine', (ms.owner_profile_id = v_me))
                           order by ms.sort_order, ms.due_date)
                      from public.project_milestones ms where ms.project_id = p_project), '[]'::jsonb)
                  else '[]'::jsonb end,
    'links', coalesce((select jsonb_agg(jsonb_build_object('link_id', l.id, 'label', l.label,
                                'url', l.url, 'link_type', l.link_type,
                                'is_confidential', l.is_confidential) order by l.created_at)
                         from public.project_links l
                        where l.project_id = p_project
                          and (case when l.is_confidential then v_member else true end)), '[]'::jsonb),
    'closure', (select jsonb_build_object('outcome_status', pc.outcome_status,
                         'expected_outcome_achieved', pc.expected_outcome_achieved,
                         'outcome_code', pc.outcome_code, 'deliverable_title', pc.deliverable_title,
                         'deliverable_url', pc.deliverable_url, 'closed_at', pc.closed_at)
                  from public.project_closures pc where pc.project_id = p_project));
  return v_out;
end
$fn$;
revoke all on function private.project_card(uuid, boolean) from public, anon, authenticated;


-- =====================================================================
-- Lectures
-- =====================================================================

-- ISE-088.
create or replace function public.list_projects(
  p_scope text default 'for_me', p_query text default null, p_project_type text default null,
  p_sector_id bigint default null, p_country_code char(2) default null,
  p_compensation text default null, p_status text default 'open',
  p_cursor text default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope text := coalesce(p_scope, 'for_me');
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_rows jsonb := '[]'::jsonb; v_next text;
  v_c_at timestamptz; v_c_id uuid; v_c_score numeric; v_c_sid uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_scope not in ('for_me','all','consortiums','mine') then
    raise exception 'invalid_scope' using errcode = 'P0001'; end if;

  if v_scope = 'for_me' then
    select c_score, c_id into v_c_score, v_c_sid from private.decode_score_cursor(p_cursor);
    with visible as (
      select pr.id, (private.project_match_score(pr.id)).o_score as score
        from public.projects pr
       where pr.deleted_at is null and pr.status in ('recruiting','team_ready','active')
         and private.can_see_project(pr.id) and pr.owner_profile_id <> v_me),
    base as (select v.id, v.score from visible v
              where v.score >= 25
                and (v_c_score is null or (v.score, v.id) < (v_c_score, v_c_sid))
              order by v.score desc, v.id desc limit v_limit)
    select coalesce(jsonb_agg(private.project_card(b.id, false) order by b.score desc, b.id desc), '[]'::jsonb),
           private.encode_score_cursor(min(b.score), (array_agg(b.id order by b.score, b.id))[1])
      into v_rows, v_next from base b;
  else
    select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);
    with base as (
      select pr.id, coalesce(pr.published_at, pr.created_at) as at
        from public.projects pr
       where pr.deleted_at is null and private.can_see_project(pr.id)
         and pr.status <> 'draft'
         and (v_scope <> 'consortiums' or pr.project_type in ('consortium','tender'))
         and (v_scope <> 'mine' or pr.owner_profile_id = v_me
              or exists (select 1 from public.project_members m
                          where m.project_id = pr.id and m.profile_id = v_me
                            and m.membership_status in ('invited','pending_confirmation','active','completed'))
              or exists (select 1 from public.project_applications a
                          where a.project_id = pr.id and a.applicant_profile_id = v_me)
              or exists (select 1 from public.project_invitations i
                          where i.project_id = pr.id and i.invited_profile_id = v_me))
         and (p_status is null or p_status = 'all'
              or (p_status = 'open' and pr.status in ('recruiting','team_ready','active'))
              or (p_status = 'closed' and pr.status in ('completed','failed','cancelled','archived'))
              or pr.status = p_status)
         and (p_project_type is null or pr.project_type = p_project_type)
         and (p_sector_id is null or pr.sector_id = p_sector_id)
         and (p_compensation is null or pr.compensation_type = p_compensation)
         and (p_country_code is null or exists (select 1 from public.project_countries pc
                                                 where pc.project_id = pr.id and pc.country_code = p_country_code))
         and (v_q is null or pr.title ilike '%' || v_q || '%' or pr.summary ilike '%' || v_q || '%')
         and (v_c_at is null or (coalesce(pr.published_at, pr.created_at), pr.id) < (v_c_at, v_c_id))
       order by coalesce(pr.published_at, pr.created_at) desc, pr.id desc limit v_limit)
    select coalesce(jsonb_agg(private.project_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
           private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
      into v_rows, v_next from base b;
  end if;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;
revoke all on function public.list_projects(text, text, text, bigint, char(2), text, text, text, integer) from public, anon;
grant execute on function public.list_projects(text, text, text, bigint, char(2), text, text, text, integer) to authenticated;

create or replace function public.get_project(p_project uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$ select private.project_card(p_project, true) $$;
revoke all on function public.get_project(uuid) from public, anon;
grant execute on function public.get_project(uuid) to authenticated;


-- Donnees financieres : schema `private`, membres de l'equipe seulement.
create or replace function public.get_project_confidential_details(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_out jsonb;
begin
  if private.current_profile_id() is null then
    raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.is_project_member(p_project) then
    raise exception 'financial_data_reserved_to_team' using errcode = '42501'; end if;
  select jsonb_build_object('client_name', d.client_name, 'funder_name', d.funder_name,
           'budget_estimate', d.budget_estimate, 'budget_currency', d.budget_currency,
           'financial_notes', d.financial_notes, 'revenue_generated', d.revenue_generated,
           'revenue_currency', d.revenue_currency)
    into v_out from private.project_confidential_details d where d.project_id = p_project;
  return v_out;
end
$fn$;
revoke all on function public.get_project_confidential_details(uuid) from public, anon;
grant execute on function public.get_project_confidential_details(uuid) to authenticated;
comment on function public.get_project_confidential_details(uuid) is
  'Donnees financieres d''un projet. Reservees a l''equipe : 42501 pour tout autre appelant.';


-- ISE-088, onglet « Mes collaborations ».
create or replace function public.list_my_projects(
  p_group text default 'participating', p_cursor text default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_group text := coalesce(p_group, 'participating');
  v_rows jsonb := '[]'::jsonb; v_next text; v_c_at timestamptz; v_c_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_group not in ('coordinating','participating','invitations','interests','completed') then
    raise exception 'invalid_group' using errcode = 'P0001'; end if;
  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select pr.id, coalesce(pr.published_at, pr.created_at) as at
      from public.projects pr
     where pr.deleted_at is null and private.can_see_project(pr.id)
       and case v_group
             when 'coordinating' then pr.owner_profile_id = v_me
             when 'participating' then exists (select 1 from public.project_members m
                                                where m.project_id = pr.id and m.profile_id = v_me
                                                  and m.membership_status in ('pending_confirmation','active'))
             when 'invitations' then exists (select 1 from public.project_invitations i
                                              where i.project_id = pr.id and i.invited_profile_id = v_me
                                                and i.status in ('sent','question_asked'))
             when 'interests' then exists (select 1 from public.project_applications a
                                            where a.project_id = pr.id and a.applicant_profile_id = v_me
                                              and a.status in ('submitted','reviewing','shortlisted','selected'))
             else pr.status in ('completed','failed','cancelled','archived')
                  and (pr.owner_profile_id = v_me
                       or exists (select 1 from public.project_members m
                                   where m.project_id = pr.id and m.profile_id = v_me
                                     and m.membership_status in ('active','completed')))
           end
       and (v_c_at is null or (coalesce(pr.published_at, pr.created_at), pr.id) < (v_c_at, v_c_id))
     order by coalesce(pr.published_at, pr.created_at) desc, pr.id desc limit v_limit)
  select coalesce(jsonb_agg(private.project_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;
revoke all on function public.list_my_projects(text, text, integer) from public, anon;
grant execute on function public.list_my_projects(text, text, integer) to authenticated;


-- =====================================================================
-- Ecritures
-- =====================================================================

-- ISE-090. N'ECRIT QUE DANS `project_applications` (MASTER PROMPT 32).
create or replace function public.submit_project_interest(
  p_project uuid, p_role uuid, p_message text, p_availability_notes text,
  p_availability_confirmed boolean, p_terms_acknowledged boolean, p_cv_consent boolean)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_id uuid; v_mode text;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.is_active_member() then raise exception 'not_active_member' using errcode = '42501'; end if;
  if not private.can_see_project(p_project) then
    raise exception 'project_not_visible' using errcode = '42501'; end if;
  if private.is_project_owner(p_project) then
    raise exception 'owner_cannot_apply' using errcode = 'P0001'; end if;
  if coalesce(p_terms_acknowledged, false) is not true then
    raise exception 'terms_not_acknowledged' using errcode = 'P0001'; end if;

  if p_role is not null then
    select r.application_mode into v_mode from public.project_roles r
     where r.id = p_role and r.project_id = p_project and r.status in ('open','partially_filled');
    if v_mode is null then raise exception 'role_not_open' using errcode = 'P0001'; end if;
    if v_mode = 'invitation_only' and not exists (
         select 1 from public.project_invitations i
          where i.project_id = p_project and i.invited_profile_id = v_me
            and i.status in ('sent','accepted','question_asked')) then
      raise exception 'role_invitation_only' using errcode = 'P0001';
    end if;
  end if;

  if exists (select 1 from public.project_applications a
              where a.project_id = p_project and a.applicant_profile_id = v_me
                and coalesce(a.project_role_id::text, '') = coalesce(p_role::text, '')
                and a.status in ('submitted','reviewing','shortlisted','selected')) then
    raise exception 'interest_already_expressed' using errcode = 'P0001';
  end if;

  if not private.consume_rate_limit('profile:' || v_me::text, 'project_interest', 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001'; end if;

  insert into public.project_applications
    (project_id, project_role_id, applicant_profile_id, message, availability_notes,
     availability_confirmed, terms_acknowledged, cv_consent, status, submitted_at)
  values (p_project, p_role, v_me, nullif(btrim(coalesce(p_message, '')), ''),
     nullif(btrim(coalesce(p_availability_notes, '')), ''),
     coalesce(p_availability_confirmed, false), true, coalesce(p_cv_consent, false),
     'submitted', clock_timestamp())
  returning id into v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('project.interest_submitted', 'project', p_project, v_me,
          jsonb_build_object('application_id', v_id, 'role_id', p_role));

  return jsonb_build_object('application_id', v_id, 'status', 'submitted',
                            'creates_membership', false);
end
$fn$;
revoke all on function public.submit_project_interest(uuid, uuid, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.submit_project_interest(uuid, uuid, text, text, boolean, boolean, boolean) to authenticated;
comment on function public.submit_project_interest(uuid, uuid, text, text, boolean, boolean, boolean) is
  'ISE-090. Expression d''interet uniquement. Ne cree JAMAIS de project_members (MASTER PROMPT 32).';


create or replace function public.withdraw_project_interest(p_application uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_n integer; v_project uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select a.project_id into v_project from public.project_applications a
   where a.id = p_application and a.applicant_profile_id = v_me;
  if v_project is null then raise exception 'application_not_found' using errcode = 'P0001'; end if;
  update public.project_applications set status = 'withdrawn'
   where id = p_application and applicant_profile_id = v_me and status = 'submitted';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'cannot_withdraw' using errcode = 'P0001'; end if;
  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('project.interest_withdrawn', 'project', v_project, v_me,
          jsonb_build_object('application_id', p_application));
  return jsonb_build_object('status', 'withdrawn');
end
$fn$;
revoke all on function public.withdraw_project_interest(uuid) from public, anon;
grant execute on function public.withdraw_project_interest(uuid) to authenticated;


-- Invitation acceptee -> `pending_confirmation`, JAMAIS `active`.
create or replace function public.respond_project_invitation(p_invitation uuid, p_response text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_row record; v_member uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_response not in ('accepted','declined','question_asked') then
    raise exception 'invalid_response' using errcode = 'P0001'; end if;
  select i.id, i.project_id, i.project_role_id, i.status into v_row
    from public.project_invitations i
   where i.id = p_invitation and i.invited_profile_id = v_me;
  if v_row.id is null then raise exception 'invitation_not_found' using errcode = 'P0001'; end if;
  if v_row.status not in ('sent','question_asked') then
    raise exception 'invitation_already_answered' using errcode = 'P0001'; end if;

  update public.project_invitations
     set status = p_response, responded_at = clock_timestamp()
   where id = p_invitation;

  if p_response = 'accepted' then
    insert into public.project_members
      (project_id, profile_id, project_role_id, source_invitation_id, membership_role,
       membership_status, agreed_terms, cv_consent)
    values (v_row.project_id, v_me, v_row.project_role_id, v_row.id, 'member',
       'pending_confirmation', '{}'::jsonb, false)
    on conflict do nothing
    returning id into v_member;
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('project.invitation_answered', 'project', v_row.project_id, v_me,
          jsonb_build_object('invitation_id', p_invitation, 'response', p_response));

  return jsonb_build_object('status', p_response, 'member_id', v_member,
                            'membership_status', case when p_response = 'accepted'
                                                      then 'pending_confirmation' else null end);
end
$fn$;
revoke all on function public.respond_project_invitation(uuid, text) from public, anon;
grant execute on function public.respond_project_invitation(uuid, text) to authenticated;


-- SEUL chemin vers `membership_status = 'active'` (CA-PROJ-05, U 84-85).
create or replace function public.confirm_project_membership(
  p_project uuid, p_agreed_terms jsonb default '{}'::jsonb, p_cv_consent boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_id uuid; v_now timestamptz := clock_timestamp();
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select m.id into v_id from public.project_members m
   where m.project_id = p_project and m.profile_id = v_me
     and m.membership_status in ('invited','pending_confirmation')
   order by m.created_at desc limit 1;
  if v_id is null then raise exception 'no_pending_membership' using errcode = 'P0001'; end if;

  update public.project_members
     set membership_status = 'active',
         confirmed_at = v_now,
         joined_at = coalesce(joined_at, v_now),
         cv_consent = coalesce(p_cv_consent, false),
         agreed_terms = coalesce(p_agreed_terms, '{}'::jsonb)
                        || jsonb_build_object('confirmed_at', v_now, 'confirmed_by', v_me)
   where id = v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('project.membership_confirmed', 'project', p_project, v_me,
          jsonb_build_object('member_id', v_id, 'confirmed_at', v_now));

  return jsonb_build_object('member_id', v_id, 'membership_status', 'active', 'confirmed_at', v_now);
end
$fn$;
revoke all on function public.confirm_project_membership(uuid, jsonb, boolean) from public, anon;
grant execute on function public.confirm_project_membership(uuid, jsonb, boolean) to authenticated;
comment on function public.confirm_project_membership(uuid, jsonb, boolean) is
  'Seul chemin vers project_members.active. Consentement horodate obligatoire (MASTER PROMPT 32, CA-PROJ-05).';


-- Un membre n'est jamais bloque dans un projet (DIGEST D 5.8, U 148-150).
create or replace function public.withdraw_project_membership(p_project uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_n integer;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.project_members
     set membership_status = 'withdrawn', left_at = clock_timestamp()
   where project_id = p_project and profile_id = v_me
     and membership_status in ('invited','pending_confirmation','active');
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'no_membership_to_withdraw' using errcode = 'P0001'; end if;
  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('project.membership_withdrawn', 'project', p_project, v_me, '{}'::jsonb);
  return jsonb_build_object('membership_status', 'withdrawn');
end
$fn$;
revoke all on function public.withdraw_project_membership(uuid) from public, anon;
grant execute on function public.withdraw_project_membership(uuid) to authenticated;


-- ISE-091 — ma participation. Impact reel : uniquement des decomptes constates.
create or replace function public.get_my_project_participation(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_card jsonb; v_mine record;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select m.id, m.membership_role, m.membership_status, m.project_role_id, m.confirmed_at, m.agreed_terms
    into v_mine
  from public.project_members m
  where m.project_id = p_project and m.profile_id = v_me
  order by m.created_at desc limit 1;
  if v_mine.id is null and not private.is_project_owner(p_project) then
    raise exception 'not_project_participant' using errcode = '42501'; end if;

  v_card := private.project_card(p_project, true);
  if v_card is null then return null; end if;

  return v_card || jsonb_build_object(
    'my_participation', case when v_mine.id is null then null else jsonb_build_object(
      'member_id', v_mine.id, 'membership_role', v_mine.membership_role,
      'membership_status', v_mine.membership_status, 'confirmed_at', v_mine.confirmed_at,
      'agreed_terms', v_mine.agreed_terms,
      'role_title', (select r.title from public.project_roles r where r.id = v_mine.project_role_id)) end,
    'my_milestones', coalesce((select jsonb_agg(jsonb_build_object(
                        'milestone_id', ms.id, 'title', ms.title, 'due_date', ms.due_date,
                        'status', ms.status) order by ms.due_date nulls last, ms.sort_order)
                        from public.project_milestones ms
                       where ms.project_id = p_project and ms.owner_profile_id = v_me), '[]'::jsonb),
    'next_milestone', (select jsonb_build_object('milestone_id', ms.id, 'title', ms.title,
                                'due_date', ms.due_date, 'status', ms.status)
                         from public.project_milestones ms
                        where ms.project_id = p_project and ms.status in ('todo','in_progress')
                        order by ms.due_date nulls last, ms.sort_order limit 1),
    'impact', jsonb_build_object(
      'members_confirmed', (select count(*) from public.project_members m
                             where m.project_id = p_project and m.membership_status = 'active'),
      'roles_filled', (select count(distinct m.project_role_id) from public.project_members m
                        where m.project_id = p_project and m.membership_status = 'active'
                          and m.project_role_id is not null),
      'roles_total', (select count(*) from public.project_roles r where r.project_id = p_project),
      'milestones_done', (select count(*) from public.project_milestones ms
                           where ms.project_id = p_project and ms.status = 'done'),
      'milestones_total', (select count(*) from public.project_milestones ms
                            where ms.project_id = p_project)));
end
$fn$;
revoke all on function public.get_my_project_participation(uuid) from public, anon;
grant execute on function public.get_my_project_participation(uuid) to authenticated;


-- Un jalon dont je suis responsable : je le fais avancer moi-meme.
create or replace function public.set_project_milestone_status(p_milestone uuid, p_status text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_row record;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_status not in ('todo','in_progress','done','blocked') then
    raise exception 'invalid_milestone_status' using errcode = 'P0001'; end if;
  select ms.id, ms.project_id, ms.owner_profile_id into v_row
    from public.project_milestones ms where ms.id = p_milestone;
  if v_row.id is null then raise exception 'milestone_not_found' using errcode = 'P0001'; end if;
  if v_row.owner_profile_id is distinct from v_me and not private.is_project_owner(v_row.project_id) then
    raise exception 'not_milestone_owner' using errcode = '42501'; end if;
  update public.project_milestones
     set status = p_status,
         completed_at = case when p_status = 'done' then coalesce(completed_at, clock_timestamp()) else null end
   where id = p_milestone;
  return jsonb_build_object('milestone_id', p_milestone, 'status', p_status);
end
$fn$;
revoke all on function public.set_project_milestone_status(uuid, text) from public, anon;
grant execute on function public.set_project_milestone_status(uuid, text) to authenticated;
