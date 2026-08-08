-- 0021_rls_identity_profile_network
-- Applique le 2026-08-08 (version 20260808005832)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0021_rls_identity_profile_network
-- Politiques RLS des lots Identite (Phase 2) et Reseau (Phase 3).
-- MASTER PROMPT §11, §17, §47, §80 ; D-72, D-73.
-- =====================================================================

-- Un membre peut-il voir une donnee appartenant a `p_owner`
-- portant le niveau de visibilite `p_visibility` ?
create or replace function private.can_see_field(p_owner uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when private.current_profile_id() is null then false
      when p_owner = private.current_profile_id() then true
      when private.is_blocked_between(p_owner, private.current_profile_id()) then false
      when private.has_permission('profiles.read') then true
      when p_visibility = 'private'     then false
      when p_visibility = 'members'     then private.is_active_member()
      when p_visibility = 'connections' then private.is_connected_to(p_owner)
      when p_visibility = 'promotion'   then private.shares_promotion_with(p_owner)
      else false
    end
$$;
grant execute on function private.can_see_field(uuid, text) to authenticated;

-- Un profil est-il consultable par le membre courant ?
create or replace function private.can_see_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when private.current_profile_id() is null then false
      when p_profile = private.current_profile_id() then true
      when private.has_permission('profiles.read') then true
      when private.is_blocked_between(p_profile, private.current_profile_id()) then false
      else private.is_active_member() and exists (
        select 1 from public.ise_profiles p
        where p.id = p_profile
          and p.deleted_at is null
          and p.profile_status in ('referenced', 'active')
      )
    end
$$;
grant execute on function private.can_see_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ise_profiles
-- ---------------------------------------------------------------------
drop policy if exists ise_profiles_select on public.ise_profiles;
create policy ise_profiles_select on public.ise_profiles
  for select to authenticated
  using (private.can_see_profile(id));

drop policy if exists ise_profiles_update_own on public.ise_profiles;
create policy ise_profiles_update_own on public.ise_profiles
  for update to authenticated
  using (id = private.current_profile_id())
  with check (id = private.current_profile_id());

drop policy if exists ise_profiles_admin_write on public.ise_profiles;
create policy ise_profiles_admin_write on public.ise_profiles
  for all to authenticated
  using (private.has_permission('profiles.edit'))
  with check (private.has_permission('profiles.edit'));

-- ---------------------------------------------------------------------
-- Visibilite par champ : lisible et modifiable par son seul proprietaire.
-- ---------------------------------------------------------------------
drop policy if exists profile_visibility_own on public.profile_visibility;
create policy profile_visibility_own on public.profile_visibility
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Sections du profil portant une colonne `visibility`.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['experiences', 'educations', 'profile_projects',
                           'recommendations', 'profile_availabilities'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated
        using (private.can_see_field(%3$I, visibility));
    $p$, t || '_select', t,
         case when t = 'recommendations' then 'subject_profile_id' else 'profile_id' end);

    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (%3$I = private.current_profile_id())
        with check (%3$I = private.current_profile_id());
    $p$, t || '_write_own', t,
         case when t = 'recommendations' then 'author_profile_id' else 'profile_id' end);
  end loop;
end
$$;

-- Le sujet d'une recommandation peut la masquer sans pouvoir la reecrire.
drop policy if exists recommendations_subject_moderate on public.recommendations;
create policy recommendations_subject_moderate on public.recommendations
  for update to authenticated
  using (subject_profile_id = private.current_profile_id())
  with check (subject_profile_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Sections du profil sans colonne `visibility` : visibles si le profil l'est.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['profile_skills', 'profile_sectors', 'profile_functions',
                           'profile_expertise_areas', 'profile_languages',
                           'profile_tools', 'profile_geographies'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated
        using (private.can_see_profile(profile_id));
    $p$, t || '_select', t);

    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (profile_id = private.current_profile_id())
        with check (profile_id = private.current_profile_id());
    $p$, t || '_write_own', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Donnees strictement personnelles : proprietaire uniquement.
-- Le score de completion et les recherches sauvegardees ne sont
-- JAMAIS lisibles par un tiers (D-72).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['saved_searches', 'search_alerts', 'saved_profiles',
                           'profile_blocks'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (%3$I = private.current_profile_id())
        with check (%3$I = private.current_profile_id());
    $p$, t || '_own', t,
         case when t = 'profile_blocks' then 'blocker_profile_id' else 'profile_id' end);
  end loop;
end
$$;

drop policy if exists search_alert_seen_results_own on public.search_alert_seen_results;
create policy search_alert_seen_results_own on public.search_alert_seen_results
  for all to authenticated
  using (exists (select 1 from public.search_alerts a
                 where a.id = alert_id and a.profile_id = private.current_profile_id()))
  with check (exists (select 1 from public.search_alerts a
                      where a.id = alert_id and a.profile_id = private.current_profile_id()));

-- L'index de recherche n'est jamais lu par un client : il sert au moteur serveur.
-- Aucune politique => table fermee a `authenticated`, accessible en `service_role`.

-- ---------------------------------------------------------------------
-- Reclamation de profil
-- ---------------------------------------------------------------------
drop policy if exists profile_claims_own on public.profile_claims;
create policy profile_claims_own on public.profile_claims
  for select to authenticated
  using (claimant_user_id = (select auth.uid()) or private.has_permission('profiles.verify'));

drop policy if exists profile_claims_insert_own on public.profile_claims;
create policy profile_claims_insert_own on public.profile_claims
  for insert to authenticated
  with check (claimant_user_id = (select auth.uid()) and status = 'submitted');

drop policy if exists profile_claims_withdraw_own on public.profile_claims;
create policy profile_claims_withdraw_own on public.profile_claims
  for update to authenticated
  using (claimant_user_id = (select auth.uid()) and status in ('submitted', 'under_review'))
  with check (claimant_user_id = (select auth.uid()));

drop policy if exists profile_claims_review on public.profile_claims;
create policy profile_claims_review on public.profile_claims
  for all to authenticated
  using (private.has_permission('profiles.verify'))
  with check (private.has_permission('profiles.verify'));

drop policy if exists profile_verifications_read on public.profile_verifications;
create policy profile_verifications_read on public.profile_verifications
  for select to authenticated
  using (profile_id = private.current_profile_id() or private.has_permission('profiles.verify'));

drop policy if exists profile_claim_disputes_admin on public.profile_claim_disputes;
create policy profile_claim_disputes_admin on public.profile_claim_disputes
  for all to authenticated
  using (private.has_permission('profiles.moderate'))
  with check (private.has_permission('profiles.moderate'));

-- ---------------------------------------------------------------------
-- Promotions : appartenance et animation
-- ---------------------------------------------------------------------
drop policy if exists promotion_memberships_select on public.promotion_memberships;
create policy promotion_memberships_select on public.promotion_memberships
  for select to authenticated
  using (private.is_active_member());

drop policy if exists promotion_memberships_manage on public.promotion_memberships;
create policy promotion_memberships_manage on public.promotion_memberships
  for all to authenticated
  using (private.has_permission('promotions.manage'))
  with check (private.has_permission('promotions.manage'));

drop policy if exists promotion_managers_select on public.promotion_managers;
create policy promotion_managers_select on public.promotion_managers
  for select to authenticated using (private.is_active_member());

drop policy if exists promotion_managers_manage on public.promotion_managers;
create policy promotion_managers_manage on public.promotion_managers
  for all to authenticated
  using (private.has_permission('promotions.manage'))
  with check (private.has_permission('promotions.manage'));

drop policy if exists promotion_invitations_own on public.promotion_invitations;
create policy promotion_invitations_own on public.promotion_invitations
  for select to authenticated
  using (inviter_profile_id = private.current_profile_id()
         or private.has_permission('promotions.manage'));

drop policy if exists promotion_invitations_create on public.promotion_invitations;
create policy promotion_invitations_create on public.promotion_invitations
  for insert to authenticated
  with check (inviter_profile_id = private.current_profile_id());

drop policy if exists missing_member_suggestions_own on public.missing_member_suggestions;
create policy missing_member_suggestions_own on public.missing_member_suggestions
  for select to authenticated
  using (submitted_by_profile_id = private.current_profile_id()
         or private.has_permission('promotions.manage'));

drop policy if exists missing_member_suggestions_create on public.missing_member_suggestions;
create policy missing_member_suggestions_create on public.missing_member_suggestions
  for insert to authenticated
  with check (submitted_by_profile_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Demandes de recommandation
-- ---------------------------------------------------------------------
drop policy if exists recommendation_requests_involved on public.recommendation_requests;
create policy recommendation_requests_involved on public.recommendation_requests
  for select to authenticated
  using (requester_profile_id = private.current_profile_id()
         or recipient_profile_id = private.current_profile_id());

drop policy if exists recommendation_requests_create on public.recommendation_requests;
create policy recommendation_requests_create on public.recommendation_requests
  for insert to authenticated
  with check (requester_profile_id = private.current_profile_id()
              and not private.is_blocked_between(requester_profile_id, recipient_profile_id));

drop policy if exists recommendation_requests_respond on public.recommendation_requests;
create policy recommendation_requests_respond on public.recommendation_requests
  for update to authenticated
  using (recipient_profile_id = private.current_profile_id()
         or requester_profile_id = private.current_profile_id())
  with check (recipient_profile_id = private.current_profile_id()
              or requester_profile_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Relations
-- ---------------------------------------------------------------------
drop policy if exists connection_requests_involved on public.connection_requests;
create policy connection_requests_involved on public.connection_requests
  for select to authenticated
  using (requester_profile_id = private.current_profile_id()
         or addressee_profile_id = private.current_profile_id());

drop policy if exists connection_requests_create on public.connection_requests;
create policy connection_requests_create on public.connection_requests
  for insert to authenticated
  with check (requester_profile_id = private.current_profile_id()
              and private.is_active_member()
              and not private.is_blocked_between(requester_profile_id, addressee_profile_id)
              and status = 'pending');

-- Refus et retrait passent par une mise a jour ; l'acceptation passe
-- obligatoirement par public.accept_connection_request() (transaction atomique).
drop policy if exists connection_requests_respond on public.connection_requests;
create policy connection_requests_respond on public.connection_requests
  for update to authenticated
  using (
    (addressee_profile_id = private.current_profile_id() and status = 'pending')
    or (requester_profile_id = private.current_profile_id() and status = 'pending')
  )
  with check (status in ('declined', 'withdrawn'));

drop policy if exists connections_select on public.connections;
create policy connections_select on public.connections
  for select to authenticated
  using (
    profile_a_id = private.current_profile_id()
    or profile_b_id = private.current_profile_id()
    -- Relations d'un tiers : visibles pour proposer un chemin d'introduction (D-51),
    -- uniquement si l'un des deux membres est en relation avec moi.
    or private.is_connected_to(profile_a_id)
    or private.is_connected_to(profile_b_id)
  );

-- Une relation ne se cree que par la fonction atomique ; on autorise
-- uniquement la suppression par l'un des deux membres.
drop policy if exists connections_delete_own on public.connections;
create policy connections_delete_own on public.connections
  for delete to authenticated
  using (profile_a_id = private.current_profile_id()
         or profile_b_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Introductions
-- ---------------------------------------------------------------------
drop policy if exists introduction_requests_involved on public.introduction_requests;
create policy introduction_requests_involved on public.introduction_requests
  for select to authenticated
  using (
    requester_profile_id    = private.current_profile_id()
    or intermediary_profile_id = private.current_profile_id()
    -- La cible ne voit la demande qu'une fois l'introduction reellement faite.
    or (target_profile_id = private.current_profile_id()
        and status in ('introduced', 'target_responded', 'completed', 'no_outcome'))
  );

drop policy if exists introduction_requests_create on public.introduction_requests;
create policy introduction_requests_create on public.introduction_requests
  for insert to authenticated
  with check (
    requester_profile_id = private.current_profile_id()
    and private.is_active_member()
    -- D-51 : l'intermediaire doit etre une relation directe du demandeur.
    and private.is_connected_to(intermediary_profile_id)
    and not private.is_blocked_between(requester_profile_id, target_profile_id)
    and not private.is_blocked_between(requester_profile_id, intermediary_profile_id)
    and status = 'requested'
  );

-- Toute transition passe par public.transition_introduction() : aucune
-- politique UPDATE n'est ouverte aux clients.

drop policy if exists introduction_events_involved on public.introduction_events;
create policy introduction_events_involved on public.introduction_events
  for select to authenticated
  using (exists (
    select 1 from public.introduction_requests i
    where i.id = introduction_id
      and (i.requester_profile_id = private.current_profile_id()
           or i.intermediary_profile_id = private.current_profile_id())
  ));
