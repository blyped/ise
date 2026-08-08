-- =====================================================================
-- 0049_rls_support_moderation
-- Ouverture des politiques RLS du lot « Support et moderation » (0016).
--
-- FUITE REELLE COUVERTE ICI — les NOTES INTERNES de support.
--   `support_messages.is_internal_note` isole les echanges entre agents.
--   Ouvrir le fil du ticket a son auteur sans distinguer cette colonne lui
--   aurait livre les notes internes. Ici la distinction est portee par la
--   POLITIQUE (`is_internal_note` est un attribut de LIGNE, la RLS suffit,
--   sans privilege de colonne).
--
-- MACHINES D'ETATS — `support_tickets.status` et `reports.status` ont
--   chacun leur fonction atomique (`transition_support_ticket`,
--   `transition_report`). Mais un agent doit pouvoir s'assigner un ticket,
--   et un moderateur annoter un signalement : il faut donc une politique
--   UPDATE. Une politique RLS ne sait pas comparer l'ancienne et la
--   nouvelle valeur d'une colonne. Le garde-fou est donc un TRIGGER
--   `BEFORE UPDATE` : toute modification de `status` faite AILLEURS que
--   dans une fonction atomique (donc sous une autre identite que le
--   proprietaire des tables) leve `invalid_transition`. La politique
--   ouvre l'edition, le trigger ferme la transition.
--
-- Reference : MASTER PROMPT §53, §80 ; D-31, D-66, D-85, D-102.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Garde-fou de transition (voir en-tete)
-- ---------------------------------------------------------------------
create or replace function private.guard_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  return new;
end
$$;

comment on function private.guard_status_transition() is
  'BEFORE UPDATE : refuse tout changement de `status` hors fonction atomique. '
  'Les fonctions de transition sont SECURITY DEFINER et appartiennent a `postgres` : '
  'elles s''executent donc avec current_user = postgres et passent, alors qu''un client '
  '(`authenticated`) est refuse. Complete la RLS, qui ne sait pas comparer OLD et NEW.';

drop trigger if exists support_tickets_status_guard on public.support_tickets;
create trigger support_tickets_status_guard
  before update on public.support_tickets
  for each row execute function private.guard_status_transition();

drop trigger if exists reports_status_guard on public.reports;
create trigger reports_status_guard
  before update on public.reports
  for each row execute function private.guard_status_transition();

-- ---------------------------------------------------------------------
-- support_tickets
--
-- `private.can_access_support_ticket()` existe depuis 0027 : REUTILISE.
-- ---------------------------------------------------------------------
drop policy if exists support_tickets_involved on public.support_tickets;
create policy support_tickets_involved on public.support_tickets
  for select to authenticated
  using (private.can_access_support_ticket(id));

-- D-85 : l'urgence n'est PAS choisie par le demandeur. Le WITH CHECK
-- impose `urgency_source = 'system'` et interdit de designer un
-- attributeur : seul un agent peut requalifier ensuite.
drop policy if exists support_tickets_create on public.support_tickets;
create policy support_tickets_create on public.support_tickets
  for insert to authenticated
  with check (requester_profile_id = private.current_profile_id()
              and status = 'open'
              and urgency_source = 'system'
              and urgency_set_by_profile_id is null);

-- Assignation, requalification d'urgence, contexte technique : reserves au
-- support. Le changement de `status` reste bloque par le trigger.
drop policy if exists support_tickets_agent on public.support_tickets;
create policy support_tickets_agent on public.support_tickets
  for update to authenticated
  using (private.has_permission('support.manage'))
  with check (private.has_permission('support.manage'));

-- ---------------------------------------------------------------------
-- support_messages — les notes internes ne sortent pas du support.
-- ---------------------------------------------------------------------
drop policy if exists support_messages_involved on public.support_messages;
create policy support_messages_involved on public.support_messages
  for select to authenticated
  using (private.can_access_support_ticket(ticket_id)
         and (is_internal_note = false or private.has_permission('support.manage')));

drop policy if exists support_messages_write_member on public.support_messages;
create policy support_messages_write_member on public.support_messages
  for insert to authenticated
  with check (author_profile_id = private.current_profile_id()
              and author_kind = 'member'
              and is_internal_note = false
              and exists (select 1 from public.support_tickets t
                          where t.id = ticket_id
                            and t.requester_profile_id = private.current_profile_id()));

drop policy if exists support_messages_write_agent on public.support_messages;
create policy support_messages_write_agent on public.support_messages
  for insert to authenticated
  with check (author_profile_id = private.current_profile_id()
              and author_kind = 'agent'
              and private.has_permission('support.manage'));

drop policy if exists support_message_attachments_involved on public.support_message_attachments;
create policy support_message_attachments_involved on public.support_message_attachments
  for select to authenticated
  using (exists (select 1 from public.support_messages m
                 where m.id = message_id
                   and private.can_access_support_ticket(m.ticket_id)
                   and (m.is_internal_note = false
                        or private.has_permission('support.manage'))));

drop policy if exists support_message_attachments_create on public.support_message_attachments;
create policy support_message_attachments_create on public.support_message_attachments
  for insert to authenticated
  with check (exists (select 1 from public.support_messages m
                      where m.id = message_id
                        and m.author_profile_id = private.current_profile_id()));

-- ---------------------------------------------------------------------
-- reports (D-66 : referentiel unique de motifs)
--
-- Un signalement n'est jamais visible de la personne signalee : la table
-- ne porte AUCUNE politique fondee sur `target_owner_profile_id`.
-- ---------------------------------------------------------------------
drop policy if exists reports_own on public.reports;
create policy reports_own on public.reports
  for select to authenticated
  using (reporter_profile_id = private.current_profile_id()
         or private.has_permission('profiles.moderate'));

drop policy if exists reports_create on public.reports;
create policy reports_create on public.reports
  for insert to authenticated
  with check (reporter_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status = 'open'
              and reviewer_profile_id is null
              and resolution_code is null);

-- La revue passe par `transition_report` pour le statut ; la politique ne
-- couvre que l'annotation (severite, note interne, masquage du signalant).
drop policy if exists reports_moderate on public.reports;
create policy reports_moderate on public.reports
  for update to authenticated
  using (private.has_permission('profiles.moderate'))
  with check (private.has_permission('profiles.moderate'));

-- Journal de revue : notes internes de moderation. Ni le signalant ni la
-- personne signalee n'y accedent.
drop policy if exists report_events_moderators on public.report_events;
create policy report_events_moderators on public.report_events
  for select to authenticated
  using (private.has_permission('profiles.moderate'));

-- Les pieces jointes appartiennent au signalant : il peut les deposer et
-- les relire, la moderation les consulte.
drop policy if exists report_evidence_involved on public.report_evidence;
create policy report_evidence_involved on public.report_evidence
  for select to authenticated
  using (private.has_permission('profiles.moderate')
         or exists (select 1 from public.reports r
                    where r.id = report_id
                      and r.reporter_profile_id = private.current_profile_id()));

drop policy if exists report_evidence_create on public.report_evidence;
create policy report_evidence_create on public.report_evidence
  for insert to authenticated
  with check (exists (select 1 from public.reports r
                      where r.id = report_id
                        and r.reporter_profile_id = private.current_profile_id()
                        and r.status = 'open'));

-- ---------------------------------------------------------------------
-- moderation_actions
--
-- Registre des sanctions. Il porte le MOTIF INTERNE de la decision : il
-- reste reserve a la moderation. Ce qu'un membre sanctionne doit savoir
-- lui est notifie (`notifications`), il ne se lit pas ici.
-- ---------------------------------------------------------------------
drop policy if exists moderation_actions_moderators on public.moderation_actions;
create policy moderation_actions_moderators on public.moderation_actions
  for select to authenticated
  using (private.has_permission('profiles.moderate'));

drop policy if exists moderation_actions_create on public.moderation_actions;
create policy moderation_actions_create on public.moderation_actions
  for insert to authenticated
  with check (moderator_profile_id = private.current_profile_id()
              and private.has_permission('profiles.moderate'));
