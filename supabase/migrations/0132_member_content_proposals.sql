-- =====================================================================
-- 0132 — PROPOSITION DE CONTENU PAR LES ISE, VALIDÉE PAR L'ADMINISTRATION
-- =====================================================================
--
-- DEMANDE DU PORTEUR : « Tout ajout de ce genre par un ISE doit être envoyé
-- à l'admin pour validation avant que ça ne soit visible. Peut-être qu'on
-- leur donnera la possibilité d'ajouter les images en même temps pour que je
-- n'aie pas à faire toutes les images à la validation. »
--
-- LE MODÈLE EST DÉJÀ DANS LA MAISON. Un membre publie déjà une opportunité
-- (`/opportunites/publier`) et l'administration tranche
-- (`moderate_opportunity`, 0077). On reproduit ce cycle, on n'en invente pas
-- un second :
--     proposer -> file d'attente -> accepter (publie) | refuser (motif).
--
-- AUCUN ÉTAT NOUVEAU N'EST AJOUTÉ. Les deux tables portaient déjà l'état
-- qu'il fallait, inutilisé faute de voie d'entrée :
--     · `news.editorial_status` = 'submitted'   (déjà dans le CHECK d'origine) ;
--     · `events.status`         = 'pending_review' et 'rejected' (idem).
-- L'état de PROPOSITION est donc bien distinct de l'état PUBLIÉ, sans
-- élargir un domaine de valeurs que le reste du code interroge déjà.
--
-- D-128 EST RESPECTÉE À LA LETTRE. Accepter une proposition PUBLIE — cela
-- n'écrit jamais `landing_visibility`, `landing_priority` ni `is_featured`.
-- La programmation de la vitrine reste au CMS ; la proposition d'un membre
-- relève du circuit éditorial, et les deux ne se touchent pas.
--
-- L'IMAGE : POURQUOI UN BUCKET PRIVÉ DE PLUS.
--   `landing-media` est PUBLIC (D-134, 0068) : tout objet qu'on y dépose est
--   lisible par le web ouvert, immédiatement, sans session. Y laisser
--   atterrir le visuel d'une proposition NON VALIDÉE reviendrait à publier
--   l'image avant la décision — exactement ce que le porteur demande
--   d'empêcher. Le visuel proposé atterrit donc dans un bucket PRIVÉ dédié,
--   `content-proposals`, sous `<profile_id>/…`, lisible par son auteur et
--   par les seuls détenteurs de `content.publish` / `events.manage`.
--   À l'acceptation, et alors seulement, l'administration recopie l'objet
--   dans `landing-media` et l'enregistre dans `cms_media_assets` : le visuel
--   du membre devient un média réutilisable tel quel, sans refaire l'image.
--   C'est le point précis de la demande du porteur.
--
-- Validation et refus sont tracés par `private.log_audit`, comme toute
-- décision administrative, et notifiés à l'auteur par
-- `private.emit_in_app_notification`.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Colonnes de proposition
-- ---------------------------------------------------------------------
-- `news.submitted_by_profile_id` / `reviewed_*` / `rejection_reason`
-- existent depuis 0013. Ne manquaient que le visuel proposé et, côté
-- événements, la trace de la revue.

alter table public.news
  add column if not exists proposed_cover_path text,
  add column if not exists proposed_cover_alt  text;

alter table public.events
  add column if not exists proposed_cover_path    text,
  add column if not exists proposed_cover_alt     text,
  add column if not exists reviewed_by_profile_id uuid references public.ise_profiles (id) on delete set null,
  add column if not exists reviewed_at            timestamptz,
  add column if not exists rejection_reason       text;

comment on column public.news.proposed_cover_path is
  'Chemin dans le bucket PRIVE `content-proposals` du visuel joint par le membre. Remis a NULL par la decision : le media valide vit desormais dans `cover_media_id`.';
comment on column public.events.proposed_cover_path is
  'Idem `news.proposed_cover_path`.';

-- Le chemin enregistre doit etre celui de l'AUTEUR. La politique Storage le
-- dit deja pour le depot ; la contrainte l'impose pour la ligne.
alter table public.news drop constraint if exists news_proposed_cover_scope;
alter table public.news add constraint news_proposed_cover_scope check (
  proposed_cover_path is null
  or (submitted_by_profile_id is not null
      and proposed_cover_path like (submitted_by_profile_id::text || '/%')
      and length(btrim(coalesce(proposed_cover_alt, ''))) >= 3)
);

alter table public.events drop constraint if exists events_proposed_cover_scope;
alter table public.events add constraint events_proposed_cover_scope check (
  proposed_cover_path is null
  or (created_by_profile_id is not null
      and proposed_cover_path like (created_by_profile_id::text || '/%')
      and length(btrim(coalesce(proposed_cover_alt, ''))) >= 3)
);

-- Un evenement PROPOSE n'a pas encore de lieu ni de lien : on relache ces
-- deux coherences pour les seuls etats non publies, et on les re-impose au
-- moment d'accepter (cf. `moderate_content_proposal`).
alter table public.events drop constraint if exists events_in_person_needs_place;
alter table public.events add constraint events_in_person_needs_place check (
  format = 'online' or city is not null or venue_name is not null
  or status in ('draft', 'pending_review', 'rejected')
);

alter table public.events drop constraint if exists events_online_needs_url;
alter table public.events add constraint events_online_needs_url check (
  format = 'in_person' or online_url_private is not null
  or status in ('draft', 'pending_review', 'rejected')
);

create index if not exists idx_news_proposals_pending
  on public.news (created_at desc)
  where submitted_by_profile_id is not null and editorial_status = 'submitted';

create index if not exists idx_events_proposals_pending
  on public.events (created_at desc)
  where created_by_profile_id is not null and status = 'pending_review';

-- ---------------------------------------------------------------------
-- 2. Bucket PRIVE `content-proposals`
-- ---------------------------------------------------------------------
-- Bornes identiques a `landing-media` (5 Mo, memes types) : le fichier doit
-- pouvoir y etre recopie tel quel a l'acceptation, sans transcodage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-proposals', 'content-proposals', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ise_content_proposals_insert on storage.objects;
create policy ise_content_proposals_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-proposals'
    and private.is_active_member()
    and private.storage_segment(name, 1) = private.current_profile_id()::text
    and private.storage_segment(name, 2) is not null
  );

drop policy if exists ise_content_proposals_read on storage.objects;
create policy ise_content_proposals_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'content-proposals'
    and (private.storage_segment(name, 1) = private.current_profile_id()::text
         or private.has_permission('content.publish')
         or private.has_permission('events.manage'))
  );

drop policy if exists ise_content_proposals_delete on storage.objects;
create policy ise_content_proposals_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-proposals'
    and (private.storage_segment(name, 1) = private.current_profile_id()::text
         or private.has_permission('content.publish')
         or private.has_permission('events.manage'))
  );

-- Depot dans `landing-media` par le circuit EDITORIAL. `ise_landing_media_insert`
-- (0068) exige `cms.media.manage` : un administrateur editorial ne l'a pas
-- forcement, et il doit pourtant pouvoir promouvoir le visuel qu'il vient
-- d'accepter. Le prefixe reste contraint par `is_landing_media_path`.
drop policy if exists ise_landing_media_insert_editorial on storage.objects;
create policy ise_landing_media_insert_editorial on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'landing-media'
    and (private.has_permission('content.publish') or private.has_permission('events.manage'))
    and private.is_landing_media_path(name)
  );

-- ---------------------------------------------------------------------
-- 3. Visibilite : une proposition n'est visible que de son auteur
-- ---------------------------------------------------------------------
-- `can_see_news` n'ouvrait que 'published'. Un membre ne pouvait donc pas
-- relire sa propre proposition. On ouvre a l'AUTEUR, et a lui seul — le
-- reste du reseau ne voit toujours rien avant la decision.

create or replace function private.can_see_news(p_news uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_news is not null and private.current_profile_id() is not null
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

create or replace function private.can_see_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_event is not null and private.current_profile_id() is not null
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
                  or not private.is_blocked_between(e.organizer_profile_id, private.current_profile_id()))
             and (case e.visibility
                    when 'members'   then true
                    when 'promotion' then private.is_in_promotion(e.organizer_promotion_id)
                    when 'community' then private.is_community_member(e.organizer_community_id)
                    when 'selected_members' then
                      private.is_event_registered(e.id)
                      or exists (select 1 from public.event_speakers s
                                 where s.event_id = e.id and s.profile_id = private.current_profile_id())
                    when 'invitation_only' then
                      private.is_event_registered(e.id)
                      or exists (select 1 from public.event_speakers s
                                 where s.event_id = e.id and s.profile_id = private.current_profile_id())
                    else false
                  end)
           )
         )
     )
$$;

-- ---------------------------------------------------------------------
-- 4. Aides internes
-- ---------------------------------------------------------------------

create or replace function private.assert_proposed_cover(p_path text, p_alt text, p_owner uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_path is null then
    return;
  end if;
  -- Le chemin doit etre le SIEN : la politique Storage le dit deja, on ne
  -- laisse pas pour autant enregistrer le chemin d'un autre en base.
  if p_owner is null or p_path not like (p_owner::text || '/%') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_alt, ''))) < 3 then
    raise exception 'media_alt_required' using errcode = 'P0001';
  end if;
  if not exists (
       select 1 from storage.objects o
        where o.bucket_id = 'content-proposals' and o.name = p_path
     ) then
    raise exception 'media_not_found' using errcode = 'P0002';
  end if;
end
$$;

-- Le membre ne saisit pas de slug : il ecrit un titre. Le slug en decoule,
-- et la collision se resout ici plutot que par une erreur de contrainte
-- unique illisible.
create or replace function private.unique_content_slug(p_kind text, p_title text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := nullif(btrim(public.slugify(coalesce(p_title, ''))), '');
  v_slug text;
  v_try  integer := 0;
begin
  v_base := coalesce(v_base, 'proposition');
  v_base := left(v_base, 120);
  loop
    v_slug := case when v_try = 0 then v_base
                   else v_base || '-' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6) end;
    exit when (p_kind = 'news'  and not exists (select 1 from public.news   n where n.slug = v_slug))
           or (p_kind = 'event' and not exists (select 1 from public.events e where e.slug = v_slug));
    v_try := v_try + 1;
    if v_try > 12 then
      raise exception 'slug_already_exists' using errcode = 'P0001';
    end if;
  end loop;
  return v_slug;
end
$$;

-- ---------------------------------------------------------------------
-- 5. Voie MEMBRE : proposer
-- ---------------------------------------------------------------------

create or replace function public.propose_news(
  p_category_code text,
  p_title         text,
  p_summary       text,
  p_body          text default null,
  p_event_date    date default null,
  p_source_url    text default null,
  p_cover_path    text default null,
  p_cover_alt     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_title   text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_url     text := nullif(btrim(coalesce(p_source_url, '')), '');
  v_path    text := nullif(btrim(coalesce(p_cover_path, '')), '');
  v_alt     text := nullif(btrim(coalesce(p_cover_alt, '')), '');
  v_slug    text;
  v_id      uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(v_title) < 3 or length(v_title) > 240
     or v_summary = '' or length(v_summary) > 400 then
    raise exception 'news_missing_required_field' using errcode = 'P0001';
  end if;
  if p_category_code is null or not exists (
       select 1 from public.news_categories c where c.code = p_category_code and c.is_active
     ) then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;

  perform private.assert_proposed_cover(v_path, v_alt, v_me);

  v_slug := private.unique_content_slug('news', v_title);

  -- 'submitted' : l'etat de PROPOSITION est distinct de l'etat publie. Rien
  -- n'est visible tant que l'administration n'a pas tranche — `can_see_news`
  -- (0046) n'ouvre 'submitted' qu'a l'auteur et a `content.publish`.
  insert into public.news (
    category_code, title, slug, summary, body, event_date,
    source_type, source_url, visibility, editorial_level,
    editorial_status, submitted_by_profile_id,
    proposed_cover_path, proposed_cover_alt
  )
  values (
    p_category_code, v_title, v_slug, v_summary,
    nullif(btrim(coalesce(p_body, '')), ''), p_event_date,
    case when v_url is null then 'internal' else 'other' end, v_url,
    'members', 3, 'submitted', v_me, v_path, v_alt
  )
  returning id into v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('news.proposed', 'news', v_id, v_me,
          jsonb_build_object('title', v_title, 'has_cover', v_path is not null));

  perform private.log_audit(
    p_action      => 'member.news_proposed',
    p_object_type => 'news',
    p_object_id   => v_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('category', p_category_code, 'has_cover', v_path is not null));

  return jsonb_build_object('news_id', v_id, 'slug', v_slug, 'editorial_status', 'submitted');
end
$$;

create or replace function public.propose_event(
  p_event_type_code text,
  p_title           text,
  p_description     text,
  p_starts_at       timestamptz,
  p_ends_at         timestamptz default null,
  p_timezone        text default 'Africa/Abidjan',
  p_format          text default 'online',
  p_country_code    char(2) default null,
  p_city            text default null,
  p_venue_name      text default null,
  p_online_url      text default null,
  p_cover_path      text default null,
  p_cover_alt       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_tz    text := nullif(btrim(coalesce(p_timezone, '')), '');
  v_fmt   text := coalesce(nullif(btrim(coalesce(p_format, '')), ''), 'online');
  v_city  text := nullif(btrim(coalesce(p_city, '')), '');
  v_venue text := nullif(btrim(coalesce(p_venue_name, '')), '');
  v_url   text := nullif(btrim(coalesce(p_online_url, '')), '');
  v_path  text := nullif(btrim(coalesce(p_cover_path, '')), '');
  v_alt   text := nullif(btrim(coalesce(p_cover_alt, '')), '');
  v_slug  text;
  v_id    uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(v_title) < 3 or length(v_title) > 240 then
    raise exception 'event_missing_required_field' using errcode = 'P0001';
  end if;
  if p_event_type_code is null or not exists (
       select 1 from public.event_types t where t.code = p_event_type_code and t.is_active
     ) then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;
  if p_starts_at is null then
    raise exception 'event_missing_required_field' using errcode = 'P0001';
  end if;
  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if v_tz is null then
    raise exception 'event_missing_required_field' using errcode = 'P0001';
  end if;
  if v_fmt not in ('online', 'in_person', 'hybrid') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  -- Exige des maintenant ce que la validation exigera : mieux vaut le dire
  -- a l'auteur que le decouvrir au moment de publier.
  if v_fmt <> 'in_person' and v_url is null then
    raise exception 'event_online_url_required' using errcode = 'P0001';
  end if;
  if v_fmt <> 'online' and v_city is null and v_venue is null then
    raise exception 'event_place_required' using errcode = 'P0001';
  end if;

  perform private.assert_proposed_cover(v_path, v_alt, v_me);

  v_slug := private.unique_content_slug('event', v_title);

  insert into public.events (
    event_type_code, title, slug, description, organizer_type, organizer_profile_id,
    format, country_code, city, venue_name, online_url_private,
    starts_at, ends_at, timezone, visibility, status, created_by_profile_id,
    proposed_cover_path, proposed_cover_alt
  )
  values (
    p_event_type_code, v_title, v_slug, nullif(btrim(coalesce(p_description, '')), ''),
    'profile', v_me, v_fmt, p_country_code, v_city, v_venue, v_url,
    p_starts_at, p_ends_at, v_tz, 'members', 'pending_review', v_me, v_path, v_alt
  )
  returning id into v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('event.proposed', 'event', v_id, v_me,
          jsonb_build_object('title', v_title, 'has_cover', v_path is not null));

  perform private.log_audit(
    p_action      => 'member.event_proposed',
    p_object_type => 'event',
    p_object_id   => v_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('event_type', p_event_type_code, 'has_cover', v_path is not null));

  return jsonb_build_object('event_id', v_id, 'slug', v_slug, 'status', 'pending_review');
end
$$;

-- « Ou en est ma proposition ? » — en attente, publiee, ou refusee avec le
-- motif. Un refus sans motif rendu a l'auteur serait un refus muet.
create or replace function public.list_my_content_proposals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(r order by r->>'created_at' desc), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
             'kind', 'news',
             'id', n.id,
             'title', n.title,
             'summary', n.summary,
             'status', n.editorial_status,
             'rejection_reason', n.rejection_reason,
             'reviewed_at', n.reviewed_at,
             'published_at', n.published_at,
             'has_cover', (n.proposed_cover_path is not null or n.cover_media_id is not null),
             'created_at', n.created_at
           ) as r
      from public.news n
     where n.submitted_by_profile_id = v_me and n.deleted_at is null
    union all
    select jsonb_build_object(
             'kind', 'event',
             'id', e.id,
             'title', e.title,
             'summary', e.description,
             'status', e.status,
             'rejection_reason', e.rejection_reason,
             'reviewed_at', e.reviewed_at,
             'published_at', e.published_at,
             'has_cover', (e.proposed_cover_path is not null or e.cover_media_id is not null),
             'created_at', e.created_at
           )
      from public.events e
     where e.created_by_profile_id = v_me and e.deleted_at is null
  ) s;

  return jsonb_build_object('rows', v_rows);
end
$$;

-- ---------------------------------------------------------------------
-- 6. Voie ADMINISTRATION : file d'attente et decision
-- ---------------------------------------------------------------------

create or replace function public.admin_list_content_proposals(p_state text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_news  boolean := private.has_permission('content.publish');
  v_event boolean := private.has_permission('events.manage');
  v_state text    := coalesce(nullif(btrim(coalesce(p_state, '')), ''), 'pending');
  v_rows  jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (v_news or v_event) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_state not in ('pending', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  -- Les deux permissions sont distinctes : qui ne detient que `events.manage`
  -- ne voit pas les propositions d'actualite, et reciproquement.
  select coalesce(jsonb_agg(r order by r->>'submitted_at' desc), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
             'kind', 'news',
             'id', n.id,
             'title', n.title,
             'summary', n.summary,
             'status', n.editorial_status,
             'author_profile_id', n.submitted_by_profile_id,
             'author_name', coalesce(p.display_name, ''),
             'submitted_at', n.created_at,
             'has_cover', n.proposed_cover_path is not null,
             'rejection_reason', n.rejection_reason
           ) as r
      from public.news n
      left join public.ise_profiles p on p.id = n.submitted_by_profile_id
     where v_news
       and n.deleted_at is null
       and n.submitted_by_profile_id is not null
       and n.editorial_status = case when v_state = 'pending' then 'submitted' else 'rejected' end
    union all
    select jsonb_build_object(
             'kind', 'event',
             'id', e.id,
             'title', e.title,
             'summary', e.description,
             'status', e.status,
             'author_profile_id', e.created_by_profile_id,
             'author_name', coalesce(p.display_name, ''),
             'submitted_at', e.created_at,
             'has_cover', e.proposed_cover_path is not null,
             'rejection_reason', e.rejection_reason
           )
      from public.events e
      left join public.ise_profiles p on p.id = e.created_by_profile_id
     where v_event
       and e.deleted_at is null
       and e.created_by_profile_id is not null
       and e.status = case when v_state = 'pending' then 'pending_review' else 'rejected' end
  ) s;

  return jsonb_build_object('rows', v_rows, 'can_news', v_news, 'can_events', v_event);
end
$$;

create or replace function public.admin_get_content_proposal(p_kind text, p_id uuid)
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
  if p_kind not in ('news', 'event') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_kind = 'news' and not private.has_permission('content.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_kind = 'event' and not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_kind = 'news' then
    select jsonb_build_object(
             'kind', 'news',
             'id', n.id,
             'status', n.editorial_status,
             'title', n.title,
             'summary', n.summary,
             'body', n.body,
             'category_code', n.category_code,
             'event_date', n.event_date,
             'source_url', n.source_url,
             'author_profile_id', n.submitted_by_profile_id,
             'author_name', coalesce(p.display_name, ''),
             'submitted_at', n.created_at,
             'cover_path', n.proposed_cover_path,
             'cover_alt', n.proposed_cover_alt,
             'rejection_reason', n.rejection_reason)
      into v_out
      from public.news n
      left join public.ise_profiles p on p.id = n.submitted_by_profile_id
     where n.id = p_id and n.deleted_at is null
       and n.submitted_by_profile_id is not null
       and n.editorial_status in ('submitted', 'rejected');
  else
    select jsonb_build_object(
             'kind', 'event',
             'id', e.id,
             'status', e.status,
             'title', e.title,
             'summary', e.description,
             'body', null,
             'category_code', e.event_type_code,
             'format', e.format,
             'starts_at', e.starts_at,
             'ends_at', e.ends_at,
             'timezone', e.timezone,
             'city', e.city,
             'venue_name', e.venue_name,
             'country_code', e.country_code,
             'author_profile_id', e.created_by_profile_id,
             'author_name', coalesce(p.display_name, ''),
             'submitted_at', e.created_at,
             'cover_path', e.proposed_cover_path,
             'cover_alt', e.proposed_cover_alt,
             'rejection_reason', e.rejection_reason)
      into v_out
      from public.events e
      left join public.ise_profiles p on p.id = e.created_by_profile_id
     where e.id = p_id and e.deleted_at is null
       and e.created_by_profile_id is not null
       and e.status in ('pending_review', 'rejected');
  end if;

  return v_out;
end
$$;

-- ACCEPTER ou REFUSER. Un refus exige un motif d'au moins 10 caracteres,
-- transmis a l'auteur : c'est la seule facon qu'il a de corriger.
--
-- Les parametres `p_media_*` portent le visuel PROMU : l'appelant a recopie
-- l'objet du bucket prive vers `landing-media` avant l'appel, et transmet
-- ici le chemin et les metadonnees a enregistrer dans `cms_media_assets`.
-- Le media devient alors un actif reutilisable tel quel — c'est exactement
-- la demande du porteur : ne pas refaire les images a la validation.
create or replace function public.moderate_content_proposal(
  p_kind         text,
  p_id           uuid,
  p_decision     text,
  p_reason       text default null,
  p_media_path   text default null,
  p_media_alt    text default null,
  p_media_mime   text default null,
  p_media_width  integer default null,
  p_media_height integer default null,
  p_media_size   bigint default null,
  p_media_name   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := private.current_profile_id();
  v_perm     text := case p_kind when 'news' then 'content.publish'
                                 when 'event' then 'events.manage' end;
  v_action   text := case p_kind when 'news' then 'admin.news_proposal_moderated'
                                 else 'admin.event_proposal_moderated' end;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_path     text := nullif(btrim(coalesce(p_media_path, '')), '');
  v_media_id uuid;
  v_author   uuid;
  v_title    text;
  v_released text;
  v_news     public.news;
  v_event    public.events;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_perm is null then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if not private.has_permission(v_perm) then
    perform private.log_audit(
      p_action      => v_action,
      p_object_type => p_kind,
      p_object_id   => p_id::text,
      p_result      => 'denied',
      p_error_code  => '42501');
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and length(coalesce(v_reason, '')) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  if p_decision = 'approved' and v_path is not null then
    if not private.is_landing_media_path(v_path) then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    if length(btrim(coalesce(p_media_alt, ''))) < 3 then
      raise exception 'media_alt_required' using errcode = 'P0001';
    end if;
    insert into public.cms_media_assets (
      bucket_id, storage_path, filename, mime_type, width, height,
      size_bytes, alt_text, created_by_profile_id
    )
    values (
      'landing-media', v_path,
      left(coalesce(nullif(btrim(coalesce(p_media_name, '')), ''), 'visuel-propose'), 200),
      coalesce(p_media_mime, 'image/jpeg'), p_media_width, p_media_height,
      p_media_size, btrim(p_media_alt), v_me
    )
    returning id into v_media_id;
  end if;

  if p_kind = 'news' then
    select * into v_news from public.news
     where id = p_id and deleted_at is null for update;
    if not found then
      raise exception 'news_not_found' using errcode = 'P0002';
    end if;
    if v_news.editorial_status <> 'submitted' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;

    v_author   := v_news.submitted_by_profile_id;
    v_title    := v_news.title;
    v_released := v_news.proposed_cover_path;

    -- D-128 : ni landing_visibility, ni landing_priority, ni is_featured.
    -- Publier n'est pas mettre en avant ; la landing reste au CMS.
    update public.news
       set editorial_status        = case when p_decision = 'approved' then 'published' else 'rejected' end,
           published_at            = case when p_decision = 'approved' then coalesce(published_at, now()) else published_at end,
           published_by_profile_id = case when p_decision = 'approved' then v_me else published_by_profile_id end,
           cover_media_id          = coalesce(v_media_id, cover_media_id),
           rejection_reason        = case when p_decision = 'rejected' then v_reason else rejection_reason end,
           reviewed_by_profile_id  = v_me,
           reviewed_at             = now(),
           proposed_cover_path     = null,
           proposed_cover_alt      = null
     where id = p_id;
  else
    select * into v_event from public.events
     where id = p_id and deleted_at is null for update;
    if not found then
      raise exception 'event_not_found' using errcode = 'P0002';
    end if;
    if v_event.status <> 'pending_review' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    -- Les deux coherences relachees pour la proposition sont re-imposees
    -- ici : publier un evenement en ligne sans lien serait publier un
    -- rendez-vous ou personne ne peut se rendre.
    if p_decision = 'approved' then
      if v_event.format <> 'in_person' and v_event.online_url_private is null then
        raise exception 'event_online_url_required' using errcode = 'P0001';
      end if;
      if v_event.format <> 'online' and v_event.city is null and v_event.venue_name is null then
        raise exception 'event_place_required' using errcode = 'P0001';
      end if;
    end if;

    v_author   := v_event.created_by_profile_id;
    v_title    := v_event.title;
    v_released := v_event.proposed_cover_path;

    update public.events
       set status                 = case when p_decision = 'approved' then 'published' else 'rejected' end,
           published_at           = case when p_decision = 'approved' then coalesce(published_at, now()) else published_at end,
           cover_media_id         = coalesce(v_media_id, cover_media_id),
           rejection_reason       = case when p_decision = 'rejected' then v_reason else rejection_reason end,
           reviewed_by_profile_id = v_me,
           reviewed_at            = now(),
           proposed_cover_path    = null,
           proposed_cover_alt     = null
     where id = p_id;
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values (case p_kind when 'news' then 'news.proposal_moderated' else 'event.proposal_moderated' end,
          p_kind, p_id, v_me,
          jsonb_build_object('decision', p_decision, 'note', v_reason,
                             'media_id', v_media_id, 'author_profile_id', v_author));

  perform private.emit_in_app_notification(
    v_author, null,
    case p_kind when 'news' then 'news' else 'events' end,
    'relevant',
    case when p_decision = 'approved'
         then 'Votre proposition a été publiée.'
         else 'Votre proposition n''a pas été retenue.' end,
    case when p_decision = 'approved' then v_title else coalesce(v_reason, v_title) end,
    p_kind, p_id, 'view', '/mes-propositions',
    'content_proposal_moderated:' || p_id::text);

  perform private.log_audit(
    p_action      => v_action,
    p_object_type => p_kind,
    p_object_id   => p_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('decision', p_decision, 'note', v_reason,
                                        'media_id', v_media_id));

  -- `released_cover_path` : le chemin du bucket PRIVE, desormais orphelin.
  -- PostgreSQL n'a aucun acces aux octets stockes ; seul l'appelant peut
  -- les effacer, et seulement tant qu'il connait le chemin.
  return jsonb_build_object(
    'kind', p_kind, 'id', p_id, 'decision', p_decision,
    'media_id', v_media_id, 'released_cover_path', v_released);
end
$$;

-- ---------------------------------------------------------------------
-- 7. Privileges
-- ---------------------------------------------------------------------

revoke all on function public.propose_news(text, text, text, text, date, text, text, text) from public, anon;
revoke all on function public.propose_event(text, text, text, timestamptz, timestamptz, text, text, char, text, text, text, text, text) from public, anon;
revoke all on function public.list_my_content_proposals() from public, anon;
revoke all on function public.admin_list_content_proposals(text) from public, anon;
revoke all on function public.admin_get_content_proposal(text, uuid) from public, anon;
revoke all on function public.moderate_content_proposal(text, uuid, text, text, text, text, text, integer, integer, bigint, text) from public, anon;

grant execute on function public.propose_news(text, text, text, text, date, text, text, text) to authenticated;
grant execute on function public.propose_event(text, text, text, timestamptz, timestamptz, text, text, char, text, text, text, text, text) to authenticated;
grant execute on function public.list_my_content_proposals() to authenticated;
grant execute on function public.admin_list_content_proposals(text) to authenticated;
grant execute on function public.admin_get_content_proposal(text, uuid) to authenticated;
grant execute on function public.moderate_content_proposal(text, uuid, text, text, text, text, text, integer, integer, bigint, text) to authenticated;

commit;
