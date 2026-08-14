-- =====================================================================
-- 0131_support_communication_reporting
-- Module Communication, volet « Remonter une information ».
--
-- DECISION DE CADRAGE : on ETEND le module support existant (0016, 0027,
-- 0049, 0053, 0076). On n'en cree pas un second. Le fil de suivi, les
-- pieces jointes, la reference lisible `ISE-0042`, le cockpit agent et le
-- contexte technique existent deja ; ce qui manquait, ce sont
--   (1) un referentiel de categories par NATURE et non par module,
--   (2) un statut « Pris en charge » distinct de « En cours »,
--   (3) quatre niveaux de priorite au lieu de trois,
--   (4) un contexte technique reellement renseigne et borne,
--   (5) des compteurs et des filtres dans le cockpit,
--   (6) une voie d'ecriture pour les pieces jointes (la table et le
--       bucket existaient, aucune RPC ne permettait d'y ecrire).
--
-- AUCUN TICKET EN BASE au moment de cette migration (0 ligne dans
-- `support_tickets`, 0 objet dans `support-attachments`). Les CHECK sont
-- donc reecrits sans migration de donnees ; les UPDATE de repli
-- ci-dessous ne sont la que par principe, ils ne toucheront rien.
--
-- D-85 EST CONSERVEE : le demandeur ne choisit PAS sa priorite. Elle est
-- posee par le SYSTEME a la creation (valeur par defaut de la nature de
-- la demande) et n'est requalifiable que par l'administration, qui trace
-- alors son identite dans `urgency_set_by_profile_id`. Aucun delai cible
-- n'est introduit ici : il n'en existe toujours aucun.
--
-- CE FIL N'EST PAS UNE MESSAGERIE. Il relie un ISE et l'administration.
-- Les politiques de 0049 (`can_access_support_ticket`) restent seules
-- maitresses de l'acces ; aucune n'est elargie ici.
--
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================


-- =====================================================================
-- PARTIE 1 — REFERENTIEL DE CATEGORIES PAR NATURE
--
-- Les 16 categories de 0016 decrivaient le MODULE concerne (« Mon
-- compte », « Opportunites », « Communautes »...). Le porteur demande la
-- NATURE de la remontee (bug, suggestion, idee...). Ce n'est pas un
-- renommage : c'est un autre axe de classement.
--
-- Les anciennes categories sont DESACTIVEES (`is_active = false`), pas
-- supprimees : `support_tickets.category_code` les reference par cle
-- etrangere, et une categorie desactivee reste lisible sur les tickets
-- historiques tout en disparaissant des formulaires
-- (`loadSupportCategories` filtre deja sur `is_active`).
-- `other` survit : c'est la meme categorie « Autre » dans les deux axes.
-- =====================================================================

-- Colonne de priorite par defaut selon la nature. C'est le SYSTEME qui
-- classe (D-85) : une suggestion n'arrive pas avec la meme priorite
-- qu'un bug. L'administration reste libre de requalifier ensuite.
alter table public.support_categories
  add column if not exists default_urgency text not null default 'standard';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'support_categories_default_urgency_check'
       and conrelid = 'public.support_categories'::regclass
  ) then
    alter table public.support_categories
      add constraint support_categories_default_urgency_check
      check (default_urgency in ('low', 'standard', 'high', 'critical'));
  end if;
end
$$;

comment on column public.support_categories.default_urgency is
  'Priorite posee par le SYSTEME a la creation, selon la nature de la remontee (D-85 : le demandeur ne choisit pas). Requalifiable par l''administration.';

-- Desactivation de l'axe « par module ». `other` est conserve actif.
update public.support_categories
   set is_active = false
 where code in ('account', 'profile', 'verification', 'privacy', 'security',
                'search', 'network_calls', 'opportunities', 'internships',
                'mentorship', 'projects', 'communities', 'promotions',
                'messages', 'report_problem');

-- Les huit natures demandees. `routes_to_moderation` reste faux partout :
-- signaler un abus passe par `public.reports` (D-66, ecran /aide/signaler),
-- pas par un ticket support. « Contenu incorrect » vise une donnee fausse
-- ou perimee, pas un contenu abusif.
insert into public.support_categories
  (code, name, description, routes_to_moderation, sort_order, is_active, default_urgency)
values
  ('bug',               'Bug',
   'Quelque chose ne fonctionne pas comme prevu : une action echoue, un ecran s''affiche mal.',
   false, 10, true, 'high'),
  ('technical_issue',   'Probleme technique',
   'Lenteur, connexion impossible, notification non recue, fichier qui ne s''ouvre pas.',
   false, 20, true, 'standard'),
  ('suggestion',        'Suggestion',
   'Une amelioration concrete a apporter a une fonctionnalite existante.',
   false, 30, true, 'low'),
  ('idea',              'Idee',
   'Une proposition nouvelle pour le reseau : service, evenement, usage.',
   false, 40, true, 'low'),
  ('help_request',      'Demande d''aide',
   'Vous ne savez pas comment faire quelque chose et souhaitez etre accompagne.',
   false, 50, true, 'standard'),
  ('profile_data',      'Donnees de mon profil',
   'Une information vous concernant est inexacte, manquante ou a corriger.',
   false, 60, true, 'standard'),
  ('incorrect_content', 'Contenu incorrect',
   'Une information publiee sur la plateforme est fausse, perimee ou mal orthographiee.',
   false, 70, true, 'standard'),
  ('other',             'Autre',
   'Une observation qui n''entre dans aucune des categories precedentes.',
   false, 80, true, 'standard')
on conflict (code) do update
  set name                 = excluded.name,
      description          = excluded.description,
      routes_to_moderation = excluded.routes_to_moderation,
      sort_order           = excluded.sort_order,
      is_active            = excluded.is_active,
      default_urgency      = excluded.default_urgency;


-- =====================================================================
-- PARTIE 2 — QUATRE NIVEAUX DE PRIORITE
--
-- 0016 posait trois niveaux : standard / important / security. Le porteur
-- en demande quatre : Faible, Normale, Haute, Critique. La correspondance
-- retenue est une TRADUCTION, pas un ajout de concept :
--     important -> high      (une demande a traiter avant les autres)
--     security  -> critical  (un incident de securite EST critique)
--     standard  -> standard  (« Normale » a l'ecran)
--     (nouveau)  low         (« Faible » : suggestion, idee)
--
-- `reports.severity` garde le vocabulaire a trois niveaux de 0016 : la
-- moderation est une autre file, elle n'est pas touchee ici.
-- =====================================================================

alter table public.support_tickets
  drop constraint if exists support_tickets_urgency_check;

-- Repli de principe : la table est vide, ces UPDATE ne toucheront rien.
update public.support_tickets set urgency = 'high'     where urgency = 'important';
update public.support_tickets set urgency = 'critical' where urgency = 'security';

alter table public.support_tickets
  alter column urgency set default 'standard';

alter table public.support_tickets
  add constraint support_tickets_urgency_check
  check (urgency in ('low', 'standard', 'high', 'critical'));

comment on column public.support_tickets.urgency is
  'Quatre niveaux : low / standard / high / critical (Faible, Normale, Haute, Critique). '
  'JAMAIS choisie par le demandeur (D-85) : posee par le systeme d''apres la nature de la demande, '
  'requalifiable par l''administration seule, qui laisse alors sa trace dans urgency_set_by_profile_id.';


-- =====================================================================
-- PARTIE 3 — SIX STATUTS
--
-- 0016 en posait cinq. Le porteur en demande six. Correspondance retenue :
--     Nouveau        -> open            (inchange)
--     Pris en charge -> acknowledged    (NOUVEAU : un agent a pris le
--                                        dossier, le travail n'a pas
--                                        commence — c'est exactement ce
--                                        que `in_progress` melangeait)
--     En cours       -> in_progress     (inchange, sens desormais strict)
--     Repondu        -> waiting_user    (CODE CONSERVE, libelle change)
--     Resolu         -> resolved        (inchange)
--     Ferme          -> closed          (inchange)
--
-- POURQUOI `waiting_user` DEVIENT « Repondu » ET NON UN NOUVEAU CODE.
--   « Repondu » et « En attente du membre » decrivent le MEME etat, vus
--   de deux cotes : l'administration a ecrit, la balle est dans le camp
--   du membre. Creer un septieme code `answered` aurait produit deux
--   etats indiscernables et une machine a etats a deux chemins pour un
--   seul fait. On garde donc le code — ce qui preserve les RPC, les
--   politiques et les tests existants — et on corrige le LIBELLE, qui
--   etait le seul element reellement oriente « attente » et non
--   « reponse ».
-- =====================================================================

alter table public.support_tickets
  drop constraint if exists support_tickets_status_check;

alter table public.support_tickets
  add constraint support_tickets_status_check
  check (status in ('open', 'acknowledged', 'in_progress', 'waiting_user', 'resolved', 'closed'));

-- L'index partiel des tickets ouverts porte la liste des statuts actifs :
-- il doit inclure `acknowledged`, sinon un ticket pris en charge sort de
-- l'index et le cockpit ralentit sans que rien ne le signale.
drop index if exists public.support_tickets_open_idx;
create index support_tickets_open_idx
  on public.support_tickets(status, urgency)
  where status in ('open', 'acknowledged', 'in_progress', 'waiting_user');

comment on column public.support_tickets.status is
  'Six etats : open (Nouveau), acknowledged (Pris en charge), in_progress (En cours), '
  'waiting_user (Repondu — l''administration a repondu, le membre a la main), '
  'resolved (Resolu), closed (Ferme). Transitions par transition_support_ticket UNIQUEMENT (trigger de 0049).';


-- =====================================================================
-- PARTIE 4 — CONTEXTE TECHNIQUE BORNE
--
-- `technical_context` existait et ne contenait que `{page, surface}`.
-- Le porteur veut, pour un bug : l'ecran d'ou part le signalement, le
-- navigateur, le systeme, l'environnement web ou mobile.
--
-- REGLE ABSOLUE : rien de sensible n'entre, et RIEN N'EST RENVOYE AU
-- MEMBRE. `get_support_ticket()` (RPC membre) ne renvoie pas cette
-- colonne et ne la renverra pas ; seule `admin_get_support_ticket()` la
-- expose, a un porteur de `support.manage`.
--
-- La fonction ci-dessous est une LISTE BLANCHE : toute cle inconnue est
-- jetee, toute valeur non scalaire est jetee, toute chaine est tronquee.
-- Un client malveillant ou maladroit qui pousserait un jeton, un cookie
-- ou un corps de requete ne verrait rien arriver en base.
-- =====================================================================

create or replace function private.sanitize_support_context(p_context jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select jsonb_object_agg(
              e.key,
              to_jsonb(left(
                case jsonb_typeof(e.value)
                  when 'string' then e.value #>> '{}'
                  else e.value::text
                end, 200)))
       from jsonb_each(coalesce(p_context, '{}'::jsonb)) e
      where e.key in (
              'page',            -- chemin de l'ecran d'ou part la remontee
              'surface',         -- 'web' | 'mobile'
              'environment',     -- 'production' | 'preview' | 'development'
              'browser',         -- famille de navigateur
              'browser_version',
              'os',
              'os_version',
              'device_type',     -- 'desktop' | 'tablet' | 'mobile'
              'viewport',        -- '1440x900'
              'language',
              'timezone',
              'app_version',
              'user_agent')      -- brut tronque, pour l'administration seule
        and jsonb_typeof(e.value) in ('string', 'number', 'boolean')),
    '{}'::jsonb);
$$;

revoke all on function private.sanitize_support_context(jsonb) from public, anon, authenticated;

comment on function private.sanitize_support_context(jsonb) is
  'Liste blanche du contexte technique d''un ticket. Jette toute cle inconnue, toute valeur non scalaire, '
  'tronque a 200 caracteres. Aucun jeton, aucun cookie, aucun contenu prive ne peut transiter. '
  'Ce contexte n''est JAMAIS renvoye au demandeur.';


-- =====================================================================
-- PARTIE 5 — RPC MEMBRE : creation, fil, reponse
--
-- Trois evolutions, toutes ADDITIVES pour les appelants existants :
--   * la priorite initiale vient de la nature choisie (systeme, D-85) ;
--   * le contexte technique passe par la liste blanche ;
--   * la creation et la reponse renvoient `message_id`, sans quoi il est
--     impossible d'attacher une piece jointe au message qui vient d'etre
--     ecrit (c'est ce chainon manquant qui rendait la table
--     `support_message_attachments` inutilisable).
-- =====================================================================

create or replace function public.create_support_ticket(
  p_category_code     text,
  p_subject           text,
  p_description       text,
  p_technical_context jsonb default '{}'::jsonb,
  p_correlation_id    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_ticket  public.support_tickets;
  v_message uuid;
  v_urgency text;
  v_type    text := 'support_ticket_created';
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select c.default_urgency into v_urgency
    from public.support_categories c
   where c.code = p_category_code and c.is_active;

  if v_urgency is null then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_subject, ''))) < 3
     or length(btrim(coalesce(p_subject, ''))) > 200
     or length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not private.consume_rate_limit(v_me::text, 'support.ticket', 10, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- `urgency_source = 'system'` et `urgency_set_by_profile_id = null` :
  -- la priorite initiale est posee par la plateforme, pas par le
  -- demandeur (D-85). C'est la valeur du referentiel de categories.
  insert into public.support_tickets
    (requester_profile_id, category_code, subject, description,
     urgency, urgency_source, technical_context, correlation_id)
  values
    (v_me, p_category_code, btrim(p_subject), btrim(p_description),
     v_urgency, 'system',
     private.sanitize_support_context(p_technical_context),
     nullif(btrim(coalesce(p_correlation_id, '')), ''))
  returning * into v_ticket;

  insert into public.support_messages (ticket_id, author_kind, author_profile_id, body)
  values (v_ticket.id, 'member', v_me, btrim(p_description))
  returning id into v_message;

  if exists (select 1 from public.notification_types t where t.code = v_type and t.is_active) then
    insert into public.notifications
      (profile_id, notification_type_code, category, priority, title, body,
       entity_type, entity_id, action_type, action_path, deduplication_key)
    values
      (v_me, v_type, 'system', 'info',
       'Votre demande a été reçue.',
       'Demande ' || v_ticket.reference_code || ' — ' || v_ticket.subject,
       'support_ticket', v_ticket.id, 'open',
       '/aide/demandes/' || v_ticket.id::text,
       'support_ticket_created:' || v_ticket.id::text)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ticket_id',      v_ticket.id,
    'message_id',     v_message,
    'reference_code', v_ticket.reference_code,
    'status',         v_ticket.status,
    'created_at',     v_ticket.created_at);
end
$$;
revoke all on function public.create_support_ticket(text, text, text, jsonb, text) from public, anon;
grant execute on function public.create_support_ticket(text, text, text, jsonb, text) to authenticated;
comment on function public.create_support_ticket(text, text, text, jsonb, text) is
  'ISE-100 — creation d''une remontee. Priorite initiale posee par le SYSTEME d''apres la nature (D-85). '
  'Contexte technique filtre par liste blanche. Renvoie message_id pour permettre l''ajout de pieces jointes. '
  'Aucun delai cible n''est pose ni renvoye.';


create or replace function public.reply_to_support_ticket(p_ticket_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_t       public.support_tickets;
  v_body    text := btrim(coalesce(p_body, ''));
  v_message uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if length(v_body) = 0 or length(v_body) > 5000 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_t from public.support_tickets where id = p_ticket_id;
  if not found or v_t.requester_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_t.status not in ('open', 'acknowledged', 'in_progress', 'waiting_user') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  insert into public.support_messages (ticket_id, author_kind, author_profile_id, body)
  values (p_ticket_id, 'member', v_me, v_body)
  returning id into v_message;

  return jsonb_build_object('replied', true, 'message_id', v_message);
end
$$;
revoke all on function public.reply_to_support_ticket(uuid, text) from public, anon;
grant execute on function public.reply_to_support_ticket(uuid, text) to authenticated;


-- Fil du ticket cote membre. Deux ajouts : le statut `acknowledged` dans
-- les etats qui acceptent une reponse, et les PIECES JOINTES du message
-- (nom, type, taille, chemin) pour que l'ecran puisse fabriquer une URL
-- signee. Les notes internes restent filtrees explicitement : une
-- fonction SECURITY DEFINER ne passe pas par la RLS.
create or replace function public.get_support_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_ticket public.support_tickets;
  v_agent  boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_agent := private.has_permission('support.manage');
  if v_ticket.requester_profile_id <> v_me and not v_agent then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- `technical_context` n'est PAS renvoye ici : il n'a rien a faire dans
  -- l'ecran du demandeur (voir en-tete, partie 4).
  return jsonb_build_object(
    'ticket_id',      v_ticket.id,
    'reference_code', v_ticket.reference_code,
    'subject',        v_ticket.subject,
    'description',    v_ticket.description,
    'category_code',  v_ticket.category_code,
    'category_name',  (select c.name from public.support_categories c
                        where c.code = v_ticket.category_code),
    'status',         v_ticket.status,
    'created_at',     v_ticket.created_at,
    'updated_at',     v_ticket.updated_at,
    'resolved_at',    v_ticket.resolved_at,
    'closed_at',      v_ticket.closed_at,
    'reopened_count', v_ticket.reopened_count,
    'is_mine',        (v_ticket.requester_profile_id = v_me),
    'can_reply',      v_ticket.status in ('open', 'acknowledged', 'in_progress', 'waiting_user'),
    'can_close',      (v_ticket.status = 'resolved'),
    'can_reopen',     (v_ticket.status = 'resolved' and v_ticket.requester_profile_id = v_me),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'message_id',  m.id,
               'author_kind', m.author_kind,
               'from_me',     (m.author_profile_id is not null and m.author_profile_id = v_me),
               'body',        m.body,
               'created_at',  m.created_at,
               'attachments', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'attachment_id', a.id,
                          'file_name',     a.file_name,
                          'mime_type',     a.mime_type,
                          'byte_size',     a.byte_size,
                          'storage_path',  a.storage_path)
                        order by a.created_at)
                   from public.support_message_attachments a
                  where a.message_id = m.id), '[]'::jsonb))
               order by m.created_at, m.id)
        from public.support_messages m
       where m.ticket_id = p_ticket_id
         and (m.is_internal_note = false or v_agent)), '[]'::jsonb));
end
$$;
revoke all on function public.get_support_ticket(uuid) from public, anon;
grant execute on function public.get_support_ticket(uuid) to authenticated;
comment on function public.get_support_ticket(uuid) is
  'ISE-100 — fil d''une remontee, pieces jointes incluses. Les notes internes sont filtrees explicitement. '
  'Le contexte technique n''est jamais renvoye au demandeur.';


create or replace function public.list_my_support_tickets(
  p_cursor text default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_c_at  timestamptz;
  v_c_id  uuid;
  v_rows  jsonb;
  v_next  text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with page as (
    select t.*
      from public.support_tickets t
     where t.requester_profile_id = v_me
       and (v_c_at is null or (t.created_at, t.id) < (v_c_at, v_c_id))
     order by t.created_at desc, t.id desc
     limit v_limit + 1
  ),
  kept as (select * from page order by created_at desc, id desc limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'ticket_id',      k.id,
           'reference_code', k.reference_code,
           'subject',        k.subject,
           'category_code',  k.category_code,
           'category_name',  (select c.name from public.support_categories c
                               where c.code = k.category_code),
           'status',         k.status,
           'created_at',     k.created_at,
           'updated_at',     k.updated_at,
           'resolved_at',    k.resolved_at,
           'reopened_count', k.reopened_count,
           'message_count',  (select count(*) from public.support_messages m
                               where m.ticket_id = k.id and m.is_internal_note = false))
           order by k.created_at desc, k.id desc), '[]'::jsonb),
         case when (select count(*) from page) > v_limit
              then (array_agg(private.encode_keyset_cursor(k.created_at, k.id)
                                  order by k.created_at asc, k.id asc))[1]
              else null end
    into v_rows, v_next
  from kept k;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', v_next,
    'open_total', (select count(*) from public.support_tickets t
                    where t.requester_profile_id = v_me
                      and t.status in ('open', 'acknowledged', 'in_progress', 'waiting_user')));
end
$$;
revoke all on function public.list_my_support_tickets(text, integer) from public, anon;
grant execute on function public.list_my_support_tickets(text, integer) to authenticated;


-- =====================================================================
-- PARTIE 6 — MACHINE A ETATS A SIX ETATS
--
-- Le trigger `support_tickets_status_guard` (0049) refuse tout UPDATE
-- direct de `status`. Cette fonction reste donc l'unique voie.
--
-- Transitions autorisees :
--   open          -> acknowledged | in_progress                 (agent)
--   acknowledged  -> in_progress | waiting_user | resolved      (agent)
--   in_progress   -> waiting_user | resolved                    (agent)
--   waiting_user  -> in_progress | resolved                     (agent)
--   resolved      -> in_progress                                (agent, reprise)
--   resolved      -> closed                                     (agent OU demandeur)
--   resolved      -> open                                       (demandeur : reouverture)
--   closed        -> (terminal)
-- =====================================================================

create or replace function public.transition_support_ticket(p_ticket_id uuid, p_to_status text)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := private.current_profile_id();
  v_ticket   public.support_tickets;
  v_is_agent boolean;
  v_allowed  boolean := false;
  v_from     text;
  v_notif    text;
  v_title    text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;

  v_is_agent := private.has_permission('support.manage');

  if not v_is_agent and v_me <> v_ticket.requester_profile_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  v_allowed := case
    when p_to_status = 'acknowledged' then v_is_agent and v_ticket.status = 'open'
    when p_to_status = 'in_progress'  then v_is_agent and v_ticket.status in
                                             ('open', 'acknowledged', 'waiting_user', 'resolved')
    when p_to_status = 'waiting_user' then v_is_agent and v_ticket.status in
                                             ('acknowledged', 'in_progress')
    when p_to_status = 'resolved'     then v_is_agent and v_ticket.status in
                                             ('acknowledged', 'in_progress', 'waiting_user')
    when p_to_status = 'closed'       then v_ticket.status = 'resolved'
    when p_to_status = 'open'         then v_ticket.status = 'resolved'
                                           and v_me = v_ticket.requester_profile_id
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_from := v_ticket.status;

  update public.support_tickets
     set status         = p_to_status,
         resolved_at    = case
                            when p_to_status in ('resolved', 'closed') then coalesce(resolved_at, now())
                            else null
                          end,
         closed_at      = case when p_to_status = 'closed' then now() else null end,
         reopened_count = case when p_to_status = 'open' then reopened_count + 1 else reopened_count end,
         -- Prendre en charge, c'est se designer : un ticket « Pris en
         -- charge » sans titulaire serait un statut qui ment.
         assigned_agent_profile_id = case
           when p_to_status = 'acknowledged' and assigned_agent_profile_id is null then v_me
           else assigned_agent_profile_id
         end
   where id = p_ticket_id
  returning * into v_ticket;

  if v_is_agent and v_me <> v_ticket.requester_profile_id then
    v_notif := case p_to_status
      when 'acknowledged' then 'support_ticket_created'
      when 'waiting_user' then 'support_information_requested'
      when 'resolved'     then 'support_ticket_resolved'
    end;
    v_title := case p_to_status
      when 'acknowledged' then 'Votre demande est prise en charge.'
      when 'waiting_user' then 'L''équipe support vous a répondu.'
      when 'resolved'     then 'Votre demande a été résolue.'
    end;
    if v_notif is not null and exists (
      select 1 from public.notification_types nt where nt.code = v_notif and nt.is_active) then
      insert into public.notifications
        (profile_id, notification_type_code, category,
         priority, title, body, entity_type, entity_id, action_type, action_path,
         deduplication_key)
      values
        (v_ticket.requester_profile_id, v_notif, 'system',
         case when v_notif = 'support_information_requested' then 'action_required' else 'info' end,
         v_title,
         'Demande ' || v_ticket.reference_code || ' — ' || v_ticket.subject,
         'support_ticket', v_ticket.id, 'open',
         '/aide/demandes/' || v_ticket.id::text,
         'support_transition:' || v_ticket.id::text || ':' || p_to_status || ':'
           || extract(epoch from clock_timestamp())::bigint::text)
      on conflict do nothing;
    end if;
  end if;

  perform private.log_audit(
    p_action      => 'support.ticket_transitioned',
    p_object_type => 'support_ticket',
    p_object_id   => p_ticket_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'from_status', v_from,
      'to_status',   p_to_status,
      'by_agent',    v_is_agent
    )
  );

  return v_ticket;
end
$$;
revoke all on function public.transition_support_ticket(uuid, text) from public, anon;
grant execute on function public.transition_support_ticket(uuid, text) to authenticated;
comment on function public.transition_support_ticket(uuid, text) is
  'ISE-100 — unique voie de changement de statut (six etats). « Pris en charge » assigne le ticket a l''agent '
  'qui le prend, sinon le statut mentirait. Notifie le demandeur et audite.';


-- =====================================================================
-- PARTIE 7 — PRIORITE REQUALIFIEE PAR L'ADMINISTRATION
--
-- Il manquait TOUTE ecriture sur `urgency` : le cockpit affichait une
-- priorite que personne ne pouvait changer. C'est ce que D-85 prevoit
-- pourtant explicitement — l'urgence n'est pas choisie par le demandeur,
-- elle est ATTRIBUEE. Cette RPC est cette attribution, et elle laisse la
-- trace de son auteur (`urgency_source = 'agent'`, `urgency_set_by_profile_id`),
-- comme la contrainte `support_tickets_urgency_attribution` l'exige.
-- =====================================================================

create or replace function public.admin_set_support_ticket_urgency(
  p_ticket_id uuid,
  p_urgency   text,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_from   text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    perform private.log_audit(
      p_action      => 'support.ticket_urgency_set',
      p_object_type => 'support_ticket',
      p_object_id   => p_ticket_id::text,
      p_result      => 'denied',
      p_error_code  => '42501');
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_urgency is null or p_urgency not in ('low', 'standard', 'high', 'critical') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select urgency into v_from from public.support_tickets where id = p_ticket_id for update;
  if v_from is null then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;

  update public.support_tickets
     set urgency                   = p_urgency,
         urgency_source            = 'agent',
         urgency_set_by_profile_id = v_me
   where id = p_ticket_id;

  perform private.log_audit(
    p_action      => 'support.ticket_urgency_set',
    p_object_type => 'support_ticket',
    p_object_id   => p_ticket_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
                       'from_urgency', v_from,
                       'to_urgency',   p_urgency,
                       'reason',       v_reason));

  return jsonb_build_object('ticket_id', p_ticket_id, 'urgency', p_urgency);
end
$$;
revoke all on function public.admin_set_support_ticket_urgency(uuid, text, text) from public, anon;
grant execute on function public.admin_set_support_ticket_urgency(uuid, text, text) to authenticated;
comment on function public.admin_set_support_ticket_urgency(uuid, text, text) is
  'SA-039 — requalifie la priorite d''une remontee. Reservee a support.manage, trace l''auteur (D-85). Auditee.';


-- =====================================================================
-- PARTIE 8 — COCKPIT ADMINISTRATEUR
--
-- Compteurs REELS, jamais estimes (MASTER PROMPT §98) :
--   nouvelles      = statut `open`
--   en cours       = `acknowledged` + `in_progress`
--   non repondues  = ouvertes ET sans AUCUN message d'agent visible du
--                    membre (une note interne ne repond a personne)
--   critiques      = priorite `critical`, non close
--   resolues       = `resolved` + `closed`
--
-- Les listes `assignees` et `promotions` alimentent les filtres du
-- cockpit avec les valeurs REELLEMENT presentes : aucun filtre ne propose
-- une valeur qui ne ramenerait rien.
-- =====================================================================

create or replace function public.admin_support_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_open constant text[] := array['open', 'acknowledged', 'in_progress', 'waiting_user'];
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'new_count',        (select count(*) from public.support_tickets t where t.status = 'open'),
    'in_progress_count',(select count(*) from public.support_tickets t
                          where t.status in ('acknowledged', 'in_progress')),
    'unanswered_count', (select count(*) from public.support_tickets t
                          where t.status = any (v_open)
                            and not exists (select 1 from public.support_messages m
                                             where m.ticket_id = t.id
                                               and m.author_kind = 'agent'
                                               and m.is_internal_note = false)),
    'critical_count',   (select count(*) from public.support_tickets t
                          where t.urgency = 'critical' and t.status = any (v_open)),
    'resolved_count',   (select count(*) from public.support_tickets t
                          where t.status in ('resolved', 'closed')),
    'open_total',       (select count(*) from public.support_tickets t where t.status = any (v_open)),
    'total',            (select count(*) from public.support_tickets),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('code', x.code, 'name', x.name, 'total', x.total)
                       order by x.total desc, x.name)
        from (select c.code, c.name, count(t.id) as total
                from public.support_categories c
                join public.support_tickets t on t.category_code = c.code
               group by c.code, c.name) x), '[]'::jsonb),
    'assignees', coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', x.id, 'name', x.name, 'total', x.total)
                       order by x.name)
        from (select p.id, p.display_name as name, count(*) as total
                from public.support_tickets t
                join public.ise_profiles p on p.id = t.assigned_agent_profile_id
               group by p.id, p.display_name) x), '[]'::jsonb),
    'promotions', coalesce((
      select jsonb_agg(jsonb_build_object('promotion_id', x.id, 'name', x.name, 'total', x.total)
                       order by x.name)
        from (select pr.id, pr.name, count(*) as total
                from public.support_tickets t
                join public.ise_profiles p on p.id = t.requester_profile_id
                join public.promotions pr on pr.id = p.promotion_id
               group by pr.id, pr.name) x), '[]'::jsonb));
end
$$;
revoke all on function public.admin_support_dashboard() from public, anon;
grant execute on function public.admin_support_dashboard() to authenticated;
comment on function public.admin_support_dashboard() is
  'SA-038 — compteurs et referentiels de filtres du cockpit des remontees. Chiffres comptes en base, jamais estimes. '
  'Aucun delai cible (D-85).';


-- L'ancienne signature a trois arguments est REMPLACEE : la laisser en
-- place creerait deux surcharges que PostgREST ne saurait pas departager
-- lorsque l'appelant ne passe que `p_status`.
drop function if exists public.admin_list_support_tickets(text, text, integer);

create or replace function public.admin_list_support_tickets(
  p_status              text        default null,
  p_category_code       text        default null,
  p_urgency             text        default null,
  p_promotion_id        bigint      default null,
  p_assignee_profile_id uuid        default null,
  p_unanswered          boolean     default false,
  p_from                date        default null,
  p_to                  date        default null,
  p_cursor              text        default null,
  p_limit               integer     default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_ts timestamptz;
  v_cur_id uuid;
  v_rows   jsonb;
  v_next   text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in
     ('open', 'acknowledged', 'in_progress', 'waiting_user', 'resolved', 'closed') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_urgency is not null and p_urgency not in ('low', 'standard', 'high', 'critical') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_category_code is not null and not exists (
       select 1 from public.support_categories c where c.code = p_category_code) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' - 'rn'
                            order by r.created_at desc, r.ticket_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      t.id as ticket_id,
      t.reference_code,
      t.subject,
      t.category_code,
      sc.name as category_name,
      t.status,
      t.urgency,
      t.reopened_count,
      req.display_name as requester_name,
      pr.name as promotion_name,
      agt.display_name as assignee_name,
      (select count(*) from public.support_messages m where m.ticket_id = t.id) as message_count,
      not exists (select 1 from public.support_messages m
                   where m.ticket_id = t.id
                     and m.author_kind = 'agent'
                     and m.is_internal_note = false) as unanswered,
      t.created_at,
      t.updated_at,
      t.created_at::text || '|' || t.id::text as cur,
      row_number() over (order by t.created_at desc, t.id desc) as rn
    from public.support_tickets t
    join public.support_categories sc on sc.code = t.category_code
    left join public.ise_profiles req on req.id = t.requester_profile_id
    left join public.promotions   pr  on pr.id  = req.promotion_id
    left join public.ise_profiles agt on agt.id = t.assigned_agent_profile_id
    where ((p_status is not null and t.status = p_status)
       or (p_status is null and t.status in ('open', 'acknowledged', 'in_progress', 'waiting_user')))
      and (p_category_code is null or t.category_code = p_category_code)
      and (p_urgency is null or t.urgency = p_urgency)
      and (p_promotion_id is null or req.promotion_id = p_promotion_id)
      and (p_assignee_profile_id is null or t.assigned_agent_profile_id = p_assignee_profile_id)
      and (coalesce(p_unanswered, false) = false
           or not exists (select 1 from public.support_messages m
                           where m.ticket_id = t.id
                             and m.author_kind = 'agent'
                             and m.is_internal_note = false))
      and (p_from is null or t.created_at >= p_from::timestamptz)
      and (p_to   is null or t.created_at < (p_to + 1)::timestamptz)
      and (v_cur_ts is null or (t.created_at, t.id) < (v_cur_ts, v_cur_id))
    order by t.created_at desc, t.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;
revoke all on function public.admin_list_support_tickets(text, text, text, bigint, uuid, boolean, date, date, text, integer)
  from public, anon;
grant execute on function public.admin_list_support_tickets(text, text, text, bigint, uuid, boolean, date, date, text, integer)
  to authenticated;
comment on function public.admin_list_support_tickets(text, text, text, bigint, uuid, boolean, date, date, text, integer) is
  'SA-038 — file des remontees, filtrable par statut, nature, priorite, promotion, administrateur en charge, '
  'absence de reponse et periode. Aucun delai cible affiche (D-85).';


-- Detail agent : ajout du contexte technique deja present en base mais
-- jamais affiche, et des pieces jointes de chaque message.
create or replace function public.admin_get_support_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'ticket_id',       t.id,
      'reference_code',  t.reference_code,
      'subject',         t.subject,
      'description',     t.description,
      'category_code',   t.category_code,
      'category_name',   sc.name,
      'status',          t.status,
      'urgency',         t.urgency,
      'urgency_source',  t.urgency_source,
      'urgency_set_by',  usr.display_name,
      'reopened_count',  t.reopened_count,
      'correlation_id',  t.correlation_id,
      'technical_context', t.technical_context,
      'requester_profile_id', t.requester_profile_id,
      'requester_name',  req.display_name,
      'promotion_name',  pr.name,
      'assignee_profile_id', t.assigned_agent_profile_id,
      'assignee_name',   agt.display_name,
      'created_at',      t.created_at,
      'resolved_at',     t.resolved_at,
      'closed_at',       t.closed_at
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'message_id',       m.id,
        'author_kind',      m.author_kind,
        'author_name',      ap.display_name,
        'body',             m.body,
        'is_internal_note', m.is_internal_note,
        'created_at',       m.created_at,
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'attachment_id', a.id,
                   'file_name',     a.file_name,
                   'mime_type',     a.mime_type,
                   'byte_size',     a.byte_size,
                   'storage_path',  a.storage_path)
                 order by a.created_at)
            from public.support_message_attachments a
           where a.message_id = m.id), '[]'::jsonb)
      ) order by m.created_at)
      from public.support_messages m
      left join public.ise_profiles ap on ap.id = m.author_profile_id
      where m.ticket_id = t.id
    ), '[]'::jsonb)
  )
    into v_out
  from public.support_tickets t
  join public.support_categories sc on sc.code = t.category_code
  left join public.ise_profiles req on req.id = t.requester_profile_id
  left join public.promotions   pr  on pr.id  = req.promotion_id
  left join public.ise_profiles agt on agt.id = t.assigned_agent_profile_id
  left join public.ise_profiles usr on usr.id = t.urgency_set_by_profile_id
  where t.id = p_ticket_id;

  if v_out is null then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;
revoke all on function public.admin_get_support_ticket(uuid) from public, anon;
grant execute on function public.admin_get_support_ticket(uuid) to authenticated;


-- Reponse agent : le statut `acknowledged` est accepte, et la fonction
-- renvoie desormais `message_id` (une reponse peut porter une piece
-- jointe, une capture annotee par exemple).
create or replace function public.admin_reply_support_ticket(
  p_ticket_id   uuid,
  p_body        text,
  p_is_internal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_t       public.support_tickets;
  v_body    text := btrim(coalesce(p_body, ''));
  v_message uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    perform private.log_audit(
      p_action      => 'support.agent_replied',
      p_object_type => 'support_ticket',
      p_object_id   => p_ticket_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if length(v_body) = 0 or length(v_body) > 5000 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_t from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  if v_t.status = 'closed' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  insert into public.support_messages
    (ticket_id, author_kind, author_profile_id, body, is_internal_note)
  values
    (p_ticket_id, 'agent', v_me, v_body, coalesce(p_is_internal, false))
  returning id into v_message;

  if not coalesce(p_is_internal, false)
     and exists (select 1 from public.notification_types nt
                 where nt.code = 'support_agent_replied' and nt.is_active) then
    insert into public.notifications
      (profile_id, notification_type_code, category, priority, title, body,
       entity_type, entity_id, action_type, action_path, deduplication_key)
    values
      (v_t.requester_profile_id, 'support_agent_replied', 'system', 'relevant',
       'L''équipe support vous a répondu.',
       'Demande ' || v_t.reference_code || ' — ' || v_t.subject,
       'support_ticket', v_t.id, 'open',
       '/aide/demandes/' || v_t.id::text,
       'support_agent_replied:' || v_t.id::text || ':' || extract(epoch from clock_timestamp())::bigint::text)
    on conflict do nothing;
  end if;

  perform private.log_audit(
    p_action      => 'support.agent_replied',
    p_object_type => 'support_ticket',
    p_object_id   => p_ticket_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('is_internal_note', coalesce(p_is_internal, false))
  );

  return jsonb_build_object(
    'replied', true,
    'message_id', v_message,
    'is_internal_note', coalesce(p_is_internal, false));
end
$$;
revoke all on function public.admin_reply_support_ticket(uuid, text, boolean) from public, anon;
grant execute on function public.admin_reply_support_ticket(uuid, text, boolean) to authenticated;


-- =====================================================================
-- PARTIE 9 — PIECES JOINTES : LE CHAINON MANQUANT
--
-- ETAT CONSTATE. Tout existait SAUF le moyen d'ecrire :
--   * table `support_message_attachments` (0016) avec ses CHECK MIME et
--     taille (10 Mo) ;
--   * bucket PRIVE `support-attachments` (0027), memes types MIME ;
--   * politiques Storage `ise_support_attachments_read/write` (0027)
--     indexees sur `support-attachments/<ticket_id>/...` ;
--   * politiques RLS `support_message_attachments_involved/create` (0049).
--   Aucune RPC, aucune interface. Resultat : 0 objet, 0 ligne, et un
--   texte a l'ecran disant « le televersement n'est pas en place ».
--
-- CE QUE CETTE FONCTION AJOUTE. Appelee APRES le televersement, jamais
-- avant : l'objet doit deja exister dans le bucket, elle le verifie.
-- Elle reverifie proprietaire, appartenance du message au ticket,
-- coherence du chemin avec le ticket, type MIME, taille, et la limite de
-- 3 fichiers par message (D-84), que rien n'imposait jusqu'ici.
--
-- ANALYSE ANTIVIRALE : AUCUNE, et rien ici ne pretend le contraire.
-- Aucun antivirus n'est disponible dans ce deploiement. Ce qui protege :
-- bucket PRIVE, liste MIME contrainte au bucket ET a la RPC, taille
-- bornee, acces limite a l'auteur du ticket et aux porteurs de
-- `support.manage`, telechargement par URL signee de courte duree. Ce qui
-- n'est PAS fait : l'analyse du contenu. Une capture d'ecran PNG est peu
-- risquee ; un PDF ou un DOCX peut porter une charge active. C'est un
-- manque explicite, a couvrir par un service externe (meme convention
-- que 0127).
-- =====================================================================

create or replace function public.attach_support_file(
  p_message_id   uuid,
  p_storage_path text,
  p_file_name    text,
  p_mime_type    text,
  p_byte_size    bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_bucket    constant text    := 'support-attachments';
  c_max_bytes constant bigint  := 10485760;
  c_max_files constant integer := 3;
  c_mimes     constant text[]  := array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp'];

  v_me       uuid := private.current_profile_id();
  v_is_agent boolean;
  v_ticket   uuid;
  v_author   uuid;
  v_path     text := btrim(coalesce(p_storage_path, ''));
  v_name     text := btrim(coalesce(p_file_name, ''));
  v_mime     text := lower(btrim(coalesce(p_mime_type, '')));
  v_object   text;
  v_count    integer;
  v_id       uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select m.ticket_id, m.author_profile_id
    into v_ticket, v_author
    from public.support_messages m
   where m.id = p_message_id;

  if v_ticket is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_is_agent := private.has_permission('support.manage');

  -- On ne joint un fichier qu'a SON PROPRE message. Un agent ne complete
  -- pas le message d'un membre, et reciproquement.
  if v_author is distinct from v_me then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not v_is_agent and not exists (
       select 1 from public.support_tickets t
        where t.id = v_ticket and t.requester_profile_id = v_me) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_name = '' or char_length(v_name) > 255 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not (v_mime = any (c_mimes)) then
    raise exception 'attachment_type_not_allowed' using errcode = 'P0001';
  end if;
  if p_byte_size is null or p_byte_size <= 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_byte_size > c_max_bytes then
    raise exception 'attachment_too_large' using errcode = 'P0001';
  end if;

  -- Le chemin doit designer le prefixe du TICKET : c'est ce prefixe que
  -- les politiques Storage de 0027 controlent. Un chemin d'un autre
  -- ticket serait une piece jointe orpheline et lisible du mauvais cote.
  if v_path not like c_bucket || '/' || v_ticket::text || '/%' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- `storage.objects.name` ne porte pas le prefixe du bucket (meme piege
  -- qu'en 0127).
  v_object := substr(v_path, char_length(c_bucket) + 2);

  if not exists (
    select 1 from storage.objects o
     where o.bucket_id = c_bucket and o.name = v_object) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_count
    from public.support_message_attachments a
   where a.message_id = p_message_id;

  if v_count >= c_max_files then
    raise exception 'attachment_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.support_message_attachments
    (message_id, storage_path, file_name, mime_type, byte_size)
  values
    (p_message_id, v_path, left(v_name, 255), v_mime, p_byte_size)
  returning id into v_id;

  perform private.log_audit(
    p_action      => 'support.attachment_added',
    p_object_type => 'support_ticket',
    p_object_id   => v_ticket::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
                       'attachment_id', v_id,
                       'message_id',    p_message_id,
                       'mime_type',     v_mime,
                       'byte_size',     p_byte_size,
                       'by_agent',      v_is_agent));

  return jsonb_build_object(
    'attachment_id', v_id,
    'ticket_id',     v_ticket,
    'storage_path',  v_path);
end
$$;
revoke all on function public.attach_support_file(uuid, text, text, text, bigint) from public, anon;
grant execute on function public.attach_support_file(uuid, text, text, text, bigint) to authenticated;
comment on function public.attach_support_file(uuid, text, text, text, bigint) is
  'ISE-100 — enregistre une piece jointe DEJA televersee sous support-attachments/<ticket_id>/. '
  'Verifie l''auteur du message, le prefixe du ticket, l''existence reelle de l''objet, le type MIME, '
  'la taille (10 Mo) et la limite de 3 fichiers par message (D-84). Aucune analyse antivirale (non disponible). Auditee.';
