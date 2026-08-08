-- =====================================================================
-- 0070_promotions_api
--
-- Couche base de donnees du module PROMOTIONS (ISE-067 -> ISE-071).
--
-- Les tables existent depuis 0003 (`promotions`, `promotion_memberships`,
-- `promotion_managers`, `promotion_invitations`) et 0011
-- (`promotion_membership_confirmations`, `promotion_stat_snapshots`,
-- `missing_member_suggestions`, `private.missing_member_contact_hints`).
-- Aucune de ces migrations n'est modifiee ici.
--
-- DEFAUT REEL CONSTATE ET CORRIGE : le module n'avait AUCUNE fonction
-- d'acces. Les ecrans ISE-067 -> ISE-071 n'avaient donc aucun chemin de
-- lecture ni d'ecriture, et `promotion_invitations.token_hash` n'avait
-- aucun producteur : une invitation ne pouvait pas exister.
--
-- REGLES CARDINALES PORTEES ICI ---------------------------------------
--  1. UN ESPACE PROFESSIONNEL, PAS UN RESEAU SOCIAL NOSTALGIQUE
--     (MASTER PROMPT 28). Aucune fonction ne renvoie de compteur de
--     popularite ni de classement entre promotions ([U 10][U 126],
--     CA-PROMO-02).
--  2. L'INDICE DE CONTACT EST UNE DONNEE PERSONNELLE D'UN TIERS
--     (MASTER PROMPT 47, CA-PROMO-04, [F 53][U 59]). Il est ecrit dans
--     `private.missing_member_contact_hints` et n'est projete par AUCUNE
--     fonction de ce fichier. Le camarade qui aide voit qu'une
--     information existe, jamais laquelle. Masquer cote interface
--     aurait laisse la donnee dans la reponse reseau.
--  3. LE JETON D'INVITATION N'EST STOCKE QUE HACHE ([U 110]). Il est
--     renvoye EN CLAIR UNE SEULE FOIS, a l'emetteur, au moment de la
--     creation. Aucune lecture ulterieure ne peut le reconstituer.
--  4. Aucune transition d'etat par politique : toute ecriture passe par
--     les fonctions atomiques ci-dessous.
--
-- References : MASTER PROMPT 15, 28, 43, 47, 64, 71, 98, 113 ; D-42,
--              D-43, D-44, D-93, D-101, D-102, D-103.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Catalogue d'evenements de domaine
-- ---------------------------------------------------------------------
insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('promotion.invitation_created',
   'Une invitation a reclamer un profil reference a ete emise.',        'promotion', 120),
  ('promotion.invitation_revoked',
   'Une invitation de promotion a ete revoquee par son emetteur.',      'promotion', 121),
  ('promotion.missing_member_suggested',
   'Un membre signale un camarade absent de l''annuaire de promotion.', 'promotion', 122)
on conflict (code) do nothing;


-- =====================================================================
-- 1. Helpers d'autorisation
-- =====================================================================

-- Responsable de promotion en mandat actif ([F 60], [U 64]).
-- Un responsable est un animateur : ce helper n'ouvre AUCUNE donnee
-- personnelle, il ouvre les ecrans de mobilisation ([F 64], [U 66]).
create or replace function private.is_promotion_manager(p_promotion bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.promotion_managers m
     where m.promotion_id = p_promotion
       and m.profile_id   = private.current_profile_id()
       and m.active
       and m.starts_at <= now()
       and (m.ends_at is null or m.ends_at > now()));
$$;

revoke all on function private.is_promotion_manager(bigint) from public, anon;
grant execute on function private.is_promotion_manager(bigint) to authenticated, service_role;

comment on function private.is_promotion_manager(bigint) is
  'Responsable de promotion en mandat actif. N''ouvre aucune donnee personnelle ([F 64], [U 66]).';


-- Acces a l'ESPACE d'une promotion : liste des membres, profils a
-- retrouver, invitations. Distinct de la simple lecture d'identite, qui
-- reste ouverte a tout membre actif ([F 95] ; [U 77-79] : l'espace
-- promotion doit pousser vers les autres generations, pas s'y fermer).
create or replace function private.can_see_promotion_space(p_promotion bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member()
     and (private.is_in_promotion(p_promotion)
          or private.has_permission('promotions.manage'));
$$;

revoke all on function private.can_see_promotion_space(bigint) from public, anon;
grant execute on function private.can_see_promotion_space(bigint) to authenticated, service_role;


-- Carte d'un camarade de promotion.
--
-- Deux formes STRICTEMENT differentes selon que le profil est reclame
-- ou non (CA-PROMO-03, [U 33-34]) :
--   * profil reclame   -> carte professionnelle ;
--   * profil reference -> nom, promotion, pays connu. Rien d'autre.
--     Ni e-mail historique, ni telephone, ni note administrative : ces
--     champs vivent dans `private.profile_contacts` et ne sont pas lus.
create or replace function private.promotion_member_card(p_profile uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.claim_status = 'claimed' then
      jsonb_build_object(
        'profile_id',          p.id,
        'display_name',        coalesce(p.display_name, p.first_name || ' ' || p.last_name),
        'is_claimed',          true,
        'is_self',             (p.id = private.current_profile_id()),
        'verification_status', p.verification_status,
        'avatar_path',         p.avatar_path,
        'headline',            p.headline,
        'position',            p.current_position,
        'organization',        coalesce(o.canonical_name, p.current_organization_raw),
        'city',                p.current_city,
        'country_code',        p.current_country_code,
        'country_name',        c.name_fr,
        'skills',              coalesce((
                                 select jsonb_agg(k.name)
                                   from (select s.name
                                           from public.profile_skills ps
                                           join public.skills s on s.id = ps.skill_id
                                          where ps.profile_id = p.id
                                          order by s.name
                                          limit 3) k), '[]'::jsonb),
        'availability_help',   exists (select 1 from public.profile_availabilities a
                                        where a.profile_id = p.id and a.active))
    else
      jsonb_build_object(
        'profile_id',          p.id,
        'display_name',        coalesce(p.display_name, p.first_name || ' ' || p.last_name),
        'is_claimed',          false,
        'is_self',             false,
        'verification_status', p.verification_status,
        'avatar_path',         null,
        'headline',            null,
        'position',            null,
        'organization',        null,
        'city',                null,
        'country_code',        p.current_country_code,
        'country_name',        c.name_fr,
        'skills',              '[]'::jsonb,
        'availability_help',   false)
  end
  from public.ise_profiles p
  left join public.organizations o on o.id = p.current_organization_id
  left join public.countries c on c.code = p.current_country_code
 where p.id = p_profile and p.deleted_at is null;
$$;

revoke all on function private.promotion_member_card(uuid) from public, anon;
grant execute on function private.promotion_member_card(uuid) to authenticated, service_role;

comment on function private.promotion_member_card(uuid) is
  'Carte de camarade. Un profil non reclame reste MINIMAL (CA-PROMO-03) : jamais de coordonnee historique.';


-- =====================================================================
-- 2. ISE-067 — Ma promotion
-- =====================================================================
create or replace function public.get_promotion_overview(p_promotion_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_id    bigint := p_promotion_id;
  v_p     public.promotions;
  v_space boolean;
  v_out   jsonb;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_id is null then
    select promotion_id into v_id from public.ise_profiles where id = v_me;
  end if;
  if v_id is null then
    raise exception 'promotion_not_found' using errcode = 'P0002';
  end if;

  select * into v_p from public.promotions where id = v_id and status <> 'archived';
  if not found then
    raise exception 'promotion_not_found' using errcode = 'P0002';
  end if;

  v_space := private.can_see_promotion_space(v_id);

  -- Identite et chiffres cles : QUATRE indicateurs au maximum ([U 8]).
  -- Aucun taux n'est compare a une autre promotion (CA-PROMO-02).
  v_out := jsonb_build_object(
    'promotion_id',    v_p.id,
    'program_code',    v_p.program_code,
    'graduation_year', v_p.graduation_year,
    'name',            v_p.name,
    'description',     v_p.description,
    'estimated_size',  v_p.estimated_size,
    'is_member',       private.is_in_promotion(v_id),
    'is_manager',      private.is_promotion_manager(v_id),
    'can_manage',      private.has_permission('promotions.manage'),
    'stats', (
      select jsonb_build_object(
        'referenced', count(*),
        'claimed',    count(*) filter (where p.claim_status = 'claimed'),
        'verified',   count(*) filter (where p.verification_status = 'verified'),
        'to_find',    count(*) filter (where p.claim_status <> 'claimed'),
        'countries',  count(distinct p.current_country_code)
                        filter (where p.current_country_code is not null))
        from public.ise_profiles p
       where p.promotion_id = v_id and p.deleted_at is null),
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'profile_id',   mp.id,
               'display_name', coalesce(mp.display_name, mp.first_name || ' ' || mp.last_name),
               'avatar_path',  mp.avatar_path,
               'manager_role', m.manager_role)
             order by m.manager_role, mp.last_name)
        from public.promotion_managers m
        join public.ise_profiles mp on mp.id = m.profile_id and mp.deleted_at is null
       where m.promotion_id = v_id and m.active
         and (m.ends_at is null or m.ends_at > now())), '[]'::jsonb));

  -- Blocs RESERVES aux membres de la promotion et a `promotions.manage`.
  -- Un membre d'une autre promotion ne les recoit pas : ils sont ABSENTS
  -- de la reponse, pas masques a l'affichage (MASTER PROMPT 47).
  if v_space then
    v_out := v_out || jsonb_build_object(
      -- Camarades a (re)decouvrir : 4 cartes ([F 19] « 3 a 5 »).
      'classmates', coalesce((
        select jsonb_agg(private.promotion_member_card(k.id))
          from (select p.id, p.last_active_at, p.last_name
                  from public.ise_profiles p
                 where p.promotion_id = v_id and p.deleted_at is null
                   and p.claim_status = 'claimed' and p.id <> v_me
                   and not private.is_blocked_between(v_me, p.id)
                 order by p.last_active_at desc nulls last, p.last_name
                 limit 4) k), '[]'::jsonb),

      -- Nouvelles de la promotion : MAXIMUM 3 ([F 15][U 19]).
      -- Aucun fil social, aucune reaction ([U 23]).
      'news', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'news_id',      n.id,
                 'title',        n.title,
                 'summary',      n.summary,
                 'published_at', n.published_at))
          from (select n.id, n.title, n.summary, n.published_at
                  from public.news n
                 where n.promotion_id = v_id
                   and n.editorial_status = 'published'
                   and n.deleted_at is null
                 order by n.published_at desc nulls last
                 limit 3) n), '[]'::jsonb),

      -- Prochaine rencontre ([F 16]). Colonnes ENUMEREES : depuis 0046,
      -- `select *` sur `events` echoue avec 42501.
      'next_event', (
        select jsonb_build_object(
                 'event_id',  e.id,
                 'title',     e.title,
                 'starts_at', e.starts_at,
                 'city',      e.city,
                 'format',    e.format)
          from public.events e
         where e.organizer_promotion_id = v_id
           and e.status = 'published'
           and e.deleted_at is null
           and e.starts_at >= now()
         order by e.starts_at
         limit 1),

      -- Profils a retrouver : un NOMBRE, jamais une coordonnee.
      'to_find_count', (
        select count(*) from public.ise_profiles p
         where p.promotion_id = v_id and p.deleted_at is null
           and p.claim_status <> 'claimed'),
      'missing_suggestion_count', (
        select count(*) from public.missing_member_suggestions s
         where s.promotion_id = v_id and s.status in ('submitted','reviewing')));
  else
    v_out := v_out || jsonb_build_object(
      'classmates', null, 'news', null, 'next_event', null,
      'to_find_count', null, 'missing_suggestion_count', null);
  end if;

  return v_out;
end
$fn$;

revoke all on function public.get_promotion_overview(bigint) from public, anon;
grant execute on function public.get_promotion_overview(bigint) to authenticated;

comment on function public.get_promotion_overview(bigint) is
  'ISE-067. Identite et 4 indicateurs pour tout membre actif ; blocs reserves aux membres de la promotion.';


-- =====================================================================
-- 3. ISE-068 — Membres de la promotion (pagination par curseur, D-44)
-- =====================================================================
create or replace function public.list_promotion_members(
  p_promotion_id bigint,
  p_query        text    default null,
  p_country_code char(2) default null,
  p_sector_id    bigint  default null,
  p_skill_id     bigint  default null,
  p_status       text    default 'all',
  p_cursor       text    default null,
  p_limit        integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_at    timestamptz;
  v_cid   uuid;
  v_rows  jsonb;
  v_next  text;
  v_norm  text := nullif(btrim(coalesce(p_query, '')), '');
  v_count integer;
  v_tail_at timestamptz;
  v_tail_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_promotion_space(p_promotion_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('all','claimed','to_find','can_help') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_at, v_cid from private.decode_keyset_cursor(p_cursor);

  -- Une seule requete : la page, son curseur de queue et son cardinal.
  -- `array_agg(... order by asc)[1]` designe la DERNIERE ligne rendue,
  -- puisque la page est ordonnee en decroissant (D-44).
  with page as (
    select p.id, p.created_at
      from public.ise_profiles p
     where p.promotion_id = p_promotion_id
       and p.deleted_at is null
       and not private.is_blocked_between(v_me, p.id)
       and (p_status <> 'claimed'  or p.claim_status = 'claimed')
       and (p_status <> 'to_find'  or p.claim_status <> 'claimed')
       and (p_status <> 'can_help' or exists (select 1 from public.profile_availabilities a
                                               where a.profile_id = p.id and a.active))
       and (p_country_code is null or p.current_country_code = p_country_code)
       and (p_sector_id is null or exists (select 1 from public.profile_sectors ps
                                            where ps.profile_id = p.id and ps.sector_id = p_sector_id))
       and (p_skill_id is null or exists (select 1 from public.profile_skills pk
                                           where pk.profile_id = p.id and pk.skill_id = p_skill_id))
       and (v_norm is null
            or public.normalize_text(coalesce(p.display_name, p.first_name || ' ' || p.last_name))
                 like '%' || public.normalize_text(v_norm) || '%'
            or public.normalize_text(coalesce(p.current_organization_raw, ''))
                 like '%' || public.normalize_text(v_norm) || '%')
       and (v_at is null or (p.created_at, p.id) < (v_at, v_cid))
     order by p.created_at desc, p.id desc
     limit v_limit)
  select coalesce(jsonb_agg(private.promotion_member_card(page.id)
                            order by page.created_at desc, page.id desc), '[]'::jsonb),
         count(*)::integer,
         (array_agg(page.created_at order by page.created_at, page.id))[1],
         (array_agg(page.id order by page.created_at, page.id))[1]
    into v_rows, v_count, v_tail_at, v_tail_id
    from page;

  if v_count = v_limit then
    v_next := private.encode_keyset_cursor(v_tail_at, v_tail_id);
  end if;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', v_next,
    'facets', jsonb_build_object(
      'all',      (select count(*) from public.ise_profiles p
                    where p.promotion_id = p_promotion_id and p.deleted_at is null),
      'claimed',  (select count(*) from public.ise_profiles p
                    where p.promotion_id = p_promotion_id and p.deleted_at is null
                      and p.claim_status = 'claimed'),
      'to_find',  (select count(*) from public.ise_profiles p
                    where p.promotion_id = p_promotion_id and p.deleted_at is null
                      and p.claim_status <> 'claimed'),
      'can_help', (select count(*) from public.ise_profiles p
                    where p.promotion_id = p_promotion_id and p.deleted_at is null
                      and exists (select 1 from public.profile_availabilities a
                                   where a.profile_id = p.id and a.active))));
end
$fn$;

revoke all on function public.list_promotion_members(bigint, text, char, bigint, bigint, text, text, integer) from public, anon;
grant execute on function public.list_promotion_members(bigint, text, char, bigint, bigint, text, text, integer) to authenticated;

comment on function public.list_promotion_members(bigint, text, char, bigint, bigint, text, text, integer) is
  'ISE-068. Reserve aux membres de la promotion et a promotions.manage. Curseur keyset (D-44).';


-- =====================================================================
-- 4. ISE-069 — Profil reference : aider a retrouver un camarade
--
-- CE QUE CETTE FONCTION NE RENVOIE PAS, ET POURQUOI :
--   `private.profile_contacts` et `private.missing_member_contact_hints`
--   ne sont PAS lus. Le camarade qui veut aider apprend qu'une
--   information de contact a ete transmise (`has_contact_hint`), jamais
--   laquelle ([F 53][U 59], CA-PROMO-04).
-- =====================================================================
create or replace function public.get_promotion_referenced_member(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_p  public.ise_profiles;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_p from public.ise_profiles
   where id = p_profile_id and deleted_at is null;
  if not found or v_p.promotion_id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if not private.can_see_promotion_space(v_p.promotion_id) then
    -- Indistinctement absent : un membre d'une autre promotion ne doit
    -- pas pouvoir deduire l'existence d'un profil reference.
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if v_p.claim_status = 'claimed' then
    -- Un profil actif n'est pas « a retrouver » : l'annuaire membre
    -- prend le relais.
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'profile_id',   v_p.id,
    'display_name', coalesce(v_p.display_name, v_p.first_name || ' ' || v_p.last_name),
    'claim_status', v_p.claim_status,
    'promotion', (select jsonb_build_object('promotion_id', pr.id,
                           'program_code', pr.program_code,
                           'graduation_year', pr.graduation_year,
                           'name', pr.name)
                    from public.promotions pr where pr.id = v_p.promotion_id),
    'country_code', v_p.current_country_code,
    'country_name', (select c.name_fr from public.countries c
                      where c.code = v_p.current_country_code),
    'declared_expertise', coalesce((
        select jsonb_agg(s.name order by s.name)
          from public.profile_sectors ps join public.sectors s on s.id = ps.sector_id
         where ps.profile_id = v_p.id), '[]'::jsonb),
    'organization',    v_p.current_organization_raw,
    'last_updated_at', v_p.updated_at,
    'data_quality', jsonb_build_object(
      'promotion',    'confirmed',
      'country',      case when v_p.current_country_code is null then 'missing' else 'to_confirm' end,
      'organization', case when v_p.current_organization_raw is null then 'unknown' else 'to_confirm' end),
    -- Presence d'un indice, JAMAIS son contenu.
    'has_contact_hint', exists (
        select 1 from public.missing_member_suggestions s
          join private.missing_member_contact_hints h on h.suggestion_id = s.id
         where s.matched_profile_id = v_p.id),
    'pending_invitation', (
        select jsonb_build_object('invitation_id', i.id, 'status', i.status,
                                  'expires_at', i.expires_at)
          from public.promotion_invitations i
         where i.profile_id = v_p.id and i.status in ('sent','opened')
           and i.expires_at > now()
         order by i.created_at desc limit 1));
end
$fn$;

revoke all on function public.get_promotion_referenced_member(uuid) from public, anon;
grant execute on function public.get_promotion_referenced_member(uuid) to authenticated;

comment on function public.get_promotion_referenced_member(uuid) is
  'ISE-069. Ne projette JAMAIS un indice de contact : seulement son existence (CA-PROMO-04).';


-- ---------------------------------------------------------------------
-- ISE-069 — signaler un camarade absent de l'annuaire.
--
-- Deduplication AVANT creation ([F 58]) : les homonymes de la promotion
-- sont renvoyes pour que le membre tranche lui-meme. Un ajout par un
-- membre ne cree JAMAIS un ISE verifie ([F 57]).
-- ---------------------------------------------------------------------
create or replace function public.suggest_missing_member(
  p_promotion_id bigint,
  p_first_name   text,
  p_last_name    text,
  p_country_code char(2) default null,
  p_contact_hint text    default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_id   uuid;
  v_dups jsonb;
  v_hint text := nullif(btrim(coalesce(p_contact_hint, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_promotion_space(p_promotion_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_first_name, ''))) = 0
     or length(btrim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not private.consume_rate_limit(v_me::text, 'promotion.missing_member', 10, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id',   p.id,
           'display_name', coalesce(p.display_name, p.first_name || ' ' || p.last_name),
           'claim_status', p.claim_status)), '[]'::jsonb)
    into v_dups
    from public.ise_profiles p
   where p.promotion_id = p_promotion_id and p.deleted_at is null
     and public.normalize_text(p.last_name) = public.normalize_text(p_last_name);

  insert into public.missing_member_suggestions
    (promotion_id, submitted_by_profile_id, first_name, last_name, country_code, status)
  values (p_promotion_id, v_me, btrim(p_first_name), btrim(p_last_name), p_country_code, 'submitted')
  returning id into v_id;

  -- « Les coordonnees doivent rester dans un espace prive approprie »
  -- ([U 111]). Elles n'ont AUCUN chemin de lecture applicatif.
  if v_hint is not null then
    insert into private.missing_member_contact_hints (suggestion_id, contact_hint)
    values (v_id, v_hint);
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('promotion.missing_member_suggested', 'promotion', null, v_me,
          jsonb_build_object('promotion_id', p_promotion_id, 'suggestion_id', v_id));

  return jsonb_build_object(
    'suggestion_id',       v_id,
    'status',              'submitted',
    'contact_hint_stored', v_hint is not null,
    'creates_profile',     false,
    'possible_duplicates', v_dups);
end
$fn$;

revoke all on function public.suggest_missing_member(bigint, text, text, char, text) from public, anon;
grant execute on function public.suggest_missing_member(bigint, text, text, char, text) to authenticated;

comment on function public.suggest_missing_member(bigint, text, text, char, text) is
  'ISE-069. L''indice de contact part en schema private et n''est projete nulle part ([U 111]).';


-- =====================================================================
-- 5. ISE-070 — Inviter un camarade a reclamer SON profil
-- =====================================================================
create or replace function public.create_promotion_invitation(
  p_profile_id uuid,
  p_channel    text default 'link',
  p_email      text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_p     public.ise_profiles;
  v_token text;
  v_id    uuid;
  v_exp   timestamptz := now() + interval '14 days';
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_channel not in ('link','email') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_p from public.ise_profiles where id = p_profile_id and deleted_at is null;
  if not found or v_p.promotion_id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if not private.can_see_promotion_space(v_p.promotion_id) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if v_p.claim_status = 'claimed' then
    raise exception 'profile_already_claimed' using errcode = 'P0001';
  end if;
  if v_p.id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  -- Anti-spam ([F 66][U 94]) : une promotion ne se relance pas en boucle.
  if not private.consume_rate_limit(v_me::text, 'promotion.invitation', 20, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.promotion_invitations i
              where i.profile_id = p_profile_id
                and i.status in ('sent','opened') and i.expires_at > now()) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.promotion_invitations
    (promotion_id, profile_id, invited_email_hash, inviter_profile_id,
     token_hash, status, expires_at)
  values (v_p.promotion_id, p_profile_id,
          case when nullif(btrim(coalesce(p_email, '')), '') is null then null
               else encode(extensions.digest(lower(btrim(p_email)), 'sha256'), 'hex') end,
          v_me,
          encode(extensions.digest(v_token, 'sha256'), 'hex'),
          'sent', v_exp)
  returning id into v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('promotion.invitation_created', 'promotion', null, v_me,
          jsonb_build_object('invitation_id', v_id, 'promotion_id', v_p.promotion_id,
                             'channel', p_channel));

  return jsonb_build_object(
    'invitation_id',   v_id,
    'channel',         p_channel,
    'expires_at',      v_exp,
    -- Unique et derniere apparition du jeton en clair ([U 110]).
    'token',           v_token,
    -- L'invitation ne cree AUCUN compte : la personne invitee decide.
    'creates_account', false);
end
$fn$;

revoke all on function public.create_promotion_invitation(uuid, text, text) from public, anon;
grant execute on function public.create_promotion_invitation(uuid, text, text) to authenticated;

comment on function public.create_promotion_invitation(uuid, text, text) is
  'ISE-070. Jeton renvoye une seule fois, hachage seul conserve ([U 110]). Expiration 14 jours.';


create or replace function public.revoke_promotion_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_i  public.promotion_invitations;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_i from public.promotion_invitations
   where id = p_invitation_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_i.inviter_profile_id <> v_me
     and not private.is_promotion_manager(v_i.promotion_id)
     and not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_i.status not in ('sent','opened') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.promotion_invitations set status = 'revoked' where id = p_invitation_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('promotion.invitation_revoked', 'promotion', null, v_me,
          jsonb_build_object('invitation_id', p_invitation_id));

  return jsonb_build_object('invitation_id', p_invitation_id, 'status', 'revoked');
end
$fn$;

revoke all on function public.revoke_promotion_invitation(uuid) from public, anon;
grant execute on function public.revoke_promotion_invitation(uuid) to authenticated;


-- =====================================================================
-- 6. ISE-071 — Suivi des invitations
--
-- Le suivi montre un ETAT, jamais une coordonnee : ni l'adresse
-- destinataire (seul son hachage existe en base), ni le jeton.
-- =====================================================================
create or replace function public.list_promotion_invitations(
  p_promotion_id bigint,
  p_scope        text    default 'to_follow',
  p_cursor       text    default null,
  p_limit        integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_at    timestamptz;
  v_cid   uuid;
  v_rows  jsonb;
  v_next  text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_promotion_space(p_promotion_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_scope not in ('to_follow','claimed','to_find','all') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_at, v_cid from private.decode_keyset_cursor(p_cursor);

  with rows_cte as (
    select p.id, p.created_at,
           coalesce(p.display_name, p.first_name || ' ' || p.last_name) as display_name,
           p.claim_status,
           i.id           as invitation_id,
           i.status       as invitation_status,
           i.expires_at, i.opened_at, i.claimed_at,
           i.created_at   as invited_at,
           (i.invited_email_hash is not null) as by_email
      from public.ise_profiles p
      left join lateral (
             select x.id, x.status, x.expires_at, x.opened_at, x.claimed_at,
                    x.created_at, x.invited_email_hash
               from public.promotion_invitations x
              where x.profile_id = p.id
              order by x.created_at desc limit 1) i on true
     where p.promotion_id = p_promotion_id
       and p.deleted_at is null
       and (p_scope <> 'claimed'   or p.claim_status = 'claimed')
       and (p_scope <> 'to_find'   or (p.claim_status <> 'claimed' and i.id is null))
       and (p_scope <> 'to_follow' or p.claim_status <> 'claimed')
       and (v_at is null or (p.created_at, p.id) < (v_at, v_cid))
     order by p.created_at desc, p.id desc
     limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id',        r.id,
           'display_name',      r.display_name,
           'claim_status',      r.claim_status,
           'invitation_id',     r.invitation_id,
           'invitation_status', case
                                  when r.invitation_id is null then 'none'
                                  when r.invitation_status in ('sent','opened')
                                       and r.expires_at <= now() then 'expired'
                                  else r.invitation_status end,
           'channel',           case when r.invitation_id is null then null
                                     when r.by_email then 'email' else 'link' end,
           'last_action_at',    coalesce(r.claimed_at, r.opened_at, r.invited_at),
           'expires_at',        r.expires_at)
           order by r.created_at desc, r.id desc), '[]'::jsonb)
    into v_rows
    from rows_cte r;

  if jsonb_array_length(v_rows) = v_limit then
    select private.encode_keyset_cursor(p.created_at, p.id) into v_next
      from public.ise_profiles p
     where p.id = ((v_rows -> (v_limit - 1)) ->> 'profile_id')::uuid;
  end if;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', v_next,
    'summary', (
      select jsonb_build_object(
        'to_find',   count(*) filter (where p.claim_status <> 'claimed'),
        'sent',      (select count(*) from public.promotion_invitations i
                       where i.promotion_id = p_promotion_id
                         and i.status in ('sent','opened')),
        'opened',    (select count(*) from public.promotion_invitations i
                       where i.promotion_id = p_promotion_id and i.status = 'opened'),
        'claimed',   count(*) filter (where p.claim_status = 'claimed'),
        'estimated', (select pr.estimated_size from public.promotions pr
                       where pr.id = p_promotion_id))
        from public.ise_profiles p
       where p.promotion_id = p_promotion_id and p.deleted_at is null));
end
$fn$;

revoke all on function public.list_promotion_invitations(bigint, text, text, integer) from public, anon;
grant execute on function public.list_promotion_invitations(bigint, text, text, integer) to authenticated;

comment on function public.list_promotion_invitations(bigint, text, text, integer) is
  'ISE-071. Etats d''invitation seulement : ni adresse destinataire, ni jeton. Curseur keyset (D-44).';
