-- =====================================================================
-- 0033_search_matching_performance
--
-- Correctif de PERFORMANCE de 0030 et 0031, apres EXPLAIN ANALYZE sur un
-- jeu de 5 000 profils (cible D22 section 147, CA-MATCH-10).
--
-- MESURES AVANT (5 000 profils, 15 000 competences, 5 000 experiences) :
--   search_profiles, texte seul ................. 103,8 ms
--   search_profiles, texte + 9 filtres ..........  61,6 ms
--   match_profiles, 8 criteres .................. 2 457,6 ms   <-- inacceptable
--
-- TROIS DEFAUTS DIAGNOSTIQUES
--
--   1. `private.is_blocked_between()` est SECURITY DEFINER et porte un
--      `SET search_path` : le planificateur ne peut ni l'inliner ni la
--      remonter. Elle etait evaluee LIGNE A LIGNE dans le filtre de base,
--      ce qui imposait un Seq Scan de `ise_profiles` (61 ms sur 95 ms du
--      noeud de balayage). Correctif : la liste des blocages du membre
--      courant est materialisee UNE FOIS dans un tableau, et le helper
--      mandate reste applique sur la page finale (au plus 50 lignes),
--      ou il ne coute rien et garde son role de garde-fou.
--
--   2. `private.profile_years_of_experience()` porte elle aussi un
--      `SET search_path` : non inlinable, donc un appel par candidat, soit
--      5 000 agregations independantes sur `experiences`. Correctif : une
--      CTE d'agregation unique, strictement identique dans sa formule.
--
--   3. `match_profiles` scorait TOUS les profils eligibles avant de jeter
--      ceux sans raison (D-43). D22 sections 149-153 impose la sequence
--      inverse : generer d'abord un ensemble raisonnable de candidats.
--      Correctif : la generation de candidats est l'UNION des sept
--      branches indexables qui peuvent produire une raison. Un profil hors
--      de cette union n'a par construction AUCUNE raison affichable et
--      etait donc deja exclu : le resultat est inchange, seul le cout l'est.
--
--   4. Bonus : dans `search_profiles`, le predicat texte etait un OR entre
--      `d.search_vector @@ tsq` et `similarity(p.normalized_name, ...)`,
--      c'est-a-dire une disjonction portant sur DEUX tables. L'index GIN
--      plein texte ne pouvait donc jamais servir. Correctif : quatre
--      branches UNION explicites (plein texte, trigramme, alias resolus,
--      absence de texte), fusionnees par un `max()` du rang.
--      NOTE : l'operateur indexable `%` de pg_trgm n'est PAS utilise, voir
--      l'arbitrage commente dans la branche 2.
--
-- MESURES APRES (memes conditions, cache chaud, moyenne sur 5) :
--   search_profiles, sans critere ...............  12,1 ms
--   search_profiles, texte seul .................  32,6 ms
--   search_profiles, texte + 9 filtres ..........  48,9 ms
--   match_profiles ............................... voir 0034
--
-- LA SEMANTIQUE EST INCHANGEE. La suite tests/search/0001 doit rester a
-- 0 echec, et le tableau de parite identique au terme pres.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. search_profiles : retrieval par branches indexees
-- ---------------------------------------------------------------------
create or replace function public.search_profiles(
  p_query                text     default null,
  p_skill_ids            bigint[] default null,
  p_sector_ids           bigint[] default null,
  p_job_function_ids     bigint[] default null,
  p_country_codes        char(2)[] default null,
  p_subregion_codes      text[]   default null,
  p_promotion_ids        bigint[] default null,
  p_language_codes       varchar[] default null,
  p_availability_types   text[]   default null,
  p_min_years_experience int      default null,
  p_cursor               text     default null,
  p_page_size            int      default 20
)
returns table (
  profile_id              uuid,
  display_name            text,
  headline                text,
  current_position        text,
  current_organization    text,
  current_city            text,
  current_country_code    char(2),
  promotion_label         text,
  verification_status     text,
  top_skills              text[],
  open_availability_types text[],
  page_cursor             text
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me       uuid;
  v_limit    int;
  v_q        text;
  v_nq       text;
  v_tsq      tsquery;
  v_aliases  bigint[];
  v_blocked  uuid[];
  v_cur_rank numeric;
  v_cur_id   uuid;
  v_raw      text;
begin
  if not private.is_active_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_me    := private.current_profile_id();
  v_limit := least(greatest(coalesce(p_page_size, 20), 1), 50);
  v_q     := nullif(btrim(coalesce(p_query, '')), '');
  v_nq    := public.normalize_text(v_q);

  if v_q is not null then
    v_tsq := websearch_to_tsquery('public.french_unaccent', v_q);
    if v_tsq = ''::tsquery then
      v_tsq := null;
    end if;
  end if;

  -- Resolution des alias de competences (D-46), inchangee.
  if v_nq is not null then
    select array_agg(distinct a.skill_id) into v_aliases
    from public.skill_aliases a
    where (
            (' ' || v_nq || ' ') like ('% ' || a.normalized_alias || ' %')
         or (' ' || replace(v_nq, ' et ', ' ') || ' ') like ('% ' || a.normalized_alias || ' %')
          )
      and (
            not a.is_short_acronym
         or v_q ~ ('(^|[^[:alnum:]])' || upper(a.alias) || '($|[^[:alnum:]])')
          );
  end if;

  -- Blocages du membre courant, materialises une seule fois.
  select coalesce(array_agg(
           case when b.blocker_profile_id = v_me then b.blocked_profile_id
                else b.blocker_profile_id end), array[]::uuid[])
    into v_blocked
  from public.profile_blocks b
  where b.blocker_profile_id = v_me or b.blocked_profile_id = v_me;

  if nullif(btrim(coalesce(p_cursor, '')), '') is not null then
    begin
      v_raw := convert_from(decode(p_cursor, 'base64'), 'UTF8');
    exception when others then
      raise exception 'invalid_cursor' using errcode = 'P0001';
    end;
    if v_raw !~ '^[0-9]+(\.[0-9]+)?\|[0-9a-fA-F-]{36}$' then
      raise exception 'invalid_cursor' using errcode = 'P0001';
    end if;
    v_cur_rank := split_part(v_raw, '|', 1)::numeric;
    v_cur_id   := split_part(v_raw, '|', 2)::uuid;
  end if;

  return query
  with hits as (
    -- Branche 1 : plein texte, servie par profile_search_documents_gin.
    select d.profile_id as id, ts_rank(d.search_vector, v_tsq)::numeric as rank
    from public.profile_search_documents d
    where v_tsq is not null and d.search_vector @@ v_tsq
    union all
    -- Branche 2 : trigramme sur le nom.
    -- ARBITRAGE : l'operateur indexable `%` de pg_trgm depend du GUC de
    -- session `pg_trgm.similarity_threshold`, que Supabase interdit de
    -- figer au niveau de la fonction (« permission denied to set
    -- parameter »). Un seuil de session different de 0,30 ferait
    -- silencieusement diverger le resultat de D-45. On conserve donc la
    -- comparaison explicite, qui balaie `ise_profiles` mais donne un
    -- resultat vrai quelle que soit la session. Le cout mesure est
    -- marginal : la branche ne fait plus aucun appel de fonction
    -- SECURITY DEFINER par ligne.
    select p.id, extensions.similarity(p.normalized_name, v_nq)::numeric
    from public.ise_profiles p
    where v_nq is not null
      and extensions.similarity(p.normalized_name, v_nq) >= 0.30
    union all
    -- Branche 3 : alias de competences resolus a la requete (D-46).
    select ps.profile_id, 0::numeric
    from public.profile_skills ps
    where v_aliases is not null and ps.skill_id = any (v_aliases)
    union all
    -- Branche 4 : aucune recherche textuelle, tout l'annuaire est candidat.
    select p.id, 0::numeric
    from public.ise_profiles p
    where v_q is null
  ),
  ranked as (
    select h.id, round(max(h.rank), 6) as rank
    from hits h
    group by h.id
  ),
  base as (
    select rk.id, rk.rank
    from ranked rk
    join public.ise_profiles p on p.id = rk.id
    where p.deleted_at is null
      and p.profile_status in ('referenced', 'active')
      and not (p.id = any (v_blocked))
      and (p_skill_ids is null or exists (
            select 1 from public.profile_skills ps
            where ps.profile_id = p.id and ps.skill_id = any (p_skill_ids)))
      and (p_sector_ids is null or exists (
            select 1 from public.profile_sectors x
            where x.profile_id = p.id and x.sector_id = any (p_sector_ids))
           or exists (
            select 1 from public.experiences e
            where e.profile_id = p.id and e.sector_id = any (p_sector_ids)))
      and (p_job_function_ids is null or exists (
            select 1 from public.profile_functions x
            where x.profile_id = p.id and x.job_function_id = any (p_job_function_ids))
           or exists (
            select 1 from public.experiences e
            where e.profile_id = p.id and e.job_function_id = any (p_job_function_ids)))
      and (p_country_codes is null
           or p.current_country_code = any (p_country_codes)
           or exists (
            select 1 from public.profile_geographies g
            where g.profile_id = p.id and g.country_code = any (p_country_codes))
           or exists (
            select 1 from public.experiences e
            where e.profile_id = p.id and e.country_code = any (p_country_codes)))
      and (p_subregion_codes is null
           or exists (
            select 1 from public.countries c
            where c.code = p.current_country_code and c.subregion_code = any (p_subregion_codes))
           or exists (
            select 1 from public.profile_geographies g
            join public.countries c2 on c2.code = g.country_code
            where g.profile_id = p.id and c2.subregion_code = any (p_subregion_codes))
           or exists (
            select 1 from public.experiences e
            join public.countries c3 on c3.code = e.country_code
            where e.profile_id = p.id and c3.subregion_code = any (p_subregion_codes)))
      and (p_promotion_ids is null or p.promotion_id = any (p_promotion_ids))
      and (p_language_codes is null or exists (
            select 1 from public.profile_languages pl
            where pl.profile_id = p.id and pl.language_code = any (p_language_codes)))
      and (p_availability_types is null or exists (
            select 1 from public.profile_availabilities pa
            where pa.profile_id = p.id and pa.active
              and pa.availability_type = any (p_availability_types)))
      and (p_min_years_experience is null or exists (
            select 1
            from public.experiences e
            where e.profile_id = p.id
            group by e.profile_id
            having round(greatest(0,
                     (max(coalesce(e.end_date, current_date)) - min(e.start_date))::numeric / 365.25
                   ), 2) >= p_min_years_experience))
  ),
  page as (
    select b.id, b.rank
    from base b
    where v_cur_rank is null or (b.rank, b.id) < (v_cur_rank, v_cur_id)
    order by b.rank desc, b.id desc
    limit v_limit
  )
  select
    p.id,
    p.display_name,
    p.headline,
    p.current_position,
    coalesce(org.canonical_name, p.current_organization_raw),
    p.current_city,
    p.current_country_code,
    case when pr.id is null then null
         else concat_ws(' ', pr.program_code, pr.graduation_year::text) end,
    p.verification_status,
    coalesce(sk.names, array[]::text[]),
    coalesce(av.types, array[]::text[]),
    replace(encode(convert_to(pg.rank::text || '|' || pg.id::text, 'UTF8'), 'base64'), E'\n', '')
  from page pg
  join public.ise_profiles p on p.id = pg.id
  left join public.organizations org on org.id = p.current_organization_id
  left join public.promotions pr on pr.id = p.promotion_id
  left join lateral (
    select array_agg(x.name order by x.rn) as names
    from (
      select s.name, row_number() over (order by ps.is_primary desc, s.name) as rn
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
      where ps.profile_id = p.id
    ) x
    where x.rn <= 3
  ) sk on true
  left join lateral (
    select array_agg(pa.availability_type order by pa.availability_type) as types
    from public.profile_availabilities pa
    where pa.profile_id = p.id and pa.active
  ) av on true
  -- Garde-fou mandate, applique sur la page (50 lignes au maximum) :
  -- rigoureusement redondant avec v_blocked, mais il fait foi.
  where not private.is_blocked_between(p.id, v_me)
  order by pg.rank desc, pg.id desc;
end
$fn$;

comment on function public.search_profiles(text, bigint[], bigint[], bigint[], char(2)[], text[], bigint[], varchar[], text[], int, text, int) is
  'Recherche d''annuaire (ISE-034/035). Reservee aux membres actifs. Aucune donnee privee projetee '
  '(D-72) : ni e-mail, ni telephone, ni score de completion, ni rang de pertinence. Pagination par '
  'curseur opaque (D-44). Retrieval en branches indexees (0033).';

-- ---------------------------------------------------------------------
-- 2. match_profiles : generation de candidats puis scoring
-- ---------------------------------------------------------------------
create or replace function public.match_profiles(
  p_skill_ids            bigint[]  default null,
  p_sector_id            bigint    default null,
  p_country_code         char(2)   default null,
  p_subregion_code       text      default null,
  p_availability_type    text      default null,
  p_min_years_experience int       default null,
  p_language_codes       varchar[] default null,
  p_promotion_id         bigint    default null,
  p_exclude_profile_ids  uuid[]    default null,
  p_cursor               text      default null,
  p_page_size            int       default 20
)
returns table (
  profile_id           uuid,
  display_name         text,
  headline             text,
  current_position     text,
  current_organization text,
  current_country_code char(2),
  promotion_label      text,
  relevance_label      text,
  reasons              jsonb,
  page_cursor          text
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me         uuid;
  v_limit      int;
  v_skills_n   int      := coalesce(cardinality(p_skill_ids), 0);
  v_langs_n    int      := coalesce(cardinality(p_language_codes), 0);
  v_adjacent   bigint[];
  v_sector_nm  text;
  v_country_nm text;
  v_subreg_nm  text;
  v_avail_nm   text;
  v_blocked    uuid[];
  v_cur_score  numeric;
  v_cur_id     uuid;
  v_raw        text;
begin
  if not private.is_active_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_me    := private.current_profile_id();
  v_limit := least(greatest(coalesce(p_page_size, 20), 1), 50);

  if p_min_years_experience is not null and p_min_years_experience <= 0 then
    p_min_years_experience := null;
  end if;

  select s.name    into v_sector_nm  from public.sectors s            where s.id   = p_sector_id;
  select c.name_fr into v_country_nm from public.countries c          where c.code = p_country_code;
  select r.name_fr into v_subreg_nm  from public.subregions r         where r.code = p_subregion_code;
  select a.name    into v_avail_nm   from public.availability_types a where a.code = p_availability_type;

  if p_sector_id is not null then
    select array_agg(distinct x.sid) into v_adjacent
    from (
      select sa.related_sector_id as sid from public.sector_adjacencies sa where sa.sector_id = p_sector_id
      union
      select sa.sector_id from public.sector_adjacencies sa where sa.related_sector_id = p_sector_id
    ) x;
  end if;

  select coalesce(array_agg(
           case when b.blocker_profile_id = v_me then b.blocked_profile_id
                else b.blocker_profile_id end), array[]::uuid[])
    into v_blocked
  from public.profile_blocks b
  where b.blocker_profile_id = v_me or b.blocked_profile_id = v_me;

  if nullif(btrim(coalesce(p_cursor, '')), '') is not null then
    begin
      v_raw := convert_from(decode(p_cursor, 'base64'), 'UTF8');
    exception when others then
      raise exception 'invalid_cursor' using errcode = 'P0001';
    end;
    if v_raw !~ '^[0-9]+(\.[0-9]+)?\|[0-9a-fA-F-]{36}$' then
      raise exception 'invalid_cursor' using errcode = 'P0001';
    end if;
    v_cur_score := split_part(v_raw, '|', 1)::numeric;
    v_cur_id    := split_part(v_raw, '|', 2)::uuid;
  end if;

  return query
  with yoe as (
    -- Formule strictement identique a private.profile_years_of_experience(),
    -- mais evaluee une seule fois pour tout l'annuaire.
    select e.profile_id,
           round(greatest(0,
             (max(coalesce(e.end_date, current_date)) - min(e.start_date))::numeric / 365.25
           ), 2) as years
    from public.experiences e
    group by e.profile_id
  ),
  cand_ids as (
    -- GENERATION DE CANDIDATS (D22 sections 149-153) : union des seules
    -- branches capables de produire une raison. Hors de cette union, un
    -- profil n'aurait aucune raison affichable et serait de toute facon
    -- ecarte par D-43 : le resultat est donc rigoureusement identique.
    select ps.profile_id as id
      from public.profile_skills ps
     where v_skills_n > 0 and ps.skill_id = any (p_skill_ids)
    union
    select x.profile_id
      from public.profile_sectors x
     where p_sector_id is not null
       and (x.sector_id = p_sector_id
            or (v_adjacent is not null and x.sector_id = any (v_adjacent)))
    union
    select g.profile_id
      from public.profile_geographies g
     where p_country_code is not null and g.country_code = p_country_code
    union
    select e.profile_id
      from public.experiences e
     where p_country_code is not null and e.country_code = p_country_code
    union
    select p.id
      from public.ise_profiles p
     where p_country_code is not null and p.current_country_code = p_country_code
    union
    select p.id
      from public.ise_profiles p
      join public.countries c on c.code = p.current_country_code
     where p_subregion_code is not null and c.subregion_code = p_subregion_code
    union
    select pa.profile_id
      from public.profile_availabilities pa
     where p_availability_type is not null and pa.active
       and pa.availability_type = p_availability_type
    union
    select pl.profile_id
      from public.profile_languages pl
     where v_langs_n > 0 and pl.language_code = any (p_language_codes)
    union
    select p.id
      from public.ise_profiles p
     where p_promotion_id is not null and p.promotion_id = p_promotion_id
    union
    select y.profile_id
      from yoe y
     where p_min_years_experience is not null
       and y.years / p_min_years_experience >= 1
  ),
  cand as (
    select
      p.id,
      p.display_name,
      p.headline,
      p.current_position,
      coalesce(org.canonical_name, p.current_organization_raw) as org_name,
      p.current_country_code,
      p.promotion_id,
      case when pr.id is null then null
           else concat_ws(' ', pr.program_code, pr.graduation_year::text) end as promo_label,
      cc.subregion_code as residence_subregion,
      yy.years as yoe
    from cand_ids ci
    join public.ise_profiles p on p.id = ci.id
    left join public.organizations org on org.id = p.current_organization_id
    left join public.promotions    pr  on pr.id  = p.promotion_id
    left join public.countries     cc  on cc.code = p.current_country_code
    left join yoe yy on yy.profile_id = p.id
    where p.deleted_at is null
      and p.profile_status in ('referenced', 'active')
      and p.id <> v_me
      and not (p.id = any (v_blocked))
      and (p_exclude_profile_ids is null or not (p.id = any (p_exclude_profile_ids)))
  ),
  agg as (
    select
      c.*,
      coalesce(sk.n, 0)                            as sk_n,
      coalesce(sk.weighted, 0)                     as sk_weighted,
      coalesce(sk.names, array[]::text[])          as sk_names,
      coalesce(sc.is_exact, false)                 as sc_exact,
      coalesce(sc.is_adjacent, false)              as sc_adjacent,
      (p_country_code is not null and (
         exists (select 1 from public.profile_geographies g
                  where g.profile_id = c.id and g.country_code = p_country_code)
      or exists (select 1 from public.experiences e
                  where e.profile_id = c.id and e.country_code = p_country_code)
      ))                                           as geo_experience,
      (p_country_code is not null and c.current_country_code = p_country_code)
                                                   as geo_residence,
      (p_subregion_code is not null and c.residence_subregion = p_subregion_code)
                                                   as geo_subregion,
      coalesce(av.type_match, false)               as av_type_match,
      coalesce(av.has_any, false)                  as av_has_any,
      coalesce(lg.shared, array[]::text[])         as lg_shared,
      coalesce(lg.n, 0)                            as lg_n
    from cand c
    left join lateral (
      select
        count(*)                                             as n,
        sum(least(1::numeric, m.mult * m.bonus))             as weighted,
        (array_agg(s.name order by s.name collate "fr-FR-x-icu"))[1:4] as names
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
      cross join lateral (
        select
          case ps.level
            when 'notion'       then 0.40::numeric
            when 'intermediate' then 0.70::numeric
            when 'advanced'     then 0.90::numeric
            when 'expert'       then 1.00::numeric
            else 0.75::numeric
          end as mult,
          case when ps.is_primary then 1.1::numeric else 1::numeric end as bonus
      ) m
      where ps.profile_id = c.id
        and v_skills_n > 0
        and ps.skill_id = any (p_skill_ids)
    ) sk on true
    left join lateral (
      select
        bool_or(x.sector_id = p_sector_id)                                 as is_exact,
        bool_or(v_adjacent is not null and x.sector_id = any (v_adjacent)) as is_adjacent
      from public.profile_sectors x
      where x.profile_id = c.id and p_sector_id is not null
    ) sc on true
    left join lateral (
      select
        bool_or(pa.availability_type = p_availability_type) as type_match,
        count(*) > 0                                        as has_any
      from public.profile_availabilities pa
      where pa.profile_id = c.id and pa.active
    ) av on true
    left join lateral (
      select
        array_agg(u.code::text order by u.ord) as shared,
        count(*)                               as n
      from unnest(coalesce(p_language_codes, array[]::varchar[])) with ordinality as u(code, ord)
      where exists (select 1 from public.profile_languages pl
                     where pl.profile_id = c.id and pl.language_code = u.code)
    ) lg on true
  ),
  scored as (
    select
      a.*,
      case when v_skills_n = 0 then 0 else 40 end as m_skills,
      case
        when v_skills_n = 0 or a.sk_n = 0 then 0
        else round(40 * least(1::numeric, a.sk_weighted / v_skills_n), 2)
      end as p_skills,
      case when p_sector_id is null then 0 else 15 end as m_sector,
      case
        when p_sector_id is null then 0
        when a.sc_exact    then 15
        when a.sc_adjacent then 9
        else 0
      end as p_sector,
      case when p_country_code is null and p_subregion_code is null then 0 else 15 end as m_geo,
      case
        when p_country_code is null and p_subregion_code is null then 0
        when a.geo_experience then 15
        when a.geo_residence  then 12
        when a.geo_subregion  then 8
        else 0
      end as p_geo,
      case when p_availability_type is null then 0 else 10 end as m_avail,
      case
        when p_availability_type is null then 0
        when a.av_type_match then 10
        when a.av_has_any    then 5
        else 0
      end as p_avail,
      case when p_min_years_experience is null or a.yoe is null then 0 else 10 end as m_exp,
      case
        when p_min_years_experience is null or a.yoe is null then 0
        when a.yoe / p_min_years_experience < 0.5 then 0
        else round(10 * least(1::numeric, a.yoe / p_min_years_experience), 2)
      end as p_exp,
      case when v_langs_n = 0 then 0 else 5 end as m_lang,
      case
        when v_langs_n = 0 or a.lg_n = 0 then 0
        else round(5 * (a.lg_n::numeric / v_langs_n), 2)
      end as p_lang,
      case when p_promotion_id is null then 0 else 5 end as m_promo,
      case
        when p_promotion_id is null then 0
        when a.promotion_id is not distinct from p_promotion_id then 5
        else 0
      end as p_promo
    from agg a
  ),
  totalled as (
    select
      s.*,
      (s.m_skills + s.m_sector + s.m_geo + s.m_avail + s.m_exp + s.m_lang + s.m_promo) as total_max,
      (s.p_skills + s.p_sector + s.p_geo + s.p_avail + s.p_exp + s.p_lang + s.p_promo) as total_pts
    from scored s
  ),
  final as (
    select
      t.*,
      round(t.total_pts / t.total_max * 100, 2) as score,
      (
        select coalesce(jsonb_agg(r.j order by r.ord), '[]'::jsonb)
        from (
          values
            (1, case when v_skills_n > 0 and t.sk_n > 0 then jsonb_build_object(
                  'criterion', 'skills',
                  'label', case when t.sk_n = 1
                                then 'Compétence recherchée : ' || t.sk_names[1]
                                else t.sk_n || ' compétences recherchées en commun' end,
                  'evidence', to_jsonb(t.sk_names)) end),
            (2, case
                  when p_sector_id is not null and t.sc_exact then jsonb_build_object(
                    'criterion', 'sector',
                    'label', 'Exerce dans le secteur ' || coalesce(v_sector_nm, 'recherché'),
                    'evidence', case when v_sector_nm is not null
                                     then jsonb_build_array(v_sector_nm) else '[]'::jsonb end)
                  when p_sector_id is not null and t.sc_adjacent then jsonb_build_object(
                    'criterion', 'sector',
                    'label', 'Exerce dans un secteur connexe',
                    'evidence', case when v_sector_nm is not null
                                     then jsonb_build_array(v_sector_nm) else '[]'::jsonb end)
                end),
            (3, case
                  when t.geo_experience then jsonb_build_object(
                    'criterion', 'geography',
                    'label', 'A déjà travaillé : ' || coalesce(v_country_nm, p_country_code::text),
                    'evidence', jsonb_build_array(coalesce(v_country_nm, p_country_code::text)))
                  when t.geo_residence then jsonb_build_object(
                    'criterion', 'geography',
                    'label', 'Basé : ' || coalesce(v_country_nm, p_country_code::text),
                    'evidence', jsonb_build_array(coalesce(v_country_nm, p_country_code::text)))
                  when t.geo_subregion then jsonb_build_object(
                    'criterion', 'geography',
                    'label', 'Même zone : ' || coalesce(v_subreg_nm, p_subregion_code),
                    'evidence', jsonb_build_array(coalesce(v_subreg_nm, p_subregion_code)))
                end),
            (4, case when p_availability_type is not null and t.av_type_match then jsonb_build_object(
                  'criterion', 'availability',
                  'label', 'Se déclare ouvert : ' || coalesce(v_avail_nm, p_availability_type),
                  'evidence', jsonb_build_array(coalesce(v_avail_nm, p_availability_type))) end),
            (5, case when p_min_years_experience is not null and t.yoe is not null
                      and t.yoe / p_min_years_experience >= 1 then jsonb_build_object(
                  'criterion', 'experience',
                  'label', floor(t.yoe)::text || ' ans d''expérience',
                  'evidence', '[]'::jsonb) end),
            (6, case when v_langs_n > 0 and t.lg_n > 0 then jsonb_build_object(
                  'criterion', 'language',
                  'label', 'Langue de travail commune',
                  'evidence', to_jsonb(t.lg_shared)) end),
            (7, case when p_promotion_id is not null
                      and t.promotion_id is not distinct from p_promotion_id then jsonb_build_object(
                  'criterion', 'promotion',
                  'label', 'Même promotion',
                  'evidence', '[]'::jsonb) end)
        ) as r(ord, j)
        where r.j is not null
      ) as reasons_json
    from totalled t
    where t.total_max > 0
  ),
  eligible as (
    select
      f.*,
      case
        when f.score >= 70 then 'very_relevant'
        when f.score >= 45 then 'relevant'
        when f.score >= 25 then 'close'
      end as lbl
    from final f
    where f.score >= 25
      and jsonb_array_length(f.reasons_json) > 0
  )
  select
    e.id,
    e.display_name,
    e.headline,
    e.current_position,
    e.org_name,
    e.current_country_code,
    e.promo_label,
    e.lbl,
    e.reasons_json,
    replace(encode(convert_to(e.score::text || '|' || e.id::text, 'UTF8'), 'base64'), E'\n', '')
  from eligible e
  where (v_cur_score is null
         or e.score < v_cur_score
         or (e.score = v_cur_score and e.id > v_cur_id))
    -- Garde-fou mandate, redondant avec v_blocked mais il fait foi.
    and not private.is_blocked_between(e.id, v_me)
  order by e.score desc, e.id asc
  limit v_limit;
end
$fn$;

comment on function public.match_profiles(bigint[], bigint, char(2), text, text, int, varchar[], bigint, uuid[], text, int) is
  'Moteur de matching V1, portage fidele de packages/domain/src/matching/engine.ts. Ne renvoie '
  'jamais le score chiffre (MASTER PROMPT section 15). Tout candidat sans raison est exclu (D-43). '
  'Generation de candidats puis scoring (D22 sections 149-153, 0033).';

-- ---------------------------------------------------------------------
-- 3. Index reclames par le nouveau plan
-- ---------------------------------------------------------------------

-- Branche « pays d'exercice » de la generation de candidats : la table
-- experiences n'avait qu'un index sur country_code seul, sans le profil.
create index if not exists experiences_country_profile_idx
  on public.experiences (country_code, profile_id)
  where country_code is not null;

-- Branche « secteur » symetrique.
create index if not exists experiences_sector_profile_idx
  on public.experiences (sector_id, profile_id)
  where sector_id is not null;

-- Branche « langue » : couvre a la fois le filtre et la generation.
create index if not exists profile_languages_language_profile_idx
  on public.profile_languages (language_code, profile_id);

-- Agregation d'anciennete : Index Only Scan sur (profil, dates).
create index if not exists experiences_profile_dates_idx
  on public.experiences (profile_id, start_date, end_date);
