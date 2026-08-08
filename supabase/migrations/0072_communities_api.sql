-- =====================================================================
-- 0072_communities_api
--
-- Couche base de donnees de la tranche COMMUNAUTES (ISE-084 -> ISE-087).
--
-- Les tables existent depuis 0011, les politiques depuis 0044. Aucune de
-- ces deux migrations n'est modifiee ici.
--
-- CE QUE CETTE MIGRATION N'AJOUTE PAS, ET POURQUOI
--   * aucun compteur de vues, aucun « like », aucune reaction, aucun
--     classement de communautes ni de membres. MASTER PROMPT 1 et
--     DIGEST D 4.7 l'interdisent explicitement ; l'onglet « Pour moi »
--     trie sur une pertinence INTERNE qui n'est jamais renvoyee, et les
--     seules valeurs affichables sont des faits (nombre de membres,
--     date de la derniere publication) ;
--   * aucune creation de communaute par un membre : DIGEST D 4.7 la
--     reserve a l'administration en V1. `communities_create` (0044)
--     limite deja l'insertion au statut `draft` ; aucune fonction ne
--     l'expose ici ;
--   * aucune promotion de role : `join_community` impose
--     `role = 'member'` (cas C10 de 0009).
--
-- CE QU'ELLE AJOUTE
--   1. Trois colonnes de cloture sur `community_posts` (ISE-087).
--   2. `private.community_card`, `private.community_post_card`,
--      `private.community_match_reasons` — projections communes.
--   3. Lectures paginees PAR CURSEUR (D-44).
--   4. Ecritures atomiques : adhesion, depart, preferences de
--      notification, publication, commentaire, marquage « reponse
--      utile », cloture avec synthese.
--   5. Garde anti-spam et anti-hors-sujet : limitation de debit et
--      detection du cross-posting a l'identique.
--
-- References : MASTER PROMPT 1, 9, 15, 16, 27, 43, 53, 64, 98, 100,
--              101, 113 ; D-44, D-53, D-73, D-93, D-101, D-102, D-103,
--              D-126 ; docs/rls.md 10.5.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Cloture d'une publication (ISE-087)
--
-- La maquette « Suivi de ma publication » propose de publier une
-- synthese et de cloturer la discussion. Aucune colonne ne portait ce
-- fait : sans elle, le bouton aurait ete decoratif (MASTER PROMPT 113).
-- Trois colonnes additives, aucune contrainte existante modifiee.
-- ---------------------------------------------------------------------
alter table public.community_posts
  add column if not exists resolution_summary     text,
  add column if not exists resolved_at            timestamptz,
  add column if not exists resolved_by_profile_id uuid references public.ise_profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.community_posts'::regclass
      and conname = 'community_posts_resolution_coherence'
  ) then
    alter table public.community_posts
      add constraint community_posts_resolution_coherence
      check ((resolved_at is null) = (resolved_by_profile_id is null));
  end if;
end
$$;

comment on column public.community_posts.resolution_summary is
  'Synthese publiee par l''auteur a la cloture de sa publication (ISE-087). Trace utile pour les futurs membres, jamais une note de reputation.';

create index if not exists community_posts_community_published_idx
  on public.community_posts (community_id, published_at desc, id desc)
  where deleted_at is null;

create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at, id);

create index if not exists community_memberships_profile_status_idx
  on public.community_memberships (profile_id, membership_status);


-- ---------------------------------------------------------------------
-- 0 bis. Catalogue d'evenements de domaine
-- ---------------------------------------------------------------------
insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('community.joined',
   'Un membre a rejoint une communaute (ou en a demande l''adhesion).', 'community', 110),
  ('community.left',
   'Un membre a quitte une communaute.',                                'community', 111),
  ('community.post_created',
   'Une publication a ete creee dans une communaute.',                  'community', 112),
  ('community.comment_created',
   'Une reponse a ete ajoutee a une publication de communaute.',        'community', 113),
  ('community.post_resolved',
   'L''auteur a publie une synthese et cloture sa publication.',        'community', 114)
on conflict (code) do nothing;


-- =====================================================================
-- 1. Projections communes
-- =====================================================================

-- ---------------------------------------------------------------------
-- private.community_match_reasons(p_community)
--
-- Explication OBLIGATOIRE d'une recommandation (CA-COMM-02, D-43). Ne
-- renvoie que des faits verifiables par la personne : une competence
-- qu'elle a declaree, un secteur, un pays, des relations deja presentes.
-- Aucun score n'est renvoye ; la ponderation deterministe (competences
-- 40 / secteur 30 / pays 20 / relations 10, DIGEST D 4.7) ne sert
-- qu'a ordonner.
-- ---------------------------------------------------------------------
create or replace function private.community_match_reasons(p_community uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select private.current_profile_id() as id),
  c as (
    select co.community_type, co.country_code, co.sector_id, co.skill_domain_id
    from public.communities co where co.id = p_community
  )
  select coalesce(jsonb_agg(r.reason order by r.rank), '[]'::jsonb)
  from (
    select 1 as rank,
           jsonb_build_object(
             'code',  'skill_domain',
             'label', (select d.name from public.skill_domains d
                        join c on c.skill_domain_id = d.id),
             'detail', (select s.name
                          from public.profile_skills ps
                          join public.skills s           on s.id = ps.skill_id
                          join public.skill_categories k on k.id = s.category_id
                          join c on c.skill_domain_id = k.domain_id
                         where ps.profile_id = (select id from me)
                         order by ps.is_primary desc, s.name
                         limit 1)) as reason
    where exists (select 1
                    from public.profile_skills ps
                    join public.skills s           on s.id = ps.skill_id
                    join public.skill_categories k on k.id = s.category_id
                    join c on c.skill_domain_id = k.domain_id
                   where ps.profile_id = (select id from me))

    union all
    select 2,
           jsonb_build_object(
             'code',  'sector',
             'label', (select se.name from public.sectors se join c on c.sector_id = se.id),
             'detail', null)
    where exists (select 1 from public.profile_sectors ps
                  join c on c.sector_id = ps.sector_id
                  where ps.profile_id = (select id from me))

    union all
    select 3,
           jsonb_build_object(
             'code',  'country',
             'label', (select co.name_fr from public.countries co join c on co.code = c.country_code),
             'detail', null)
    where exists (
      select 1 from c
      where c.country_code is not null
        and (exists (select 1 from public.profile_geographies g
                      where g.profile_id = (select id from me)
                        and g.country_code = c.country_code)
             or exists (select 1 from public.ise_profiles p
                         where p.id = (select id from me)
                           and p.current_country_code = c.country_code))
    )

    union all
    select 4,
           jsonb_build_object('code', 'connections', 'label', null,
             'detail', (select count(*)::text
                          from public.community_memberships m
                          join public.connections cn
                            on (cn.profile_a_id = m.profile_id and cn.profile_b_id = (select id from me))
                            or (cn.profile_b_id = m.profile_id and cn.profile_a_id = (select id from me))
                         where m.community_id = p_community
                           and m.membership_status = 'active'))
    where exists (
      select 1 from public.community_memberships m
      join public.connections cn
        on (cn.profile_a_id = m.profile_id and cn.profile_b_id = (select id from me))
        or (cn.profile_b_id = m.profile_id and cn.profile_a_id = (select id from me))
      where m.community_id = p_community and m.membership_status = 'active')
  ) r
$$;

revoke all on function private.community_match_reasons(uuid) from public, anon, authenticated;
comment on function private.community_match_reasons(uuid) is
  'Raisons explicites d''une recommandation de communaute (CA-COMM-02). Aucun score n''en sort.';


-- ---------------------------------------------------------------------
-- private.community_card(p_community, p_full)
--
-- SECURITY DEFINER, motif A (docs/rls.md 4) : lit `ise_profiles` pour
-- les animateurs, dont les privileges de colonne sont retires depuis
-- 0028. Renvoie `null` si la communaute n'est pas visible.
-- ---------------------------------------------------------------------
create or replace function private.community_card(
  p_community uuid,
  p_full      boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_row  record;
  v_mine record;
  v_out  jsonb;
begin
  if p_community is null or not private.can_see_community(p_community) then
    return null;
  end if;

  select c.id, c.name, c.slug, c.description, c.purpose, c.charter_text,
         c.community_type, c.country_code, c.sector_id, c.skill_domain_id,
         c.visibility, c.join_policy, c.post_moderation_mode, c.status,
         c.created_at
    into v_row
  from public.communities c
  where c.id = p_community and c.deleted_at is null;

  if not found then return null; end if;

  select m.role, m.membership_status, m.notification_level, m.digest_frequency
    into v_mine
  from public.community_memberships m
  where m.community_id = p_community and m.profile_id = v_me;

  v_out := jsonb_build_object(
    'community_id',    v_row.id,
    'name',            v_row.name,
    'slug',            v_row.slug,
    'description',     v_row.description,
    'community_type',  v_row.community_type,
    'visibility',      v_row.visibility,
    'join_policy',     v_row.join_policy,
    'status',          v_row.status,
    -- Fait, pas indicateur de popularite : la maquette ISE-084 affiche
    -- « 286 membres ». Aucun classement n'est construit dessus.
    'member_count',    (select count(*) from public.community_memberships m
                         where m.community_id = p_community and m.membership_status = 'active'),
    'type_label',      case v_row.community_type
                         when 'country'  then (select co.name_fr from public.countries co
                                                where co.code = v_row.country_code)
                         when 'sector'   then (select se.name from public.sectors se
                                                where se.id = v_row.sector_id)
                         when 'thematic' then (select d.name from public.skill_domains d
                                                where d.id = v_row.skill_domain_id)
                         else null
                       end,
    'country_code',    v_row.country_code,
    'membership',      case when v_mine.membership_status is null then null
                            else jsonb_build_object(
                              'status',             v_mine.membership_status,
                              'role',               v_mine.role,
                              'notification_level', v_mine.notification_level,
                              'digest_frequency',   v_mine.digest_frequency)
                       end,
    'is_member',       private.is_community_member(p_community),
    'is_moderator',    private.is_community_moderator(p_community),
    -- « Derniere activite utile » (DIGEST D 4.9 U 8) : la date de la
    -- derniere publication reellement publiee, rien d'autre.
    'last_activity_at', (select max(p.published_at) from public.community_posts p
                          where p.community_id = p_community
                            and p.status = 'published' and p.deleted_at is null),
    'last_topic',      (select p.title from public.community_posts p
                         where p.community_id = p_community
                           and p.status = 'published' and p.deleted_at is null
                         order by p.published_at desc, p.id desc limit 1),
    'open_question_count', (select count(*) from public.community_posts p
                             where p.community_id = p_community
                               and p.status = 'published' and p.deleted_at is null
                               and p.post_type = 'question' and p.resolved_at is null)
  );

  if not p_full then
    return v_out;
  end if;

  v_out := v_out || jsonb_build_object(
    'purpose',              v_row.purpose,
    'charter_text',         v_row.charter_text,
    'post_moderation_mode', v_row.post_moderation_mode,
    'created_at',           v_row.created_at,
    -- Statistiques factuelles de l'encart « La communaute en bref ».
    'stats', jsonb_build_object(
      'members',          (select count(*) from public.community_memberships m
                            where m.community_id = p_community and m.membership_status = 'active'),
      'active_30d',       (select count(distinct p.author_profile_id) from public.community_posts p
                            where p.community_id = p_community and p.status = 'published'
                              and p.deleted_at is null and p.published_at >= now() - interval '30 days'),
      'open_discussions', (select count(*) from public.community_posts p
                            where p.community_id = p_community and p.status = 'published'
                              and p.deleted_at is null and p.resolved_at is null),
      'expertise_calls',  (select count(*) from public.community_posts p
                            where p.community_id = p_community and p.status = 'published'
                              and p.deleted_at is null and p.post_type = 'question'
                              and p.resolved_at is null),
      'countries',        (select count(distinct pr.current_country_code)
                             from public.community_memberships m
                             join public.ise_profiles pr on pr.id = m.profile_id
                            where m.community_id = p_community and m.membership_status = 'active'
                              and pr.current_country_code is not null),
      'promotions',       (select count(distinct pr.promotion_id)
                             from public.community_memberships m
                             join public.ise_profiles pr on pr.id = m.profile_id
                            where m.community_id = p_community and m.membership_status = 'active'
                              and pr.promotion_id is not null)),
    -- « 2 animateurs » : affichage discret, sans hierarchie (U 30).
    'moderators', coalesce((
      select jsonb_agg(private.network_profile_card(m.profile_id) || jsonb_build_object('community_role', m.role)
                       order by m.joined_at)
        from public.community_memberships m
       where m.community_id = p_community
         and m.membership_status = 'active'
         and m.role in ('moderator', 'manager')
         and private.network_profile_card(m.profile_id) is not null), '[]'::jsonb),
    -- « Membres que vous connaissez » : uniquement des relations
    -- confirmees, jamais une suggestion inventee.
    'known_members', coalesce((
      select jsonb_agg(x.card order by x.at desc)
        from (
          select private.network_profile_card(m.profile_id) as card, m.joined_at as at
            from public.community_memberships m
            join public.connections cn
              on (cn.profile_a_id = m.profile_id and cn.profile_b_id = v_me)
              or (cn.profile_b_id = m.profile_id and cn.profile_a_id = v_me)
           where m.community_id = p_community
             and m.membership_status = 'active'
           order by m.joined_at desc
           limit 4
        ) x
       where x.card is not null), '[]'::jsonb),
    'known_member_count', (select count(*) from public.community_memberships m
                            join public.connections cn
                              on (cn.profile_a_id = m.profile_id and cn.profile_b_id = v_me)
                              or (cn.profile_b_id = m.profile_id and cn.profile_a_id = v_me)
                           where m.community_id = p_community and m.membership_status = 'active'),
    -- Expertises de la communaute : tags reellement portes par les
    -- publications, jamais un « top experts » (U 67-68).
    'expertise', coalesce((
      select jsonb_agg(t.name order by t.n desc, t.name)
        from (select s.name, count(*) as n
                from public.community_post_skills cs
                join public.community_posts p on p.id = cs.post_id
                join public.skills s          on s.id = cs.skill_id
               where p.community_id = p_community
                 and p.status = 'published' and p.deleted_at is null
               group by s.name
               order by count(*) desc, s.name
               limit 8) t), '[]'::jsonb)
  );

  return v_out;
end
$fn$;

revoke all on function private.community_card(uuid, boolean) from public, anon, authenticated;
comment on function private.community_card(uuid, boolean) is
  'Projection d''une communaute. Aucun compteur de vues, aucun score, aucun classement (MASTER PROMPT 1).';


-- ---------------------------------------------------------------------
-- private.community_post_card(p_post, p_full)
-- ---------------------------------------------------------------------
create or replace function private.community_post_card(
  p_post uuid,
  p_full boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_row record;
  v_out jsonb;
begin
  if p_post is null or not private.can_see_community_post(p_post) then
    return null;
  end if;

  select p.id, p.community_id, p.author_profile_id, p.post_type, p.title, p.body,
         p.visibility, p.status, p.referenced_entity_type, p.referenced_entity_id,
         p.is_locked, p.published_at, p.created_at,
         p.resolution_summary, p.resolved_at,
         c.name as community_name
    into v_row
  from public.community_posts p
  join public.communities c on c.id = p.community_id
  where p.id = p_post;

  if not found then return null; end if;

  v_out := jsonb_build_object(
    'post_id',        v_row.id,
    'community_id',   v_row.community_id,
    'community_name', v_row.community_name,
    'post_type',      v_row.post_type,
    'title',          v_row.title,
    'visibility',     v_row.visibility,
    'status',         v_row.status,
    'is_locked',      v_row.is_locked,
    'is_author',      (v_row.author_profile_id = v_me),
    'is_resolved',    (v_row.resolved_at is not null),
    'published_at',   v_row.published_at,
    'created_at',     v_row.created_at,
    'author',         private.network_profile_card(v_row.author_profile_id),
    'reply_count',    (select count(*) from public.community_comments k
                        where k.post_id = p_post and k.status = 'published' and k.deleted_at is null),
    'helpful_count',  (select count(*) from public.community_comments k
                        where k.post_id = p_post and k.status = 'published'
                          and k.deleted_at is null and k.marked_helpful_at is not null),
    'skills',         coalesce((select jsonb_agg(s.name order by s.name)
                                  from public.community_post_skills cs
                                  join public.skills s on s.id = cs.skill_id
                                 where cs.post_id = p_post), '[]'::jsonb),
    'referenced',     case when v_row.referenced_entity_type is null then null
                           else jsonb_build_object('type', v_row.referenced_entity_type,
                                                   'id',   v_row.referenced_entity_id)
                      end
  );

  if p_full then
    v_out := v_out || jsonb_build_object(
      'body',               v_row.body,
      'resolution_summary', v_row.resolution_summary,
      'resolved_at',        v_row.resolved_at);
  end if;

  return v_out;
end
$fn$;

revoke all on function private.community_post_card(uuid, boolean) from public, anon, authenticated;


-- =====================================================================
-- 2. Lectures
-- =====================================================================

-- ---------------------------------------------------------------------
-- ISE-084 — public.list_communities
--
-- Quatre onglets : « Pour moi » (recommandations expliquees),
-- « Toutes », « Mes communautes », « Nouvelles ».
-- « Pour moi » ordonne sur une pertinence interne (curseur de score,
-- chiffre par l'application avant d'atteindre le navigateur) ; les
-- autres onglets sur un curseur keyset chronologique (D-44).
-- ---------------------------------------------------------------------
create or replace function public.list_communities(
  p_scope          text     default 'for_me',
  p_query          text     default null,
  p_community_type text     default null,
  p_country_code   char(2)  default null,
  p_sector_id      bigint   default null,
  p_cursor         text     default null,
  p_limit          integer  default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid    := private.current_profile_id();
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope   text    := coalesce(p_scope, 'for_me');
  v_q       text    := nullif(btrim(coalesce(p_query, '')), '');
  v_rows    jsonb   := '[]'::jsonb;
  v_next    text;
  v_c_at    timestamptz;
  v_c_id    uuid;
  v_c_score numeric;
  v_c_sid   uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_scope not in ('for_me', 'all', 'mine', 'new') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  if v_scope = 'for_me' then
    select c_score, c_id into v_c_score, v_c_sid from private.decode_score_cursor(p_cursor);

    with scored as (
      select c.id,
             -- Ponderation deterministe DIGEST D 4.7 (somme 100).
             ( case when exists (select 1
                                   from public.profile_skills ps
                                   join public.skills s           on s.id = ps.skill_id
                                   join public.skill_categories k on k.id = s.category_id
                                  where ps.profile_id = v_me and k.domain_id = c.skill_domain_id)
                    then 40 else 0 end
             + case when exists (select 1 from public.profile_sectors ps
                                  where ps.profile_id = v_me and ps.sector_id = c.sector_id)
                    then 30 else 0 end
             + case when c.country_code is not null
                     and (exists (select 1 from public.profile_geographies g
                                   where g.profile_id = v_me and g.country_code = c.country_code)
                          or exists (select 1 from public.ise_profiles p
                                      where p.id = v_me and p.current_country_code = c.country_code))
                    then 20 else 0 end
             + case when exists (select 1
                                   from public.community_memberships m
                                   join public.connections cn
                                     on (cn.profile_a_id = m.profile_id and cn.profile_b_id = v_me)
                                     or (cn.profile_b_id = m.profile_id and cn.profile_a_id = v_me)
                                  where m.community_id = c.id and m.membership_status = 'active')
                    then 10 else 0 end )::numeric as score
        from public.communities c
       where c.deleted_at is null
         and c.status = 'active'
         and private.can_see_community(c.id)
         and not exists (select 1 from public.community_memberships m
                          where m.community_id = c.id and m.profile_id = v_me
                            and m.membership_status in ('active', 'pending'))
    ),
    base as (
      select s.id, s.score
        from scored s
       where s.score > 0
         and (v_c_score is null or (s.score, s.id) < (v_c_score, v_c_sid))
       order by s.score desc, s.id desc
       limit v_limit
    )
    select coalesce(jsonb_agg(private.community_card(b.id, false)
                              || jsonb_build_object('reasons', private.community_match_reasons(b.id))
                              order by b.score desc, b.id desc), '[]'::jsonb),
           private.encode_score_cursor(min(b.score), (array_agg(b.id order by b.score, b.id))[1])
      into v_rows, v_next
    from base b;

  else
    select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

    with base as (
      select c.id, c.created_at as at
        from public.communities c
       where c.deleted_at is null
         and private.can_see_community(c.id)
         and (v_scope <> 'mine' or exists (
               select 1 from public.community_memberships m
                where m.community_id = c.id and m.profile_id = v_me
                  and m.membership_status in ('active', 'pending')))
         and (v_scope <> 'new' or c.created_at >= now() - interval '90 days')
         and (v_scope = 'mine' or c.status = 'active')
         and (p_community_type is null or c.community_type = p_community_type)
         and (p_country_code is null or c.country_code = p_country_code)
         and (p_sector_id is null or c.sector_id = p_sector_id)
         and (v_q is null
              or c.name ilike '%' || v_q || '%'
              or c.description ilike '%' || v_q || '%')
         and (v_c_at is null or (c.created_at, c.id) < (v_c_at, v_c_id))
       order by c.created_at desc, c.id desc
       limit v_limit
    )
    select coalesce(jsonb_agg(private.community_card(b.id, false)
                              || jsonb_build_object('reasons', private.community_match_reasons(b.id))
                              order by b.at desc, b.id desc), '[]'::jsonb),
           private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
      into v_rows, v_next
    from base b;
  end if;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_communities(text, text, text, char(2), bigint, text, integer) from public, anon;
grant execute on function public.list_communities(text, text, text, char(2), bigint, text, integer) to authenticated;
comment on function public.list_communities(text, text, text, char(2), bigint, text, integer) is
  'ISE-084. « Pour moi » ordonne sur une pertinence interne jamais renvoyee ; chaque ligne porte ses raisons (CA-COMM-02).';


-- ISE-085 — fiche complete d'une communaute.
create or replace function public.get_community(p_community uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.community_card(p_community, true)
$$;

revoke all on function public.get_community(uuid) from public, anon;
grant execute on function public.get_community(uuid) to authenticated;


-- ISE-085 — fil de la communaute, pagine par curseur.
create or replace function public.list_community_posts(
  p_community uuid,
  p_post_type text    default null,
  p_query     text    default null,
  p_cursor    text    default null,
  p_limit     integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid    := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q     text    := nullif(btrim(coalesce(p_query, '')), '');
  v_rows  jsonb   := '[]'::jsonb;
  v_next  text;
  v_c_at  timestamptz;
  v_c_id  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_community(p_community) then
    raise exception 'community_not_visible' using errcode = '42501';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select p.id, coalesce(p.published_at, p.created_at) as at
      from public.community_posts p
     where p.community_id = p_community
       and private.can_see_community_post(p.id)
       and p.status = 'published'
       and p.deleted_at is null
       and (p_post_type is null or p.post_type = p_post_type)
       and (v_q is null or p.title ilike '%' || v_q || '%' or p.body ilike '%' || v_q || '%')
       and (v_c_at is null or (coalesce(p.published_at, p.created_at), p.id) < (v_c_at, v_c_id))
     order by coalesce(p.published_at, p.created_at) desc, p.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(private.community_post_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_community_posts(uuid, text, text, text, integer) from public, anon;
grant execute on function public.list_community_posts(uuid, text, text, text, integer) to authenticated;


-- ISE-085 — membres de la communaute (onglet « Membres »).
create or replace function public.list_community_members(
  p_community uuid,
  p_query     text    default null,
  p_cursor    text    default null,
  p_limit     integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid    := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q     text    := nullif(btrim(coalesce(p_query, '')), '');
  v_rows  jsonb   := '[]'::jsonb;
  v_next  text;
  v_c_at  timestamptz;
  v_c_id  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- La liste des membres n'est ouverte qu'aux membres : une communaute
  -- ouverte au reseau expose sa FICHE, pas son annuaire (docs/rls.md 10.5).
  if not private.is_community_member(p_community) then
    raise exception 'members_reserved_to_members' using errcode = '42501';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select m.id as mid, m.profile_id, m.role, coalesce(m.joined_at, m.created_at) as at
      from public.community_memberships m
      join public.ise_profiles p on p.id = m.profile_id
     where m.community_id = p_community
       and m.membership_status = 'active'
       and p.deleted_at is null
       and not private.is_blocked_between(m.profile_id, v_me)
       and (v_q is null
            or coalesce(p.display_name, concat_ws(' ', p.first_name, p.last_name)) ilike '%' || v_q || '%'
            or coalesce(p.current_position, '') ilike '%' || v_q || '%')
       and (v_c_at is null or (coalesce(m.joined_at, m.created_at), m.id) < (v_c_at, v_c_id))
     order by coalesce(m.joined_at, m.created_at) desc, m.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(private.network_profile_card(b.profile_id)
                            || jsonb_build_object('community_role', b.role, 'joined_at', b.at)
                            order by b.at desc, b.mid desc)
                  filter (where private.network_profile_card(b.profile_id) is not null), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.mid order by b.at, b.mid))[1])
    into v_rows, v_next
  from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_community_members(uuid, text, text, integer) from public, anon;
grant execute on function public.list_community_members(uuid, text, text, integer) to authenticated;


-- ISE-087 — une publication et ses reponses.
create or replace function public.get_community_post(p_post uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_card jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_card := private.community_post_card(p_post, true);
  if v_card is null then return null; end if;

  return v_card || jsonb_build_object(
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'comment_id', k.id,
               'parent_id',  k.parent_comment_id,
               'body',       k.body,
               'created_at', k.created_at,
               'is_helpful', (k.marked_helpful_at is not null),
               'is_author',  (k.author_profile_id = v_me),
               'author',     private.network_profile_card(k.author_profile_id))
             order by k.created_at, k.id)
        from public.community_comments k
       where k.post_id = p_post
         and k.status = 'published'
         and k.deleted_at is null
         and not private.is_blocked_between(k.author_profile_id, v_me)), '[]'::jsonb),
    'can_reply', (private.is_community_member(
                    (select p.community_id from public.community_posts p where p.id = p_post))
                  and not coalesce((select p.is_locked from public.community_posts p where p.id = p_post), true))
  );
end
$fn$;

revoke all on function public.get_community_post(uuid) from public, anon;
grant execute on function public.get_community_post(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- ISE-087 — suivi de MA publication.
--
-- Trois compteurs FACTUELS : reponses, reponses marquees utiles,
-- contributeurs distincts. Aucune vue, aucun « like », aucun classement
-- des contributeurs (MASTER PROMPT 1).
-- ---------------------------------------------------------------------
create or replace function public.get_community_post_tracking(p_post uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_owner uuid;
  v_com   uuid;
  v_card  jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select p.author_profile_id, p.community_id into v_owner, v_com
    from public.community_posts p where p.id = p_post;
  if v_owner is null then return null; end if;
  if v_owner <> v_me and not private.is_community_moderator(v_com) then
    raise exception 'not_post_author' using errcode = '42501';
  end if;

  v_card := private.community_post_card(p_post, true);
  if v_card is null then return null; end if;

  return v_card || jsonb_build_object(
    'counters', jsonb_build_object(
      'replies',      (select count(*) from public.community_comments k
                        where k.post_id = p_post and k.status = 'published' and k.deleted_at is null),
      'helpful',      (select count(*) from public.community_comments k
                        where k.post_id = p_post and k.status = 'published'
                          and k.deleted_at is null and k.marked_helpful_at is not null),
      'contributors', (select count(distinct k.author_profile_id) from public.community_comments k
                        where k.post_id = p_post and k.status = 'published' and k.deleted_at is null)),
    'helpful_replies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'comment_id', k.id,
               'body',       k.body,
               'created_at', k.created_at,
               'author',     private.network_profile_card(k.author_profile_id))
             order by k.marked_helpful_at)
        from public.community_comments k
       where k.post_id = p_post and k.status = 'published'
         and k.deleted_at is null and k.marked_helpful_at is not null), '[]'::jsonb),
    'contributors', coalesce((
      select jsonb_agg(distinct private.network_profile_card(k.author_profile_id))
        from public.community_comments k
       where k.post_id = p_post and k.status = 'published' and k.deleted_at is null
         and k.author_profile_id <> v_me
         and private.network_profile_card(k.author_profile_id) is not null), '[]'::jsonb)
  );
end
$fn$;

revoke all on function public.get_community_post_tracking(uuid) from public, anon;
grant execute on function public.get_community_post_tracking(uuid) to authenticated;


-- =====================================================================
-- 3. Ecritures
-- =====================================================================

-- ---------------------------------------------------------------------
-- public.join_community
--
-- Encode la politique d'adhesion en base (docs/rls.md 10.5) :
--   open       -> active immediat
--   request    -> pending
--   invitation -> refus explicite
-- `role` est toujours `member` : personne ne s'auto-promeut.
-- ---------------------------------------------------------------------
create or replace function public.join_community(p_community uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me     uuid := private.current_profile_id();
  v_policy text;
  v_status text;
  v_exist  text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_active_member' using errcode = '42501';
  end if;
  if not private.can_see_community(p_community) then
    raise exception 'community_not_visible' using errcode = '42501';
  end if;

  select c.join_policy into v_policy
    from public.communities c
   where c.id = p_community and c.deleted_at is null and c.status = 'active';
  if v_policy is null then
    raise exception 'community_not_open' using errcode = 'P0001';
  end if;

  select m.membership_status into v_exist
    from public.community_memberships m
   where m.community_id = p_community and m.profile_id = v_me;

  if v_exist in ('active', 'pending') then
    return jsonb_build_object('membership_status', v_exist, 'changed', false);
  end if;
  if v_exist = 'suspended' then
    raise exception 'membership_suspended' using errcode = 'P0001';
  end if;

  v_status := case v_policy
                when 'open'    then 'active'
                when 'request' then 'pending'
                else null
              end;
  if v_status is null then
    raise exception 'invitation_only_community' using errcode = 'P0001';
  end if;

  insert into public.community_memberships
    (community_id, profile_id, role, membership_status, requested_at, joined_at)
  values
    (p_community, v_me, 'member', v_status,
     case when v_status = 'pending' then clock_timestamp() else null end,
     case when v_status = 'active'  then clock_timestamp() else null end)
  on conflict (community_id, profile_id) do update
    set role              = 'member',
        membership_status = excluded.membership_status,
        requested_at      = excluded.requested_at,
        joined_at         = excluded.joined_at,
        left_at           = null;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('community.joined', 'community', p_community, v_me,
          jsonb_build_object('membership_status', v_status));

  return jsonb_build_object('membership_status', v_status, 'changed', true);
end
$fn$;

revoke all on function public.join_community(uuid) from public, anon;
grant execute on function public.join_community(uuid) to authenticated;
comment on function public.join_community(uuid) is
  'ISE-084/085. Adhesion : active si open, pending si request, refus si invitation. role = member impose.';


create or replace function public.leave_community(p_community uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_n  integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.community_memberships
     set membership_status = 'left',
         left_at           = clock_timestamp()
   where community_id = p_community
     and profile_id   = v_me
     and membership_status in ('active', 'pending')
     and role = 'member';
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'cannot_leave_community' using errcode = 'P0001';
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('community.left', 'community', p_community, v_me, '{}'::jsonb);

  return jsonb_build_object('membership_status', 'left');
end
$fn$;

revoke all on function public.leave_community(uuid) from public, anon;
grant execute on function public.leave_community(uuid) to authenticated;


-- Preferences de notification par communaute (CA-COMM-08).
create or replace function public.set_community_notification(
  p_community uuid,
  p_level     text,
  p_digest    text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_n  integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_level not in ('all', 'important', 'none') then
    raise exception 'invalid_notification_level' using errcode = 'P0001';
  end if;
  if p_digest not in ('none', 'daily', 'weekly') then
    raise exception 'invalid_digest_frequency' using errcode = 'P0001';
  end if;

  update public.community_memberships
     set notification_level = p_level,
         digest_frequency   = p_digest
   where community_id = p_community and profile_id = v_me
     and membership_status = 'active';
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'not_community_member' using errcode = '42501';
  end if;
  return jsonb_build_object('notification_level', p_level, 'digest_frequency', p_digest);
end
$fn$;

revoke all on function public.set_community_notification(uuid, text, text) from public, anon;
grant execute on function public.set_community_notification(uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- ISE-086 — public.create_community_post
--
-- GARDES ANTI-SPAM ET ANTI-HORS-SUJET (DIGEST D 4.7 U 105-106) :
--   * limitation de debit applicative (D-103) : 10 publications par
--     heure et par membre, compteur en base ;
--   * cross-posting : une empreinte de contenu identique deja publiee
--     dans 3 communautes differentes au cours des 24 dernieres heures
--     est refusee. Le seuil de 3 est un arbitrage — la specification
--     parle de « la meme publicite dans 10 communautes » sans fixer de
--     limite operationnelle ; 3 est prudent et se releve par migration ;
--   * `post_moderation_mode = 'pre_approval'` place la publication en
--     `pending_review` : la moderation prealable est une propriete de la
--     communaute, jamais un choix de l'auteur ;
--   * une communaute privee ne peut pas produire un billet ouvert au
--     reseau (coherence avec `can_see_community_post`, 0044).
-- ---------------------------------------------------------------------
create or replace function public.create_community_post(
  p_community              uuid,
  p_post_type              text,
  p_title                  text,
  p_body                   text,
  p_visibility             text     default 'community',
  p_skill_ids              bigint[] default null,
  p_referenced_entity_type text     default null,
  p_referenced_entity_id   uuid     default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me          uuid := private.current_profile_id();
  v_mode        text;
  v_cvis        text;
  v_status      text;
  v_id          uuid;
  v_fingerprint text;
  v_spread      integer;
  v_title       text := btrim(coalesce(p_title, ''));
  v_body        text := nullif(btrim(coalesce(p_body, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_community_member(p_community) then
    raise exception 'not_community_member' using errcode = '42501';
  end if;
  if length(v_title) < 8 or length(v_title) > 240 then
    raise exception 'invalid_title' using errcode = 'P0001';
  end if;
  if p_post_type not in ('question', 'experience', 'resource', 'analysis', 'news',
                         'opportunity_reference', 'network_call_reference',
                         'event_reference', 'project_reference') then
    raise exception 'invalid_post_type' using errcode = 'P0001';
  end if;
  if p_visibility not in ('community', 'network') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;

  select c.post_moderation_mode, c.visibility into v_mode, v_cvis
    from public.communities c
   where c.id = p_community and c.deleted_at is null and c.status = 'active';
  if v_mode is null then
    raise exception 'community_not_active' using errcode = 'P0001';
  end if;
  if p_visibility = 'network' and v_cvis <> 'network' then
    raise exception 'network_visibility_requires_network_community' using errcode = 'P0001';
  end if;

  if not private.consume_rate_limit('profile:' || v_me::text, 'community_post', 10, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_fingerprint := encode(
    extensions.digest(convert_to(lower(v_title) || '|' || lower(coalesce(v_body, '')), 'UTF8'), 'sha256'),
    'hex');

  select count(distinct p.community_id) into v_spread
    from public.community_posts p
   where p.author_profile_id = v_me
     and p.content_fingerprint = v_fingerprint
     and p.created_at >= now() - interval '24 hours'
     and p.community_id <> p_community;
  if v_spread >= 3 then
    raise exception 'cross_posting_blocked' using errcode = 'P0001';
  end if;

  v_status := case when v_mode = 'pre_approval' then 'pending_review' else 'published' end;

  insert into public.community_posts
    (community_id, author_profile_id, post_type, title, body, visibility, status,
     referenced_entity_type, referenced_entity_id, content_fingerprint, published_at)
  values
    (p_community, v_me, p_post_type, v_title, v_body, p_visibility, v_status,
     p_referenced_entity_type, p_referenced_entity_id, v_fingerprint,
     case when v_status = 'published' then clock_timestamp() else null end)
  returning id into v_id;

  if p_skill_ids is not null then
    insert into public.community_post_skills (post_id, skill_id)
    select v_id, s.id from public.skills s
     where s.id = any(p_skill_ids) and s.is_active
    on conflict do nothing;
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('community.post_created', 'community', p_community, v_me,
          jsonb_build_object('post_id', v_id, 'post_type', p_post_type, 'status', v_status));

  return jsonb_build_object('post_id', v_id, 'status', v_status,
                            'requires_review', (v_status = 'pending_review'));
end
$fn$;

revoke all on function public.create_community_post(uuid, text, text, text, text, bigint[], text, uuid) from public, anon;
grant execute on function public.create_community_post(uuid, text, text, text, text, bigint[], text, uuid) to authenticated;
comment on function public.create_community_post(uuid, text, text, text, text, bigint[], text, uuid) is
  'ISE-086. Limitation de debit + refus du cross-posting a l''identique. La moderation prealable est une propriete de la communaute.';


create or replace function public.add_community_comment(
  p_post   uuid,
  p_body   text,
  p_parent uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_com  uuid;
  v_lock boolean;
  v_id   uuid;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_body is null or length(v_body) < 2 then
    raise exception 'empty_comment' using errcode = 'P0001';
  end if;

  select p.community_id, p.is_locked into v_com, v_lock
    from public.community_posts p
   where p.id = p_post and p.status = 'published' and p.deleted_at is null;
  if v_com is null then
    raise exception 'post_not_found' using errcode = 'P0001';
  end if;
  if v_lock then
    raise exception 'post_locked' using errcode = 'P0001';
  end if;
  if not private.is_community_member(v_com) then
    raise exception 'not_community_member' using errcode = '42501';
  end if;
  if p_parent is not null and not exists (
       select 1 from public.community_comments k where k.id = p_parent and k.post_id = p_post) then
    raise exception 'invalid_parent_comment' using errcode = 'P0001';
  end if;
  if not private.consume_rate_limit('profile:' || v_me::text, 'community_comment', 30, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.community_comments (post_id, author_profile_id, parent_comment_id, body, status)
  values (p_post, v_me, p_parent, v_body, 'published')
  returning id into v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('community.comment_created', 'community', v_com, v_me,
          jsonb_build_object('post_id', p_post, 'comment_id', v_id));

  return jsonb_build_object('comment_id', v_id);
end
$fn$;

revoke all on function public.add_community_comment(uuid, text, uuid) from public, anon;
grant execute on function public.add_community_comment(uuid, text, uuid) to authenticated;


-- « Reponse utile » : marquage par l'auteur de la publication. Ce n'est
-- ni un vote, ni un classement des personnes : un marqueur binaire,
-- pose et retirable par une seule personne (DIGEST D 4.9 F 53).
create or replace function public.mark_comment_helpful(
  p_comment uuid,
  p_helpful boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_owner uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select p.author_profile_id into v_owner
    from public.community_comments k
    join public.community_posts p on p.id = k.post_id
   where k.id = p_comment;
  if v_owner is null then
    raise exception 'comment_not_found' using errcode = 'P0001';
  end if;
  if v_owner <> v_me then
    raise exception 'not_post_author' using errcode = '42501';
  end if;

  update public.community_comments
     set marked_helpful_at            = case when p_helpful then clock_timestamp() else null end,
         marked_helpful_by_profile_id = case when p_helpful then v_me else null end
   where id = p_comment;

  return jsonb_build_object('is_helpful', p_helpful);
end
$fn$;

revoke all on function public.mark_comment_helpful(uuid, boolean) from public, anon;
grant execute on function public.mark_comment_helpful(uuid, boolean) to authenticated;


-- ISE-087 — publier la synthese et cloturer la discussion.
create or replace function public.resolve_community_post(
  p_post    uuid,
  p_summary text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid := private.current_profile_id();
  v_owner   uuid;
  v_com     uuid;
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_summary is null or length(v_summary) < 20 then
    raise exception 'summary_too_short' using errcode = 'P0001';
  end if;

  select p.author_profile_id, p.community_id into v_owner, v_com
    from public.community_posts p
   where p.id = p_post and p.status = 'published' and p.deleted_at is null;
  if v_owner is null then
    raise exception 'post_not_found' using errcode = 'P0001';
  end if;
  if v_owner <> v_me then
    raise exception 'not_post_author' using errcode = '42501';
  end if;

  update public.community_posts
     set resolution_summary     = v_summary,
         resolved_at            = clock_timestamp(),
         resolved_by_profile_id = v_me
   where id = p_post;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('community.post_resolved', 'community', v_com, v_me,
          jsonb_build_object('post_id', p_post));

  return jsonb_build_object('post_id', p_post, 'is_resolved', true);
end
$fn$;

revoke all on function public.resolve_community_post(uuid, text) from public, anon;
grant execute on function public.resolve_community_post(uuid, text) to authenticated;
