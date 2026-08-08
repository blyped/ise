-- 0014_messaging
-- Applique le 2026-08-08 (version 20260808004855)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0014_messaging
-- Messagerie contextuelle (ISE-097). D-82, D-83, D-84.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Conversations
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id                     uuid primary key default extensions.gen_random_uuid(),
  conversation_type      text not null default 'direct'
                           check (conversation_type in ('direct', 'group', 'support')),
  context_type           text
                           check (context_type is null or context_type in
                             ('profile', 'network_call', 'opportunity', 'internship',
                              'mentorship', 'project', 'introduction', 'community',
                              'event', 'support')),
  context_id             uuid,
  context_label          text,
  initiation_reason      text
                           check (initiation_reason is null or initiation_reason in
                             ('expertise', 'opportunity', 'introduction',
                              'mentorship', 'project', 'other')),
  title                  text,
  created_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  last_message_at        timestamptz,
  message_count          integer not null default 0 check (message_count >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint conversations_context_pair
    check ((context_type is null) = (context_id is null)
           or context_type in ('profile', 'support')),
  constraint conversations_group_needs_context
    check (conversation_type <> 'group' or context_type is not null)
);

comment on table public.conversations is
  'Conversation contextuelle. Aucun archived_at global : l''archivage est porte par participant (D-82).';
comment on column public.conversations.context_type is
  'Module d''origine de la conversation. Reference polymorphe volontaire : aucune FK unique possible.';

select private.attach_updated_at('public', 'conversations');

create index if not exists conversations_context_idx
  on public.conversations(context_type, context_id) where context_id is not null;
create index if not exists conversations_created_by_idx
  on public.conversations(created_by_profile_id) where created_by_profile_id is not null;
create index if not exists conversations_last_message_idx
  on public.conversations(last_message_at desc, id desc);

-- ---------------------------------------------------------------------
-- 2. Participants  (D-82 : archivage par participant)
-- ---------------------------------------------------------------------
create table if not exists public.conversation_participants (
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  profile_id           uuid not null references public.ise_profiles(id) on delete cascade,
  membership_status    text not null default 'active'
                         check (membership_status in ('active', 'left', 'removed')),
  joined_at            timestamptz not null default now(),
  left_at              timestamptz,
  last_read_message_id uuid,
  last_read_at         timestamptz,
  unread_count         integer not null default 0 check (unread_count >= 0),
  archived_at          timestamptz,
  muted_until          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (conversation_id, profile_id),
  constraint conversation_participants_left_timestamp
    check (membership_status = 'active' or left_at is not null)
);

comment on column public.conversation_participants.archived_at is
  'Archivage par participant (D-82). Archiver ne fait jamais disparaitre la conversation chez l''autre membre.';
comment on column public.conversation_participants.unread_count is
  'Compteur de non-lus propre au participant. Realtime limite a ce compteur et aux conversations ouvertes (D-83).';

select private.attach_updated_at('public', 'conversation_participants');

create index if not exists conversation_participants_profile_idx
  on public.conversation_participants(profile_id, conversation_id);
create index if not exists conversation_participants_inbox_idx
  on public.conversation_participants(profile_id)
  where archived_at is null and membership_status = 'active';
create index if not exists conversation_participants_archived_idx
  on public.conversation_participants(profile_id, archived_at desc)
  where archived_at is not null;
create index if not exists conversation_participants_unread_idx
  on public.conversation_participants(profile_id)
  where unread_count > 0 and membership_status = 'active';
create index if not exists conversation_participants_last_read_idx
  on public.conversation_participants(last_read_message_id)
  where last_read_message_id is not null;

-- ---------------------------------------------------------------------
-- 3. Messages  (D-83 : pending / sent / failed)
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id                   uuid primary key default extensions.gen_random_uuid(),
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id    uuid references public.ise_profiles(id) on delete set null,
  message_type         text not null default 'text'
                         check (message_type in ('text', 'system', 'attachment')),
  body                 text,
  reply_to_message_id  uuid references public.messages(id) on delete set null,
  client_message_id    text,
  delivery_status      text not null default 'sent'
                         check (delivery_status in ('pending', 'sent', 'failed')),
  failure_code         text,
  failed_at            timestamptz,
  has_attachments      boolean not null default false,
  created_at           timestamptz not null default now(),
  edited_at            timestamptz,
  deleted_at           timestamptz,
  deleted_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  constraint messages_body_or_attachment
    check (message_type = 'attachment' or length(btrim(coalesce(body, ''))) > 0),
  constraint messages_system_has_no_sender
    check (message_type <> 'system' or sender_profile_id is null),
  constraint messages_failed_timestamp
    check (delivery_status <> 'failed' or failed_at is not null),
  constraint messages_reply_not_self
    check (reply_to_message_id is null or reply_to_message_id <> id)
);

comment on table public.messages is
  'Message d''une conversation. delivery_status suit D-83 : sent n''est pose qu''apres persistance serveur.';
comment on column public.messages.client_message_id is
  'Identifiant d''idempotence fourni par le client. Unique par conversation : rejouer un envoi ne cree pas de doublon.';

create index if not exists messages_conversation_cursor_idx
  on public.messages(conversation_id, created_at desc, id desc);
create index if not exists messages_sender_idx
  on public.messages(sender_profile_id, created_at desc)
  where sender_profile_id is not null;
create index if not exists messages_reply_to_idx
  on public.messages(reply_to_message_id) where reply_to_message_id is not null;
create index if not exists messages_deleted_by_idx
  on public.messages(deleted_by_profile_id) where deleted_by_profile_id is not null;
create index if not exists messages_failed_idx
  on public.messages(conversation_id, created_at desc) where delivery_status = 'failed';
create unique index if not exists messages_client_id_uidx
  on public.messages(conversation_id, client_message_id)
  where client_message_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversation_participants_last_read_fk') then
    alter table public.conversation_participants
      add constraint conversation_participants_last_read_fk
      foreign key (last_read_message_id) references public.messages(id) on delete set null;
  end if;
end
$$;

create table if not exists public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  hidden_at  timestamptz not null default now(),
  primary key (message_id, profile_id)
);
create index if not exists message_hides_profile_idx on public.message_hides(profile_id);

-- ---------------------------------------------------------------------
-- 4. Pieces jointes  (D-84)
-- ---------------------------------------------------------------------
create table if not exists public.message_attachments (
  id                uuid primary key default extensions.gen_random_uuid(),
  message_id        uuid not null references public.messages(id) on delete cascade,
  storage_path      text not null,
  original_filename text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  scan_status       text not null default 'pending'
                      check (scan_status in ('pending', 'clean', 'infected', 'skipped', 'failed')),
  scanned_at        timestamptz,
  created_at        timestamptz not null default now(),
  constraint message_attachments_size_limit
    check (size_bytes > 0 and size_bytes <= 10485760),
  constraint message_attachments_mime_allowlist
    check (mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/webp'
    ))
);

comment on table public.message_attachments is
  'Piece jointe d''un message. Limites D-84 : 10 Mo par fichier, 3 par message, liste blanche de types.';
comment on column public.message_attachments.storage_path is
  'Chemin dans un bucket prive. Le telechargement passe toujours par une URL signee (CA-MSG-03).';

create index if not exists message_attachments_message_idx on public.message_attachments(message_id);
create index if not exists message_attachments_scan_idx
  on public.message_attachments(created_at) where scan_status = 'pending';

create or replace function public.enforce_message_attachment_limit()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.message_attachments
  where message_id = new.message_id;

  if v_count >= 3 then
    raise exception 'attachment_limit_exceeded' using errcode = 'P0001';
  end if;

  return new;
end
$fn$;

comment on function public.enforce_message_attachment_limit() is
  'D-84 : au plus 3 pieces jointes par message. Code d''erreur machine attachment_limit_exceeded.';

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'message_attachments'
      and t.tgname = 'message_attachments_limit'
  ) then
    create trigger message_attachments_limit
      before insert on public.message_attachments
      for each row execute function public.enforce_message_attachment_limit();
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 5. Signalements de messages
-- ---------------------------------------------------------------------
create table if not exists public.message_reports (
  id                     uuid primary key default extensions.gen_random_uuid(),
  message_id             uuid not null references public.messages(id) on delete cascade,
  conversation_id        uuid not null references public.conversations(id) on delete cascade,
  reporter_profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  reason_code            text not null references public.report_reasons(code) on delete restrict,
  description            text,
  status                 text not null default 'open'
                           check (status in ('open', 'under_review', 'actioned',
                                             'dismissed', 'escalated')),
  priority               text not null default 'standard'
                           check (priority in ('standard', 'important', 'security')),
  reviewed_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  reviewed_at            timestamptz,
  resolution             text,
  moderation_reason      text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint message_reports_reviewed_timestamp
    check (status in ('open', 'under_review') or reviewed_at is not null)
);

comment on table public.message_reports is
  'Signalement d''un message. L''identite du signalant n''est jamais exposee au membre signale (CA-SUP-02).';

select private.attach_updated_at('public', 'message_reports');

create unique index if not exists message_reports_message_reporter_uidx
  on public.message_reports(message_id, reporter_profile_id);
create index if not exists message_reports_message_idx      on public.message_reports(message_id);
create index if not exists message_reports_conversation_idx on public.message_reports(conversation_id);
create index if not exists message_reports_reporter_idx     on public.message_reports(reporter_profile_id);
create index if not exists message_reports_reason_idx       on public.message_reports(reason_code);
create index if not exists message_reports_reviewer_idx     on public.message_reports(reviewed_by_profile_id)
  where reviewed_by_profile_id is not null;
create index if not exists message_reports_queue_idx
  on public.message_reports(created_at desc, id desc)
  where status in ('open', 'under_review', 'escalated');

