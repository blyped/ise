-- =====================================================================
-- 0034_matching_set_based
--
-- Deuxieme passe de performance sur public.match_profiles, apres mesure.
--
-- MESURES (5 000 profils, cache chaud, moyenne sur 5 executions)
--   0031 (scoring de tout l'annuaire, fonctions non inlinables) 2 457,6 ms
--   0033 (generation de candidats + anciennete pre-agregee) ......  363,5 ms
--   0034 (agregats de scoring ensemblistes) .....................  242,5 ms
--        (le meme appel reduit a deux criteres realistes) .......   79,6 ms
--
--   Le cas a 8 criteres reste le PIRE cas du jeu synthetique : tous les
--   profils y parlent francais ou anglais et depassent 8 ans, si bien que
--   la generation de candidats ne filtre rien. Un jeu reel est bien plus
--   selectif ; la mesure a deux criteres en donne l'ordre de grandeur.
--
-- DIAGNOSTIC RESIDUEL
--   Apres 0033, le temps restant n'etait plus dans le retrieval (25 ms
--   mesures a l'EXPLAIN) mais dans les QUATRE jointures laterales
--   correlees de la CTE `agg` : elles etaient re-executees une fois par
--   candidat, soit environ 30 000 sondes d'index par appel, dont un
--   array_agg avec collation ICU "fr-FR-x-icu" (couteuse) sur chaque
--   ligne.
--
-- CORRECTIF
--   Les quatre agregats deviennent des CTE ENSEMBLISTES : chacune balaie
--   une seule fois les lignes reellement concernees par le critere, les
--   regroupe par profil, et est rattachee au candidat par une jointure
--   de hachage. Les deux EXISTS correles de la geographie deviennent une
--   union d'ensembles.
--
--   La formule de score, les libelles, l'ordre des raisons, les seuils et
--   le tri sont repris a l'identique. Le tableau de parite doit rester
--   inchange au centieme pres.
-- =====================================================================

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
    -- Formule strictement identique a private.profile_years_of_experience().
    select e.profile_id,
           round(greatest(0,
             (max(coalesce(e.end_date, current_date)) - min(e.start_date))::numeric / 365.25
           ), 2) as years
    from public.experiences e
    group by e.profile_id
  ),
  -- ---- Agregats de scoring, un balayage par critere ------------------
  skill_agg as (
    select
      ps.profile_id,
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
    where v_skills_n > 0 and ps.skill_id = any (p_skill_ids)
    group by ps.profile_id
  ),
  sector_agg as (
    select
      x.profile_id,
      bool_or(x.sector_id = p_sector_id)                                 as is_exact,
      bool_or(v_adjacent is not null and x.sector_id = any (v_adjacent)) as is_adjacent
    from public.profile_sectors x
    where p_sector_id is not null
      and (x.sector_id = p_sector_id
           or (v_adjacent is not null and x.sector_id = any (v_adjacent)))
    group by x.profile_id
  ),
  avail_agg as (
    select
      pa.profile_id,
      bool_or(pa.availability_type = p_availability_type) as type_match,
      true                                                as has_any
    from public.profile_availabilities pa
    -- `has_any` n'a de sens que si le critere est demande : sans cette
    -- garde, la CTE balaierait toutes les disponibilites pour rien.
    where pa.active and p_availability_type is not null
    group by pa.profile_id
  ),
  lang_agg as (
    -- `shared` respecte l'ordre des codes DEMANDES, comme
    -- criteria.languageCodes.filter(...) en TypeScript.
    select
      pl.profile_id,
      array_agg(u.code::text order by u.ord) as shared,
      count(*)                               as n
    from unnest(coalesce(p_language_codes, array[]::varchar[])) with ordinality as u(code, ord)
    join public.profile_languages pl on pl.language_code = u.code
    group by pl.profile_id
  ),
  geo_exp as (
    select g.profile_id
      from public.profile_geographies g
     where p_country_code is not null and g.country_code = p_country_code
    union
    select e.profile_id
      from public.experiences e
     where p_country_code is not null and e.country_code = p_country_code
  ),
  -- ---- Generation de candidats (D22 sections 149-153) ----------------
  cand_ids as (
    select sa.profile_id as id from skill_agg  sa
    union
    select sc.profile_id      from sector_agg  sc
    union
    select ge.profile_id      from geo_exp     ge
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
    select av.profile_id
      from avail_agg av
     where p_availability_type is not null and av.type_match
    union
    select lg.profile_id      from lang_agg    lg
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
  agg as (
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
      yy.years                                     as yoe,
      coalesce(sk.n, 0)                            as sk_n,
      coalesce(sk.weighted, 0)                     as sk_weighted,
      coalesce(sk.names, array[]::text[])          as sk_names,
      coalesce(sc.is_exact, false)                 as sc_exact,
      coalesce(sc.is_adjacent, false)              as sc_adjacent,
      (p_country_code is not null and ge.profile_id is not null)          as geo_experience,
      (p_country_code is not null and p.current_country_code = p_country_code) as geo_residence,
      (p_subregion_code is not null and cc.subregion_code = p_subregion_code)  as geo_subregion,
      coalesce(av.type_match, false)               as av_type_match,
      coalesce(av.has_any, false)                  as av_has_any,
      coalesce(lg.shared, array[]::text[])         as lg_shared,
      coalesce(lg.n, 0)                            as lg_n
    from cand_ids ci
    join public.ise_profiles p on p.id = ci.id
    left join public.organizations org on org.id = p.current_organization_id
    left join public.promotions    pr  on pr.id  = p.promotion_id
    left join public.countries     cc  on cc.code = p.current_country_code
    left join yoe        yy on yy.profile_id = p.id
    left join skill_agg  sk on sk.profile_id = p.id
    left join sector_agg sc on sc.profile_id = p.id
    left join avail_agg  av on av.profile_id = p.id
    left join lang_agg   lg on lg.profile_id = p.id
    left join geo_exp    ge on ge.profile_id = p.id
    where p.deleted_at is null
      and p.profile_status in ('referenced', 'active')
      and p.id <> v_me
      and not (p.id = any (v_blocked))
      and (p_exclude_profile_ids is null or not (p.id = any (p_exclude_profile_ids)))
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
  labelled as (
    -- Le seuil D-42 est applique AVANT la construction des raisons :
    -- inutile de composer du jsonb pour un candidat deja ecarte.
    select
      t.*,
      round(t.total_pts / t.total_max * 100, 2) as score
    from totalled t
    where t.total_max > 0
      and round(t.total_pts / t.total_max * 100, 2) >= 25
  ),
  final as (
    select
      l.*,
      (
        select coalesce(jsonb_agg(r.j order by r.ord), '[]'::jsonb)
        from (
          values
            (1, case when v_skills_n > 0 and l.sk_n > 0 then jsonb_build_object(
                  'criterion', 'skills',
                  'label', case when l.sk_n = 1
                                then 'Compétence recherchée : ' || l.sk_names[1]
                                else l.sk_n || ' compétences recherchées en commun' end,
                  'evidence', to_jsonb(l.sk_names)) end),
            (2, case
                  when p_sector_id is not null and l.sc_exact then jsonb_build_object(
                    'criterion', 'sector',
                    'label', 'Exerce dans le secteur ' || coalesce(v_sector_nm, 'recherché'),
                    'evidence', case when v_sector_nm is not null
                                     then jsonb_build_array(v_sector_nm) else '[]'::jsonb end)
                  when p_sector_id is not null and l.sc_adjacent then jsonb_build_object(
                    'criterion', 'sector',
                    'label', 'Exerce dans un secteur connexe',
                    'evidence', case when v_sector_nm is not null
                                     then jsonb_build_array(v_sector_nm) else '[]'::jsonb end)
                end),
            (3, case
                  when l.geo_experience then jsonb_build_object(
                    'criterion', 'geography',
                    'label', 'A déjà travaillé : ' || coalesce(v_country_nm, p_country_code::text),
                    'evidence', jsonb_build_array(coalesce(v_country_nm, p_country_code::text)))
                  when l.geo_residence then jsonb_build_object(
                    'criterion', 'geography',
                    'label', 'Basé : ' || coalesce(v_country_nm, p_country_code::text),
                    'evidence', jsonb_build_array(coalesce(v_country_nm, p_country_code::text)))
                  when l.geo_subregion then jsonb_build_object(
                    'criterion', 'geography',
                    'label', 'Même zone : ' || coalesce(v_subreg_nm, p_subregion_code),
                    'evidence', jsonb_build_array(coalesce(v_subreg_nm, p_subregion_code)))
                end),
            (4, case when p_availability_type is not null and l.av_type_match then jsonb_build_object(
                  'criterion', 'availability',
                  'label', 'Se déclare ouvert : ' || coalesce(v_avail_nm, p_availability_type),
                  'evidence', jsonb_build_array(coalesce(v_avail_nm, p_availability_type))) end),
            (5, case when p_min_years_experience is not null and l.yoe is not null
                      and l.yoe / p_min_years_experience >= 1 then jsonb_build_object(
                  'criterion', 'experience',
                  'label', floor(l.yoe)::text || ' ans d''expérience',
                  'evidence', '[]'::jsonb) end),
            (6, case when v_langs_n > 0 and l.lg_n > 0 then jsonb_build_object(
                  'criterion', 'language',
                  'label', 'Langue de travail commune',
                  'evidence', to_jsonb(l.lg_shared)) end),
            (7, case when p_promotion_id is not null
                      and l.promotion_id is not distinct from p_promotion_id then jsonb_build_object(
                  'criterion', 'promotion',
                  'label', 'Même promotion',
                  'evidence', '[]'::jsonb) end)
        ) as r(ord, j)
        where r.j is not null
      ) as reasons_json
    from labelled l
  ),
  eligible as (
    select
      f.*,
      case
        when f.score >= 70 then 'very_relevant'
        when f.score >= 45 then 'relevant'
        else 'close'
      end as lbl
    from final f
    where jsonb_array_length(f.reasons_json) > 0   -- D-43
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
  'jamais le score chiffre (MASTER PROMPT section 15) : seuls relevance_label et reasons sortent, '
  'le score n''existe que dans le curseur opaque. Tout candidat sans raison est exclu (D-43). '
  'Retrieval puis scoring ensembliste (D22 sections 149-153).';

-- Balayage groupe des disponibilites actives (CTE avail_agg).
create index if not exists profile_availabilities_active_type_idx
  on public.profile_availabilities (profile_id, availability_type, active)
  where active;
