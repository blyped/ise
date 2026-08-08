-- =====================================================================
-- 0043_rls_mentorship
-- Ouverture des politiques RLS du lot « Mentorat » (0010).
--
-- Une relation de mentorat est un espace a DEUX. Rien de ce qui s'y passe
-- (objectifs, seances, actions) ne sort du binome, sauf :
--   * les NOTES de seance, qui n'appartiennent qu'a leur auteur — un mentor
--     ne lit pas les notes de son mentore, et reciproquement (D-72) ;
--   * le BILAN (`mentorship_feedback`), confidentiel vis-a-vis de l'autre
--     partie : sinon la sincerite du retour disparait.
--
-- L'annuaire des mentors n'expose que les mentors ACTIFS, et jamais a
-- travers un blocage.
-- =====================================================================

insert into private.permissions (code, domain, action, description)
values ('mentorship.manage', 'mentorship', 'manage',
        'Animation du dispositif de mentorat.')
on conflict (code) do nothing;

insert into private.role_permissions (role_id, permission_id)
select r.id, p.id from private.roles r, private.permissions p
where r.code = 'superadmin' and p.code = 'mentorship.manage'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function private.is_mentorship_party(p_mentorship uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_mentorship is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.mentorships m
       where m.id = p_mentorship
         and (m.mentor_profile_id = private.current_profile_id()
              or m.mentee_profile_id = private.current_profile_id())
     )
$$;
revoke all on function private.is_mentorship_party(uuid) from public, anon;
grant execute on function private.is_mentorship_party(uuid) to authenticated;
comment on function private.is_mentorship_party(uuid) is
  'Mentor ou mentore d''une relation de mentorat. Booleen.';

create or replace function private.can_see_mentor_profile(p_mentor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_mentor is not null
     and private.current_profile_id() is not null
     and (
       p_mentor = private.current_profile_id()
       or private.has_permission('mentorship.manage')
       or (
         private.is_active_member()
         and not private.is_blocked_between(p_mentor, private.current_profile_id())
         and exists (select 1 from public.mentor_profiles mp
                     where mp.profile_id = p_mentor and mp.is_active)
         and private.can_see_profile(p_mentor)
       )
     )
$$;
revoke all on function private.can_see_mentor_profile(uuid) from public, anon;
grant execute on function private.can_see_mentor_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Annuaire des mentors
-- ---------------------------------------------------------------------
drop policy if exists mentor_profiles_select on public.mentor_profiles;
create policy mentor_profiles_select on public.mentor_profiles
  for select to authenticated
  using (private.can_see_mentor_profile(profile_id));

drop policy if exists mentor_profiles_write_own on public.mentor_profiles;
create policy mentor_profiles_write_own on public.mentor_profiles
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id() and private.is_active_member());

do $$
declare t text;
begin
  foreach t in array array['mentor_domains', 'mentor_countries'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated
        using (private.can_see_mentor_profile(mentor_profile_id));
    $p$, t || '_select', t);
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (mentor_profile_id = private.current_profile_id())
        with check (mentor_profile_id = private.current_profile_id());
    $p$, t || '_write_own', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- mentorship_matches : score protege par privilege de colonne (0028).
-- Une suggestion n'appartient qu'au mentore a qui elle s'adresse.
-- ---------------------------------------------------------------------
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'mentorship_matches'
    and column_name <> 'score';
  revoke select, insert, update on public.mentorship_matches from authenticated;
  execute format('grant select (%s) on public.mentorship_matches to authenticated', v_cols);
  execute format('grant update (dismissed_at) on public.mentorship_matches to authenticated');
end
$$;
comment on column public.mentorship_matches.score is
  'Score PRIVE (MASTER PROMPT §15, D-72). Privilege de colonne retire a `authenticated`.';

drop policy if exists mentorship_matches_own on public.mentorship_matches;
create policy mentorship_matches_own on public.mentorship_matches
  for select to authenticated
  using (mentee_profile_id = private.current_profile_id());

drop policy if exists mentorship_matches_dismiss on public.mentorship_matches;
create policy mentorship_matches_dismiss on public.mentorship_matches
  for update to authenticated
  using (mentee_profile_id = private.current_profile_id())
  with check (mentee_profile_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Demandes de mentorat
-- ---------------------------------------------------------------------
drop policy if exists mentorship_requests_involved on public.mentorship_requests;
create policy mentorship_requests_involved on public.mentorship_requests
  for select to authenticated
  using (
    mentee_profile_id = private.current_profile_id()
    -- Le mentor ne voit pas le brouillon du mentore.
    or (mentor_profile_id = private.current_profile_id() and status <> 'draft')
    or private.has_permission('mentorship.manage')
  );

drop policy if exists mentorship_requests_create on public.mentorship_requests;
create policy mentorship_requests_create on public.mentorship_requests
  for insert to authenticated
  with check (
    mentee_profile_id = private.current_profile_id()
    and private.is_active_member()
    and status in ('draft', 'pending')
    and not private.is_blocked_between(mentee_profile_id, mentor_profile_id)
    and exists (select 1 from public.mentor_profiles mp
                where mp.profile_id = mentor_profile_id and mp.is_active)
  );

-- Le mentore modifie sa demande tant qu'elle n'est pas partie, et peut
-- l'annuler ensuite. Le mentor repond. Aucune des deux parties ne peut
-- se substituer a l'autre.
drop policy if exists mentorship_requests_update_mentee on public.mentorship_requests;
create policy mentorship_requests_update_mentee on public.mentorship_requests
  for update to authenticated
  using (mentee_profile_id = private.current_profile_id()
         and status in ('draft', 'pending', 'alternative_proposed'))
  with check (mentee_profile_id = private.current_profile_id()
              and status in ('draft', 'pending', 'cancelled', 'accepted'));

drop policy if exists mentorship_requests_respond_mentor on public.mentorship_requests;
create policy mentorship_requests_respond_mentor on public.mentorship_requests
  for update to authenticated
  using (mentor_profile_id = private.current_profile_id()
         and status in ('pending', 'alternative_proposed'))
  with check (mentor_profile_id = private.current_profile_id()
              and status in ('accepted', 'declined', 'alternative_proposed'));

drop policy if exists mentorship_requests_delete_draft on public.mentorship_requests;
create policy mentorship_requests_delete_draft on public.mentorship_requests
  for delete to authenticated
  using (mentee_profile_id = private.current_profile_id() and status = 'draft');

-- ---------------------------------------------------------------------
-- Relations de mentorat
-- ---------------------------------------------------------------------
drop policy if exists mentorships_involved on public.mentorships;
create policy mentorships_involved on public.mentorships
  for select to authenticated
  using (private.is_mentorship_party(id) or private.has_permission('mentorship.manage'));

-- Une relation ne nait que d'une demande REELLEMENT acceptee (D-55) :
-- l'insertion exige la demande source et son statut.
drop policy if exists mentorships_create_from_request on public.mentorships;
create policy mentorships_create_from_request on public.mentorships
  for insert to authenticated
  with check (
    (mentor_profile_id = private.current_profile_id()
     or mentee_profile_id = private.current_profile_id())
    and private.is_active_member()
    and status = 'planned'
    and exists (
      select 1 from public.mentorship_requests r
      where r.id = source_request_id
        and r.status = 'accepted'
        and r.mentor_profile_id = public.mentorships.mentor_profile_id
        and r.mentee_profile_id = public.mentorships.mentee_profile_id
    )
  );

drop policy if exists mentorships_update_parties on public.mentorships;
create policy mentorships_update_parties on public.mentorships
  for update to authenticated
  using (private.is_mentorship_party(id))
  with check (private.is_mentorship_party(id));

drop policy if exists mentorships_manage on public.mentorships;
create policy mentorships_manage on public.mentorships
  for all to authenticated
  using (private.has_permission('mentorship.manage'))
  with check (private.has_permission('mentorship.manage'));

-- ---------------------------------------------------------------------
-- Contenu partage du binome : objectifs, seances, actions.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['mentorship_goals', 'mentorship_sessions', 'mentorship_actions'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (private.is_mentorship_party(mentorship_id))
        with check (private.is_mentorship_party(mentorship_id));
    $p$, t || '_parties', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Notes de seance : STRICTEMENT personnelles (D-72). L'autre partie n'y
-- accede pas, l'animation du dispositif non plus. Le resume partage vit
-- dans `mentorship_sessions.shared_summary`.
-- ---------------------------------------------------------------------
drop policy if exists mentorship_session_notes_own on public.mentorship_session_notes;
create policy mentorship_session_notes_own on public.mentorship_session_notes
  for all to authenticated
  using (author_profile_id = private.current_profile_id())
  with check (author_profile_id = private.current_profile_id()
              and exists (select 1 from public.mentorship_sessions s
                          where s.id = session_id
                            and private.is_mentorship_party(s.mentorship_id)));

-- ---------------------------------------------------------------------
-- Bilan : confidentiel vis-a-vis de l'autre partie.
-- ---------------------------------------------------------------------
drop policy if exists mentorship_feedback_own on public.mentorship_feedback;
create policy mentorship_feedback_own on public.mentorship_feedback
  for all to authenticated
  using (respondent_profile_id = private.current_profile_id())
  with check (respondent_profile_id = private.current_profile_id()
              and private.is_mentorship_party(mentorship_id));

drop policy if exists mentorship_feedback_manage on public.mentorship_feedback;
create policy mentorship_feedback_manage on public.mentorship_feedback
  for select to authenticated
  using (private.has_permission('mentorship.manage'));

-- ---------------------------------------------------------------------
-- Journal d'evenements : lisible par le binome, ecrit cote serveur.
-- ---------------------------------------------------------------------
drop policy if exists mentorship_events_involved on public.mentorship_events;
create policy mentorship_events_involved on public.mentorship_events
  for select to authenticated
  using (private.is_mentorship_party(mentorship_id)
         or private.has_permission('mentorship.manage'));
