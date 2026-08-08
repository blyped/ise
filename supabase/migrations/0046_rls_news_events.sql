-- =====================================================================
-- 0046_rls_news_events
-- Ouverture des politiques RLS du lot « Actualites et evenements » (0013).
--
-- FUITE REELLE CORRIGEE ICI — `events.online_url_private`
--   La colonne porte le lien de connexion prive d'un evenement en ligne.
--   `events.online_url_visibility` vaut `registered` ou `all_viewers` :
--   dans le premier cas, le lien ne doit atteindre QUE les inscrits. La RLS
--   filtre des LIGNES : elle rend visible la fiche de l'evenement a toute
--   son audience, donc elle ne peut pas retenir cette seule colonne.
--   Sans correctif, n'importe quel membre pouvant voir l'evenement lisait
--   le lien et pouvait s'y connecter sans inscription — exactement le
--   defaut D1 de 0028, transpose aux evenements.
--   Correctif : PRIVILEGE DE COLONNE (`revoke` puis `grant` colonne par
--   colonne) + accesseur dedie `public.get_event_online_url(uuid)`.
--
-- Reference : MASTER PROMPT §17, §47, §80 ; D-72, D-73.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers — actualites
-- ---------------------------------------------------------------------
create or replace function private.can_see_news(p_news uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_news is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.news n
       where n.id = p_news
         and (
           n.submitted_by_profile_id = private.current_profile_id()
           or private.has_permission('content.publish')
           or (
             n.deleted_at is null
             and n.editorial_status = 'published'
             and private.is_active_member()
             and (case n.visibility
                    when 'members'   then true
                    when 'promotion' then private.is_in_promotion(n.promotion_id)
                    when 'community' then private.is_community_member(n.community_id)
                    else false
                  end)
           )
         )
     )
$$;
revoke all on function private.can_see_news(uuid) from public, anon;
grant execute on function private.can_see_news(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Helpers — evenements
-- ---------------------------------------------------------------------
create or replace function private.is_event_organizer(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_event is not null
     and private.current_profile_id() is not null
     and (
       private.has_permission('events.manage')
       or exists (
         select 1 from public.events e
         where e.id = p_event
           and (e.organizer_profile_id = private.current_profile_id()
                or e.created_by_profile_id = private.current_profile_id())
       )
     )
$$;
revoke all on function private.is_event_organizer(uuid) from public, anon;
grant execute on function private.is_event_organizer(uuid) to authenticated;

create or replace function private.is_event_registered(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_event is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.event_registrations r
       where r.event_id = p_event
         and r.profile_id = private.current_profile_id()
         and r.status in ('registered', 'pending_approval', 'waitlisted', 'attended')
     )
$$;
revoke all on function private.is_event_registered(uuid) from public, anon;
grant execute on function private.is_event_registered(uuid) to authenticated;

create or replace function private.can_see_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_event is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.events e
       where e.id = p_event
         and (
           e.organizer_profile_id = private.current_profile_id()
           or e.created_by_profile_id = private.current_profile_id()
           or private.has_permission('events.manage')
           or (
             e.deleted_at is null
             and e.status in ('published', 'full', 'completed', 'cancelled')
             and private.is_active_member()
             and (e.organizer_profile_id is null
                  or not private.is_blocked_between(e.organizer_profile_id,
                                                    private.current_profile_id()))
             and (case e.visibility
                    when 'members'   then true
                    when 'promotion' then private.is_in_promotion(e.organizer_promotion_id)
                    when 'community' then private.is_community_member(e.organizer_community_id)
                    -- Ciblage nominatif : seuls l'inscrit et l'intervenant
                    -- constate ont acces. Aucune audience implicite.
                    when 'selected_members' then
                      private.is_event_registered(e.id)
                      or exists (select 1 from public.event_speakers s
                                 where s.event_id = e.id
                                   and s.profile_id = private.current_profile_id())
                    when 'invitation_only' then
                      private.is_event_registered(e.id)
                      or exists (select 1 from public.event_speakers s
                                 where s.event_id = e.id
                                   and s.profile_id = private.current_profile_id())
                    else false
                  end)
           )
         )
     )
$$;
revoke all on function private.can_see_event(uuid) from public, anon;
grant execute on function private.can_see_event(uuid) to authenticated;
comment on function private.can_see_event(uuid) is
  'Audience reelle d''un evenement. `selected_members` et `invitation_only` n''ouvrent a personne par defaut.';

-- ---------------------------------------------------------------------
-- Correctif de colonne : `events.online_url_private`
-- ---------------------------------------------------------------------
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'events'
    and column_name <> 'online_url_private';
  revoke select on public.events from authenticated;
  execute format('grant select (%s) on public.events to authenticated', v_cols);

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'events'
    and is_generated = 'NEVER';
  -- L'organisateur DOIT pouvoir ecrire le lien : seule la LECTURE est retiree.
  revoke insert, update on public.events from authenticated;
  execute format('grant insert (%s) on public.events to authenticated', v_cols);
  execute format('grant update (%s) on public.events to authenticated', v_cols);
end
$$;

comment on column public.events.online_url_private is
  'Lien de connexion PRIVE. Privilege de LECTURE retire a `authenticated` (la RLS filtre des lignes, '
  'pas des colonnes) : il ne se lit que par public.get_event_online_url(). L''organisateur peut l''ecrire.';

-- Accesseur : trois portes successives — l'evenement doit etre visible,
-- puis soit je l'organise, soit le lien est ouvert a toute l'audience,
-- soit je suis reellement inscrit.
create or replace function public.get_event_online_url(p_event uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_url        text;
  v_visibility text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_event(p_event) then
    return null;
  end if;

  select e.online_url_private, e.online_url_visibility
    into v_url, v_visibility
  from public.events e
  where e.id = p_event;

  if v_url is null then
    return null;
  end if;
  if private.is_event_organizer(p_event) then
    return v_url;
  end if;
  if v_visibility = 'all_viewers' then
    return v_url;
  end if;
  if private.is_event_registered(p_event) then
    return v_url;
  end if;
  return null;
end
$$;
revoke all on function public.get_event_online_url(uuid) from public, anon;
grant execute on function public.get_event_online_url(uuid) to authenticated;
comment on function public.get_event_online_url(uuid) is
  'Unique voie de lecture de events.online_url_private. Renvoie NULL si l''appelant n''est ni organisateur, '
  'ni inscrit, alors que le lien est reserve aux inscrits.';

-- ---------------------------------------------------------------------
-- news
-- ---------------------------------------------------------------------
drop policy if exists news_select on public.news;
create policy news_select on public.news
  for select to authenticated
  using (private.can_see_news(id));

drop policy if exists news_submit on public.news;
create policy news_submit on public.news
  for insert to authenticated
  with check (submitted_by_profile_id = private.current_profile_id()
              and private.is_active_member()
              and editorial_status in ('draft', 'submitted'));

-- L'auteur corrige tant que la redaction n'a pas tranche. Il ne peut pas
-- se publier lui-meme : `published` n'est pas dans le WITH CHECK.
drop policy if exists news_update_own_draft on public.news;
create policy news_update_own_draft on public.news
  for update to authenticated
  using (submitted_by_profile_id = private.current_profile_id()
         and editorial_status in ('draft', 'submitted'))
  with check (submitted_by_profile_id = private.current_profile_id()
              and editorial_status in ('draft', 'submitted'));

drop policy if exists news_delete_own_draft on public.news;
create policy news_delete_own_draft on public.news
  for delete to authenticated
  using (submitted_by_profile_id = private.current_profile_id()
         and editorial_status = 'draft');

drop policy if exists news_editorial on public.news;
create policy news_editorial on public.news
  for all to authenticated
  using (private.has_permission('content.publish'))
  with check (private.has_permission('content.publish'));

do $$
declare t text;
begin
  foreach t in array array['news_communities', 'news_organizations', 'news_profiles',
                           'news_promotions', 'news_skills', 'news_sources'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated using (private.can_see_news(news_id));
    $p$, t || '_select', t);
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (exists (select 1 from public.news n
                       where n.id = news_id
                         and (n.submitted_by_profile_id = private.current_profile_id()
                              or private.has_permission('content.publish'))))
        with check (exists (select 1 from public.news n
                            where n.id = news_id
                              and (n.submitted_by_profile_id = private.current_profile_id()
                                   or private.has_permission('content.publish'))));
    $p$, t || '_write', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (private.can_see_event(id));

drop policy if exists events_create on public.events;
create policy events_create on public.events
  for insert to authenticated
  with check (created_by_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status in ('draft', 'pending_review'));

drop policy if exists events_update_organizer on public.events;
create policy events_update_organizer on public.events
  for update to authenticated
  using (private.is_event_organizer(id))
  with check (private.is_event_organizer(id));

drop policy if exists events_delete_draft on public.events;
create policy events_delete_draft on public.events
  for delete to authenticated
  using (created_by_profile_id = private.current_profile_id() and status = 'draft');

-- ---------------------------------------------------------------------
-- Programme, intervenants, rattachements : lus avec l'evenement.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['event_agenda_items', 'event_speakers', 'event_questions',
                           'event_promotions', 'event_communities'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated using (private.can_see_event(event_id));
    $p$, t || '_select', t);
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (private.is_event_organizer(event_id))
        with check (private.is_event_organizer(event_id));
    $p$, t || '_write_organizer', t);
  end loop;
end
$$;

-- Un intervenant confirme ou decline sa propre participation.
drop policy if exists event_speakers_respond_own on public.event_speakers;
create policy event_speakers_respond_own on public.event_speakers
  for update to authenticated
  using (profile_id = private.current_profile_id() and status = 'invited')
  with check (profile_id = private.current_profile_id()
              and status in ('confirmed', 'declined'));

-- ---------------------------------------------------------------------
-- Inscriptions
--
-- La liste des participants suit `events.attendee_list_visibility`, et un
-- inscrit qui a decoche `is_listed` n'apparait dans AUCUNE liste.
-- ---------------------------------------------------------------------
drop policy if exists event_registrations_select on public.event_registrations;
create policy event_registrations_select on public.event_registrations
  for select to authenticated
  using (
    profile_id = private.current_profile_id()
    or private.is_event_organizer(event_id)
    or (
      is_listed
      and status in ('registered', 'attended')
      and private.can_see_event(event_id)
      and not private.is_blocked_between(profile_id, private.current_profile_id())
      and exists (
        select 1 from public.events e
        where e.id = event_id
          and (case e.attendee_list_visibility
                 when 'members'    then true
                 when 'registered' then private.is_event_registered(e.id)
                 else false                   -- 'organizer'
               end)
      )
    )
  );

drop policy if exists event_registrations_create_own on public.event_registrations;
create policy event_registrations_create_own on public.event_registrations
  for insert to authenticated
  with check (profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.can_see_event(event_id)
              and status in ('registered', 'pending_approval', 'waitlisted'));

-- Le membre annule ou modifie sa visibilite ; il ne se declare jamais
-- « present » lui-meme (D-55 : la presence se constate).
drop policy if exists event_registrations_update_own on public.event_registrations;
create policy event_registrations_update_own on public.event_registrations
  for update to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and status in ('registered', 'pending_approval', 'waitlisted', 'cancelled'));

drop policy if exists event_registrations_manage_organizer on public.event_registrations;
create policy event_registrations_manage_organizer on public.event_registrations
  for all to authenticated
  using (private.is_event_organizer(event_id))
  with check (private.is_event_organizer(event_id));

drop policy if exists event_registration_answers_own on public.event_registration_answers;
create policy event_registration_answers_own on public.event_registration_answers
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and private.can_see_event(event_id));

drop policy if exists event_registration_answers_organizer on public.event_registration_answers;
create policy event_registration_answers_organizer on public.event_registration_answers
  for select to authenticated
  using (private.is_event_organizer(event_id));

-- ---------------------------------------------------------------------
-- Ressources : trois niveaux propres a l'evenement.
-- ---------------------------------------------------------------------
drop policy if exists event_resources_select on public.event_resources;
create policy event_resources_select on public.event_resources
  for select to authenticated
  using (
    private.is_event_organizer(event_id)
    or (private.can_see_event(event_id)
        and (case visibility
               when 'members'    then true
               when 'registered' then private.is_event_registered(event_id)
               else false                     -- 'organizer'
             end))
  );

drop policy if exists event_resources_write_organizer on public.event_resources;
create policy event_resources_write_organizer on public.event_resources
  for all to authenticated
  using (private.is_event_organizer(event_id))
  with check (private.is_event_organizer(event_id));

-- ---------------------------------------------------------------------
-- Rappels : file d'envoi cote serveur. Lecture reservee a l'organisateur ;
-- aucune ecriture cliente.
-- ---------------------------------------------------------------------
drop policy if exists event_reminders_organizer on public.event_reminders;
create policy event_reminders_organizer on public.event_reminders
  for select to authenticated
  using (private.is_event_organizer(event_id));

-- ---------------------------------------------------------------------
-- Retombees et bilan
-- ---------------------------------------------------------------------
drop policy if exists event_outcomes_select on public.event_outcomes;
create policy event_outcomes_select on public.event_outcomes
  for select to authenticated
  using (private.is_event_organizer(event_id) or private.has_permission('analytics.read'));

drop policy if exists event_outcomes_declare on public.event_outcomes;
create policy event_outcomes_declare on public.event_outcomes
  for insert to authenticated
  with check (declared_by_profile_id = private.current_profile_id()
              and private.is_event_organizer(event_id));

-- `event_followups.id` EST l'identifiant de l'evenement (relation 1-1).
drop policy if exists event_followups_select on public.event_followups;
create policy event_followups_select on public.event_followups
  for select to authenticated
  using (private.is_event_organizer(id)
         or (published_at is not null and private.can_see_event(id)));

drop policy if exists event_followups_write_organizer on public.event_followups;
create policy event_followups_write_organizer on public.event_followups
  for all to authenticated
  using (private.is_event_organizer(id))
  with check (private.is_event_organizer(id));

-- Agregats : jamais servis a un membre ordinaire.
drop policy if exists event_impact_snapshots_read on public.event_impact_snapshots;
create policy event_impact_snapshots_read on public.event_impact_snapshots
  for select to authenticated
  using (private.is_event_organizer(event_id) or private.has_permission('analytics.read'));
