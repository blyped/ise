-- =====================================================================
-- 0016_support_moderation
-- Aide & support (ISE-100), signalements et moderation.
--
-- Sources : DIGEST A partie W ; DIGEST E2 partie D (D.1 a D.12) ;
--           MASTER PROMPT §38, §40, §53, §98 ; docs/decisions.md D-13, D-66, D-85.
--
-- REGLES STRUCTURANTES
--   * D-85 : AUCUN SLA n'est affiche ni stocke. Pas de colonne `due_at`,
--     pas de `sla_hours`, pas de `first_response_target_at`. Les seuls
--     elements de priorisation sont les 3 niveaux d'urgence documentes
--     (standard / important / security), que le demandeur ne choisit pas
--     librement : le systeme ou l'agent support classifie.
--   * D-66 : un referentiel unique de motifs de signalement,
--     `public.report_reasons` (cree en 0002), filtre a l'affichage par
--     `applies_to`. Aucune seconde table de motifs.
--   * D-13 : text + CHECK, jamais de type ENUM PostgreSQL.
--   * Aucune RLS ni policy ici : migration dediee ulterieure.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Referentiel des categories du centre d'aide
--    Union arbitree des deux listes divergentes [14 §73] (12 entrees) et
--    [34 §120] (11 entrees) : aucune capacite decrite n'est perdue.
--    Taxonomie evolutive => table de reference (conventions §4), pas un CHECK.
-- ---------------------------------------------------------------------
create table if not exists public.support_categories (
  code                   text primary key,
  name                   text not null,
  description            text,
  -- D.6 : support = probleme du membre ; moderation = risque ou violation.
  -- Les deux files restent distinctes ; ce drapeau indique qu'une demande
  -- deposee dans cette categorie doit etre orientee vers la file moderation.
  routes_to_moderation   boolean not null default false,
  sort_order             integer not null default 0,
  is_active              boolean not null default true
);

comment on table public.support_categories is
  'Categories du centre d''aide et des tickets. Union arbitree des listes [14 §73] et [34 §120].';

insert into public.support_categories (code, name, routes_to_moderation, sort_order) values
  ('account',        'Mon compte',            false,  10),
  ('profile',        'Mon profil',            false,  20),
  ('verification',   'Verification ISE',      false,  30),
  ('privacy',        'Confidentialite',       false,  40),
  ('security',       'Securite',              false,  50),
  ('search',         'Recherche',             false,  60),
  ('network_calls',  'Appels au reseau',      false,  70),
  ('opportunities',  'Opportunites',          false,  80),
  ('internships',    'Stages',                false,  90),
  ('mentorship',     'Mentorat',              false, 100),
  ('projects',       'Projets',               false, 110),
  ('communities',    'Communautes',           false, 120),
  ('promotions',     'Promotions',            false, 130),
  ('messages',       'Messages',              false, 140),
  ('report_problem', 'Signaler un probleme',  true,  150),
  ('other',          'Autre',                 false, 160)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 2. Seed du referentiel unique des motifs de signalement (D-66)
--    La table a ete creee en 0002 et laissee vide : on l'alimente ici,
--    sans jamais l'alterer (aucun ALTER TABLE sur une table existante).
--    9 motifs = union dedupliquee des 4 listes concurrentes
--    ([14 §81], [34 §131], [14 §21], [5 §65]).
-- ---------------------------------------------------------------------
insert into public.report_reasons (code, name, description, applies_to, sort_order) values
  ('fake_profile',          'Faux profil',
   'Le profil ne correspond a aucune personne reelle.',
   array['profile'], 10),
  ('impersonation',         'Usurpation d''identite',
   'Le compte se fait passer pour quelqu''un d''autre.',
   array['profile'], 20),
  ('harassment',            'Harcelement',
   'Propos ou comportement repetes et hostiles.',
   array['profile','conversation','message','comment'], 30),
  ('spam',                  'Spam',
   'Contenu non sollicite, repetitif ou automatise.',
   array['profile','conversation','message','network_call','opportunity','project','news_post','event','community','comment'], 40),
  ('abusive_solicitation',  'Prospection abusive',
   'Sollicitation commerciale insistante ou hors sujet.',
   array['profile','conversation','message','opportunity'], 50),
  ('false_information',     'Informations fausses ou trompeuses',
   'Contenu inexact susceptible d''induire en erreur.',
   array['profile','opportunity','project','news_post','event','comment'], 60),
  ('inappropriate_content', 'Contenu inapproprie',
   'Contenu choquant, illicite ou contraire aux regles du reseau.',
   array['profile','conversation','message','network_call','opportunity','project','news_post','event','community','comment'], 70),
  ('fraud',                 'Fraude',
   'Tentative d''escroquerie ou de detournement.',
   array['profile','conversation','message','opportunity','project'], 80),
  ('other',                 'Autre',
   'Motif non couvert par les categories precedentes.',
   array['profile','conversation','message','network_call','opportunity','project','news_post','event','community','comment'], 90)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 3. Tickets de support
-- ---------------------------------------------------------------------
create table if not exists public.support_tickets (
  id                      uuid primary key default extensions.gen_random_uuid(),

  -- Reference lisible affichee au membre : « Votre demande #ISE-2457 ».
  ticket_number           bigint generated always as identity (start with 1000),
  reference_code          text generated always as ('ISE-' || ticket_number::text) stored,

  requester_profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  category_code           text not null references public.support_categories(code),

  subject                 text not null check (length(btrim(subject)) between 3 and 200),
  description             text not null check (length(btrim(description)) >= 10),

  -- Trois niveaux d'urgence documentes [34 §140]. AUCUN SLA associe (D-85).
  -- Le demandeur ne choisit pas librement : `urgency_source` trace qui a classe.
  urgency                 text not null default 'standard'
                            check (urgency in ('standard', 'important', 'security')),
  urgency_source          text not null default 'system'
                            check (urgency_source in ('system', 'agent')),
  urgency_set_by_profile_id uuid references public.ise_profiles(id) on delete set null,

  status                  text not null default 'open'
                            check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),

  assigned_agent_profile_id uuid references public.ise_profiles(id) on delete set null,

  -- Contexte technique ajoute automatiquement [34 §124] : version applicative,
  -- navigateur, page concernee. JAMAIS de donnee sensible inutile [34 §125],
  -- jamais de secret, jamais de contenu de message prive.
  technical_context       jsonb not null default '{}'::jsonb,

  -- Tracabilite d'erreur cote client (D-102).
  correlation_id          text,

  -- KPI reels calculables (D.10) : nombre de reouvertures, delai de resolution.
  -- Ce sont des mesures constatees, pas des engagements affiches (D-85, §98).
  reopened_count          integer not null default 0 check (reopened_count >= 0),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  resolved_at             timestamptz,
  closed_at               timestamptz,

  constraint support_tickets_resolved_coherence check (
    (status in ('resolved', 'closed')) = (resolved_at is not null)
  ),
  constraint support_tickets_closed_coherence check (
    (status = 'closed') = (closed_at is not null)
  ),
  constraint support_tickets_urgency_attribution check (
    urgency_source = 'system' or urgency_set_by_profile_id is not null
  )
);

create index if not exists support_tickets_requester_idx
  on public.support_tickets(requester_profile_id);
create index if not exists support_tickets_assignee_idx
  on public.support_tickets(assigned_agent_profile_id)
  where assigned_agent_profile_id is not null;
create index if not exists support_tickets_category_idx
  on public.support_tickets(category_code);
create index if not exists support_tickets_open_idx
  on public.support_tickets(status, urgency)
  where status in ('open', 'in_progress', 'waiting_user');
-- Pagination par curseur (D-44).
create index if not exists support_tickets_created_cursor_idx
  on public.support_tickets(created_at desc, id desc);
create unique index if not exists support_tickets_reference_uidx
  on public.support_tickets(reference_code);

select private.attach_updated_at('public', 'support_tickets');

comment on table public.support_tickets is
  'Demande d''assistance d''un membre. Aucun SLA stocke ni affiche (D-85).';
comment on column public.support_tickets.urgency is
  'Trois niveaux documentes : standard / important / security. Non choisi librement par le demandeur [34 §141].';
comment on column public.support_tickets.technical_context is
  'Contexte technique minimal collecte automatiquement. Aucun secret, aucune coordonnee, aucun contenu prive.';


-- ---------------------------------------------------------------------
-- 4. Fil de conversation d'un ticket
-- ---------------------------------------------------------------------
create table if not exists public.support_messages (
  id                  uuid primary key default extensions.gen_random_uuid(),
  ticket_id           uuid not null references public.support_tickets(id) on delete cascade,

  author_kind         text not null check (author_kind in ('member', 'agent', 'system')),
  author_profile_id   uuid references public.ise_profiles(id) on delete set null,

  body                text not null check (length(btrim(body)) >= 1),

  -- Note interne : visible des agents support uniquement (filtrage RLS ulterieur).
  is_internal_note    boolean not null default false,

  created_at          timestamptz not null default now(),

  constraint support_messages_author_required check (
    author_kind = 'system' or author_profile_id is not null
  ),
  constraint support_messages_internal_note_by_agent check (
    is_internal_note = false or author_kind = 'agent'
  )
);

create index if not exists support_messages_ticket_idx
  on public.support_messages(ticket_id, created_at);
create index if not exists support_messages_author_idx
  on public.support_messages(author_profile_id)
  where author_profile_id is not null;

comment on table public.support_messages is
  'Echanges d''un ticket support. `is_internal_note` isole les notes non visibles du membre.';


-- Pieces jointes d'un message support. Limites D-84 (provisoire) :
-- 10 Mo par fichier, 3 fichiers par message (quantite verifiee cote applicatif),
-- types autorises pdf/docx/xlsx/pptx/png/jpg/webp.
create table if not exists public.support_message_attachments (
  id                uuid primary key default extensions.gen_random_uuid(),
  message_id        uuid not null references public.support_messages(id) on delete cascade,
  storage_path      text not null,
  file_name         text not null,
  mime_type         text not null check (mime_type in (
                      'application/pdf',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                      'image/png', 'image/jpeg', 'image/webp')),
  byte_size         bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at        timestamptz not null default now(),
  constraint support_message_attachments_path_uniq unique (storage_path)
);

create index if not exists support_message_attachments_message_idx
  on public.support_message_attachments(message_id);


-- ---------------------------------------------------------------------
-- 5. Signalements
--    Workflow impose : open -> reviewing -> resolved | dismissed.
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id                      uuid primary key default extensions.gen_random_uuid(),

  reporter_profile_id     uuid not null references public.ise_profiles(id) on delete cascade,

  -- Contexte automatique conserve [34 §136]. Reference polymorphe volontaire :
  -- les modules cibles (appels, opportunites, projets, messages, evenements)
  -- arrivent dans des migrations ulterieures ; aucune FK possible ici.
  target_type             text not null check (target_type in (
                            'profile', 'conversation', 'message', 'network_call',
                            'opportunity', 'project', 'news_post', 'event',
                            'community', 'comment')),
  target_id               uuid not null,
  -- Renseigne par la moderation lorsque le proprietaire du contenu est identifie.
  target_owner_profile_id uuid references public.ise_profiles(id) on delete set null,

  -- D-66 : referentiel unique. Le filtrage motif/type d'objet s'appuie sur
  -- report_reasons.applies_to et se verifie cote applicatif (la table de
  -- reference n'est pas alteree ici).
  reason_code             text not null references public.report_reasons(code),
  description             text,

  -- Colonne « Gravite » de SA-040. Meme vocabulaire a trois niveaux que
  -- support_tickets.urgency, sans aucun SLA associe (D-85).
  severity                text not null default 'standard'
                            check (severity in ('standard', 'important', 'security')),

  status                  text not null default 'open'
                            check (status in ('open', 'reviewing', 'resolved', 'dismissed')),

  reviewer_profile_id     uuid references public.ise_profiles(id) on delete set null,
  -- Code machine de l'issue retenue (D-102 : la traduction se fait cote app).
  resolution_code         text check (resolution_code is null or resolution_code in (
                            'no_violation', 'content_removed', 'content_hidden',
                            'member_warned', 'member_suspended', 'escalated', 'duplicate')),
  resolution_note         text,

  -- CA-SUP-02 : la confidentialite du signalant est la regle par defaut.
  is_reporter_hidden      boolean not null default true,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  reviewing_at            timestamptz,
  closed_at               timestamptz,

  constraint reports_closed_coherence check (
    (status in ('resolved', 'dismissed')) = (closed_at is not null)
  ),
  constraint reports_resolution_required check (
    status <> 'resolved' or resolution_code is not null
  ),
  constraint reports_no_self_report check (
    target_type <> 'profile' or target_id <> reporter_profile_id
  )
);

-- Un signalant ne depose pas deux fois le meme signalement encore ouvert.
create unique index if not exists reports_open_by_reporter_uidx
  on public.reports(reporter_profile_id, target_type, target_id)
  where status in ('open', 'reviewing');

create index if not exists reports_target_idx    on public.reports(target_type, target_id);
create index if not exists reports_status_idx    on public.reports(status, severity)
  where status in ('open', 'reviewing');
create index if not exists reports_reviewer_idx  on public.reports(reviewer_profile_id)
  where reviewer_profile_id is not null;
create index if not exists reports_reason_idx    on public.reports(reason_code);
create index if not exists reports_created_cursor_idx
  on public.reports(created_at desc, id desc);

select private.attach_updated_at('public', 'reports');

comment on table public.reports is
  'Signalement d''un profil ou d''un contenu. File distincte des tickets support [34 §137-139].';
comment on column public.reports.is_reporter_hidden is
  'Le membre signale ne voit pas qui l''a signale (CA-SUP-02, [14 §83]).';


-- Preuves attachees a un signalement : capture, document ou commentaire.
create table if not exists public.report_evidence (
  id            uuid primary key default extensions.gen_random_uuid(),
  report_id     uuid not null references public.reports(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in ('screenshot', 'document', 'comment')),
  storage_path  text,
  note          text,
  created_at    timestamptz not null default now(),
  constraint report_evidence_payload_required check (
    (evidence_kind = 'comment' and note is not null)
    or (evidence_kind <> 'comment' and storage_path is not null)
  )
);

create index if not exists report_evidence_report_idx on public.report_evidence(report_id);


-- Journal des transitions d'un signalement (meme motif que introduction_events).
create table if not exists public.report_events (
  id                uuid primary key default extensions.gen_random_uuid(),
  report_id         uuid not null references public.reports(id) on delete cascade,
  actor_profile_id  uuid references public.ise_profiles(id) on delete set null,
  from_status       text,
  to_status         text not null,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists report_events_report_idx on public.report_events(report_id, created_at);


-- ---------------------------------------------------------------------
-- 6. Actions de moderation
--    Liste [14 §87] : classer sans suite, avertir, masquer contenu,
--    suspendre temporairement, suspendre compte, escalader (+ restauration).
--    [14 §88] : toute action administrative sensible exige un motif.
-- ---------------------------------------------------------------------
create table if not exists public.moderation_actions (
  id                      uuid primary key default extensions.gen_random_uuid(),

  -- Une action peut naitre d'un signalement ou d'une detection interne.
  report_id               uuid references public.reports(id) on delete set null,
  moderator_profile_id    uuid references public.ise_profiles(id) on delete set null,

  action_type             text not null check (action_type in (
                            'dismiss', 'warn', 'hide_content', 'restore_content',
                            'temporary_suspension', 'account_suspension',
                            'lift_suspension', 'escalate')),

  target_type             text not null check (target_type in (
                            'profile', 'conversation', 'message', 'network_call',
                            'opportunity', 'project', 'news_post', 'event',
                            'community', 'comment')),
  target_id               uuid not null,
  target_profile_id       uuid references public.ise_profiles(id) on delete set null,

  -- Motif obligatoire et substantiel.
  reason                  text not null check (length(btrim(reason)) >= 10),

  suspension_until        timestamptz,
  correlation_id          text,
  created_at              timestamptz not null default now(),

  constraint moderation_actions_temp_suspension_needs_end check (
    action_type <> 'temporary_suspension' or suspension_until is not null
  ),
  constraint moderation_actions_end_only_for_temp check (
    suspension_until is null or action_type = 'temporary_suspension'
  )
);

create index if not exists moderation_actions_report_idx     on public.moderation_actions(report_id)
  where report_id is not null;
create index if not exists moderation_actions_target_idx     on public.moderation_actions(target_type, target_id);
create index if not exists moderation_actions_profile_idx    on public.moderation_actions(target_profile_id)
  where target_profile_id is not null;
create index if not exists moderation_actions_moderator_idx  on public.moderation_actions(moderator_profile_id)
  where moderator_profile_id is not null;
create index if not exists moderation_actions_created_cursor_idx
  on public.moderation_actions(created_at desc, id desc);

comment on table public.moderation_actions is
  'Action de moderation constatee. Motif obligatoire [14 §88] ; chaque action est aussi journalisee dans private.audit_log (0018).';


-- ---------------------------------------------------------------------
-- 7. Fonctions metier de transition
--    Conventions §7 : acteur -> permission -> etat courant -> transition
--    autorisee, dans une transaction, avec journalisation.
--    Codes d'erreur : 28000 / 42501 / P0002 / P0001 (D-102).
-- ---------------------------------------------------------------------

create or replace function public.transition_report(
  p_report_id       uuid,
  p_to_status       text,
  p_resolution_code text default null,
  p_note            text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_report  public.reports;
  v_from    text;
  v_allowed boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not private.has_permission('profiles.moderate') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;

  -- Machine d'etats imposee : open -> reviewing -> resolved | dismissed.
  v_allowed := case
    when p_to_status = 'reviewing' then v_report.status = 'open'
    when p_to_status = 'resolved'  then v_report.status = 'reviewing'
    when p_to_status = 'dismissed' then v_report.status in ('open', 'reviewing')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if p_to_status = 'resolved' and p_resolution_code is null then
    raise exception 'resolution_required' using errcode = 'P0001';
  end if;

  v_from := v_report.status;

  update public.reports
     set status            = p_to_status,
         reviewer_profile_id = coalesce(reviewer_profile_id, v_me),
         reviewing_at      = case when p_to_status = 'reviewing' then now() else reviewing_at end,
         closed_at         = case when p_to_status in ('resolved', 'dismissed') then now() else closed_at end,
         resolution_code   = case when p_to_status = 'resolved'  then p_resolution_code
                                  when p_to_status = 'dismissed' then coalesce(p_resolution_code, 'no_violation')
                                  else resolution_code end,
         resolution_note   = coalesce(p_note, resolution_note)
   where id = p_report_id
  returning * into v_report;

  insert into public.report_events (report_id, actor_profile_id, from_status, to_status, note)
  values (p_report_id, v_me, v_from, p_to_status, p_note);

  return v_report;
end
$$;

revoke all on function public.transition_report(uuid, text, text, text) from public;
grant execute on function public.transition_report(uuid, text, text, text) to authenticated;

comment on function public.transition_report(uuid, text, text, text) is
  'Transition atomique d''un signalement : open -> reviewing -> resolved | dismissed. Exige profiles.moderate.';


create or replace function public.transition_support_ticket(
  p_ticket_id uuid,
  p_to_status text
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_ticket  public.support_tickets;
  v_is_agent boolean;
  v_allowed boolean := false;
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

  -- open -> in_progress -> [waiting_user] -> resolved -> closed.
  -- Le membre peut uniquement rouvrir un ticket resolu et cloturer le sien.
  v_allowed := case
    when p_to_status = 'in_progress'  then v_is_agent and v_ticket.status in ('open', 'waiting_user', 'resolved')
    when p_to_status = 'waiting_user' then v_is_agent and v_ticket.status = 'in_progress'
    when p_to_status = 'resolved'     then v_is_agent and v_ticket.status in ('in_progress', 'waiting_user')
    when p_to_status = 'closed'       then v_ticket.status = 'resolved'
    when p_to_status = 'open'         then v_ticket.status = 'resolved' and v_me = v_ticket.requester_profile_id
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.support_tickets
     set status         = p_to_status,
         resolved_at    = case
                            when p_to_status in ('resolved', 'closed') then coalesce(resolved_at, now())
                            else null
                          end,
         closed_at      = case when p_to_status = 'closed' then now() else null end,
         reopened_count = case when p_to_status = 'open' then reopened_count + 1 else reopened_count end
   where id = p_ticket_id
  returning * into v_ticket;

  return v_ticket;
end
$$;

revoke all on function public.transition_support_ticket(uuid, text) from public;
grant execute on function public.transition_support_ticket(uuid, text) to authenticated;

comment on function public.transition_support_ticket(uuid, text) is
  'Transition atomique d''un ticket support. Aucun delai cible n''est evalue ni stocke (D-85).';
