-- =====================================================================
-- 0039_network_relations_introductions
--
-- Couche base de donnees de la tranche RELATIONS & INTRODUCTIONS
-- (ISE-038 -> ISE-046).
--
-- Les tables et les deux fonctions atomiques existent depuis 0006
-- (`connection_requests`, `connections`, `introduction_requests`,
-- `introduction_events`, `public.accept_connection_request()`,
-- `public.transition_introduction()`), et les politiques depuis 0021.
-- AUCUNE des deux n'est modifiee ici, et aucune politique `UPDATE`
-- n'est ouverte sur `introduction_requests` : c'est voulu (D-50).
--
-- Ce que cette migration ajoute, et pourquoi :
--
--   1. private.network_profile_card(uuid)
--      Carte de profil compacte, composee EN BASE champ par champ selon
--      la visibilite effective du proprietaire, exactement comme
--      `public.get_member_profile()` (0036/0038). Les ecrans du reseau
--      affichent des dizaines de profils : sans cette fonction, chaque
--      liste devrait soit lire `ise_profiles` en clair (impossible
--      depuis 0028 : privilege de colonne retire), soit renvoyer puis
--      masquer (interdit, MASTER PROMPT §47).
--
--   2. public.send_connection_request(...)          -- ISE-038
--      public.respond_to_connection_request(...)    -- ISE-041 / ISE-042
--      La politique `connection_requests_create` (0021) verifie deja le
--      demandeur, le blocage et le statut initial. Elle ne peut pas
--      verifier la LIMITATION DE DEBIT (D-103, 30 demandes/jour) :
--      `private.consume_rate_limit()` ecrit dans `private`, schema
--      expose a aucun role client. Elle ne peut pas non plus distinguer
--      « deja en relation » de « demande deja en cours » : l'index
--      unique partiel remonterait un 23505 nu, que l'interface ne
--      saurait pas traduire (D-102). D'ou une fonction atomique unique.
--
--   3. public.my_network_summary()                  -- ISE-040
--      public.list_my_connections(...)              -- ISE-040
--      public.list_connection_requests(...)         -- ISE-041
--      public.get_connection_request(uuid)          -- ISE-042
--      Lectures composees, pagination PAR CURSEUR (D-44).
--
--   4. public.suggest_introduction_paths(uuid, int) -- ISE-043
--      LE point sensible de la tranche. Voir la note de confidentialite
--      en tete de la fonction : le RPC ne revele aucune relation d'un
--      tiers que le demandeur ne pouvait deja lire par la politique
--      `connections_select` (0021), et n'explore JAMAIS le graphe
--      au-dela du degre 1 (D-51).
--
--   5. public.request_introduction(...)             -- ISE-044
--      public.list_my_introductions(...)            -- ISE-045
--      public.get_introduction_request(uuid)        -- ISE-045 / ISE-046
--      public.declare_introduction_outcome(...)     -- ISE-046
--      Le bilan passe obligatoirement par
--      `public.transition_introduction()` : la declaration d'un
--      resultat ne peut donc pas franchir une etape non constatee
--      (D-55, MASTER PROMPT §25).
--
-- References : MASTER PROMPT §15, §23, §24, §25, §27, §43, §47, §53,
--              §54, §64, §71, §85, §98, §100, §101, §113 ;
--              D-42, D-43, D-44, D-50, D-51, D-55, D-73, D-93,
--              D-101, D-102, D-103, D-118.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Catalogue d'evenements de domaine
--
-- 0018 ne declarait que `connection.requested`, `connection.accepted`,
-- `introduction.requested`, `introduction.accepted` et
-- `introduction.completed`. Les faits reellement constates par cette
-- tranche en comptent davantage, et un fait sans code d'evenement ne
-- serait pas observable (MASTER PROMPT §52).
-- ---------------------------------------------------------------------
insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('connection.declined',      'Une demande de relation a ete declinee.',                 'connection',   45),
  ('connection.withdrawn',     'Une demande de relation a ete retiree par son auteur.',   'connection',   46),
  ('introduction.declined',    'L''intermediaire a decline la demande d''introduction.',  'introduction', 62),
  ('introduction.introduced',  'L''intermediaire declare avoir transmis l''introduction.','introduction', 64),
  ('introduction.no_outcome',  'Une introduction s''est terminee sans suite declaree.',   'introduction', 72)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 0 bis. Bilan d'introduction : un resultat manquait au referentiel
--
-- ISE-046 propose « Introduction complementaire — la cible vous a
-- oriente vers un autre contact ». C'est un FAIT distinct : l'echange a
-- eu lieu et a produit une reorientation. Aucune des cinq valeurs de
-- 0006 ne le porte. Plutot que de le ranger sous `exchange_held` (ce
-- qui perdrait l'information) ou de retirer l'option de la maquette, la
-- contrainte est etendue (D-118).
--
-- 0006 n'est PAS editee : la contrainte est remplacee ici, comme en
-- 0028 et 0038.
-- ---------------------------------------------------------------------
alter table public.introduction_requests
  drop constraint if exists introduction_requests_outcome_check;

alter table public.introduction_requests
  add constraint introduction_requests_outcome_check
  check (outcome is null or outcome in (
    'exchange_held', 'collaboration_considered', 'collaboration_confirmed',
    'referred_to_other_contact', 'no_response', 'not_relevant'));


-- ---------------------------------------------------------------------
-- 1. Carte de profil du reseau
--
-- SECURITY DEFINER, motif A (docs/rls.md §4) : appelle
-- `private.field_is_visible()`, qui lit `profile_visibility` d'un TIERS
-- (politique « proprietaire seulement »). Ne projette JAMAIS e-mail,
-- telephone, adresse, date de naissance, CV ni `profile_completion`.
-- Renvoie `NULL` — indistinctement — pour un profil inexistant,
-- supprime, suspendu, ou bloque dans un sens ou dans l'autre.
-- ---------------------------------------------------------------------
create or replace function private.network_profile_card(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $card$
declare
  v_row record;
  v_out jsonb;
  v_org text;
begin
  if p_profile is null or not private.can_see_profile(p_profile) then
    return null;
  end if;

  select p.id, p.display_name, p.first_name, p.last_name, p.avatar_path, p.headline,
         p.current_position, p.current_organization_id, p.current_organization_raw,
         p.current_city, p.current_country_code, p.promotion_id,
         p.verification_status, p.claim_status, p.profile_status
    into v_row
  from public.ise_profiles p
  where p.id = p_profile
    and p.deleted_at is null
    and p.profile_status in ('referenced', 'active');

  if not found then
    return null;
  end if;

  -- `full_name` n'admet pas le niveau `private` (referentiel 0025) :
  -- un profil visible porte toujours un nom.
  v_out := jsonb_build_object(
    'profile_id',          v_row.id,
    'display_name',        coalesce(v_row.display_name,
                                    concat_ws(' ', v_row.first_name, v_row.last_name)),
    'verification_status', v_row.verification_status,
    'claim_status',        v_row.claim_status,
    'is_self',             (v_row.id = private.current_profile_id())
  );

  if private.field_is_visible(p_profile, 'photo') and v_row.avatar_path is not null then
    v_out := v_out || jsonb_build_object('avatar_path', v_row.avatar_path);
  end if;

  if private.field_is_visible(p_profile, 'headline') and v_row.headline is not null then
    v_out := v_out || jsonb_build_object('headline', v_row.headline);
  end if;

  if private.field_is_visible(p_profile, 'current_position')
     and v_row.current_position is not null then
    v_out := v_out || jsonb_build_object('current_position', v_row.current_position);
  end if;

  if private.field_is_visible(p_profile, 'current_organization') then
    select coalesce(
             (select o.canonical_name from public.organizations o
               where o.id = v_row.current_organization_id),
             v_row.current_organization_raw)
      into v_org;
    if v_org is not null then
      v_out := v_out || jsonb_build_object('current_organization', v_org);
    end if;
  end if;

  if private.field_is_visible(p_profile, 'city') and v_row.current_city is not null then
    v_out := v_out || jsonb_build_object('current_city', v_row.current_city);
  end if;

  if private.field_is_visible(p_profile, 'country') and v_row.current_country_code is not null then
    v_out := v_out || jsonb_build_object(
      'current_country', (select c.name_fr from public.countries c
                           where c.code = v_row.current_country_code));
  end if;

  if private.field_is_visible(p_profile, 'promotion') and v_row.promotion_id is not null then
    v_out := v_out || jsonb_build_object(
      'promotion',
      (select jsonb_build_object(
                'id',    pr.id,
                'label', concat_ws(' ', pr.program_code, pr.graduation_year::text))
         from public.promotions pr where pr.id = v_row.promotion_id));
  end if;

  -- Trois competences au plus : une carte de liste, pas un profil complet.
  if private.field_is_visible(p_profile, 'skills') then
    v_out := v_out || jsonb_build_object('skills', coalesce((
      select jsonb_agg(x.name order by x.rn)
        from (
          select s.name,
                 row_number() over (order by ps.is_primary desc, s.name) as rn
            from public.profile_skills ps
            join public.skills s on s.id = ps.skill_id
           where ps.profile_id = p_profile
        ) x
       where x.rn <= 3), '[]'::jsonb));
  end if;

  -- Disponibilites declarees, ligne a ligne : `profile_availabilities`
  -- porte sa propre colonne `visibility` (politique 0021), en plus de la
  -- cle de champ `availabilities` du referentiel de visibilite.
  v_out := v_out || jsonb_build_object('availabilities', coalesce((
    select jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name)
                     order by a.sort_order)
      from public.profile_availabilities pa
      join public.availability_types a on a.code = pa.availability_type
     where pa.profile_id = p_profile
       and pa.active
       and private.field_is_visible(p_profile, 'availabilities')
       and private.can_see_field(p_profile, pa.visibility)
       and (pa.available_from  is null or pa.available_from  <= current_date)
       and (pa.available_until is null or pa.available_until >= current_date)),
    '[]'::jsonb));

  return v_out;
end
$card$;

revoke all on function private.network_profile_card(uuid) from public, anon, authenticated;

comment on function private.network_profile_card(uuid) is
  'Carte de profil compacte pour les ecrans Reseau (ISE-038 -> ISE-046). Composee champ par champ selon la visibilite effective (MASTER PROMPT 47). NULL indistinctement pour un profil inexistant, supprime, suspendu ou bloque.';


-- ---------------------------------------------------------------------
-- 2. Curseurs keyset (D-44)
--
-- PAS `SECURITY DEFINER` : il n'y a rien a contourner. Le curseur
-- renvoye est re-chiffre par l'application
-- (`apps/web/src/lib/opaque-cursor.ts`) avant d'atteindre le navigateur.
-- ---------------------------------------------------------------------
create or replace function private.encode_keyset_cursor(p_at timestamptz, p_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
           when p_at is null or p_id is null then null
           else encode(convert_to(p_at::text || '|' || p_id::text, 'UTF8'), 'base64')
         end
$$;

create or replace function private.decode_keyset_cursor(
  p_cursor  text,
  out c_at   timestamptz,
  out c_id   uuid
)
returns record
language plpgsql
stable
set search_path = ''
as $$
declare
  v_raw text;
begin
  c_at := null;
  c_id := null;
  if p_cursor is null or length(p_cursor) = 0 then
    return;
  end if;
  begin
    v_raw := convert_from(decode(p_cursor, 'base64'), 'UTF8');
    c_at  := split_part(v_raw, '|', 1)::timestamptz;
    c_id  := split_part(v_raw, '|', 2)::uuid;
  exception when others then
    -- Curseur tronque ou falsifie : on repart du debut, jamais d'erreur.
    c_at := null;
    c_id := null;
  end;
end
$$;

revoke all on function private.encode_keyset_cursor(timestamptz, uuid) from public, anon, authenticated;
revoke all on function private.decode_keyset_cursor(text) from public, anon, authenticated;


-- =====================================================================
-- ISE-038 / ISE-039 — Demande de connexion
-- =====================================================================

-- SECURITY DEFINER, motif B : chemin d'ecriture unique. Valide acteur,
-- blocage, doublon, relation existante et LIMITATION DE DEBIT (D-103),
-- sous `FOR UPDATE` sur le profil destinataire pour que deux envois
-- simultanes ne creent pas deux demandes.
--
-- La politique `connection_requests_create` (0021) reste en place et
-- reste la reference : cette fonction en rejoue chaque condition
-- explicitement, puisque `SECURITY DEFINER` contourne la RLS.
create or replace function public.send_connection_request(
  p_addressee_profile_id uuid,
  p_message              text default null,
  p_context              text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid := private.current_profile_id();
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_context text := nullif(btrim(coalesce(p_context, '')), '');
  v_id      uuid;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_addressee_profile_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_addressee_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if v_message is not null and length(v_message) > 600 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if v_context is not null and v_context not in
     ('promotion','organization','sector','event','project',
      'network_call','opportunity','introduction','other') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  -- Un profil bloque est indistinguable d'un profil inexistant.
  if not private.can_see_profile(p_addressee_profile_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if private.is_blocked_between(v_me, p_addressee_profile_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  -- Serialise les envois concurrents vers le meme destinataire.
  perform 1 from public.ise_profiles p where p.id = p_addressee_profile_id for update;

  if private.is_connected_to(p_addressee_profile_id) then
    raise exception 'already_connected' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.connection_requests r
     where r.status = 'pending'
       and least(r.requester_profile_id, r.addressee_profile_id)
           = least(v_me, p_addressee_profile_id)
       and greatest(r.requester_profile_id, r.addressee_profile_id)
           = greatest(v_me, p_addressee_profile_id)
  ) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;

  -- D-103 : 30 demandes par jour et par compte, fenetre glissante.
  if not private.consume_rate_limit(
       coalesce((select auth.uid())::text, v_me::text), 'connection_request', 30, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.connection_requests
    (requester_profile_id, addressee_profile_id, message, context, status)
  values (v_me, p_addressee_profile_id, v_message, v_context, 'pending')
  returning id into v_id;

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('connection.requested', 'connection', v_id, v_me,
          jsonb_build_object('addressee_profile_id', p_addressee_profile_id,
                             'context', v_context));

  return jsonb_build_object('request_id', v_id, 'status', 'pending');
end
$fn$;

revoke all on function public.send_connection_request(uuid, text, text) from public, anon;
grant execute on function public.send_connection_request(uuid, text, text) to authenticated;


-- Refus (destinataire) et retrait (demandeur). L'ACCEPTATION passe
-- obligatoirement par `public.accept_connection_request()` (0006) :
-- elle est la seule a creer la relation dans la meme transaction.
--
-- « Ignorer » n'est PAS une transition : aucune ecriture n'a lieu, la
-- demande reste `pending` jusqu'a expiration (D-55 — un statut ne se
-- pose pas sur un fait non constate). Aucune fonction ne lui correspond,
-- et c'est intentionnel.
--
-- `p_reason` n'est volontairement pas persiste : ISE-042 annonce que
-- « la personne ne recoit pas de motif detaille ». Conserver un motif
-- que personne ne lira serait garder une donnee sans usage (§47). Le
-- parametre existe pour que l'interface puisse evoluer sans changer la
-- signature.
create or replace function public.respond_to_connection_request(
  p_request_id uuid,
  p_to_status  text,
  p_reason     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_req public.connection_requests;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_to_status is null or p_to_status not in ('declined', 'withdrawn') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  select * into v_req from public.connection_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_to_status = 'declined' and v_req.addressee_profile_id <> v_me then
    raise exception 'not_addressee' using errcode = '42501';
  end if;
  if p_to_status = 'withdrawn' and v_req.requester_profile_id <> v_me then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.connection_requests
     set status = p_to_status, responded_at = now()
   where id = p_request_id;

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values (case when p_to_status = 'declined'
               then 'connection.declined' else 'connection.withdrawn' end,
          'connection', p_request_id, v_me, '{}'::jsonb);

  return jsonb_build_object('request_id', p_request_id, 'status', p_to_status);
end
$fn$;

revoke all on function public.respond_to_connection_request(uuid, text, text) from public, anon;
grant execute on function public.respond_to_connection_request(uuid, text, text) to authenticated;


-- =====================================================================
-- ISE-040 — Mes relations
-- =====================================================================

-- Compteurs du bandeau. Chaque nombre est CALCULE sur des donnees
-- reelles et ne compte que ce que le membre courant a le droit de voir :
-- une promotion ou un pays place en `private` par une relation n'entre
-- dans aucun total (MASTER PROMPT §98 — aucun indicateur invente).
create or replace function public.my_network_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_out jsonb;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  with mine as (
    select case when c.profile_a_id = v_me then c.profile_b_id else c.profile_a_id end as other_id
      from public.connections c
     where v_me in (c.profile_a_id, c.profile_b_id)
  ),
  visible as (
    select m.other_id, p.promotion_id, p.current_country_code
      from mine m
      join public.ise_profiles p on p.id = m.other_id
     where p.deleted_at is null
       and private.can_see_profile(m.other_id)
  ),
  avail as (
    select v.other_id, a.code, a.name, a.sort_order
      from visible v
      join public.profile_availabilities pa on pa.profile_id = v.other_id and pa.active
      join public.availability_types a on a.code = pa.availability_type
     where private.field_is_visible(v.other_id, 'availabilities')
       and private.can_see_field(v.other_id, pa.visibility)
       and (pa.available_until is null or pa.available_until >= current_date)
  ),
  per_type as (
    select a.code, a.name, a.sort_order, count(distinct a.other_id) as n
      from avail a group by a.code, a.name, a.sort_order
  )
  select jsonb_build_object(
    'connections',       (select count(*) from visible),
    'promotions',        (select count(distinct v.promotion_id) from visible v
                           where v.promotion_id is not null
                             and private.field_is_visible(v.other_id, 'promotion')),
    'countries',         (select count(distinct v.current_country_code) from visible v
                           where v.current_country_code is not null
                             and private.field_is_visible(v.other_id, 'country')),
    'available_to_help', (select count(distinct a.other_id) from avail a),
    'by_availability',   coalesce((select jsonb_agg(jsonb_build_object(
                                            'code', t.code, 'name', t.name, 'count', t.n)
                                          order by t.n desc, t.sort_order)
                                     from per_type t), '[]'::jsonb),
    'pending_received',  (select count(*) from public.connection_requests r
                           where r.addressee_profile_id = v_me
                             and r.status = 'pending' and r.expires_at > now()),
    'pending_sent',      (select count(*) from public.connection_requests r
                           where r.requester_profile_id = v_me
                             and r.status = 'pending' and r.expires_at > now())
  ) into v_out;

  return v_out;
end
$fn$;

revoke all on function public.my_network_summary() from public, anon;
grant execute on function public.my_network_summary() to authenticated;


-- Liste paginee PAR CURSEUR (D-44) sur `(connected_at DESC, other_id DESC)`.
-- `p_query` filtre sur `normalized_name`, couverte par l'index GIN
-- trigramme `ise_profiles_name_trgm_idx` (0003) : jamais de `ILIKE` non
-- indexe (MASTER PROMPT §85).
create or replace function public.list_my_connections(
  p_query  text default null,
  p_cursor text default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me     uuid := private.current_profile_id();
  v_limit  integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_c_at   timestamptz;
  v_c_id   uuid;
  v_out    jsonb;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select d.c_at, d.c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor) d;

  with page as (
    select x.other_id, x.connected_at, x.context
      from (
        select case when c.profile_a_id = v_me then c.profile_b_id else c.profile_a_id end as other_id,
               c.connected_at,
               c.context
          from public.connections c
         where v_me in (c.profile_a_id, c.profile_b_id)
      ) x
      join public.ise_profiles p on p.id = x.other_id
     where p.deleted_at is null
       and private.can_see_profile(x.other_id)
       and (v_needle is null
            or p.normalized_name like '%' || public.normalize_text(v_needle) || '%')
       and (v_c_at is null or (x.connected_at, x.other_id) < (v_c_at, v_c_id))
     order by x.connected_at desc, x.other_id desc
     limit v_limit
  ),
  cards as (
    select pg.other_id, pg.connected_at, pg.context,
           private.network_profile_card(pg.other_id) as card
      from page pg
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(c.card
               || jsonb_build_object('connected_at', c.connected_at, 'context', c.context)
             order by c.connected_at desc, c.other_id desc)
        from cards c where c.card is not null), '[]'::jsonb),
    'next_cursor', case
      when (select count(*) from page) < v_limit then null
      else (select private.encode_keyset_cursor(pg.connected_at, pg.other_id)
              from page pg order by pg.connected_at asc, pg.other_id asc limit 1)
    end
  ) into v_out;

  return v_out;
end
$fn$;

revoke all on function public.list_my_connections(text, text, integer) from public, anon;
grant execute on function public.list_my_connections(text, text, integer) to authenticated;


-- =====================================================================
-- ISE-041 / ISE-042 — Invitations
-- =====================================================================

create or replace function public.list_connection_requests(
  p_direction text default 'received',
  p_status    text default 'pending',
  p_cursor    text default null,
  p_limit     integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_c_at  timestamptz;
  v_c_id  uuid;
  v_out   jsonb;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_direction is null or p_direction not in ('received', 'sent') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_status is null or p_status not in
     ('pending', 'accepted', 'declined', 'withdrawn', 'expired') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select d.c_at, d.c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor) d;

  with page as (
    select r.id as request_id,
           case when p_direction = 'received'
                then r.requester_profile_id else r.addressee_profile_id end as other_id,
           r.created_at, r.message, r.context, r.status, r.expires_at, r.responded_at
      from public.connection_requests r
     where ((p_direction = 'received' and r.addressee_profile_id = v_me)
         or (p_direction = 'sent'     and r.requester_profile_id = v_me))
       and r.status = p_status
       and (p_status <> 'pending' or r.expires_at > now())
       and (v_c_at is null or (r.created_at, r.id) < (v_c_at, v_c_id))
     order by r.created_at desc, r.id desc
     limit v_limit
  ),
  cards as (
    select pg.request_id, pg.other_id, pg.created_at, pg.message, pg.context,
           pg.status, pg.expires_at, pg.responded_at,
           private.network_profile_card(pg.other_id) as card
      from page pg
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'request_id',   c.request_id,
               'status',       c.status,
               'context',      c.context,
               'message',      c.message,
               'created_at',   c.created_at,
               'expires_at',   c.expires_at,
               'responded_at', c.responded_at,
               'profile',      c.card)
             order by c.created_at desc, c.request_id desc)
        from cards c where c.card is not null), '[]'::jsonb),
    'next_cursor', case
      when (select count(*) from page) < v_limit then null
      else (select private.encode_keyset_cursor(pg.created_at, pg.request_id)
              from page pg order by pg.created_at asc, pg.request_id asc limit 1)
    end
  ) into v_out;

  return v_out;
end
$fn$;

revoke all on function public.list_connection_requests(text, text, text, integer) from public, anon;
grant execute on function public.list_connection_requests(text, text, text, integer) to authenticated;


-- Detail d'une invitation (ISE-042).
--
-- « Liens et points communs » n'utilise que des signaux EXPLICITES
-- (D-43, D-51) : relations communes, promotion commune, organisation
-- commune. Les relations communes sont nommees parce qu'elles sont, par
-- construction, MES propres relations : la reponse ne revele donc rien
-- que le membre ne puisse deja lire. Aucun contenu de message n'est
-- analyse (MASTER PROMPT §24).
create or replace function public.get_connection_request(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me     uuid := private.current_profile_id();
  v_req    public.connection_requests;
  v_other  uuid;
  v_card   jsonb;
  v_mutual jsonb;
  v_org    text;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_req from public.connection_requests where id = p_request_id;
  if not found or v_me not in (v_req.requester_profile_id, v_req.addressee_profile_id) then
    return null;
  end if;

  v_other := case when v_req.addressee_profile_id = v_me
                  then v_req.requester_profile_id else v_req.addressee_profile_id end;

  v_card := private.network_profile_card(v_other);
  if v_card is null then
    return null;
  end if;

  with mine as (
    select case when c.profile_a_id = v_me then c.profile_b_id else c.profile_a_id end as id
      from public.connections c where v_me in (c.profile_a_id, c.profile_b_id)
  ),
  theirs as (
    select case when c.profile_a_id = v_other then c.profile_b_id else c.profile_a_id end as id
      from public.connections c where v_other in (c.profile_a_id, c.profile_b_id)
  ),
  common as (
    select p.id,
           coalesce(p.display_name, concat_ws(' ', p.first_name, p.last_name)) as name
      from mine m
      join theirs t on t.id = m.id
      join public.ise_profiles p on p.id = m.id
     where p.deleted_at is null
     order by 2
     limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', c.id, 'display_name', c.name)
                            order by c.name), '[]'::jsonb)
    into v_mutual
  from common c;

  select o.canonical_name into v_org
    from public.ise_profiles a
    join public.ise_profiles b on b.id = v_other
    join public.organizations o on o.id = a.current_organization_id
   where a.id = v_me
     and a.current_organization_id is not null
     and a.current_organization_id = b.current_organization_id
     and private.field_is_visible(v_other, 'current_organization');

  return jsonb_build_object(
    'request_id',   v_req.id,
    'status',       v_req.status,
    'context',      v_req.context,
    'message',      v_req.message,
    'created_at',   v_req.created_at,
    'expires_at',   v_req.expires_at,
    'responded_at', v_req.responded_at,
    'my_role',      case when v_req.addressee_profile_id = v_me then 'addressee' else 'requester' end,
    'profile',      v_card,
    'common_ground', jsonb_build_object(
      'shares_promotion',    private.shares_promotion_with(v_other),
      'shared_organization', v_org,
      'mutual_connections',  v_mutual)
  );
end
$fn$;

revoke all on function public.get_connection_request(uuid) from public, anon;
grant execute on function public.get_connection_request(uuid) to authenticated;


-- =====================================================================
-- ISE-043 — Chemins d'introduction
-- =====================================================================

-- NOTE DE CONFIDENTIALITE — a lire avant toute modification.
--
-- Cette fonction ne revele AUCUNE relation d'un tiers que le demandeur
-- ne pouvait deja lire. La politique `connections_select` (0021)
-- autorise deja tout membre a lire les lignes de `connections` dont
-- l'un des deux cotes est l'une de ses propres relations. Autrement
-- dit : « ma relation X est aussi en relation avec T » est deja
-- lisible. Le RPC ne fait qu'intersecter MES relations avec celles de
-- la cible, puis ordonner le resultat.
--
-- Ce que la fonction ne fait JAMAIS :
--   * explorer le graphe au-dela du degre 1 (D-51 : un seul
--     intermediaire, `demandeur -> relation directe -> cible`) ;
--   * renvoyer une relation de la cible qui ne soit pas deja une de mes
--     relations — la jointure sur mes propres liens l'interdit
--     structurellement, ce n'est pas un filtre d'affichage ;
--   * analyser le contenu d'un message prive (MASTER PROMPT §24) ;
--   * renvoyer un score numerique (MASTER PROMPT §15, D-42) : seul un
--     LIBELLE qualitatif sort, deduit du nombre de signaux explicites.
--
-- Signaux retenus, tous explicites et structurels (D-51) :
--   `direct_relation`           relation confirmee des deux cotes ;
--   `shared_organization`       meme organisation actuelle que la cible ;
--   `shared_promotion`          meme promotion que la cible ;
--   `introduction_availability` disponibilite declaree « introduction ».
--
-- Libelles (transposition de D-42 : aucun pourcentage, aucun score) :
--   3 signaux ou plus -> `recommended` ; 2 -> `relevant` ; 1 -> `possible`.
-- Un candidat sans aucune raison affichable serait exclu (D-43) ; le cas
-- ne peut pas se produire, `direct_relation` etant toujours present.
create or replace function public.suggest_introduction_paths(
  p_target_profile_id uuid,
  p_limit             integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me     uuid := private.current_profile_id();
  v_limit  integer := least(greatest(coalesce(p_limit, 10), 1), 20);
  v_target jsonb;
  v_paths  jsonb;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_target_profile_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_target_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;

  -- Blocage, suppression et statut : une seule porte, celle de 0021. Un
  -- profil bloque est indistinguable d'un profil inexistant.
  v_target := private.network_profile_card(p_target_profile_id);
  if v_target is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if private.is_connected_to(p_target_profile_id) then
    -- Deja en relation : proposer un intermediaire serait une etape
    -- decorative (MASTER PROMPT §113).
    return jsonb_build_object('target', v_target, 'already_connected', true,
                              'paths', '[]'::jsonb);
  end if;

  with my_links as (
    select case when c.profile_a_id = v_me then c.profile_b_id else c.profile_a_id end as other_id,
           c.connected_at as my_connected_at
      from public.connections c
     where v_me in (c.profile_a_id, c.profile_b_id)
  ),
  target_links as (
    select case when c.profile_a_id = p_target_profile_id
                then c.profile_b_id else c.profile_a_id end as other_id,
           c.connected_at as target_connected_at,
           c.context      as target_context
      from public.connections c
     where p_target_profile_id in (c.profile_a_id, c.profile_b_id)
  ),
  candidates as (
    -- L'intersection EST la garantie structurelle du degre 1 : aucun
    -- profil qui ne soit pas deja MA relation n'entre ici.
    select m.other_id as intermediary_id,
           m.my_connected_at,
           t.target_connected_at,
           t.target_context
      from my_links m
      join target_links t on t.other_id = m.other_id
     where m.other_id <> v_me
       and m.other_id <> p_target_profile_id
  ),
  scored as (
    select c.intermediary_id,
           c.my_connected_at,
           c.target_connected_at,
           c.target_context,
           (p.current_organization_id is not null
            and p.current_organization_id = tp.current_organization_id) as shared_organization,
           (p.promotion_id is not null and p.promotion_id = tp.promotion_id) as shared_promotion,
           exists (
             select 1 from public.profile_availabilities pa
              where pa.profile_id = c.intermediary_id
                and pa.availability_type = 'introduction'
                and pa.active
                and (pa.available_until is null or pa.available_until >= current_date)
           ) as introduction_availability,
           (select r.id from public.introduction_requests r
             where r.requester_profile_id    = v_me
               and r.intermediary_profile_id = c.intermediary_id
               and r.target_profile_id       = p_target_profile_id
               and r.status in ('requested','intermediary_accepted','introduced','target_responded')
             limit 1) as pending_request_id
      from candidates c
      join public.ise_profiles p  on p.id  = c.intermediary_id
      join public.ise_profiles tp on tp.id = p_target_profile_id
     where p.deleted_at is null
       and p.profile_status = 'active'
       and p.claim_status   = 'claimed'
       and not private.is_blocked_between(v_me, c.intermediary_id)
       and not private.is_blocked_between(c.intermediary_id, p_target_profile_id)
  ),
  labelled as (
    select s.*,
           1
           + (case when s.shared_organization then 1 else 0 end)
           + (case when s.shared_promotion then 1 else 0 end)
           + (case when s.introduction_availability then 1 else 0 end) as signal_count
      from scored s
  ),
  top as (
    select l.*, private.network_profile_card(l.intermediary_id) as card
      from labelled l
     order by l.signal_count desc,
              l.target_connected_at desc nulls last,
              l.my_connected_at desc
     limit v_limit
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'intermediary',   t.card,
             'label',          case when t.signal_count >= 3 then 'recommended'
                                    when t.signal_count = 2  then 'relevant'
                                    else 'possible' end,
             'reasons',        to_jsonb(
                                 array_remove(array[
                                   'direct_relation'::text,
                                   case when t.shared_organization then 'shared_organization' end,
                                   case when t.shared_promotion then 'shared_promotion' end,
                                   case when t.introduction_availability
                                        then 'introduction_availability' end
                                 ], null)),
             'connected_since',     t.my_connected_at,
             'target_link_since',   t.target_connected_at,
             'target_link_context', t.target_context,
             'pending_request_id',  t.pending_request_id)
           order by t.signal_count desc,
                    t.target_connected_at desc nulls last,
                    t.my_connected_at desc), '[]'::jsonb)
    into v_paths
  from top t
  where t.card is not null;

  return jsonb_build_object('target', v_target, 'already_connected', false, 'paths', v_paths);
end
$fn$;

revoke all on function public.suggest_introduction_paths(uuid, integer) from public, anon;
grant execute on function public.suggest_introduction_paths(uuid, integer) to authenticated;

comment on function public.suggest_introduction_paths(uuid, integer) is
  'ISE-043. Intersection de MES relations directes avec celles de la cible (D-51, degre 1). Ne revele aucune relation d''un tiers hors de ce que connections_select autorise deja. Aucun score numerique n''est renvoye (MASTER PROMPT 15).';


-- =====================================================================
-- ISE-044 — Demander une introduction
-- =====================================================================

-- SECURITY DEFINER, motif B. La politique `introduction_requests_create`
-- (0021) verifie deja demandeur, blocage, statut initial et
-- `is_connected_to(intermediaire)`. Elle ne peut verifier ni la
-- limitation de debit (D-103) ni le second maillon du chemin —
-- « l'intermediaire est-il vraiment en relation avec la cible ? » —
-- qui est pourtant le cœur de D-51. Les deux sont verifies ici.
create or replace function public.request_introduction(
  p_intermediary_profile_id uuid,
  p_target_profile_id       uuid,
  p_purpose                 text,
  p_message_to_intermediary text,
  p_message_to_target       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_mi text := btrim(coalesce(p_message_to_intermediary, ''));
  v_mt text := nullif(btrim(coalesce(p_message_to_target, '')), '');
  v_id uuid;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_intermediary_profile_id is null or p_target_profile_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_me in (p_intermediary_profile_id, p_target_profile_id)
     or p_intermediary_profile_id = p_target_profile_id then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if p_purpose is null or p_purpose not in
     ('advice','expertise','opportunity','consortium','mentorship','partnership','other') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if length(v_mi) < 20 or length(v_mi) > 1500
     or (v_mt is not null and length(v_mt) > 1500) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if private.network_profile_card(p_target_profile_id) is null
     or private.network_profile_card(p_intermediary_profile_id) is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if private.is_blocked_between(v_me, p_target_profile_id)
     or private.is_blocked_between(v_me, p_intermediary_profile_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  -- D-51, premier maillon : l'intermediaire est MA relation directe.
  if not private.is_connected_to(p_intermediary_profile_id) then
    raise exception 'intermediary_not_connected' using errcode = 'P0001';
  end if;

  -- D-51, second maillon : l'intermediaire connait reellement la cible.
  -- Sans ce controle, une « introduction » pourrait etre demandee a
  -- quelqu'un qui n'a aucun lien avec la personne visee.
  if not exists (
    select 1 from public.connections c
     where (c.profile_a_id, c.profile_b_id) = (
             least(p_intermediary_profile_id, p_target_profile_id),
             greatest(p_intermediary_profile_id, p_target_profile_id))
  ) then
    raise exception 'intermediary_not_connected' using errcode = 'P0001';
  end if;

  if private.is_connected_to(p_target_profile_id) then
    raise exception 'already_connected' using errcode = 'P0001';
  end if;

  perform 1 from public.ise_profiles p where p.id = p_intermediary_profile_id for update;

  if exists (
    select 1 from public.introduction_requests r
     where r.requester_profile_id    = v_me
       and r.intermediary_profile_id = p_intermediary_profile_id
       and r.target_profile_id       = p_target_profile_id
       and r.status in ('requested','intermediary_accepted','introduced','target_responded')
  ) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;

  -- D-103 : 10 demandes d'introduction par jour et par compte.
  if not private.consume_rate_limit(
       coalesce((select auth.uid())::text, v_me::text), 'introduction_request', 10, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.introduction_requests
    (requester_profile_id, intermediary_profile_id, target_profile_id,
     purpose, message_to_intermediary, message_to_target, status)
  values (v_me, p_intermediary_profile_id, p_target_profile_id,
          p_purpose, v_mi, v_mt, 'requested')
  returning id into v_id;

  insert into public.introduction_events
    (introduction_id, event_type, actor_profile_id, to_status)
  values (v_id, 'requested', v_me, 'requested');

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('introduction.requested', 'introduction', v_id, v_me,
          jsonb_build_object('purpose', p_purpose));

  return jsonb_build_object('introduction_id', v_id, 'status', 'requested');
end
$fn$;

revoke all on function public.request_introduction(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.request_introduction(uuid, uuid, text, text, text) to authenticated;


-- =====================================================================
-- ISE-045 / ISE-046 — Suivi et bilan
-- =====================================================================

-- REGLE CARDINALE reprise ici : la cible ne voit RIEN tant que le statut
-- est `requested` ou `intermediary_accepted`. Ce n'est pas un filtre
-- d'affichage, c'est la fonction qui refuse de composer la reponse.
-- Et meme apres `introduced`, la cible ne recoit jamais
-- `message_to_intermediary` : ce texte est adresse a l'intermediaire.
create or replace function public.get_introduction_request(p_introduction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_i    public.introduction_requests;
  v_role text;
  v_out  jsonb;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_i from public.introduction_requests where id = p_introduction_id;
  if not found then
    return null;
  end if;

  v_role := case
              when v_i.requester_profile_id    = v_me then 'requester'
              when v_i.intermediary_profile_id = v_me then 'intermediary'
              when v_i.target_profile_id       = v_me then 'target'
              else null
            end;
  if v_role is null then
    return null;
  end if;

  -- Miroir exact de `introduction_requests_involved` (0021).
  if v_role = 'target'
     and v_i.status not in ('introduced','target_responded','completed','no_outcome') then
    return null;
  end if;

  v_out := jsonb_build_object(
    'introduction_id',           v_i.id,
    'status',                    v_i.status,
    'purpose',                   v_i.purpose,
    'my_role',                   v_role,
    'created_at',                v_i.created_at,
    'expires_at',                v_i.expires_at,
    'intermediary_responded_at', v_i.intermediary_responded_at,
    'introduced_at',             v_i.introduced_at,
    'target_responded_at',       v_i.target_responded_at,
    'completed_at',              v_i.completed_at,
    'outcome',                   v_i.outcome,
    'outcome_note',              v_i.outcome_note,
    'outcome_declared_at',       v_i.outcome_declared_at,
    'outcome_declared_by_role',  case
                                   when v_i.outcome_declared_by is null then null
                                   when v_i.outcome_declared_by = v_i.requester_profile_id then 'requester'
                                   when v_i.outcome_declared_by = v_i.target_profile_id then 'target'
                                   else 'intermediary' end,
    'requester',    private.network_profile_card(v_i.requester_profile_id),
    'intermediary', private.network_profile_card(v_i.intermediary_profile_id),
    'target',       private.network_profile_card(v_i.target_profile_id),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'event_type', e.event_type,
               'to_status',  e.to_status,
               'created_at', e.created_at,
               'actor_role', case
                               when e.actor_profile_id = v_i.requester_profile_id then 'requester'
                               when e.actor_profile_id = v_i.intermediary_profile_id then 'intermediary'
                               when e.actor_profile_id = v_i.target_profile_id then 'target'
                               else 'system' end)
             order by e.created_at)
        from public.introduction_events e
       where e.introduction_id = v_i.id), '[]'::jsonb)
  );

  -- Le contexte adresse a l'intermediaire n'est jamais transmis a la cible.
  if v_role in ('requester', 'intermediary') then
    v_out := v_out || jsonb_build_object(
      'message_to_intermediary', v_i.message_to_intermediary,
      'decline_reason',          v_i.decline_reason);
  end if;
  if v_i.message_to_target is not null
     and (v_role in ('requester', 'intermediary')
          or v_i.status in ('introduced','target_responded','completed','no_outcome')) then
    v_out := v_out || jsonb_build_object('message_to_target', v_i.message_to_target);
  end if;

  return v_out;
end
$fn$;

revoke all on function public.get_introduction_request(uuid) from public, anon;
grant execute on function public.get_introduction_request(uuid) to authenticated;


create or replace function public.list_my_introductions(
  p_scope  text default 'all',
  p_cursor text default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_c_at  timestamptz;
  v_c_id  uuid;
  v_out   jsonb;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('all','requester','intermediary','target') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select d.c_at, d.c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor) d;

  with page as (
    select r.id, r.created_at, r.status, r.purpose,
           case when r.requester_profile_id = v_me then 'requester'
                when r.intermediary_profile_id = v_me then 'intermediary'
                else 'target' end as my_role,
           r.requester_profile_id, r.intermediary_profile_id, r.target_profile_id
      from public.introduction_requests r
     where (
             (p_scope in ('all','requester')    and r.requester_profile_id = v_me)
          or (p_scope in ('all','intermediary') and r.intermediary_profile_id = v_me)
          -- La cible n'entre dans la liste qu'a partir de `introduced`.
          or (p_scope in ('all','target')       and r.target_profile_id = v_me
              and r.status in ('introduced','target_responded','completed','no_outcome'))
           )
       and (v_c_at is null or (r.created_at, r.id) < (v_c_at, v_c_id))
     order by r.created_at desc, r.id desc
     limit v_limit
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'introduction_id', pg.id,
               'status',          pg.status,
               'purpose',         pg.purpose,
               'my_role',         pg.my_role,
               'created_at',      pg.created_at,
               'requester',       private.network_profile_card(pg.requester_profile_id),
               'intermediary',    private.network_profile_card(pg.intermediary_profile_id),
               'target',          private.network_profile_card(pg.target_profile_id))
             order by pg.created_at desc, pg.id desc)
        from page pg), '[]'::jsonb),
    'next_cursor', case
      when (select count(*) from page) < v_limit then null
      else (select private.encode_keyset_cursor(pg.created_at, pg.id)
              from page pg order by pg.created_at asc, pg.id asc limit 1)
    end
  ) into v_out;

  return v_out;
end
$fn$;

revoke all on function public.list_my_introductions(text, text, integer) from public, anon;
grant execute on function public.list_my_introductions(text, text, integer) to authenticated;


-- ISE-046 — Bilan.
--
-- MASTER PROMPT §25 et D-55 : « il est interdit d'ecrire *introduction
-- reussie* quand la seule chose constatee est *intermediaire accepte* ».
-- Ce n'est pas une regle d'affichage : la fonction REFUSE de poser un
-- resultat d'echange tant que `target_responded` n'a pas ete constate,
-- et delegue le changement de statut a
-- `public.transition_introduction()`, seule voie d'ecriture du statut.
create or replace function public.declare_introduction_outcome(
  p_introduction_id uuid,
  p_outcome         text,
  p_note            text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_i    public.introduction_requests;
  v_to   text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_outcome is null or p_outcome not in
     ('exchange_held','collaboration_considered','collaboration_confirmed',
      'referred_to_other_contact','no_response','not_relevant') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if v_note is not null and length(v_note) > 1500 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_i from public.introduction_requests where id = p_introduction_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_me not in (v_i.requester_profile_id, v_i.target_profile_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_to := case
            when p_outcome in ('no_response','not_relevant') then 'no_outcome'
            else 'completed'
          end;

  -- LE garde-fou du §25 : un resultat d'echange suppose un echange.
  -- `intermediary_accepted` ne suffit pas, `introduced` non plus.
  if v_to = 'completed' and v_i.status <> 'target_responded' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  -- D-50 : seul le demandeur peut clore sans suite.
  if v_to = 'no_outcome' and v_me <> v_i.requester_profile_id then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Transition d'etat : fonction atomique de 0006, inchangee. Elle
  -- revalide l'acteur et la matrice D-50, et journalise l'evenement.
  perform public.transition_introduction(p_introduction_id, v_to, v_note);

  update public.introduction_requests
     set outcome             = p_outcome,
         outcome_declared_by = v_me,
         outcome_declared_at = now(),
         outcome_note        = v_note
   where id = p_introduction_id;

  insert into public.introduction_events
    (introduction_id, event_type, actor_profile_id, from_status, to_status, note)
  values (p_introduction_id, 'outcome_declared', v_me, v_i.status, v_to, v_note);

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values (case when v_to = 'completed' then 'introduction.completed'
               else 'introduction.no_outcome' end,
          'introduction', p_introduction_id, v_me,
          jsonb_build_object('outcome', p_outcome));

  return jsonb_build_object('introduction_id', p_introduction_id,
                            'status', v_to, 'outcome', p_outcome);
end
$fn$;

revoke all on function public.declare_introduction_outcome(uuid, text, text) from public, anon;
grant execute on function public.declare_introduction_outcome(uuid, text, text) to authenticated;

comment on function public.declare_introduction_outcome(uuid, text, text) is
  'ISE-046. Refuse tout resultat d''echange tant que target_responded n''est pas constate (MASTER PROMPT 25, D-55). Le statut est change par public.transition_introduction().';
