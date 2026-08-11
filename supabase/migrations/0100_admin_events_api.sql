-- =====================================================================
-- 0100 — API Superadmin pour les evenements (SA-030 -> 033)
-- =====================================================================
-- Reutilise directement (sans nouvelle fonction), meme principe que
-- 0094 (SA-023->026) et 0099 (SA-027->029) :
--   * public.get_event               (private.can_see_event bypasse
--     deja has_permission('events.manage'), 0046 — y compris les
--     evenements 'draft'/'pending_review')
--   * public.get_event_online_url    (private.is_event_organizer et
--     private.can_see_event bypassent deja le meme droit, 0046)
--   * public.get_event_followup      (le bloc 'event_impact' n'est
--     renvoye que si private.is_event_organizer(), qui bypasse deja
--     events.manage, 0074) — couvre la LECTURE du bilan SA-033.
--   * private.event_card(p_event, p_full) (0074) — deja compatible
--     admin (meme bypass que can_see_event) : reutilise ICI comme
--     forme de ligne de admin_list_events, exactement comme 0094/0099
--     reutilisent private.project_card / private.community_card.
--
-- Nouveau, car aucune fonction (membre ou admin) ne couvrait ces cas :
--   * admin_list_events               — liste TOUS les statuts, y
--     compris 'draft'/'pending_review', que public.list_events (0074)
--     exclut par construction (v_scope impose starts_at >= now() ou
--     'mine', jamais les brouillons d'un tiers).
--   * admin_create_event              — aucune fonction ne permettait
--     de creer un evenement pour le compte d'une promotion, d'une
--     communaute ou d'un projet (organizer_type <> 'profile') sans en
--     etre soi-meme membre/organisateur ; la policy RLS `events_create`
--     (0046) n'autorise que created_by_profile_id = soi-meme.
--   * admin_update_event              — edition du contenu/logistique.
--   * admin_set_event_status          — cycle de vie
--     (draft/pending_review/published/full/completed/cancelled/archived,
--     contrainte events_status_check) : aucune fonction ne validait les
--     transitions ni les preconditions de publication (lieu/URL selon
--     le format, events_in_person_needs_place / events_online_needs_url).
--   * admin_list_event_registrations  — AUCUNE fonction, membre ou
--     admin, ne liste les inscriptions d'un evenement (seule une
--     lecture RLS directe existe pour l'organisateur, policy
--     `event_registrations_select`, 0046) : necessaire au suivi
--     SA-032.
--   * admin_set_event_registration_status — constater la presence
--     (D-55 : la presence se constate, elle n'est jamais auto-declaree)
--     ou annuler une inscription pour le compte d'un participant.
--     Aucune fonction ne l'exposait ; seule la policy RLS
--     `event_registrations_manage_organizer` (0046) ouvrait la voie a
--     la modification directe, sans validation ni horodatage coherent.
--   * admin_upsert_event_followup     — ECRITURE du bilan organisateur
--     (`event_followups` : synthese, conclusions, decisions, suites,
--     replay). La policy RLS `event_followups_write_organizer` (0046)
--     autorisait deja l'ecriture directe, mais aucune fonction ne
--     l'exposait avec validation. Necessaire a SA-033.
--   * admin_record_event_impact_snapshot — un INSTANTANE d'impact
--     (`event_impact_snapshots`) n'est JAMAIS saisi a la main
--     (MASTER PROMPT §98 : aucun chiffre invente) : chaque valeur est
--     un decompte reel, calcule ici a partir des inscriptions et des
--     retombees declarees (`event_outcomes`), jamais un champ de
--     formulaire libre. Necessaire a SA-033.
--
-- Conventions (identiques a 0094/0099) : security definer, search_path
-- vide, has_permission('events.manage'), erreurs 28000/42501/P0001/P0002,
-- revoke public/anon, grant authenticated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_list_events — tous statuts, pagination par curseur (keyset)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_events(
  p_status text default null,
  p_event_type_code text default null,
  p_format text default null,
  p_query text default null,
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_c_at timestamptz;
  v_c_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_next text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in
     ('draft', 'pending_review', 'published', 'full', 'completed', 'cancelled', 'archived') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_format is not null and p_format not in ('online', 'in_person', 'hybrid') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select e.id, e.starts_at as at
      from public.events e
     where e.deleted_at is null
       and (p_status is null or e.status = p_status)
       and (p_event_type_code is null or e.event_type_code = p_event_type_code)
       and (p_format is null or e.format = p_format)
       and (v_q is null or e.title ilike '%' || v_q || '%' or coalesce(e.city, '') ilike '%' || v_q || '%')
       and (v_c_at is null or (e.starts_at, e.id) < (v_c_at, v_c_id))
     order by e.starts_at desc, e.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(private.event_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
    from base b;

  if jsonb_array_length(v_rows) < v_limit then
    v_next := null;
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_events(text, text, text, text, text, integer) from public, anon;
grant execute on function public.admin_list_events(text, text, text, text, text, integer) to authenticated;
comment on function public.admin_list_events(text, text, text, text, text, integer) is
  'SA-030 — Liste administrative des evenements, tous statuts (y compris brouillon / en revue). Reserve a events.manage.';

-- ---------------------------------------------------------------------
-- admin_create_event — creation administrative, tout type d'organisateur
-- ---------------------------------------------------------------------
create or replace function public.admin_create_event(
  p_event_type_code text,
  p_title text,
  p_slug text,
  p_starts_at timestamptz,
  p_timezone text,
  p_organizer_type text default 'profile',
  p_organizer_profile_id uuid default null,
  p_organizer_promotion_id bigint default null,
  p_organizer_community_id uuid default null,
  p_organizer_project_id uuid default null,
  p_organizer_external_name text default null,
  p_description text default null,
  p_target_audience text default null,
  p_format text default 'online',
  p_country_code char(2) default null,
  p_city text default null,
  p_venue_name text default null,
  p_address text default null,
  p_online_url_private text default null,
  p_online_url_visibility text default 'registered',
  p_ends_at timestamptz default null,
  p_capacity integer default null,
  p_registration_policy text default 'required',
  p_attendee_list_visibility text default 'organizer',
  p_visibility text default 'members'
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_event public.events;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_title = '' or length(v_title) < 3 or v_slug = '' or p_starts_at is null
     or nullif(btrim(coalesce(p_timezone, '')), '') is null then
    raise exception 'event_missing_required_field' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;
  if p_event_type_code is null or not exists (
       select 1 from public.event_types t where t.code = p_event_type_code and t.is_active
     ) then
    raise exception 'invalid_event_type' using errcode = 'P0001';
  end if;
  if coalesce(p_format, 'online') not in ('online', 'in_person', 'hybrid') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if coalesce(p_registration_policy, 'required') not in
     ('required', 'optional', 'none', 'approval_required') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if coalesce(p_attendee_list_visibility, 'organizer') not in ('organizer', 'registered', 'members') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if coalesce(p_online_url_visibility, 'registered') not in ('registered', 'all_viewers') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if coalesce(p_visibility, 'members') not in
     ('members', 'promotion', 'community', 'selected_members', 'invitation_only') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'event_dates_invalid' using errcode = 'P0001';
  end if;

  if coalesce(p_organizer_type, 'profile') not in
     ('profile', 'promotion', 'community', 'project', 'platform', 'partner') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_organizer_type = 'profile' and p_organizer_profile_id is null then
    raise exception 'event_organizer_target_required' using errcode = 'P0001';
  end if;
  if p_organizer_type = 'promotion' and p_organizer_promotion_id is null then
    raise exception 'event_organizer_target_required' using errcode = 'P0001';
  end if;
  if p_organizer_type = 'community' and p_organizer_community_id is null then
    raise exception 'event_organizer_target_required' using errcode = 'P0001';
  end if;
  if p_organizer_type = 'project' and p_organizer_project_id is null then
    raise exception 'event_organizer_target_required' using errcode = 'P0001';
  end if;
  if p_organizer_type in ('platform', 'partner')
     and nullif(btrim(coalesce(p_organizer_external_name, '')), '') is null then
    raise exception 'event_organizer_target_required' using errcode = 'P0001';
  end if;

  begin
    insert into public.events (
      event_type_code, title, slug, description, target_audience,
      organizer_type, organizer_profile_id, organizer_promotion_id,
      organizer_community_id, organizer_project_id, organizer_external_name,
      format, country_code, city, venue_name, address,
      online_url_private, online_url_visibility,
      starts_at, ends_at, timezone, capacity,
      registration_policy, attendee_list_visibility, visibility,
      status, created_by_profile_id
    )
    values (
      p_event_type_code, v_title, v_slug, p_description, p_target_audience,
      coalesce(p_organizer_type, 'profile'), p_organizer_profile_id, p_organizer_promotion_id,
      p_organizer_community_id, p_organizer_project_id, p_organizer_external_name,
      coalesce(p_format, 'online'), p_country_code, p_city, p_venue_name, p_address,
      p_online_url_private, coalesce(p_online_url_visibility, 'registered'),
      p_starts_at, p_ends_at, btrim(p_timezone), p_capacity,
      coalesce(p_registration_policy, 'required'), coalesce(p_attendee_list_visibility, 'organizer'),
      coalesce(p_visibility, 'members'),
      'draft', v_me
    )
    returning * into v_event;
  exception when unique_violation then
    raise exception 'slug_already_exists' using errcode = 'P0001';
  end;

  return v_event;
end;
$$;

revoke all on function public.admin_create_event(
  text, text, text, timestamptz, text, text, uuid, bigint, uuid, uuid, text, text, text, text, char(2),
  text, text, text, text, text, timestamptz, integer, text, text, text
) from public, anon;
grant execute on function public.admin_create_event(
  text, text, text, timestamptz, text, text, uuid, bigint, uuid, uuid, text, text, text, text, char(2),
  text, text, text, text, text, timestamptz, integer, text, text, text
) to authenticated;
comment on function public.admin_create_event(
  text, text, text, timestamptz, text, text, uuid, bigint, uuid, uuid, text, text, text, text, char(2),
  text, text, text, text, text, timestamptz, integer, text, text, text
) is
  'SA-030 — Creation administrative d''un evenement (toujours en brouillon), pour tout type d''organisateur. Reserve a events.manage.';

-- ---------------------------------------------------------------------
-- admin_update_event — edition du contenu et de la logistique
-- ---------------------------------------------------------------------
create or replace function public.admin_update_event(
  p_event_id uuid,
  p_title text,
  p_description text default null,
  p_target_audience text default null,
  p_organizer_type text default null,
  p_organizer_profile_id uuid default null,
  p_organizer_promotion_id bigint default null,
  p_organizer_community_id uuid default null,
  p_organizer_project_id uuid default null,
  p_organizer_external_name text default null,
  p_format text default null,
  p_country_code char(2) default null,
  p_city text default null,
  p_venue_name text default null,
  p_address text default null,
  p_online_url_private text default null,
  p_online_url_visibility text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_timezone text default null,
  p_capacity integer default null,
  p_registration_policy text default null,
  p_attendee_list_visibility text default null,
  p_visibility text default null
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_event public.events;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_title = '' or length(v_title) < 3 then
    raise exception 'event_missing_required_field' using errcode = 'P0001';
  end if;
  if p_format is not null and p_format not in ('online', 'in_person', 'hybrid') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_registration_policy is not null and p_registration_policy not in
     ('required', 'optional', 'none', 'approval_required') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_attendee_list_visibility is not null and p_attendee_list_visibility not in
     ('organizer', 'registered', 'members') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_online_url_visibility is not null and p_online_url_visibility not in ('registered', 'all_viewers') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_visibility is not null and p_visibility not in
     ('members', 'promotion', 'community', 'selected_members', 'invitation_only') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_organizer_type is not null and p_organizer_type not in
     ('profile', 'promotion', 'community', 'project', 'platform', 'partner') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_event from public.events where id = p_event_id and deleted_at is null for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if v_event.status in ('completed', 'cancelled', 'archived') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'event_dates_invalid' using errcode = 'P0001';
  end if;
  if p_starts_at is null and p_ends_at is not null and p_ends_at < v_event.starts_at then
    raise exception 'event_dates_invalid' using errcode = 'P0001';
  end if;

  update public.events
     set title = v_title,
         description = p_description,
         target_audience = p_target_audience,
         organizer_type = coalesce(p_organizer_type, organizer_type),
         organizer_profile_id = case when p_organizer_type is not null then p_organizer_profile_id
                                      else organizer_profile_id end,
         organizer_promotion_id = case when p_organizer_type is not null then p_organizer_promotion_id
                                        else organizer_promotion_id end,
         organizer_community_id = case when p_organizer_type is not null then p_organizer_community_id
                                        else organizer_community_id end,
         organizer_project_id = case when p_organizer_type is not null then p_organizer_project_id
                                      else organizer_project_id end,
         organizer_external_name = case when p_organizer_type is not null then p_organizer_external_name
                                         else organizer_external_name end,
         format = coalesce(p_format, format),
         country_code = coalesce(p_country_code, country_code),
         city = coalesce(p_city, city),
         venue_name = coalesce(p_venue_name, venue_name),
         address = coalesce(p_address, address),
         online_url_private = coalesce(p_online_url_private, online_url_private),
         online_url_visibility = coalesce(p_online_url_visibility, online_url_visibility),
         starts_at = coalesce(p_starts_at, starts_at),
         ends_at = coalesce(p_ends_at, ends_at),
         timezone = coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), timezone),
         capacity = coalesce(p_capacity, capacity),
         registration_policy = coalesce(p_registration_policy, registration_policy),
         attendee_list_visibility = coalesce(p_attendee_list_visibility, attendee_list_visibility),
         visibility = coalesce(p_visibility, visibility)
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.admin_update_event(
  uuid, text, text, text, text, uuid, bigint, uuid, uuid, text, text, char(2), text, text, text,
  text, text, timestamptz, timestamptz, text, integer, text, text, text
) from public, anon;
grant execute on function public.admin_update_event(
  uuid, text, text, text, text, uuid, bigint, uuid, uuid, text, text, char(2), text, text, text,
  text, text, timestamptz, timestamptz, text, integer, text, text, text
) to authenticated;
comment on function public.admin_update_event(
  uuid, text, text, text, text, uuid, bigint, uuid, uuid, text, text, char(2), text, text, text,
  text, text, timestamptz, timestamptz, text, integer, text, text, text
) is
  'SA-031 — Edition administrative du contenu et de la logistique d''un evenement non termine. Reserve a events.manage.';

-- ---------------------------------------------------------------------
-- admin_set_event_status — cycle de vie (events_status_check, 0013)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_event_status(
  p_event_id uuid,
  p_status text,
  p_cancellation_reason text default null
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_event public.events;
  v_allowed text[];
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is null or p_status not in
     ('draft', 'pending_review', 'published', 'full', 'completed', 'cancelled', 'archived') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_event from public.events where id = p_event_id and deleted_at is null for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  v_allowed := case v_event.status
                 when 'draft' then array['pending_review', 'published', 'cancelled']
                 when 'pending_review' then array['draft', 'published', 'cancelled']
                 when 'published' then array['full', 'completed', 'cancelled']
                 when 'full' then array['published', 'completed', 'cancelled']
                 when 'completed' then array['archived']
                 when 'cancelled' then array['archived']
                 else array[]::text[]
               end;
  if not (p_status = any(v_allowed)) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- Preconditions de publication : memes regles que les contraintes
  -- CHECK events_in_person_needs_place / events_online_needs_url
  -- (0013), verifiees ICI pour un message metier clair plutot qu'une
  -- violation de contrainte brute.
  if p_status not in ('draft', 'pending_review') then
    if v_event.format <> 'online' and v_event.city is null and v_event.venue_name is null then
      raise exception 'event_missing_location' using errcode = 'P0001';
    end if;
    if v_event.format <> 'in_person' and v_event.online_url_private is null then
      raise exception 'event_missing_online_url' using errcode = 'P0001';
    end if;
  end if;

  if p_status = 'cancelled' and length(btrim(coalesce(p_cancellation_reason, ''))) < 5 then
    raise exception 'event_cancellation_reason_required' using errcode = 'P0001';
  end if;

  update public.events
     set status = p_status,
         published_at = case when p_status in ('published', 'full') then coalesce(published_at, now())
                              else published_at end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancellation_reason = case when p_status = 'cancelled' then btrim(p_cancellation_reason)
                                     else cancellation_reason end,
         completed_at = case when p_status = 'completed' then coalesce(completed_at, now())
                              else completed_at end
   where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke all on function public.admin_set_event_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_event_status(uuid, text, text) to authenticated;
comment on function public.admin_set_event_status(uuid, text, text) is
  'SA-031 — Cycle de vie d''un evenement (validation, publication, complet, cloture, annulation, archivage). Reserve a events.manage.';

-- ---------------------------------------------------------------------
-- admin_list_event_registrations — suivi des inscriptions (SA-032)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_event_registrations(
  p_event_id uuid,
  p_status text default null,
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_c_at timestamptz;
  v_c_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_next text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id and e.deleted_at is null) then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if p_status is not null and p_status not in
     ('registered', 'pending_approval', 'waitlisted', 'cancelled', 'attended', 'no_show') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select r.event_id, r.profile_id, r.registered_at as at
      from public.event_registrations r
     where r.event_id = p_event_id
       and (p_status is null or r.status = p_status)
       and (v_c_at is null or (r.registered_at, r.profile_id) < (v_c_at, v_c_id))
     order by r.registered_at desc, r.profile_id desc
     limit v_limit
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'event_id', r.event_id,
               'profile_id', r.profile_id,
               'profile', private.network_profile_card(r.profile_id),
               'status', r.status,
               'registered_at', r.registered_at,
               'cancelled_at', r.cancelled_at,
               'checked_in_at', r.checked_in_at,
               'attended_at', r.attended_at,
               'is_listed', r.is_listed
             )
             order by b.at desc, b.profile_id desc
           ),
           '[]'::jsonb
         ),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.profile_id order by b.at, b.profile_id))[1])
    into v_rows, v_next
    from base b
    join public.event_registrations r on r.event_id = b.event_id and r.profile_id = b.profile_id;

  if jsonb_array_length(v_rows) < v_limit then
    v_next := null;
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_event_registrations(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_list_event_registrations(uuid, text, text, integer) to authenticated;
comment on function public.admin_list_event_registrations(uuid, text, text, integer) is
  'SA-032 — Suivi des inscriptions d''un evenement, tous statuts. Reserve a events.manage.';

-- ---------------------------------------------------------------------
-- admin_set_event_registration_status — constater presence / absence /
-- annulation (D-55 : la presence se constate, jamais auto-declaree)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_event_registration_status(
  p_event_id uuid,
  p_profile_id uuid,
  p_status text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_registration public.event_registrations;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is null or p_status not in
     ('registered', 'pending_approval', 'waitlisted', 'cancelled', 'attended', 'no_show') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_registration
    from public.event_registrations
   where event_id = p_event_id and profile_id = p_profile_id
   for update;
  if not found then
    raise exception 'event_registration_not_found' using errcode = 'P0002';
  end if;

  update public.event_registrations
     set status = p_status,
         cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else null end,
         checked_in_at = case when p_status = 'attended' then coalesce(checked_in_at, now())
                               else checked_in_at end,
         attended_at = case when p_status = 'attended' then coalesce(attended_at, now())
                             when p_status = 'no_show' then null
                             else attended_at end
   where event_id = p_event_id and profile_id = p_profile_id
  returning * into v_registration;

  return jsonb_build_object(
    'event_id', v_registration.event_id,
    'profile_id', v_registration.profile_id,
    'status', v_registration.status,
    'checked_in_at', v_registration.checked_in_at,
    'attended_at', v_registration.attended_at,
    'cancelled_at', v_registration.cancelled_at
  );
end;
$$;

revoke all on function public.admin_set_event_registration_status(uuid, uuid, text) from public, anon;
grant execute on function public.admin_set_event_registration_status(uuid, uuid, text) to authenticated;
comment on function public.admin_set_event_registration_status(uuid, uuid, text) is
  'SA-032 — Constate la presence, l''absence ou l''annulation d''une inscription (D-55). Reserve a events.manage.';

-- ---------------------------------------------------------------------
-- admin_upsert_event_followup — bilan organisateur (SA-033)
-- ---------------------------------------------------------------------
create or replace function public.admin_upsert_event_followup(
  p_event_id uuid,
  p_summary text default null,
  p_conclusions text default null,
  p_decisions text default null,
  p_next_steps text default null,
  p_replay_url text default null,
  p_publish boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_published_at timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id and e.deleted_at is null) then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  insert into public.event_followups (id, summary, conclusions, decisions, next_steps, replay_url,
                                       author_profile_id, published_at)
  values (p_event_id, p_summary, p_conclusions, p_decisions, p_next_steps, p_replay_url,
          v_me, case when coalesce(p_publish, false) then now() else null end)
  on conflict (id) do update
     set summary = excluded.summary,
         conclusions = excluded.conclusions,
         decisions = excluded.decisions,
         next_steps = excluded.next_steps,
         replay_url = excluded.replay_url,
         author_profile_id = v_me,
         published_at = case when coalesce(p_publish, false)
                              then coalesce(public.event_followups.published_at, now())
                              else null end
  returning published_at into v_published_at;

  return jsonb_build_object('event_id', p_event_id, 'published_at', v_published_at);
end;
$$;

revoke all on function public.admin_upsert_event_followup(uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_upsert_event_followup(uuid, text, text, text, text, text, boolean) to authenticated;
comment on function public.admin_upsert_event_followup(uuid, text, text, text, text, text, boolean) is
  'SA-033 — Redaction/publication du bilan organisateur d''un evenement (event_followups). Reserve a events.manage.';

-- ---------------------------------------------------------------------
-- admin_record_event_impact_snapshot — instantane d'impact, chiffres
-- reels uniquement (MASTER PROMPT §98)
-- ---------------------------------------------------------------------
create or replace function public.admin_record_event_impact_snapshot(
  p_event_id uuid
)
returns public.event_impact_snapshots
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_snapshot public.event_impact_snapshots;
  v_registered integer;
  v_attended integer;
  v_no_show integer;
  v_promotions integer;
  v_countries integer;
  v_connections integer;
  v_projects integer;
  v_mentorships integer;
  v_resources integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('events.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id and e.deleted_at is null) then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  select count(*) filter (where r.status in ('registered', 'attended')),
         count(*) filter (where r.status = 'attended'),
         count(*) filter (where r.status = 'no_show')
    into v_registered, v_attended, v_no_show
    from public.event_registrations r
   where r.event_id = p_event_id;

  select count(distinct p.promotion_id), count(distinct p.current_country_code)
    into v_promotions, v_countries
    from public.event_registrations r
    join public.ise_profiles p on p.id = r.profile_id
   where r.event_id = p_event_id and r.status in ('registered', 'attended');

  select count(*) filter (where o.outcome_type = 'connection'),
         count(*) filter (where o.outcome_type = 'project'),
         count(*) filter (where o.outcome_type = 'mentorship')
    into v_connections, v_projects, v_mentorships
    from public.event_outcomes o
   where o.event_id = p_event_id;

  select count(*) into v_resources from public.event_resources res where res.event_id = p_event_id;

  insert into public.event_impact_snapshots (
    event_id, snapshot_at, registered_count, attended_count, no_show_count,
    promotions_represented, countries_represented, connections_created,
    projects_initiated, mentorships_initiated, resources_produced
  )
  values (
    p_event_id, now(), coalesce(v_registered, 0), coalesce(v_attended, 0), coalesce(v_no_show, 0),
    coalesce(v_promotions, 0), coalesce(v_countries, 0), coalesce(v_connections, 0),
    coalesce(v_projects, 0), coalesce(v_mentorships, 0), coalesce(v_resources, 0)
  )
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

revoke all on function public.admin_record_event_impact_snapshot(uuid) from public, anon;
grant execute on function public.admin_record_event_impact_snapshot(uuid) to authenticated;
comment on function public.admin_record_event_impact_snapshot(uuid) is
  'SA-033 — Capture un instantane d''impact calcule (aucun chiffre saisi a la main, MASTER PROMPT §98). Reserve a events.manage.';
