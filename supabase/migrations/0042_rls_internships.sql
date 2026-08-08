-- =====================================================================
-- 0042_rls_internships
-- Ouverture des politiques RLS du lot « Stages » (0009).
--
-- Un besoin de stage decrit la situation scolaire d'un etudiant : c'est
-- une donnee sensible. Il n'est JAMAIS visible par « tout membre » du
-- simple fait d'exister. Trois niveaux seulement (colonne `visibility`) :
--   * `internship_managers_and_relevant_alumni` — la gestion des stages,
--     et l'alumni QUE L'ETUDIANT A LUI-MEME SOLLICITE (demande d'aide) ou
--     dont il a candidate a l'offre. « Pertinent » se constate, il ne se
--     suppose pas (D-55) ;
--   * `verified_members` — les membres dont le profil est verifie ;
--   * `partner_organizations` — aucun compte organisation n'existe en V1
--     (MASTER PROMPT §6) : le niveau ne s'ouvre a personne.
--
-- Le suivi de candidature (`internship_applications`) est un carnet de
-- bord DECLARATIF (D-55) : il n'appartient qu'a l'etudiant.
--
-- Ajout de nomenclature : la permission `internships.manage` (D-30 autorise
-- l'extension selon le schema `<domaine>.<action>`). Aucun test de role en
-- dur n'est introduit (D-31).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permission dediee
-- ---------------------------------------------------------------------
insert into private.permissions (code, domain, action, description)
values ('internships.manage', 'internships', 'manage',
        'Gestion des stages : besoins, offres, placements, incidents.')
on conflict (code) do nothing;

insert into private.role_permissions (role_id, permission_id)
select r.id, p.id
from private.roles r, private.permissions p
where r.code = 'superadmin' and p.code = 'internships.manage'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function private.is_internship_offer_owner(p_offer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_offer is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.internship_offers o
       where o.id = p_offer
         and o.deleted_at is null
         and (o.created_by_profile_id = private.current_profile_id()
              or o.supervisor_profile_id = private.current_profile_id())
     )
$$;
revoke all on function private.is_internship_offer_owner(uuid) from public, anon;
grant execute on function private.is_internship_offer_owner(uuid) to authenticated;

create or replace function private.can_see_internship_offer(p_offer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_offer is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.internship_offers o
       where o.id = p_offer
         and (
           o.created_by_profile_id = private.current_profile_id()
           or o.supervisor_profile_id = private.current_profile_id()
           or private.has_permission('internships.manage')
           or (
             o.deleted_at is null
             and o.status in ('published', 'paused', 'filled', 'closed', 'expired')
             and private.is_active_member()
             and not private.is_blocked_between(o.created_by_profile_id, private.current_profile_id())
             and (o.target_promotion_id is null
                  or private.is_in_promotion(o.target_promotion_id))
           )
         )
     )
$$;
revoke all on function private.can_see_internship_offer(uuid) from public, anon;
grant execute on function private.can_see_internship_offer(uuid) to authenticated;

create or replace function private.can_see_internship_need(p_need uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_need is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.internship_needs n
       where n.id = p_need
         and (
           n.student_profile_id = private.current_profile_id()
           or private.has_permission('internships.manage')
           or (
             n.deleted_at is null
             and n.status in ('active', 'paused', 'matched', 'placed')
             and private.is_active_member()
             and not private.is_blocked_between(n.student_profile_id, private.current_profile_id())
             and (
               case n.visibility
                 when 'verified_members' then exists (
                   select 1 from public.ise_profiles me
                   where me.id = private.current_profile_id()
                     and me.verification_status = 'verified'
                 )
                 when 'internship_managers_and_relevant_alumni' then (
                   -- L'alumni « pertinent » est celui que l'etudiant a
                   -- lui-meme atteint : la pertinence se constate (D-55).
                   exists (select 1 from public.internship_help_requests h
                           where h.need_id = n.id
                             and h.alumni_profile_id = private.current_profile_id())
                   or exists (select 1 from public.internship_offer_interests i
                              where i.need_id = n.id
                                and private.is_internship_offer_owner(i.offer_id))
                 )
                 else false   -- 'partner_organizations' : aucun compte organisation en V1
               end
             )
           )
         )
     )
$$;
revoke all on function private.can_see_internship_need(uuid) from public, anon;
grant execute on function private.can_see_internship_need(uuid) to authenticated;
comment on function private.can_see_internship_need(uuid) is
  'Perimetre d''un besoin de stage. « Alumni pertinent » = alumni reellement sollicite par l''etudiant.';

create or replace function private.can_see_internship_placement(p_placement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_placement is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.internship_placements pl
       where pl.id = p_placement
         and (
           pl.student_profile_id = private.current_profile_id()
           or pl.professional_supervisor_profile_id = private.current_profile_id()
           or private.has_permission('internships.manage')
         )
     )
$$;
revoke all on function private.can_see_internship_placement(uuid) from public, anon;
grant execute on function private.can_see_internship_placement(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- internship_needs
-- ---------------------------------------------------------------------
drop policy if exists internship_needs_select on public.internship_needs;
create policy internship_needs_select on public.internship_needs
  for select to authenticated
  using (private.can_see_internship_need(id));

drop policy if exists internship_needs_write_own on public.internship_needs;
create policy internship_needs_write_own on public.internship_needs
  for all to authenticated
  using (student_profile_id = private.current_profile_id())
  with check (student_profile_id = private.current_profile_id()
              and private.is_active_member());

drop policy if exists internship_needs_manage on public.internship_needs;
create policy internship_needs_manage on public.internship_needs
  for all to authenticated
  using (private.has_permission('internships.manage'))
  with check (private.has_permission('internships.manage'));

do $$
declare t text;
begin
  foreach t in array array['internship_need_countries', 'internship_need_organization_types',
                           'internship_need_sectors', 'internship_need_skills'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated using (private.can_see_internship_need(need_id));
    $p$, t || '_select', t);
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (exists (select 1 from public.internship_needs n
                       where n.id = need_id
                         and n.student_profile_id = private.current_profile_id()))
        with check (exists (select 1 from public.internship_needs n
                            where n.id = need_id
                              and n.student_profile_id = private.current_profile_id()));
    $p$, t || '_write_own', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- internship_offers
-- ---------------------------------------------------------------------
drop policy if exists internship_offers_select on public.internship_offers;
create policy internship_offers_select on public.internship_offers
  for select to authenticated
  using (private.can_see_internship_offer(id));

drop policy if exists internship_offers_insert_own on public.internship_offers;
create policy internship_offers_insert_own on public.internship_offers
  for insert to authenticated
  with check (created_by_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status in ('draft', 'to_confirm'));

drop policy if exists internship_offers_update_own on public.internship_offers;
create policy internship_offers_update_own on public.internship_offers
  for update to authenticated
  using (created_by_profile_id = private.current_profile_id())
  with check (created_by_profile_id = private.current_profile_id());

drop policy if exists internship_offers_delete_own on public.internship_offers;
create policy internship_offers_delete_own on public.internship_offers
  for delete to authenticated
  using (created_by_profile_id = private.current_profile_id()
         and status in ('draft', 'to_confirm'));

drop policy if exists internship_offers_manage on public.internship_offers;
create policy internship_offers_manage on public.internship_offers
  for all to authenticated
  using (private.has_permission('internships.manage'))
  with check (private.has_permission('internships.manage'));

drop policy if exists internship_offer_skills_select on public.internship_offer_skills;
create policy internship_offer_skills_select on public.internship_offer_skills
  for select to authenticated
  using (private.can_see_internship_offer(offer_id));

drop policy if exists internship_offer_skills_write_owner on public.internship_offer_skills;
create policy internship_offer_skills_write_owner on public.internship_offer_skills
  for all to authenticated
  using (private.is_internship_offer_owner(offer_id))
  with check (private.is_internship_offer_owner(offer_id));

-- ---------------------------------------------------------------------
-- Manifestations d'interet : etudiant <-> porteur d'offre. Aucune
-- sollicitation ne franchit un blocage, dans les deux directions.
-- ---------------------------------------------------------------------
drop policy if exists internship_offer_interests_involved on public.internship_offer_interests;
create policy internship_offer_interests_involved on public.internship_offer_interests
  for select to authenticated
  using (student_profile_id = private.current_profile_id()
         or private.is_internship_offer_owner(offer_id)
         or private.has_permission('internships.manage'));

drop policy if exists internship_offer_interests_create on public.internship_offer_interests;
create policy internship_offer_interests_create on public.internship_offer_interests
  for insert to authenticated
  with check (
    private.is_active_member()
    and status in ('expressed', 'sent')
    and (
      (direction = 'student_interest'
       and student_profile_id = private.current_profile_id()
       and private.can_see_internship_offer(offer_id))
      or (direction = 'alumni_invitation'
          and invited_by_profile_id = private.current_profile_id()
          and private.is_internship_offer_owner(offer_id)
          and not private.is_blocked_between(invited_by_profile_id, student_profile_id))
    )
  );

drop policy if exists internship_offer_interests_respond on public.internship_offer_interests;
create policy internship_offer_interests_respond on public.internship_offer_interests
  for update to authenticated
  using (student_profile_id = private.current_profile_id()
         or private.is_internship_offer_owner(offer_id))
  with check (student_profile_id = private.current_profile_id()
              or private.is_internship_offer_owner(offer_id));

-- ---------------------------------------------------------------------
-- Carnet de bord declaratif : l'etudiant, et lui seul (D-55, D-72).
-- ---------------------------------------------------------------------
drop policy if exists internship_applications_own on public.internship_applications;
create policy internship_applications_own on public.internship_applications
  for all to authenticated
  using (student_profile_id = private.current_profile_id())
  with check (student_profile_id = private.current_profile_id());

drop policy if exists internship_applications_manage on public.internship_applications;
create policy internship_applications_manage on public.internship_applications
  for select to authenticated
  using (private.has_permission('internships.manage'));

drop policy if exists internship_application_events_involved on public.internship_application_events;
create policy internship_application_events_involved on public.internship_application_events
  for select to authenticated
  using (exists (select 1 from public.internship_applications a
                 where a.id = application_id
                   and (a.student_profile_id = private.current_profile_id()
                        or private.has_permission('internships.manage'))));

drop policy if exists internship_application_events_create on public.internship_application_events;
create policy internship_application_events_create on public.internship_application_events
  for insert to authenticated
  with check (declared_by_profile_id = private.current_profile_id()
              and exists (select 1 from public.internship_applications a
                          where a.id = application_id
                            and a.student_profile_id = private.current_profile_id()));

-- ---------------------------------------------------------------------
-- Demandes d'aide adressees a un alumni
-- ---------------------------------------------------------------------
drop policy if exists internship_help_requests_involved on public.internship_help_requests;
create policy internship_help_requests_involved on public.internship_help_requests
  for select to authenticated
  using (student_profile_id = private.current_profile_id()
         or alumni_profile_id = private.current_profile_id()
         or private.has_permission('internships.manage'));

drop policy if exists internship_help_requests_create on public.internship_help_requests;
create policy internship_help_requests_create on public.internship_help_requests
  for insert to authenticated
  with check (student_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status = 'sent'
              and not private.is_blocked_between(student_profile_id, alumni_profile_id));

drop policy if exists internship_help_requests_respond on public.internship_help_requests;
create policy internship_help_requests_respond on public.internship_help_requests
  for update to authenticated
  using (alumni_profile_id = private.current_profile_id()
         or (student_profile_id = private.current_profile_id()
             and status in ('sent', 'viewed', 'accepted')))
  with check (alumni_profile_id = private.current_profile_id()
              or (student_profile_id = private.current_profile_id()
                  and status = 'withdrawn'));

-- ---------------------------------------------------------------------
-- Placements, suivis, incidents, bilans
-- ---------------------------------------------------------------------
drop policy if exists internship_placements_involved on public.internship_placements;
create policy internship_placements_involved on public.internship_placements
  for select to authenticated
  using (private.can_see_internship_placement(id));

drop policy if exists internship_placements_write_student on public.internship_placements;
create policy internship_placements_write_student on public.internship_placements
  for all to authenticated
  using (student_profile_id = private.current_profile_id())
  with check (student_profile_id = private.current_profile_id());

drop policy if exists internship_placements_manage on public.internship_placements;
create policy internship_placements_manage on public.internship_placements
  for all to authenticated
  using (private.has_permission('internships.manage'))
  with check (private.has_permission('internships.manage'));

-- Le suivi de bien-etre est un echange etudiant <-> gestion des stages :
-- le maitre de stage n'y a AUCUN acces.
drop policy if exists internship_followups_student on public.internship_followups;
create policy internship_followups_student on public.internship_followups
  for select to authenticated
  using (exists (select 1 from public.internship_placements pl
                 where pl.id = placement_id
                   and (pl.student_profile_id = private.current_profile_id()
                        or private.has_permission('internships.manage'))));

drop policy if exists internship_followups_answer on public.internship_followups;
create policy internship_followups_answer on public.internship_followups
  for update to authenticated
  using (exists (select 1 from public.internship_placements pl
                 where pl.id = placement_id
                   and pl.student_profile_id = private.current_profile_id()))
  with check (exists (select 1 from public.internship_placements pl
                      where pl.id = placement_id
                        and pl.student_profile_id = private.current_profile_id()));

drop policy if exists internship_incidents_involved on public.internship_incidents;
create policy internship_incidents_involved on public.internship_incidents
  for select to authenticated
  using (reported_by_profile_id = private.current_profile_id()
         or private.has_permission('internships.manage')
         or private.has_permission('profiles.moderate'));

drop policy if exists internship_incidents_create on public.internship_incidents;
create policy internship_incidents_create on public.internship_incidents
  for insert to authenticated
  with check (reported_by_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status = 'open'
              and private.can_see_internship_placement(placement_id));

drop policy if exists internship_incidents_handle on public.internship_incidents;
create policy internship_incidents_handle on public.internship_incidents
  for update to authenticated
  using (private.has_permission('internships.manage'))
  with check (private.has_permission('internships.manage'));

drop policy if exists internship_outcomes_involved on public.internship_outcomes;
create policy internship_outcomes_involved on public.internship_outcomes
  for select to authenticated
  using (private.can_see_internship_placement(placement_id)
         or private.has_permission('analytics.read'));

drop policy if exists internship_outcomes_write_student on public.internship_outcomes;
create policy internship_outcomes_write_student on public.internship_outcomes
  for all to authenticated
  using (declared_by_profile_id = private.current_profile_id())
  with check (declared_by_profile_id = private.current_profile_id()
              and exists (select 1 from public.internship_placements pl
                          where pl.id = placement_id
                            and pl.student_profile_id = private.current_profile_id()));

drop policy if exists internship_outcome_skills_involved on public.internship_outcome_skills;
create policy internship_outcome_skills_involved on public.internship_outcome_skills
  for select to authenticated
  using (exists (select 1 from public.internship_outcomes o
                 where o.id = outcome_id
                   and (private.can_see_internship_placement(o.placement_id)
                        or private.has_permission('analytics.read'))));

drop policy if exists internship_outcome_skills_write_student on public.internship_outcome_skills;
create policy internship_outcome_skills_write_student on public.internship_outcome_skills
  for all to authenticated
  using (exists (select 1 from public.internship_outcomes o
                 join public.internship_placements pl on pl.id = o.placement_id
                 where o.id = outcome_id
                   and pl.student_profile_id = private.current_profile_id()))
  with check (exists (select 1 from public.internship_outcomes o
                      join public.internship_placements pl on pl.id = o.placement_id
                      where o.id = outcome_id
                        and pl.student_profile_id = private.current_profile_id()));
