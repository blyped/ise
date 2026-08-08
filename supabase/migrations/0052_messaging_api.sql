-- =====================================================================
-- 0052_messaging_api
--
-- API applicative de l'ecran ISE-097 (Messagerie).
--
-- POURQUOI CETTE MIGRATION EXISTE
--   Les migrations 0014 a 0016 posent les tables, 0047 a 0049 posent les
--   politiques. Il manquait la couche d'acces : les ecrans ne peuvent pas
--   composer eux-memes les lectures.
--     * `ise_profiles` a perdu le privilege de SELECT au niveau table
--       (0028) : aucun `select` client ne peut construire une fiche
--       d'interlocuteur. Seul `private.network_profile_card()` le sait,
--       et il n'est pas executable par `authenticated`.
--     * la pagination doit etre par curseur (D-44) et le curseur keyset
--       (`private.encode_keyset_cursor`) n'est pas non plus executable
--       par `authenticated`.
--   Toutes les fonctions publiees ici sont donc SECURITY DEFINER et
--   REVERIFIENT explicitement l'appartenance : la RLS ne s'applique pas
--   a l'interieur d'une fonction definer, la verification est ecrite.
--
-- REGLES APPLIQUEES
--   D-44  pagination par curseur keyset, page 20 par defaut, 50 maximum
--   D-66  motifs de signalement filtres par `report_reasons.applies_to`
--   D-72  masquage personnel d'un message, strictement individuel
--   D-82  archivage par participant
--   D-83  `pending` -> `sent` -> `failed` ; `sent` n'est pose qu'ici,
--         apres persistance ; `client_message_id` porte l'idempotence
--   D-84  20 nouvelles conversations par jour et par membre
--   D-102 codes d'erreur machine uniquement (28000 / 42501 / P0002 / P0001)
--   D-103 limitation de debit applicative
--
-- AUCUNE de ces fonctions n'ouvre le contenu d'une conversation a un
-- tiers, a la moderation ou a un superadmin (MASTER PROMPT §24) : la
-- verification est toujours « suis-je participant », jamais « ai-je une
-- permission ».
-- =====================================================================


-- =====================================================================
-- PARTIE 1 — MESSAGERIE : coherence des compteurs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Un message persiste doit, dans la MEME transaction :
--   * dater la conversation et incrementer son compteur ;
--   * incrementer le non-lu de CHAQUE autre participant actif ;
--   * remettre a zero le non-lu de l'auteur (il a lu ce qu'il ecrit) ;
--   * desarchiver la conversation chez les destinataires — un nouveau
--     message reactive la conversation (DIGEST E2 §A.11).
-- Le faire dans un trigger et non dans la fonction d'envoi garantit que
-- le compteur reste juste quel que soit le chemin d'ecriture.
-- ---------------------------------------------------------------------
create or replace function private.on_message_persisted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.delivery_status <> 'sent' then
    return new;
  end if;

  update public.conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
         message_count   = message_count + 1
   where id = new.conversation_id;

  update public.conversation_participants
     set unread_count = unread_count + 1,
         archived_at  = null
   where conversation_id = new.conversation_id
     and membership_status = 'active'
     and (new.sender_profile_id is null or profile_id <> new.sender_profile_id);

  if new.sender_profile_id is not null then
    update public.conversation_participants
       set unread_count         = 0,
           last_read_message_id = new.id,
           last_read_at         = now()
     where conversation_id = new.conversation_id
       and profile_id      = new.sender_profile_id;
  end if;

  return new;
end
$fn$;

comment on function private.on_message_persisted() is
  'AFTER INSERT sur public.messages : datation de la conversation et compteurs de non-lus par participant (D-82, D-83).';

drop trigger if exists messages_persisted on public.messages;
create trigger messages_persisted
  after insert on public.messages
  for each row execute function private.on_message_persisted();

-- ---------------------------------------------------------------------
-- Temps reel (MASTER PROMPT §34, D-83) : STRICTEMENT deux tables.
--   * `messages` — le fil de la conversation ouverte ;
--   * `conversation_participants` — le compteur de non-lus.
-- Rien d'autre n'est publie : ni les notifications, ni les profils, ni
-- les tableaux de bord. Les politiques RLS s'appliquent au flux Realtime,
-- donc un non-participant ne recoit rien.
-- ---------------------------------------------------------------------
do $pub$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      where p.pubname = 'supabase_realtime' and c.relname = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (
      select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      where p.pubname = 'supabase_realtime' and c.relname = 'conversation_participants'
    ) then
      alter publication supabase_realtime add table public.conversation_participants;
    end if;
  end if;
end
$pub$;


-- =====================================================================
-- PARTIE 2 — MESSAGERIE : lectures
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extrait du dernier message VISIBLE PAR MOI : un message que j'ai
-- masque (`message_hides`, D-72) ne doit pas reapparaitre dans la liste,
-- et un message supprime par son auteur n'y laisse que sa mention.
-- ---------------------------------------------------------------------
create or replace function private.conversation_preview(p_conversation uuid, p_me uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'excerpt',   case when m.deleted_at is not null then null
                                else left(btrim(coalesce(m.body, '')), 160) end,
              'deleted',   (m.deleted_at is not null),
              'from_me',   (m.sender_profile_id is not null and m.sender_profile_id = p_me),
              'is_system', (m.message_type = 'system'),
              'at',        m.created_at)
       from public.messages m
      where m.conversation_id = p_conversation
        and not exists (select 1 from public.message_hides h
                        where h.message_id = m.id and h.profile_id = p_me)
      order by m.created_at desc, m.id desc
      limit 1),
    '{}'::jsonb)
$$;

-- ---------------------------------------------------------------------
-- ISE-097 — Liste des conversations.
--   p_scope : 'all' (actives) | 'unread' | 'archived'
-- Le compteur de non-lus renvoye est le compteur REEL du participant,
-- pas une estimation (MASTER PROMPT §98).
-- ---------------------------------------------------------------------
create or replace function public.list_my_conversations(
  p_scope   text default 'all',
  p_query   text default null,
  p_cursor  text default null,
  p_limit   integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope  text := coalesce(p_scope, 'all');
  v_c_at   timestamptz;
  v_c_id   uuid;
  v_rows   jsonb;
  v_next   text;
  v_query  text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_scope not in ('all', 'unread', 'archived') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select c.id,
           c.conversation_type,
           c.context_type,
           c.context_id,
           c.context_label,
           c.title,
           coalesce(c.last_message_at, c.created_at) as sort_at,
           cp.unread_count,
           cp.archived_at,
           (select cp2.profile_id
              from public.conversation_participants cp2
             where cp2.conversation_id = c.id
               and cp2.profile_id <> v_me
             order by cp2.joined_at
             limit 1) as counterpart_id,
           (select count(*) from public.conversation_participants cp3
             where cp3.conversation_id = c.id
               and cp3.membership_status = 'active') as participant_count
      from public.conversation_participants cp
      join public.conversations c on c.id = cp.conversation_id
     where cp.profile_id = v_me
       and cp.membership_status = 'active'
       and (case v_scope
              when 'archived' then cp.archived_at is not null
              when 'unread'   then cp.archived_at is null and cp.unread_count > 0
              else                 cp.archived_at is null
            end)
  ),
  carded as (
    select b.*,
           private.network_profile_card(b.counterpart_id) as counterpart
      from base b
  ),
  filtered as (
    select *
      from carded
     where v_query is null
        or public.normalize_text(coalesce(counterpart ->> 'display_name', '')) like
           '%' || public.normalize_text(v_query) || '%'
        or public.normalize_text(coalesce(context_label, '')) like
           '%' || public.normalize_text(v_query) || '%'
        or public.normalize_text(coalesce(title, '')) like
           '%' || public.normalize_text(v_query) || '%'
  ),
  page as (
    select *
      from filtered
     where v_c_at is null
        or (sort_at, id) < (v_c_at, v_c_id)
     order by sort_at desc, id desc
     limit v_limit + 1
  ),
  kept as (
    select * from page order by sort_at desc, id desc limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'conversation_id',    k.id,
           'conversation_type',  k.conversation_type,
           'context_type',       k.context_type,
           'context_id',         k.context_id,
           'context_label',      k.context_label,
           'title',              k.title,
           'last_message_at',    k.sort_at,
           'unread_count',       k.unread_count,
           'archived',           (k.archived_at is not null),
           'participant_count',  k.participant_count,
           'counterpart',        k.counterpart,
           'preview',            private.conversation_preview(k.id, v_me))
           order by k.sort_at desc, k.id desc), '[]'::jsonb),
         case when (select count(*) from page) > v_limit
              then (array_agg(private.encode_keyset_cursor(k.sort_at, k.id)
                                  order by k.sort_at asc, k.id asc))[1]
              else null end
    into v_rows, v_next
  from kept k;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', v_next,
    'unread_total', (
      select coalesce(sum(cp.unread_count), 0)
        from public.conversation_participants cp
       where cp.profile_id = v_me
         and cp.membership_status = 'active'
         and cp.archived_at is null),
    'archived_total', (
      select count(*)
        from public.conversation_participants cp
       where cp.profile_id = v_me
         and cp.membership_status = 'active'
         and cp.archived_at is not null));
end
$$;

revoke all on function public.list_my_conversations(text, text, text, integer) from public;
grant execute on function public.list_my_conversations(text, text, text, integer) to authenticated;
comment on function public.list_my_conversations(text, text, text, integer) is
  'ISE-097 — liste paginee par curseur des conversations du membre. Compteurs de non-lus reels (D-44, D-82).';


-- ---------------------------------------------------------------------
-- ISE-097 — En-tete d'une conversation.
-- Renvoie aussi de quoi decider ce que l'interface a le droit d'afficher :
-- puis-je repondre, l'accuse de lecture de l'autre est-il autorise.
-- ---------------------------------------------------------------------
create or replace function public.get_conversation(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_conv public.conversations;
  v_mine public.conversation_participants;
  v_other uuid;
  v_receipts boolean;
  v_blocked boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_mine
    from public.conversation_participants
   where conversation_id = p_conversation_id and profile_id = v_me;
  if not found or v_mine.membership_status <> 'active' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select cp.profile_id into v_other
    from public.conversation_participants cp
   where cp.conversation_id = p_conversation_id and cp.profile_id <> v_me
   order by cp.joined_at
   limit 1;

  v_blocked := v_other is not null and private.is_blocked_between(v_me, v_other);

  -- Accuse de lecture : reglage du DESTINATAIRE (`show_read_receipts`).
  -- Le sollicitant ne peut pas lire ce reglage lui-meme ; d'ou le definer.
  v_receipts := coalesce(
    (select s.show_read_receipts from public.user_settings s where s.profile_id = v_other),
    true);

  return jsonb_build_object(
    'conversation_id',   v_conv.id,
    'conversation_type', v_conv.conversation_type,
    'context_type',      v_conv.context_type,
    'context_id',        v_conv.context_id,
    'context_label',     v_conv.context_label,
    'initiation_reason', v_conv.initiation_reason,
    'title',             v_conv.title,
    'created_at',        v_conv.created_at,
    'message_count',     v_conv.message_count,
    'archived',          (v_mine.archived_at is not null),
    'unread_count',      v_mine.unread_count,
    'counterpart',       private.network_profile_card(v_other),
    'counterpart_id',    v_other,
    'is_blocked',        v_blocked,
    'can_reply',         (not v_blocked) and private.is_active_member(),
    'show_read_receipts', v_receipts,
    'other_last_read_at', (
      select cp.last_read_at from public.conversation_participants cp
       where cp.conversation_id = p_conversation_id and cp.profile_id = v_other),
    'participants', coalesce((
      select jsonb_agg(private.network_profile_card(cp.profile_id))
        from public.conversation_participants cp
       where cp.conversation_id = p_conversation_id
         and cp.membership_status = 'active'
         and cp.profile_id <> v_me), '[]'::jsonb));
end
$$;

revoke all on function public.get_conversation(uuid) from public;
grant execute on function public.get_conversation(uuid) to authenticated;
comment on function public.get_conversation(uuid) is
  'ISE-097 — en-tete d''une conversation. Refuse `not_found` a tout non-participant, sans exception administrative.';


-- ---------------------------------------------------------------------
-- ISE-097 — Fil de messages, pagination par curseur (du plus recent).
-- ---------------------------------------------------------------------
create or replace function public.list_conversation_messages(
  p_conversation_id uuid,
  p_cursor text default null,
  p_limit  integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_c_at  timestamptz;
  v_c_id  uuid;
  v_rows  jsonb;
  v_next  text;
  v_other_read timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_conversation_participant(p_conversation_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  select min(cp.last_read_at) into v_other_read
    from public.conversation_participants cp
   where cp.conversation_id = p_conversation_id and cp.profile_id <> v_me;

  with page as (
    select m.*
      from public.messages m
     where m.conversation_id = p_conversation_id
       and (m.deleted_at is null or m.sender_profile_id = v_me)
       and not exists (select 1 from public.message_hides h
                       where h.message_id = m.id and h.profile_id = v_me)
       and (v_c_at is null or (m.created_at, m.id) < (v_c_at, v_c_id))
     order by m.created_at desc, m.id desc
     limit v_limit + 1
  ),
  kept as (
    select * from page order by created_at desc, id desc limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'message_id',        k.id,
           'client_message_id', k.client_message_id,
           'message_type',      k.message_type,
           'body',              case when k.deleted_at is not null then null else k.body end,
           'deleted',           (k.deleted_at is not null),
           'edited_at',         k.edited_at,
           'created_at',        k.created_at,
           'delivery_status',   k.delivery_status,
           'from_me',           (k.sender_profile_id is not null and k.sender_profile_id = v_me),
           'sender_id',         k.sender_profile_id,
           'sender_name',       (select coalesce(p.display_name,
                                        btrim(concat_ws(' ', p.first_name, p.last_name)))
                                   from public.ise_profiles p where p.id = k.sender_profile_id),
           'read_by_other',     (k.sender_profile_id = v_me
                                 and v_other_read is not null
                                 and v_other_read >= k.created_at),
           'has_attachments',   k.has_attachments)
           order by k.created_at, k.id), '[]'::jsonb),
         case when (select count(*) from page) > v_limit
              then (array_agg(private.encode_keyset_cursor(k.created_at, k.id)
                                  order by k.created_at asc, k.id asc))[1]
              else null end
    into v_rows, v_next
  from kept k;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.list_conversation_messages(uuid, text, integer) from public;
grant execute on function public.list_conversation_messages(uuid, text, integer) to authenticated;
comment on function public.list_conversation_messages(uuid, text, integer) is
  'ISE-097 — fil de messages, curseur keyset. Les messages masques par le lecteur ne remontent pas (D-72).';


-- =====================================================================
-- PARTIE 3 — MESSAGERIE : ecritures
-- =====================================================================

-- ---------------------------------------------------------------------
-- ISE-097 — Envoi d'un message dans une conversation existante.
--
-- D-83 : la fonction ne renvoie une ligne que lorsqu'elle est PERSISTEE.
-- `delivery_status` vaut alors `sent` : c'est le seul endroit ou cet etat
-- est pose. `pending` reste un etat purement local au client.
--
-- IDEMPOTENCE : `client_message_id` est unique par conversation. Rejouer
-- un envoi apres une coupure reseau renvoie le message deja enregistre,
-- il n'en cree pas un second.
-- ---------------------------------------------------------------------
create or replace function public.send_message(
  p_conversation_id  uuid,
  p_body             text,
  p_client_message_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_body  text := btrim(coalesce(p_body, ''));
  v_msg   public.messages;
  v_other uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.conversation_participants cp
                 where cp.conversation_id = p_conversation_id
                   and cp.profile_id = v_me
                   and cp.membership_status = 'active') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if length(v_body) = 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if length(v_body) > 5000 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  -- Reprise reseau : le message existe deja, on le renvoie tel quel.
  if p_client_message_id is not null then
    select * into v_msg from public.messages
     where conversation_id = p_conversation_id
       and client_message_id = p_client_message_id;
    if found then
      return jsonb_build_object('message_id', v_msg.id,
                                'client_message_id', v_msg.client_message_id,
                                'created_at', v_msg.created_at,
                                'delivery_status', v_msg.delivery_status,
                                'duplicate', true);
    end if;
  end if;

  -- Le blocage est effectif COTE SERVEUR (CA-MSG-04) : il ne depend
  -- d'aucun affichage. Il vaut dans les deux sens.
  for v_other in
    select cp.profile_id from public.conversation_participants cp
     where cp.conversation_id = p_conversation_id
       and cp.profile_id <> v_me
       and cp.membership_status = 'active'
  loop
    if private.is_blocked_between(v_me, v_other) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;
  end loop;

  -- D-103 : limitation de debit applicative sur l'envoi.
  if not private.consume_rate_limit(v_me::text, 'message.send', 200, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.messages
    (conversation_id, sender_profile_id, message_type, body,
     client_message_id, delivery_status)
  values
    (p_conversation_id, v_me, 'text', v_body,
     nullif(btrim(coalesce(p_client_message_id, '')), ''), 'sent')
  returning * into v_msg;

  return jsonb_build_object('message_id', v_msg.id,
                            'client_message_id', v_msg.client_message_id,
                            'created_at', v_msg.created_at,
                            'delivery_status', v_msg.delivery_status,
                            'duplicate', false);
end
$$;

revoke all on function public.send_message(uuid, text, text) from public;
grant execute on function public.send_message(uuid, text, text) to authenticated;
comment on function public.send_message(uuid, text, text) is
  'ISE-097 — envoi d''un message. `sent` n''est pose qu''apres persistance (D-83) ; `client_message_id` porte l''idempotence.';


-- ---------------------------------------------------------------------
-- ISE-097 — Ouverture d'une conversation contextuelle.
--
-- Une conversation directe deja ouverte avec la meme personne et le meme
-- contexte est REUTILISEE : ouvrir deux fois le meme echange n'a aucun
-- sens metier et fragmenterait l'historique.
-- ---------------------------------------------------------------------
create or replace function public.start_conversation(
  p_target_profile_id uuid,
  p_body              text,
  p_initiation_reason text default 'other',
  p_context_type      text default 'profile',
  p_context_id        uuid default null,
  p_context_label     text default null,
  p_client_message_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_conv uuid;
  v_new  boolean := false;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_target_profile_id is null or p_target_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if length(v_body) = 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if coalesce(p_initiation_reason, 'other') not in
     ('expertise', 'opportunity', 'introduction', 'mentorship', 'project', 'other') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  -- Blocage + `direct_message_policy` du destinataire, resolus en base.
  if not private.can_message_profile(p_target_profile_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  select c.id into v_conv
    from public.conversations c
    join public.conversation_participants me    on me.conversation_id = c.id and me.profile_id = v_me
    join public.conversation_participants other on other.conversation_id = c.id
                                              and other.profile_id = p_target_profile_id
   where c.conversation_type = 'direct'
     and me.membership_status = 'active'
     and other.membership_status = 'active'
     and coalesce(c.context_type, '') = coalesce(p_context_type, '')
     and coalesce(c.context_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_context_id, '00000000-0000-0000-0000-000000000000'::uuid)
   order by c.created_at
   limit 1;

  if v_conv is null then
    -- D-84 : 20 nouvelles conversations par jour et par membre.
    if not private.consume_rate_limit(v_me::text, 'conversation.start', 20, 86400) then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;

    insert into public.conversations
      (conversation_type, context_type, context_id, context_label,
       initiation_reason, created_by_profile_id)
    values
      ('direct', p_context_type, p_context_id, nullif(btrim(coalesce(p_context_label, '')), ''),
       coalesce(p_initiation_reason, 'other'), v_me)
    returning id into v_conv;

    insert into public.conversation_participants (conversation_id, profile_id)
    values (v_conv, v_me), (v_conv, p_target_profile_id);

    v_new := true;
  end if;

  perform public.send_message(v_conv, v_body, p_client_message_id);

  return jsonb_build_object('conversation_id', v_conv, 'created', v_new);
end
$$;

revoke all on function public.start_conversation(uuid, text, text, text, uuid, text, text) from public;
grant execute on function public.start_conversation(uuid, text, text, text, uuid, text, text) to authenticated;
comment on function public.start_conversation(uuid, text, text, text, uuid, text, text) is
  'ISE-097 — ouverture d''une conversation contextuelle. Blocage et politique du destinataire verifies en base (CA-MSG-04) ; 20 ouvertures/jour (D-84).';


-- ---------------------------------------------------------------------
-- ISE-097 — Accuse de lecture et archivage par participant (D-82).
-- ---------------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_last uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.conversation_participants cp
                 where cp.conversation_id = p_conversation_id and cp.profile_id = v_me) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select m.id into v_last
    from public.messages m
   where m.conversation_id = p_conversation_id
   order by m.created_at desc, m.id desc
   limit 1;

  update public.conversation_participants
     set unread_count = 0,
         last_read_at = now(),
         last_read_message_id = coalesce(v_last, last_read_message_id)
   where conversation_id = p_conversation_id and profile_id = v_me;

  return jsonb_build_object(
    'unread_total', (select coalesce(sum(cp.unread_count), 0)
                       from public.conversation_participants cp
                      where cp.profile_id = v_me
                        and cp.membership_status = 'active'
                        and cp.archived_at is null));
end
$$;
revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.set_conversation_archived(
  p_conversation_id uuid,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.conversation_participants
     set archived_at = case when p_archived then now() else null end
   where conversation_id = p_conversation_id and profile_id = v_me;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('archived', p_archived);
end
$$;
revoke all on function public.set_conversation_archived(uuid, boolean) from public;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
comment on function public.set_conversation_archived(uuid, boolean) is
  'D-82 — archivage PAR PARTICIPANT. Archiver ne fait jamais disparaitre la conversation chez l''autre membre.';


-- ---------------------------------------------------------------------
-- Blocage — effectif cote serveur (CA-MSG-04). Aucune notification
-- n'est emise vers la personne bloquee (DIGEST E2 §A.10).
-- ---------------------------------------------------------------------
create or replace function public.block_profile(p_profile_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_profile_id is null or p_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;

  insert into public.profile_blocks (blocker_profile_id, blocked_profile_id, reason)
  values (v_me, p_profile_id, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (blocker_profile_id, blocked_profile_id) do nothing;

  return jsonb_build_object('blocked', true);
end
$$;
revoke all on function public.block_profile(uuid, text) from public;
grant execute on function public.block_profile(uuid, text) to authenticated;

create or replace function public.unblock_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.profile_blocks
   where blocker_profile_id = v_me and blocked_profile_id = p_profile_id;
  return jsonb_build_object('blocked', false);
end
$$;
revoke all on function public.unblock_profile(uuid) from public;
grant execute on function public.unblock_profile(uuid) to authenticated;

create or replace function public.list_my_blocked_profiles()
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
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'profile_id',  b.blocked_profile_id,
             'blocked_at',  b.created_at,
             'display_name', (select coalesce(p.display_name,
                                     btrim(concat_ws(' ', p.first_name, p.last_name)))
                                from public.ise_profiles p
                               where p.id = b.blocked_profile_id))
             order by b.created_at desc)
      from public.profile_blocks b
     where b.blocker_profile_id = v_me), '[]'::jsonb);
end
$$;
revoke all on function public.list_my_blocked_profiles() from public;
grant execute on function public.list_my_blocked_profiles() to authenticated;
comment on function public.list_my_blocked_profiles() is
  'ISE-099 — « Membres bloques ». Le nom est renvoye sans passer par la visibilite par champ : on doit pouvoir debloquer quelqu''un qu''on ne voit plus.';


-- ---------------------------------------------------------------------
-- Signalement d'un message (D-66 : motif filtre par type d'objet).
-- ---------------------------------------------------------------------
create or replace function public.report_message(
  p_message_id uuid,
  p_reason_code text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_conv uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select m.conversation_id into v_conv from public.messages m where m.id = p_message_id;
  if v_conv is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.is_conversation_participant(v_conv) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.report_reasons r
                 where r.code = p_reason_code and r.is_active
                   and 'message' = any (r.applies_to)) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.message_reports
    (message_id, conversation_id, reporter_profile_id, reason_code, description)
  values
    (p_message_id, v_conv, v_me, p_reason_code, nullif(btrim(coalesce(p_description, '')), ''))
  on conflict (message_id, reporter_profile_id) do nothing;

  return jsonb_build_object('reported', true);
end
$$;
revoke all on function public.report_message(uuid, text, text) from public;
grant execute on function public.report_message(uuid, text, text) to authenticated;
comment on function public.report_message(uuid, text, text) is
  'ISE-097 / ISE-100 — signalement d''un message. Seul pont entre une conversation privee et la moderation (MASTER PROMPT §24).';

