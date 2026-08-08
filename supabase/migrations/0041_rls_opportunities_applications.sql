-- =====================================================================
-- 0041_rls_opportunities_applications
-- Ouverture des politiques RLS du lot « Opportunites et candidatures » (0008).
--
-- Lecture d'une opportunite : meme regle d'audience qu'un appel au reseau
-- (visibilite D-73 + ciblage explicite + blocage), plus le statut de
-- moderation : une annonce en attente ou rejetee n'est visible que de son
-- auteur et de `opportunities.manage`.
--
-- Une CANDIDATURE n'est visible que par deux parties : le candidat et le
-- responsable de l'opportunite (auteur ou contact designe). Aucun autre
-- membre — y compris un autre candidat — n'y accede.
--
-- Ecriture : la candidature se cree en BROUILLON ; `submit_application`,
-- `declare_external_application` (D-55) et `transition_application_status`
-- sont les seuls chemins de transition. `close_opportunity` et
-- `expire_stale_opportunities` sont les seuls chemins de cloture.
--
-- Reference : MASTER PROMPT §15, §27, §29, §53, §80, §113 ; D-55, D-72, D-73.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Suis-je responsable de cette opportunite (auteur ou contact designe) ?
create or replace function private.is_opportunity_manager(p_opportunity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_opportunity is not null
     and private.current_profile_id() is not null
     and (
       private.has_permission('opportunities.manage')
       or exists (
         select 1 from public.opportunities o
         where o.id = p_opportunity
           and o.deleted_at is null
           and (o.author_profile_id = private.current_profile_id()
                or o.contact_profile_id = private.current_profile_id())
       )
     )
$$;
revoke all on function private.is_opportunity_manager(uuid) from public, anon;
grant execute on function private.is_opportunity_manager(uuid) to authenticated;
comment on function private.is_opportunity_manager(uuid) is
  'Responsable d''une opportunite : auteur, contact designe, ou porteur de `opportunities.manage`. Booleen.';

-- Auteur strict (pour l'ecriture des criteres).
create or replace function private.is_opportunity_author(p_opportunity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_opportunity is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.opportunities o
       where o.id = p_opportunity
         and o.author_profile_id = private.current_profile_id()
         and o.deleted_at is null
     )
$$;
revoke all on function private.is_opportunity_author(uuid) from public, anon;
grant execute on function private.is_opportunity_author(uuid) to authenticated;

create or replace function private.can_see_opportunity(p_opportunity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_opportunity is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.opportunities o
       where o.id = p_opportunity
         and (
           o.author_profile_id = private.current_profile_id()
           or o.contact_profile_id = private.current_profile_id()
           or private.has_permission('opportunities.manage')
           or (
             o.deleted_at is null
             and not private.is_blocked_between(o.author_profile_id, private.current_profile_id())
             and o.status in ('active', 'paused', 'closed', 'expired')
             and o.moderation_status in ('not_required', 'approved')
             and private.is_active_member()
             and (case o.visibility
                    when 'members'     then true
                    when 'connections' then private.is_connected_to(o.author_profile_id)
                    when 'promotion'   then private.shares_promotion_with(o.author_profile_id)
                    else false
                  end)
             and (
               (not exists (select 1 from public.opportunity_audience_profiles ap
                            where ap.opportunity_id = o.id)
                and not exists (select 1 from public.opportunity_audience_promotions aq
                                where aq.opportunity_id = o.id))
               or exists (select 1 from public.opportunity_audience_profiles ap
                          where ap.opportunity_id = o.id
                            and ap.profile_id = private.current_profile_id())
               or exists (select 1 from public.opportunity_audience_promotions aq
                          where aq.opportunity_id = o.id
                            and private.is_in_promotion(aq.promotion_id))
             )
           )
         )
     )
$$;
revoke all on function private.can_see_opportunity(uuid) from public, anon;
grant execute on function private.can_see_opportunity(uuid) to authenticated;
comment on function private.can_see_opportunity(uuid) is
  'Audience reelle d''une opportunite : visibilite D-73 + ciblage + moderation + blocage. Booleen.';

-- Une candidature n'a que deux parties.
create or replace function private.can_see_application(p_application uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_application is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.applications a
       where a.id = p_application
         and (
           a.applicant_profile_id = private.current_profile_id()
           -- Le responsable ne voit pas les brouillons du candidat (D-55 :
           -- aucun etat non constate n'est expose).
           or (a.status <> 'draft' and private.is_opportunity_manager(a.opportunity_id))
         )
     )
$$;
revoke all on function private.can_see_application(uuid) from public, anon;
grant execute on function private.can_see_application(uuid) to authenticated;
comment on function private.can_see_application(uuid) is
  'Candidat, ou responsable de l''opportunite une fois la candidature soumise. Booleen.';

-- ---------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------
drop policy if exists opportunities_select on public.opportunities;
create policy opportunities_select on public.opportunities
  for select to authenticated
  using (private.can_see_opportunity(id));

drop policy if exists opportunities_insert_own on public.opportunities;
create policy opportunities_insert_own on public.opportunities
  for insert to authenticated
  with check (author_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status = 'draft');

drop policy if exists opportunities_update_draft on public.opportunities;
create policy opportunities_update_draft on public.opportunities
  for update to authenticated
  using (author_profile_id = private.current_profile_id() and status = 'draft')
  with check (author_profile_id = private.current_profile_id() and status = 'draft');

drop policy if exists opportunities_delete_draft on public.opportunities;
create policy opportunities_delete_draft on public.opportunities
  for delete to authenticated
  using (author_profile_id = private.current_profile_id() and status = 'draft');

drop policy if exists opportunities_manage on public.opportunities;
create policy opportunities_manage on public.opportunities
  for all to authenticated
  using (private.has_permission('opportunities.manage'))
  with check (private.has_permission('opportunities.manage'));

-- ---------------------------------------------------------------------
-- Criteres, ciblage et questions : lus avec l'opportunite, ecrits par l'auteur.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['opportunity_skills', 'opportunity_tools',
                           'opportunity_languages', 'opportunity_countries',
                           'opportunity_audience_promotions',
                           'opportunity_audience_profiles',
                           'opportunity_questions'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated using (private.can_see_opportunity(opportunity_id));
    $p$, t || '_select', t);
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (private.is_opportunity_author(opportunity_id))
        with check (private.is_opportunity_author(opportunity_id));
    $p$, t || '_write_author', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- opportunity_matches : meme protection de score qu'en 0040.
-- ---------------------------------------------------------------------
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'opportunity_matches'
    and column_name not in ('score', 'component_scores');
  revoke select, insert, update on public.opportunity_matches from authenticated;
  execute format('grant select (%s) on public.opportunity_matches to authenticated', v_cols);
end
$$;
comment on column public.opportunity_matches.score is
  'Score PRIVE (MASTER PROMPT §15, D-72). Privilege de colonne retire a `authenticated`.';

drop policy if exists opportunity_matches_select on public.opportunity_matches;
create policy opportunity_matches_select on public.opportunity_matches
  for select to authenticated
  using (profile_id = private.current_profile_id()
         or private.is_opportunity_manager(opportunity_id));

-- ---------------------------------------------------------------------
-- Interet declare : signal strictement personnel (D-72). Un membre ne sait
-- pas qui d'autre suit une annonce, et l'auteur non plus : declarer un
-- interet n'est pas candidater (D-55).
-- ---------------------------------------------------------------------
drop policy if exists opportunity_interests_own on public.opportunity_interests;
create policy opportunity_interests_own on public.opportunity_interests
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and private.can_see_opportunity(opportunity_id));

drop policy if exists saved_opportunities_own on public.saved_opportunities;
create policy saved_opportunities_own on public.saved_opportunities
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and private.can_see_opportunity(opportunity_id));

-- Clic sortant : trace personnelle, jamais relue par un tiers.
drop policy if exists opportunity_outbound_clicks_own on public.opportunity_outbound_clicks;
create policy opportunity_outbound_clicks_own on public.opportunity_outbound_clicks
  for select to authenticated
  using (profile_id = private.current_profile_id());

drop policy if exists opportunity_outbound_clicks_create on public.opportunity_outbound_clicks;
create policy opportunity_outbound_clicks_create on public.opportunity_outbound_clicks
  for insert to authenticated
  with check (profile_id = private.current_profile_id()
              and private.can_see_opportunity(opportunity_id));

-- ---------------------------------------------------------------------
-- Invitations et parrainages : aucune sollicitation ne franchit un blocage.
-- ---------------------------------------------------------------------
drop policy if exists opportunity_invitations_involved on public.opportunity_invitations;
create policy opportunity_invitations_involved on public.opportunity_invitations
  for select to authenticated
  using (invited_profile_id = private.current_profile_id()
         or inviter_profile_id = private.current_profile_id()
         or private.is_opportunity_manager(opportunity_id));

drop policy if exists opportunity_invitations_create on public.opportunity_invitations;
create policy opportunity_invitations_create on public.opportunity_invitations
  for insert to authenticated
  with check (inviter_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.can_see_opportunity(opportunity_id)
              and not private.is_blocked_between(inviter_profile_id, invited_profile_id));

drop policy if exists opportunity_referrals_involved on public.opportunity_referrals;
create policy opportunity_referrals_involved on public.opportunity_referrals
  for select to authenticated
  using (referrer_profile_id = private.current_profile_id()
         or referred_profile_id = private.current_profile_id()
         or private.is_opportunity_manager(opportunity_id));

drop policy if exists opportunity_referrals_create on public.opportunity_referrals;
create policy opportunity_referrals_create on public.opportunity_referrals
  for insert to authenticated
  with check (referrer_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.can_see_opportunity(opportunity_id)
              and status = 'shared'
              and consent_confirmed
              and (referred_profile_id is null
                   or not private.is_blocked_between(referrer_profile_id, referred_profile_id)));

-- ---------------------------------------------------------------------
-- Resultats : ecrits par `close_opportunity` uniquement.
-- ---------------------------------------------------------------------
drop policy if exists opportunity_outcomes_select on public.opportunity_outcomes;
create policy opportunity_outcomes_select on public.opportunity_outcomes
  for select to authenticated
  using (private.is_opportunity_manager(opportunity_id)
         or private.has_permission('analytics.read'));

drop policy if exists opportunity_outcome_beneficiaries_select on public.opportunity_outcome_beneficiaries;
create policy opportunity_outcome_beneficiaries_select on public.opportunity_outcome_beneficiaries
  for select to authenticated
  using (profile_id = private.current_profile_id()
         or exists (select 1 from public.opportunity_outcomes o
                    where o.id = outcome_id
                      and private.is_opportunity_manager(o.opportunity_id)));

-- ---------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------
drop policy if exists applications_involved on public.applications;
create policy applications_involved on public.applications
  for select to authenticated
  using (private.can_see_application(id));

drop policy if exists applications_create_draft on public.applications;
create policy applications_create_draft on public.applications
  for insert to authenticated
  with check (applicant_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.can_see_opportunity(opportunity_id)
              and status = 'draft');

-- Le brouillon seul est modifiable directement : `status = 'draft'` figure
-- dans USING et dans WITH CHECK, donc aucune transition ne passe ici.
-- `submit_application`, `declare_external_application` et
-- `transition_application_status` restent les seuls chemins d'etat.
drop policy if exists applications_update_draft on public.applications;
create policy applications_update_draft on public.applications
  for update to authenticated
  using (applicant_profile_id = private.current_profile_id() and status = 'draft')
  with check (applicant_profile_id = private.current_profile_id() and status = 'draft');

drop policy if exists applications_delete_draft on public.applications;
create policy applications_delete_draft on public.applications
  for delete to authenticated
  using (applicant_profile_id = private.current_profile_id() and status = 'draft');

drop policy if exists application_answers_involved on public.application_answers;
create policy application_answers_involved on public.application_answers
  for select to authenticated
  using (private.can_see_application(application_id));

drop policy if exists application_answers_write_draft on public.application_answers;
create policy application_answers_write_draft on public.application_answers
  for all to authenticated
  using (exists (select 1 from public.applications a
                 where a.id = application_id
                   and a.applicant_profile_id = private.current_profile_id()
                   and a.status = 'draft'))
  with check (exists (select 1 from public.applications a
                      where a.id = application_id
                        and a.applicant_profile_id = private.current_profile_id()
                        and a.status = 'draft'));

drop policy if exists application_documents_involved on public.application_documents;
create policy application_documents_involved on public.application_documents
  for select to authenticated
  using (private.can_see_application(application_id));

drop policy if exists application_documents_write_draft on public.application_documents;
create policy application_documents_write_draft on public.application_documents
  for all to authenticated
  using (exists (select 1 from public.applications a
                 where a.id = application_id
                   and a.applicant_profile_id = private.current_profile_id()
                   and a.status = 'draft'))
  with check (exists (select 1 from public.applications a
                      where a.id = application_id
                        and a.applicant_profile_id = private.current_profile_id()
                        and a.status = 'draft'));

-- Journal d'etats : ecrit par `transition_application_status`, jamais par un client.
drop policy if exists application_status_history_involved on public.application_status_history;
create policy application_status_history_involved on public.application_status_history
  for select to authenticated
  using (private.can_see_application(application_id));

-- ---------------------------------------------------------------------
-- profile_documents
--
-- Un document de profil (CV, diplome) appartient a son proprietaire. Un
-- tiers n'y accede que par un chemin metier constate : le responsable
-- d'une opportunite lit le CV JOINT A UNE CANDIDATURE SOUMISE, et rien
-- d'autre. Le niveau `visibility` du document n'ouvre PAS l'acces a un
-- membre quelconque : un CV n'est pas une section de profil.
-- ---------------------------------------------------------------------
drop policy if exists profile_documents_own on public.profile_documents;
create policy profile_documents_own on public.profile_documents
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id());

drop policy if exists profile_documents_application_reader on public.profile_documents;
create policy profile_documents_application_reader on public.profile_documents
  for select to authenticated
  using (
    deleted_at is null
    and (
      exists (select 1 from public.applications a
              where a.cv_document_id = public.profile_documents.id
                and a.status <> 'draft'
                and private.is_opportunity_manager(a.opportunity_id))
      or exists (select 1 from public.application_documents ad
                 join public.applications a on a.id = ad.application_id
                 where ad.document_id = public.profile_documents.id
                   and a.status <> 'draft'
                   and private.is_opportunity_manager(a.opportunity_id))
    )
  );

drop policy if exists profile_documents_verify on public.profile_documents;
create policy profile_documents_verify on public.profile_documents
  for select to authenticated
  using (private.has_permission('profiles.verify'));
