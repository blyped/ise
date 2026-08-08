-- =====================================================================
-- 0045_rls_projects_consortiums
-- Ouverture des politiques RLS du lot « Projets et consortiums » (0012).
--
-- `projects.visibility` porte cinq niveaux qui ne sont PAS ceux de D-73 :
--   `network` · `community` · `promotion` · `invitation_only` · `team_only`.
-- Chacun est traduit explicitement ; il n'y a pas de defaut permissif.
--
-- Une CANDIDATURE de projet n'est visible que du candidat et du porteur.
-- Un LIEN CONFIDENTIEL (`project_links.is_confidential`) ne sort jamais de
-- l'equipe, meme si le projet est ouvert au reseau.
--
-- `private.is_project_owner()` et `private.is_project_member()` existent
-- depuis 0027 (Storage) : ils sont REUTILISES, jamais redefinis.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------
create or replace function private.can_see_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_project is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.projects pr
       where pr.id = p_project
         and (
           pr.owner_profile_id = private.current_profile_id()
           or private.has_permission('projects.manage')
           or private.is_project_member(p_project)
           or (
             pr.deleted_at is null
             and pr.status <> 'draft'
             and private.is_active_member()
             and not private.is_blocked_between(pr.owner_profile_id, private.current_profile_id())
             and (
               case pr.visibility
                 when 'network'    then true
                 when 'promotion'  then private.shares_promotion_with(pr.owner_profile_id)
                 when 'community'  then pr.source_community_id is not null
                                        and private.is_community_member(pr.source_community_id)
                 when 'invitation_only' then exists (
                        select 1 from public.project_invitations i
                        where i.project_id = pr.id
                          and i.invited_profile_id = private.current_profile_id()
                          and i.status in ('sent', 'accepted', 'question_asked'))
                 else false            -- 'team_only' : couvert par is_project_member
               end
             )
           )
         )
     )
$$;
revoke all on function private.can_see_project(uuid) from public, anon;
grant execute on function private.can_see_project(uuid) to authenticated;
comment on function private.can_see_project(uuid) is
  'Perimetre d''un projet : equipe, ou audience declaree (reseau / promotion / communaute / invitation). Booleen.';

create or replace function private.can_see_project_application(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_application is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.project_applications a
       where a.id = p_application
         and (a.applicant_profile_id = private.current_profile_id()
              or private.is_project_owner(a.project_id)
              or private.has_permission('projects.manage'))
     )
$$;
revoke all on function private.can_see_project_application(uuid) from public, anon;
grant execute on function private.can_see_project_application(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (private.can_see_project(id));

drop policy if exists projects_create on public.projects;
create policy projects_create on public.projects
  for insert to authenticated
  with check (owner_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status = 'draft');

drop policy if exists projects_update_owner on public.projects;
create policy projects_update_owner on public.projects
  for update to authenticated
  using (owner_profile_id = private.current_profile_id())
  with check (owner_profile_id = private.current_profile_id());

drop policy if exists projects_delete_draft on public.projects;
create policy projects_delete_draft on public.projects
  for delete to authenticated
  using (owner_profile_id = private.current_profile_id() and status = 'draft');

drop policy if exists projects_manage on public.projects;
create policy projects_manage on public.projects
  for all to authenticated
  using (private.has_permission('projects.manage'))
  with check (private.has_permission('projects.manage'));

-- ---------------------------------------------------------------------
-- Roles ouverts et leurs criteres
-- ---------------------------------------------------------------------
drop policy if exists project_roles_select on public.project_roles;
create policy project_roles_select on public.project_roles
  for select to authenticated
  using (private.can_see_project(project_id));

drop policy if exists project_roles_write_owner on public.project_roles;
create policy project_roles_write_owner on public.project_roles
  for all to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

do $$
declare t text;
begin
  foreach t in array array['project_role_skills', 'project_role_tools',
                           'project_role_languages', 'project_role_countries'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated
        using (exists (select 1 from public.project_roles r
                       where r.id = project_role_id
                         and private.can_see_project(r.project_id)));
    $p$, t || '_select', t);
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (exists (select 1 from public.project_roles r
                       where r.id = project_role_id
                         and private.is_project_owner(r.project_id)))
        with check (exists (select 1 from public.project_roles r
                            where r.id = project_role_id
                              and private.is_project_owner(r.project_id)));
    $p$, t || '_write_owner', t);
  end loop;
end
$$;

drop policy if exists project_countries_select on public.project_countries;
create policy project_countries_select on public.project_countries
  for select to authenticated
  using (private.can_see_project(project_id));

drop policy if exists project_countries_write_owner on public.project_countries;
create policy project_countries_write_owner on public.project_countries
  for all to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

drop policy if exists project_communities_select on public.project_communities;
create policy project_communities_select on public.project_communities
  for select to authenticated
  using (private.can_see_project(project_id));

drop policy if exists project_communities_write_owner on public.project_communities;
create policy project_communities_write_owner on public.project_communities
  for all to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

-- ---------------------------------------------------------------------
-- Equipe
-- ---------------------------------------------------------------------
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated
  using (profile_id = private.current_profile_id()
         or private.is_project_member(project_id));

drop policy if exists project_members_write_owner on public.project_members;
create policy project_members_write_owner on public.project_members
  for all to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

-- Un membre confirme SA propre participation : le consentement ne se
-- delegue pas (contrainte `project_members_consent_required`).
drop policy if exists project_members_confirm_own on public.project_members;
create policy project_members_confirm_own on public.project_members
  for update to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and membership_status in ('pending_confirmation', 'active', 'withdrawn'));

-- ---------------------------------------------------------------------
-- Candidatures et selection
-- ---------------------------------------------------------------------
drop policy if exists project_applications_involved on public.project_applications;
create policy project_applications_involved on public.project_applications
  for select to authenticated
  using (private.can_see_project_application(id));

drop policy if exists project_applications_create on public.project_applications;
create policy project_applications_create on public.project_applications
  for insert to authenticated
  with check (applicant_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.can_see_project(project_id)
              and status = 'submitted');

-- Le candidat ne peut que se retirer ; il ne s'auto-selectionne pas.
drop policy if exists project_applications_withdraw on public.project_applications;
create policy project_applications_withdraw on public.project_applications
  for update to authenticated
  using (applicant_profile_id = private.current_profile_id() and status = 'submitted')
  with check (applicant_profile_id = private.current_profile_id() and status = 'withdrawn');

drop policy if exists project_applications_review on public.project_applications;
create policy project_applications_review on public.project_applications
  for update to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

drop policy if exists project_selection_decisions_involved on public.project_selection_decisions;
create policy project_selection_decisions_involved on public.project_selection_decisions
  for select to authenticated
  using (private.can_see_project_application(application_id));

drop policy if exists project_selection_decisions_create on public.project_selection_decisions;
create policy project_selection_decisions_create on public.project_selection_decisions
  for insert to authenticated
  with check (decided_by_profile_id = private.current_profile_id()
              and exists (select 1 from public.project_applications a
                          where a.id = application_id
                            and private.is_project_owner(a.project_id)));

-- ---------------------------------------------------------------------
-- Invitations : aucune sollicitation ne franchit un blocage.
-- ---------------------------------------------------------------------
drop policy if exists project_invitations_involved on public.project_invitations;
create policy project_invitations_involved on public.project_invitations
  for select to authenticated
  using (invited_profile_id = private.current_profile_id()
         or invited_by_profile_id = private.current_profile_id()
         or private.is_project_owner(project_id));

drop policy if exists project_invitations_create on public.project_invitations;
create policy project_invitations_create on public.project_invitations
  for insert to authenticated
  with check (invited_by_profile_id = private.current_profile_id()
              and private.is_project_owner(project_id)
              and status = 'sent'
              and not private.is_blocked_between(invited_by_profile_id, invited_profile_id));

drop policy if exists project_invitations_respond on public.project_invitations;
create policy project_invitations_respond on public.project_invitations
  for update to authenticated
  using (invited_profile_id = private.current_profile_id() and status = 'sent')
  with check (invited_profile_id = private.current_profile_id()
              and status in ('accepted', 'declined', 'question_asked'));

drop policy if exists project_invitations_revoke on public.project_invitations;
create policy project_invitations_revoke on public.project_invitations
  for update to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

-- ---------------------------------------------------------------------
-- Vie du projet
-- ---------------------------------------------------------------------
drop policy if exists project_milestones_team on public.project_milestones;
create policy project_milestones_team on public.project_milestones
  for select to authenticated
  using (private.is_project_member(project_id));

drop policy if exists project_milestones_write_owner on public.project_milestones;
create policy project_milestones_write_owner on public.project_milestones
  for all to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

-- Un lien confidentiel ne sort pas de l'equipe, meme sur un projet ouvert.
drop policy if exists project_links_select on public.project_links;
create policy project_links_select on public.project_links
  for select to authenticated
  using (
    case
      when is_confidential then private.is_project_member(project_id)
      else private.can_see_project(project_id)
    end
  );

drop policy if exists project_links_write_team on public.project_links;
create policy project_links_write_team on public.project_links
  for all to authenticated
  using (added_by_profile_id = private.current_profile_id()
         or private.is_project_owner(project_id))
  with check (added_by_profile_id = private.current_profile_id()
              and private.is_project_member(project_id));

drop policy if exists project_closures_select on public.project_closures;
create policy project_closures_select on public.project_closures
  for select to authenticated
  using (private.can_see_project(project_id) or private.has_permission('analytics.read'));

drop policy if exists project_closures_write_owner on public.project_closures;
create policy project_closures_write_owner on public.project_closures
  for all to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id)
              and closed_by_profile_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Consortiums : demande d'une organisation portee par un membre.
-- ---------------------------------------------------------------------
drop policy if exists consortium_requests_involved on public.consortium_requests;
create policy consortium_requests_involved on public.consortium_requests
  for select to authenticated
  using (requested_by_profile_id = private.current_profile_id()
         or private.is_project_owner(project_id)
         or private.has_permission('projects.manage'));

drop policy if exists consortium_requests_create on public.consortium_requests;
create policy consortium_requests_create on public.consortium_requests
  for insert to authenticated
  with check (requested_by_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.can_see_project(project_id)
              and status = 'submitted');

drop policy if exists consortium_requests_withdraw on public.consortium_requests;
create policy consortium_requests_withdraw on public.consortium_requests
  for update to authenticated
  using (requested_by_profile_id = private.current_profile_id() and status = 'submitted')
  with check (requested_by_profile_id = private.current_profile_id() and status = 'withdrawn');

drop policy if exists consortium_requests_review on public.consortium_requests;
create policy consortium_requests_review on public.consortium_requests
  for update to authenticated
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));
