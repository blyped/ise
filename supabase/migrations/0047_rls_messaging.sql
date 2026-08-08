-- =====================================================================
-- 0047_rls_messaging
-- Ouverture des politiques RLS du lot « Messagerie » (0014).
--
-- REGLE ABSOLUE : le contenu des echanges prives n'est JAMAIS consultable
-- par l'exploitation (MASTER PROMPT §24). Aucune politique de ce fichier
-- n'accorde d'acces administratif a `conversations`, `messages` ni
-- `message_attachments` — pas meme a `profiles.moderate`. Un signalement
-- (`message_reports`) transporte lui-meme l'extrait necessaire a la revue :
-- c'est le signalant qui decide de ce qui sort de la conversation.
--
-- Ouvrir une conversation respecte trois regles cumulatives :
--   1. blocage — aucune sollicitation ne franchit un blocage ;
--   2. `user_settings.direct_message_policy` du DESTINATAIRE
--      (`members` / `connections` / `none`) ;
--   3. membre actif.
--
-- `private.is_conversation_participant()` existe depuis 0027 : REUTILISE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper : ai-je le droit d'ecrire a ce membre ?
--
-- SECURITY DEFINER (motif A) : lit `user_settings`, dont la politique est
-- « proprietaire seulement » — le sollicitant ne peut donc pas lire le
-- reglage de sa cible pour savoir s'il a le droit de la contacter.
-- Renvoie un booleen, jamais une ligne.
-- ---------------------------------------------------------------------
create or replace function private.can_message_profile(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_target is not null
     and private.current_profile_id() is not null
     and (
       p_target = private.current_profile_id()
       or (
         private.is_active_member()
         and not private.is_blocked_between(p_target, private.current_profile_id())
         and private.can_see_profile(p_target)
         and coalesce(
               (select s.direct_message_policy from public.user_settings s
                where s.profile_id = p_target),
               'members')
             <> 'none'
         and (
           coalesce((select s.direct_message_policy from public.user_settings s
                     where s.profile_id = p_target), 'members') <> 'connections'
           or private.is_connected_to(p_target)
         )
       )
     )
$$;
revoke all on function private.can_message_profile(uuid) from public, anon;
grant execute on function private.can_message_profile(uuid) to authenticated;
comment on function private.can_message_profile(uuid) is
  'Blocage + `user_settings.direct_message_policy` du destinataire. Le defaut, en l''absence de reglage, est `members`.';

-- ---------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------
drop policy if exists conversations_participants on public.conversations;
create policy conversations_participants on public.conversations
  for select to authenticated
  using (private.is_conversation_participant(id));

drop policy if exists conversations_create on public.conversations;
create policy conversations_create on public.conversations
  for insert to authenticated
  with check (created_by_profile_id = private.current_profile_id()
              and private.is_active_member());

drop policy if exists conversations_update_participants on public.conversations;
create policy conversations_update_participants on public.conversations
  for update to authenticated
  using (private.is_conversation_participant(id))
  with check (private.is_conversation_participant(id));

-- ---------------------------------------------------------------------
-- conversation_participants
-- ---------------------------------------------------------------------
drop policy if exists conversation_participants_select on public.conversation_participants;
create policy conversation_participants_select on public.conversation_participants
  for select to authenticated
  using (private.is_conversation_participant(conversation_id));

-- On n'ajoute quelqu'un que si l'on est le createur de la conversation ou
-- deja participant, ET que l'on a le droit de lui ecrire.
drop policy if exists conversation_participants_add on public.conversation_participants;
create policy conversation_participants_add on public.conversation_participants
  for insert to authenticated
  with check (
    private.is_active_member()
    and membership_status = 'active'
    and (
      exists (select 1 from public.conversations c
              where c.id = conversation_id
                and c.created_by_profile_id = private.current_profile_id())
      or private.is_conversation_participant(conversation_id)
    )
    and private.can_message_profile(profile_id)
  );

-- Chacun gere SA ligne : accuses de lecture, archivage (D-82), sourdine,
-- sortie. Personne ne modifie la ligne d'un autre.
drop policy if exists conversation_participants_own on public.conversation_participants;
create policy conversation_participants_own on public.conversation_participants
  for update to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and membership_status in ('active', 'left'));

-- ---------------------------------------------------------------------
-- messages
--
-- Un message supprime ne revient qu'a son auteur. Un message masque par
-- moi (`message_hides`) disparait de MA vue et de la mienne seule.
-- ---------------------------------------------------------------------
drop policy if exists messages_participants on public.messages;
create policy messages_participants on public.messages
  for select to authenticated
  using (
    private.is_conversation_participant(conversation_id)
    and (deleted_at is null or sender_profile_id = private.current_profile_id())
    and not exists (
      select 1 from public.message_hides h
      where h.message_id = public.messages.id
        and h.profile_id = private.current_profile_id()
    )
  );

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages
  for insert to authenticated
  with check (sender_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.is_conversation_participant(conversation_id)
              and delivery_status in ('pending', 'sent'));

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
  for update to authenticated
  using (sender_profile_id = private.current_profile_id()
         and private.is_conversation_participant(conversation_id))
  with check (sender_profile_id = private.current_profile_id());

-- Aucune politique DELETE : la suppression est LOGIQUE (`deleted_at`),
-- pour que l'accuse de reception de l'autre partie reste coherent (D-83).

drop policy if exists message_attachments_participants on public.message_attachments;
create policy message_attachments_participants on public.message_attachments
  for select to authenticated
  using (exists (select 1 from public.messages m
                 where m.id = message_id
                   and private.is_conversation_participant(m.conversation_id)));

drop policy if exists message_attachments_send on public.message_attachments;
create policy message_attachments_send on public.message_attachments
  for insert to authenticated
  with check (exists (select 1 from public.messages m
                      where m.id = message_id
                        and m.sender_profile_id = private.current_profile_id()));

-- Masquage personnel : strictement individuel (D-72).
drop policy if exists message_hides_own on public.message_hides;
create policy message_hides_own on public.message_hides
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and exists (select 1 from public.messages m
                          where m.id = message_id
                            and private.is_conversation_participant(m.conversation_id)));

-- ---------------------------------------------------------------------
-- message_reports
--
-- Seule passerelle entre une conversation privee et la moderation. Le
-- signalant decide de ce qui sort : la moderation lit le SIGNALEMENT, pas
-- la conversation. Les transitions restent reservees a la moderation.
-- ---------------------------------------------------------------------
drop policy if exists message_reports_own on public.message_reports;
create policy message_reports_own on public.message_reports
  for select to authenticated
  using (reporter_profile_id = private.current_profile_id()
         or private.has_permission('profiles.moderate'));

drop policy if exists message_reports_create on public.message_reports;
create policy message_reports_create on public.message_reports
  for insert to authenticated
  with check (reporter_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.is_conversation_participant(conversation_id)
              and status = 'open');

drop policy if exists message_reports_review on public.message_reports;
create policy message_reports_review on public.message_reports
  for update to authenticated
  using (private.has_permission('profiles.moderate'))
  with check (private.has_permission('profiles.moderate'));
