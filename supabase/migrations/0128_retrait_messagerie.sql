-- =====================================================================
-- 0128 — RETRAIT DE LA MESSAGERIE ISE <-> ISE (décision de cadrage C-08)
-- =====================================================================
-- Le porteur du projet abandonne la messagerie de membre à membre. Le
-- futur module Communication sera strictement VERTICAL :
--   ISE -> Administration, et Administration -> ISE / Promotion / Tous.
-- Aucun chemin horizontal ne doit subsister.
--
-- MÉTHODE — même raisonnement que C-06 (import en masse) : on retire la
-- SURFACE (RPC exposées, politiques, privilèges, déclencheurs), on ne
-- détruit pas les tables. Un écran retiré se remet ; une table supprimée,
-- non. Les six tables (0014) restent donc en base, vides, sans politique
-- ni privilège : `authenticated` et `anon` ne peuvent plus rien en faire,
-- et PostgREST n'expose plus aucune fonction pour y écrire. Leur
-- suppression est un nettoyage optionnel, pas un enjeu de sécurité.
--
-- CE QUI N'EST PAS TOUCHÉ, ET POURQUOI :
--   · `public.profile_blocks`, `block_profile()`, `unblock_profile()`,
--     `list_my_blocked_profiles()` (0020) ne relèvent pas de la
--     messagerie : ils servent /parametres/membres-bloques et
--     `private.can_see_profile()`. Ils sont CONSERVÉS tels quels.
--   · `public.reports` / `create_report()` (0016) restent le canal de
--     signalement ; seule `report_message()` disparaît.
--   · `user_settings.direct_message_policy` et `show_read_receipts`
--     restent en colonne (données conservées, réversible) mais ne sont
--     plus proposés à l'écran : voir apps/web/src/components/settings/
--     AccountSettingsForm.tsx. `update_my_settings()` les accepte encore
--     — paramètres à NULL = inchangé — sans plus aucun appelant.
--
-- ÉTAT AU MOMENT DU RETRAIT : 0 conversation, 0 participant, 0 message,
-- 0 masquage, 0 pièce jointe, 0 signalement de message, 0 objet dans le
-- bucket `message-attachments`, 0 fenêtre de maintenance de périmètre
-- `messaging`. Aucune donnée n'est perdue.
-- =====================================================================

-- 1. Les huit fonctions RPC exposées à l'API (0052)
drop function if exists public.start_conversation(uuid, text, text, text, uuid, text, text);
drop function if exists public.send_message(uuid, text, text);
drop function if exists public.list_my_conversations(text, text, text, integer);
drop function if exists public.get_conversation(uuid);
drop function if exists public.list_conversation_messages(uuid, text, integer);
drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.set_conversation_archived(uuid, boolean);
drop function if exists public.report_message(uuid, text, text);

-- 2. Realtime
do $$
begin
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime'
                and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime drop table public.messages';
  end if;
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime'
                and schemaname = 'public' and tablename = 'conversation_participants') then
    execute 'alter publication supabase_realtime drop table public.conversation_participants';
  end if;
end$$;

-- 3. Politiques RLS de 0047 (quinze) + politiques Storage du bucket.
drop policy if exists conversations_participants        on public.conversations;
drop policy if exists conversations_create              on public.conversations;
drop policy if exists conversations_update_participants on public.conversations;

drop policy if exists conversation_participants_select  on public.conversation_participants;
drop policy if exists conversation_participants_own     on public.conversation_participants;
drop policy if exists conversation_participants_add     on public.conversation_participants;

drop policy if exists messages_participants             on public.messages;
drop policy if exists messages_send                     on public.messages;
drop policy if exists messages_update_own               on public.messages;

drop policy if exists message_hides_own                 on public.message_hides;

drop policy if exists message_attachments_participants  on public.message_attachments;
drop policy if exists message_attachments_send          on public.message_attachments;

drop policy if exists message_reports_own               on public.message_reports;
drop policy if exists message_reports_create            on public.message_reports;
drop policy if exists message_reports_review            on public.message_reports;

drop policy if exists ise_message_attachments_read  on storage.objects;
drop policy if exists ise_message_attachments_write on storage.objects;

-- 4. Déclencheurs et fonctions internes propres à la messagerie.
drop trigger  if exists messages_persisted        on public.messages;
drop function if exists private.on_message_persisted();

drop trigger  if exists message_attachments_limit on public.message_attachments;
drop function if exists public.enforce_message_attachment_limit();

drop function if exists private.conversation_preview(uuid, uuid);
drop function if exists private.is_conversation_participant(uuid);
drop function if exists private.can_message_profile(uuid);

-- 5. Privilèges
revoke all on public.conversations             from authenticated, anon;
revoke all on public.conversation_participants from authenticated, anon;
revoke all on public.messages                  from authenticated, anon;
revoke all on public.message_hides             from authenticated, anon;
revoke all on public.message_attachments       from authenticated, anon;
revoke all on public.message_reports           from authenticated, anon;

comment on table public.conversations is
  'ABANDONNÉ (C-08, 0128) — messagerie ISE<->ISE retirée du produit. Table vide, sans politique ni privilège : inatteignable. Conservée plutôt que supprimée, une suppression étant irréversible.';
comment on table public.conversation_participants is
  'ABANDONNÉ (C-08, 0128) — voir `public.conversations`.';
comment on table public.messages is
  'ABANDONNÉ (C-08, 0128) — voir `public.conversations`.';
comment on table public.message_hides is
  'ABANDONNÉ (C-08, 0128) — voir `public.conversations`.';
comment on table public.message_attachments is
  'ABANDONNÉ (C-08, 0128) — voir `public.conversations`. Le porteur refuse explicitement l''échange de documents entre membres.';
comment on table public.message_reports is
  'ABANDONNÉ (C-08, 0128) — voir `public.conversations`. Les signalements de profils et de contenus restent assurés par `public.reports` (0016).';

-- 6. Storage — `storage.protect_delete()` interdit de supprimer le bucket
--    en SQL. Il est vide et n'a plus de politique ouverte ; on pose une
--    politique explicitement FERMÉE pour que
--    `private.storage_baseline_violations()` reste vert.
create policy ise_message_attachments_closed
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'message-attachments' and false)
  with check (bucket_id = 'message-attachments' and false);

-- 7. my_notification_summary() sans `unread_messages`
create or replace function public.my_notification_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'unread', (select count(*) from public.notifications n
                where n.profile_id = v_me and n.read_at is null and n.archived_at is null),
    'action_required', (select count(*) from public.notifications n
                         where n.profile_id = v_me and n.archived_at is null
                           and n.read_at is null
                           and n.priority in ('critical', 'action_required')),
    'read_not_archived', (select count(*) from public.notifications n
                           where n.profile_id = v_me and n.archived_at is null
                             and n.read_at is not null),
    'total', (select count(*) from public.notifications n
               where n.profile_id = v_me and n.archived_at is null),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category,
                                          'total',    x.total,
                                          'unread',   x.unread)
                       order by x.total desc, x.category)
        from (select n.category,
                     count(*) as total,
                     count(*) filter (where n.read_at is null) as unread
                from public.notifications n
               where n.profile_id = v_me and n.archived_at is null
               group by n.category) x), '[]'::jsonb),
    'by_priority', coalesce((
      select jsonb_agg(jsonb_build_object('priority', x.priority, 'total', x.total)
                       order by x.total desc, x.priority)
        from (select n.priority, count(*) as total
                from public.notifications n
               where n.profile_id = v_me and n.archived_at is null
               group by n.priority) x), '[]'::jsonb));
end
$$;

comment on function public.my_notification_summary() is
  'ISE-098 — synthèse des notifications du membre. C-08 (0128) : la clé `unread_messages` a disparu avec la messagerie ISE<->ISE.';

-- 8. Référentiels devenus orphelins
update public.notification_types
   set is_active = false,
       description = coalesce(description, '')
                     || ' [Désactivé — C-08 : la messagerie ISE<->ISE a été retirée.]'
 where code = 'message_received'
   and is_active;

update public.support_categories
   set is_active = false
 where code = 'messages'
   and is_active;
