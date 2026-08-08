-- =====================================================================
-- 0031_matching_engine
-- Portage SQL du moteur de matching V1.
--
-- SOURCE DE VERITE : packages/domain/src/matching/engine.ts et
-- packages/domain/src/matching/weights.ts. Cette fonction doit rendre
-- EXACTEMENT le meme score que scoreCandidate(), a 0,01 pres.
-- Toute divergence est un bug de ce fichier, jamais du TypeScript.
--
-- Decisions : D-40 (bareme normalise sur 100), D-41 (baremes de detail),
-- D-42 (seuils qualitatifs), D-43 (au moins une raison), D-44 (curseur),
-- MASTER PROMPT section 15 (aucun score chiffre renvoye au client).
--
-- Ponderations reprises telles quelles (CRITERION_WEIGHTS) :
--   competences 40 · secteur 15 · geographie 15 · disponibilite 10
--   experience 10 · langue 5 · promotion 5
-- Multiplicateurs de niveau (LEVEL_MULTIPLIERS) :
--   notion 0,40 · intermediate 0,70 · advanced 0,90 · expert 1,00
--   non declare 0,75 ; bonus 1,1 si competence principale, plafonne a 1.
-- Baremes D-41 :
--   secteur   : exact 15 · connexe 9 · absent 0
--   geographie: pays d'exercice 15 · pays de residence 12 · sous-region 8
--   disponibi.: type ouvert 10 · disponible sans le type 5 · aucune 0
-- Renormalisation : un critere NON DEMANDE sort du denominateur
-- (max = 0), exactement comme les early-return des scoreXxx().
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
  v_cur_score  numeric;
  v_cur_id     uuid;
  v_raw        text;
begin
  if not private.is_active_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_me    := private.current_profile_id();
  v_limit := least(greatest(coalesce(p_page_size, 20), 1), 50);

  -- Un seuil d'anciennete nul ou negatif n'a pas de sens et ferait une
  -- division par zero. Il est traite comme « critere non demande ».
  if p_min_years_experience is not null and p_min_years_experience <= 0 then
    p_min_years_experience := null;
  end if;

  -- Libelles des criteres : equivalents SQL de MatchCriteria.sectorName,
  -- countryName, subregionName, availabilityLabel.
  select s.name into v_sector_nm  from public.sectors s   where s.id = p_sector_id;
  select c.name_fr into v_country_nm from public.countries c where c.code = p_country_code;
  select r.name_fr into v_subreg_nm from public.subregions r where r.code = p_subregion_code;
  select a.name into v_avail_nm from public.availability_types a where a.code = p_availability_type;

  -- adjacentSectorIds : la table est un couple oriente, on lit les deux sens.
  if p_sector_id is not null then
    select array_agg(distinct x.sid) into v_adjacent
    from (
      select sa.related_sector_id as sid from public.sector_adjacencies sa where sa.sector_id = p_sector_id
      union
      select sa.sector_id from public.sector_adjacencies sa where sa.related_sector_id = p_sector_id
    ) x;
  end if;

  -- Curseur opaque : il porte le score interne, jamais renvoye en clair.
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
  with cand as (
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
      cc.subregion_code as residence_subregion
    from public.ise_profiles p
    left join public.organizations org on org.id = p.current_organization_id
    left join public.promotions    pr  on pr.id  = p.promotion_id
    left join public.countries     cc  on cc.code = p.current_country_code
    where p.deleted_at is null
      and p.profile_status in ('referenced', 'active')
      and p.id <> v_me
      and not private.is_blocked_between(p.id, v_me)
      and (p_exclude_profile_ids is null or not (p.id = any (p_exclude_profile_ids)))
  ),
  agg as (
    select
      c.*,
      -- ---- scoreSkills ----------------------------------------------
      coalesce(sk.n, 0)                            as sk_n,
      coalesce(sk.weighted, 0)                     as sk_weighted,
      coalesce(sk.names, array[]::text[])          as sk_names,
      -- ---- scoreSector ----------------------------------------------
      coalesce(sc.is_exact, false)                 as sc_exact,
      coalesce(sc.is_adjacent, false)              as sc_adjacent,
      -- ---- scoreGeography -------------------------------------------
      (p_country_code is not null and (
         exists (select 1 from public.profile_geographies g
                  where g.profile_id = c.id and g.country_code = p_country_code)
      or exists (select 1 from public.experiences e
                  where e.profile_id = c.id and e.country_code = p_country_code)
      ))                                            as geo_experience,
      (p_country_code is not null and c.current_country_code = p_country_code)
                                                    as geo_residence,
      (p_subregion_code is not null and c.residence_subregion = p_subregion_code)
                                                    as geo_subregion,
      -- ---- scoreAvailability ----------------------------------------
      coalesce(av.type_match, false)               as av_type_match,
      coalesce(av.has_any, false)                  as av_has_any,
      -- ---- scoreExperience ------------------------------------------
      private.profile_years_of_experience(c.id)    as yoe,
      -- ---- scoreLanguage --------------------------------------------
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
        bool_or(x.sector_id = p_sector_id)                              as is_exact,
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
      -- ================= COMPETENCES (40) ============================
      case when v_skills_n = 0 then 0 else 40 end as m_skills,
      case
        when v_skills_n = 0 or a.sk_n = 0 then 0
        else round(40 * least(1::numeric, a.sk_weighted / v_skills_n), 2)
      end as p_skills,
      -- ================= SECTEUR (15) ================================
      case when p_sector_id is null then 0 else 15 end as m_sector,
      case
        when p_sector_id is null then 0
        when a.sc_exact    then 15
        when a.sc_adjacent then 9
        else 0
      end as p_sector,
      -- ================= GEOGRAPHIE (15) =============================
      case when p_country_code is null and p_subregion_code is null then 0 else 15 end as m_geo,
      case
        when p_country_code is null and p_subregion_code is null then 0
        when a.geo_experience then 15
        when a.geo_residence  then 12
        when a.geo_subregion  then 8
        else 0
      end as p_geo,
      -- ================= DISPONIBILITE (10) ==========================
      case when p_availability_type is null then 0 else 10 end as m_avail,
      case
        when p_availability_type is null then 0
        when a.av_type_match then 10
        when a.av_has_any    then 5
        else 0
      end as p_avail,
      -- ================= EXPERIENCE (10) =============================
      case when p_min_years_experience is null or a.yoe is null then 0 else 10 end as m_exp,
      case
        when p_min_years_experience is null or a.yoe is null then 0
        when a.yoe / p_min_years_experience < 0.5 then 0
        else round(10 * least(1::numeric, a.yoe / p_min_years_experience), 2)
      end as p_exp,
      -- ================= LANGUE (5) ==================================
      case when v_langs_n = 0 then 0 else 5 end as m_lang,
      case
        when v_langs_n = 0 or a.lg_n = 0 then 0
        else round(5 * (a.lg_n::numeric / v_langs_n), 2)
      end as p_lang,
      -- ================= PROMOTION (5) ===============================
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
            -- Disponibilite : SEUL le cas « type explicitement ouvert »
            -- produit une raison. Le cas « disponible sans correspondance »
            -- vaut 5 points et AUCUNE raison (engine.ts, reason: null).
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
      and jsonb_array_length(f.reasons_json) > 0   -- D-43
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
  where v_cur_score is null
     or e.score < v_cur_score
     or (e.score = v_cur_score and e.id > v_cur_id)
  -- Tri de engine.ts rankCandidates() : score decroissant, puis identifiant
  -- CROISSANT. D-44 evoque (score DESC, id DESC) ; la parite avec le moteur
  -- TypeScript prime, l'ordre des ex aequo suit donc engine.ts.
  order by e.score desc, e.id asc
  limit v_limit;
end
$fn$;

comment on function public.match_profiles(bigint[], bigint, char(2), text, text, int, varchar[], bigint, uuid[], text, int) is
  'Moteur de matching V1, portage fidele de packages/domain/src/matching/engine.ts. '
  'Ne renvoie JAMAIS le score chiffre (MASTER PROMPT section 15) : seuls relevance_label et '
  'reasons sortent, le score n''existe que dans le curseur opaque. Tout candidat sans raison '
  'est exclu (D-43).';

revoke all on function public.match_profiles(bigint[], bigint, char(2), text, text, int, varchar[], bigint, uuid[], text, int) from public, anon;
grant execute on function public.match_profiles(bigint[], bigint, char(2), text, text, int, varchar[], bigint, uuid[], text, int) to authenticated;

-- Index reclames par la generation de candidats (D22 section 148).
create index if not exists profile_availabilities_active_profile_idx
  on public.profile_availabilities (profile_id, availability_type)
  where active;

create index if not exists sector_adjacencies_related_idx
  on public.sector_adjacencies (related_sector_id);
