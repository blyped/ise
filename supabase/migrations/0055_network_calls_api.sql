-- =====================================================================
-- 0052_network_calls_api
--
-- Couche base de donnees de la tranche APPELS AU RESEAU
-- (ISE-047 -> ISE-054).
--
-- Les tables, la machine d'etats et les trois fonctions atomiques
-- existent depuis 0007 (`publish_network_call`, `transition_network_call`,
-- `close_network_call`) ; les politiques depuis 0040. AUCUNE des deux
-- migrations n'est modifiee ici, et AUCUNE politique `UPDATE` n'est
-- ouverte sur un appel publie : les trois fonctions de 0007 restent les
-- seuls chemins de transition (db-conventions 7, MASTER PROMPT 53).
--
-- Ce que cette migration ajoute, et pourquoi :
--
--   1. private.profile_match_set(uuid, jsonb)
--      Moteur de correspondance PARTAGE entre les appels au reseau et
--      les opportunites (0053). `public.match_profiles()` (0031/0034)
--      resout un besoin different -- une recherche libre saisie par un
--      membre -- et ne connait ni le marqueur `required` / `preferred`
--      (CA-MATCH-02), ni les outils, ni les pays a double portee
--      (residence / experience) que 0007 et 0008 portent. Le remplacer
--      aurait casse ISE-034 -> ISE-037 ; l'etendre aurait change sa
--      signature. Il est donc laisse intact et une fonction soeur est
--      ajoutee, avec EXACTEMENT le meme bareme (D-40, D-41) et les
--      memes seuils qualitatifs (D-42).
--
--   2. public.compute_network_call_matches(uuid)
--      Materialise `network_call_matches` a la publication. Le score
--      reste interne : il n'est renvoye par AUCUNE des lectures
--      ci-dessous (MASTER PROMPT 15, D-42, privilege de colonne 0040).
--
--   3. Lectures composees, pagination PAR CURSEUR (D-44) :
--      list_network_calls . get_network_call . list_my_network_calls
--      list_network_call_matches . list_network_call_responses
--      get_network_call_tracking . list_network_call_respondents
--
--   4. Ecritures :
--      save_network_call_draft (brouillon + criteres + audience, atomique)
--      respond_to_network_call . set_network_call_response_status
--      toggle_saved_network_call
--
-- Ce que cette migration N'ajoute PAS, volontairement :
--   * aucune fonction de publication : `publish_network_call` (0007)
--     existe deja et suffit ;
--   * aucun chemin d'ecriture sur `network_call_events` ni sur
--     `network_call_contributors` : ils appartiennent aux fonctions de
--     0007 ;
--   * aucune notification : aucun consommateur d'evenement n'existe
--     encore. Les evenements de domaine sont ecrits, rien de plus.
--
-- References : MASTER PROMPT 9, 15, 16, 25, 27, 43, 47, 53, 64, 98,
--              100, 101, 113 ; D-40, D-41, D-42, D-43, D-44, D-52,
--              D-73, D-93, D-101, D-102, D-103.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Catalogue d'evenements de domaine
--
-- 0018 ne declarait que `network_call.created`, `network_call.responded`
-- et `network_call.resolved`. Une cloture NON resolue est un fait tout
-- aussi reel, et D-52 interdit de la ranger sous "resolved" : sans code
-- dedie, elle ne serait pas observable (MASTER PROMPT 52).
-- ---------------------------------------------------------------------
insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('network_call.published',
   'Un appel au reseau a ete publie et son audience a ete calculee.', 'network_call', 81),
  ('network_call.closed',
   'Un appel au reseau a ete cloture sans resolution (D-52).',        'network_call', 84),
  ('network_call.recommendation_made',
   'Un membre a recommande un profil en reponse a un appel.',         'network_call', 86)
on conflict (code) do nothing;


-- =====================================================================
-- 1. Moteur de correspondance partage
-- =====================================================================

-- Seuils qualitatifs D-42, normalises sur 100. Le score numerique ne
-- quitte JAMAIS la base : seul ce libelle est expose (MASTER PROMPT 15).
create or replace function private.relevance_label(p_score numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when p_score is null then null
           when p_score >= 70 then 'very_relevant'
           when p_score >= 45 then 'relevant'
           when p_score >= 25 then 'close_profile'
           else null
         end
$$;

revoke all on function private.relevance_label(numeric) from public, anon, authenticated;
comment on function private.relevance_label(numeric) is
  'Seuils D-42 : >= 70 tres pertinent, 45-69 pertinent, 25-44 profil proche, < 25 non propose.';


-- Ordre des niveaux de langue, utilise comme filtre dur lorsqu'une
-- langue est marquee `required` (D22 49).
create or replace function private.language_rank(p_proficiency text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_proficiency
           when 'basic'        then 1
           when 'intermediate' then 2
           when 'professional' then 3
           when 'fluent'       then 4
           when 'native'       then 5
           else 0
         end
$$;

revoke all on function private.language_rank(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- private.profile_match_set(p_actor, p_criteria)
--
-- SECURITY DEFINER, motif A (docs/rls.md 4) : balaie `profile_skills`,
-- `profile_sectors`, `profile_languages`, `profile_geographies`,
-- `experiences` et `ise_profiles`, dont les privileges de colonne sont
-- retires a `authenticated` depuis 0028. Ne renvoie JAMAIS de champ de
-- profil : uniquement un identifiant, un score interne, un libelle
-- qualitatif et des raisons explicites. Les cartes de profil sont
-- composees ailleurs, par `private.network_profile_card()`, qui applique
-- la visibilite champ par champ.
--
-- BAREME : celui de D-40 / D-41, a l'identique de `match_profiles()` :
--   competences 40, secteur 15, geographie 15, disponibilite 10,
--   experience 10, langue 5, promotion 5.
-- Un critere NON demande sort du denominateur (renormalisation).
--
-- MARQUEUR `required` (CA-MATCH-02) : un critere obligatoire est un
-- FILTRE DUR. Il exclut le profil qui ne le satisfait pas, quel que
-- soit son score. Il compte ensuite normalement dans le bareme.
--
-- OUTILS : 0007 et 0008 portent des outils, que D-40 n'a jamais pondere.
-- Plutot que d'inventer un poids, un outil `required` agit comme filtre
-- dur et un outil satisfait produit une RAISON, sans jamais deplacer le
-- score. Aucun bareme n'est modifie.
--
-- D-43 : un candidat sans aucune raison affichable est exclu, quel que
-- soit son score.
-- ---------------------------------------------------------------------
create or replace function private.profile_match_set(
  p_actor    uuid,
  p_criteria jsonb
)
returns table (
  profile_id       uuid,
  score            numeric,
  component_scores jsonb,
  reasons          jsonb,
  missing_criteria jsonb,
  relevance_label  text
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  c              jsonb := coalesce(p_criteria, '{}'::jsonb);
  v_req_skills   bigint[];
  v_pref_skills  bigint[];
  v_all_skills   bigint[];
  v_req_tools    bigint[];
  v_all_tools    bigint[];
  v_req_langs    jsonb := coalesce(c->'required_languages', '[]'::jsonb);
  v_all_langs    varchar[];
  v_sector       bigint  := nullif(c->>'sector_id','')::bigint;
  v_sector_req   boolean := coalesce((c->>'sector_required')::boolean, false);
  v_adjacent     bigint[];
  v_res_countries  char(2)[];
  v_exp_countries  char(2)[];
  v_geo_required   boolean := coalesce((c->>'geography_required')::boolean, false);
  v_avail        text[];
  v_min_years    numeric := nullif(c->>'min_experience_years','')::numeric;
  v_org          uuid    := nullif(c->>'organization_id','')::uuid;
  v_org_req      boolean := coalesce((c->>'organization_required')::boolean, false);
  v_promo_from   integer := nullif(c->>'promotion_year_from','')::integer;
  v_promo_to     integer := nullif(c->>'promotion_year_to','')::integer;
  v_skills_n     integer;
  v_langs_n      integer;
  v_sector_nm    text;
  v_blocked      uuid[];
begin
  select coalesce(array_agg(x::bigint), array[]::bigint[]) into v_req_skills
    from jsonb_array_elements_text(coalesce(c->'required_skill_ids','[]'::jsonb)) x;
  select coalesce(array_agg(x::bigint), array[]::bigint[]) into v_pref_skills
    from jsonb_array_elements_text(coalesce(c->'preferred_skill_ids','[]'::jsonb)) x;
  select coalesce(array_agg(distinct s), array[]::bigint[]) into v_all_skills
    from unnest(v_req_skills || v_pref_skills) s;

  select coalesce(array_agg(x::bigint), array[]::bigint[]) into v_req_tools
    from jsonb_array_elements_text(coalesce(c->'required_tool_ids','[]'::jsonb)) x;
  select coalesce(array_agg(distinct t), array[]::bigint[]) into v_all_tools
    from unnest(v_req_tools
                || coalesce((select array_agg(y::bigint)
                               from jsonb_array_elements_text(coalesce(c->'preferred_tool_ids','[]'::jsonb)) y),
                            array[]::bigint[])) t;

  select coalesce(array_agg(distinct u.l::varchar), array[]::varchar[]) into v_all_langs
    from (
      select jsonb_array_elements(v_req_langs)->>'code' as l
      union
      select jsonb_array_elements(coalesce(c->'preferred_languages','[]'::jsonb))->>'code'
    ) u
   where u.l is not null;

  select coalesce(array_agg(x::char(2)), array[]::char(2)[]) into v_res_countries
    from jsonb_array_elements_text(coalesce(c->'residence_country_codes','[]'::jsonb)) x;
  select coalesce(array_agg(x::char(2)), array[]::char(2)[]) into v_exp_countries
    from jsonb_array_elements_text(coalesce(c->'experience_country_codes','[]'::jsonb)) x;
  select coalesce(array_agg(x), array[]::text[]) into v_avail
    from jsonb_array_elements_text(coalesce(c->'availability_types','[]'::jsonb)) x;

  v_skills_n := coalesce(cardinality(v_all_skills), 0);
  v_langs_n  := coalesce(cardinality(v_all_langs), 0);

  if v_min_years is not null and v_min_years <= 0 then
    v_min_years := null;
  end if;

  select s.name into v_sector_nm from public.sectors s where s.id = v_sector;

  -- adjacentSectorIds : la table est un couple oriente, on lit les deux sens.
  if v_sector is not null then
    select array_agg(distinct x.sid) into v_adjacent
    from (
      select sa.related_sector_id as sid from public.sector_adjacencies sa where sa.sector_id = v_sector
      union
      select sa.sector_id from public.sector_adjacencies sa where sa.related_sector_id = v_sector
    ) x;
  end if;

  -- Le blocage est evalue AVANT toute pertinence (D-73) : un membre
  -- bloque dans un sens ou dans l'autre n'est jamais propose.
  select coalesce(array_agg(
           case when b.blocker_profile_id = p_actor then b.blocked_profile_id
                else b.blocker_profile_id end), array[]::uuid[])
    into v_blocked
  from public.profile_blocks b
  where p_actor is not null
    and (b.blocker_profile_id = p_actor or b.blocked_profile_id = p_actor);

  return query
  with yoe as (
    select e.profile_id,
           round(greatest(0,
             (max(coalesce(e.end_date, current_date)) - min(e.start_date))::numeric / 365.25
           ), 2) as years
    from public.experiences e
    group by e.profile_id
  ),
  skill_agg as (
    select
      ps.profile_id,
      count(*)                                 as n,
      count(*) filter (where ps.skill_id = any (v_req_skills)) as req_n,
      sum(least(1::numeric, m.mult * m.bonus)) as weighted,
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
    where v_skills_n > 0 and ps.skill_id = any (v_all_skills)
    group by ps.profile_id
  ),
  tool_agg as (
    select
      pt.profile_id,
      count(*) filter (where pt.tool_id = any (v_req_tools)) as req_n,
      (array_agg(t.name order by t.name collate "fr-FR-x-icu"))[1:4] as names
    from public.profile_tools pt
    join public.tools t on t.id = pt.tool_id
    where coalesce(cardinality(v_all_tools), 0) > 0 and pt.tool_id = any (v_all_tools)
    group by pt.profile_id
  ),
  sector_agg as (
    select
      x.profile_id,
      bool_or(x.sector_id = v_sector)                                    as is_exact,
      bool_or(v_adjacent is not null and x.sector_id = any (v_adjacent)) as is_adjacent
    from public.profile_sectors x
    where v_sector is not null
      and (x.sector_id = v_sector
           or (v_adjacent is not null and x.sector_id = any (v_adjacent)))
    group by x.profile_id
  ),
  avail_agg as (
    select
      pa.profile_id,
      bool_or(pa.availability_type = any (v_avail)) as type_match,
      true                                         as has_any,
      (array_agg(a.name order by a.sort_order)
        filter (where pa.availability_type = any (v_avail)))[1:2] as names
    from public.profile_availabilities pa
    join public.availability_types a on a.code = pa.availability_type
    where pa.active
      and coalesce(cardinality(v_avail), 0) > 0
      and (pa.available_from  is null or pa.available_from  <= current_date)
      and (pa.available_until is null or pa.available_until >= current_date)
    group by pa.profile_id
  ),
  lang_agg as (
    select
      pl.profile_id,
      array_agg(distinct pl.language_code::text) as shared,
      count(distinct pl.language_code)           as n,
      (select count(*)
         from jsonb_array_elements(v_req_langs) rl
        where exists (
          select 1 from public.profile_languages q
           where q.profile_id = pl.profile_id
             and q.language_code = (rl->>'code')::varchar
             and private.language_rank(q.proficiency)
                 >= private.language_rank(coalesce(rl->>'min_proficiency', 'professional'))
        )) as req_ok_n
    from public.profile_languages pl
    where v_langs_n > 0 and pl.language_code = any (v_all_langs)
    group by pl.profile_id
  ),
  geo_exp as (
    select g.profile_id
      from public.profile_geographies g
     where coalesce(cardinality(v_exp_countries), 0) > 0 and g.country_code = any (v_exp_countries)
    union
    select e.profile_id
      from public.experiences e
     where coalesce(cardinality(v_exp_countries), 0) > 0 and e.country_code = any (v_exp_countries)
  ),
  cand_ids as (
    select sa.profile_id as id from skill_agg  sa
    union select sc.profile_id      from sector_agg  sc
    union select ge.profile_id      from geo_exp     ge
    union select tl.profile_id      from tool_agg    tl
    union select lg.profile_id      from lang_agg    lg
    union select av.profile_id      from avail_agg   av where av.type_match
    union select p.id from public.ise_profiles p
      where coalesce(cardinality(v_res_countries), 0) > 0 and p.current_country_code = any (v_res_countries)
    union select p.id from public.ise_profiles p
      where v_org is not null and p.current_organization_id = v_org
    union select p.id from public.ise_profiles p
      join public.promotions pr on pr.id = p.promotion_id
      where (v_promo_from is not null or v_promo_to is not null)
        and (v_promo_from is null or pr.graduation_year >= v_promo_from)
        and (v_promo_to   is null or pr.graduation_year <= v_promo_to)
    union select y.profile_id from yoe y
      where v_min_years is not null and y.years / v_min_years >= 1
  ),
  agg as (
    select
      p.id,
      p.promotion_id,
      p.current_organization_id,
      pr.graduation_year,
      yy.years                                as yoe,
      coalesce(sk.n, 0)                       as sk_n,
      coalesce(sk.req_n, 0)                   as sk_req_n,
      coalesce(sk.weighted, 0)                as sk_weighted,
      coalesce(sk.names, array[]::text[])     as sk_names,
      coalesce(tl.req_n, 0)                   as tl_req_n,
      coalesce(tl.names, array[]::text[])     as tl_names,
      coalesce(sc.is_exact, false)            as sc_exact,
      coalesce(sc.is_adjacent, false)         as sc_adjacent,
      (ge.profile_id is not null)             as geo_experience,
      (coalesce(cardinality(v_res_countries), 0) > 0
        and p.current_country_code = any (v_res_countries)) as geo_residence,
      coalesce(av.type_match, false)          as av_type_match,
      coalesce(av.has_any, false)             as av_has_any,
      coalesce(av.names, array[]::text[])     as av_names,
      coalesce(lg.shared, array[]::text[])    as lg_shared,
      coalesce(lg.n, 0)                       as lg_n,
      coalesce(lg.req_ok_n, 0)                as lg_req_ok_n
    from cand_ids ci
    join public.ise_profiles p on p.id = ci.id
    left join public.promotions pr on pr.id = p.promotion_id
    left join yoe        yy on yy.profile_id = p.id
    left join skill_agg  sk on sk.profile_id = p.id
    left join tool_agg   tl on tl.profile_id = p.id
    left join sector_agg sc on sc.profile_id = p.id
    left join avail_agg  av on av.profile_id = p.id
    left join lang_agg   lg on lg.profile_id = p.id
    left join geo_exp    ge on ge.profile_id = p.id
    where p.deleted_at is null
      and p.profile_status in ('referenced', 'active')
      and (p_actor is null or p.id <> p_actor)
      and not (p.id = any (v_blocked))
  ),
  -- ---- Filtres DURS : marqueur `required` (CA-MATCH-02) --------------
  hard as (
    select a.*
    from agg a
    where (coalesce(cardinality(v_req_skills), 0) = 0
           or a.sk_req_n = cardinality(v_req_skills))
      and (coalesce(cardinality(v_req_tools), 0) = 0
           or a.tl_req_n = cardinality(v_req_tools))
      and (jsonb_array_length(v_req_langs) = 0
           or a.lg_req_ok_n = jsonb_array_length(v_req_langs))
      and (not v_sector_req or v_sector is null or a.sc_exact)
      and (not v_geo_required
           or (coalesce(cardinality(v_res_countries), 0) = 0
               and coalesce(cardinality(v_exp_countries), 0) = 0)
           or a.geo_experience or a.geo_residence)
      and (not v_org_req or v_org is null or a.current_organization_id = v_org)
      and (v_min_years is null or coalesce(a.yoe, 0) >= v_min_years)
  ),
  scored as (
    select
      h.*,
      case when v_skills_n = 0 then 0 else 40 end as m_skills,
      case when v_skills_n = 0 or h.sk_n = 0 then 0
           else round(40 * least(1::numeric, h.sk_weighted / v_skills_n), 2) end as p_skills,
      case when v_sector is null then 0 else 15 end as m_sector,
      case when v_sector is null then 0
           when h.sc_exact    then 15
           when h.sc_adjacent then 9
           else 0 end as p_sector,
      case when coalesce(cardinality(v_res_countries), 0) = 0
                and coalesce(cardinality(v_exp_countries), 0) = 0 then 0 else 15 end as m_geo,
      case when coalesce(cardinality(v_res_countries), 0) = 0
                and coalesce(cardinality(v_exp_countries), 0) = 0 then 0
           when h.geo_experience then 15
           when h.geo_residence  then 12
           else 0 end as p_geo,
      case when coalesce(cardinality(v_avail), 0) = 0 then 0 else 10 end as m_avail,
      case when coalesce(cardinality(v_avail), 0) = 0 then 0
           when h.av_type_match then 10
           when h.av_has_any    then 5
           else 0 end as p_avail,
      case when v_min_years is null or h.yoe is null then 0 else 10 end as m_exp,
      case when v_min_years is null or h.yoe is null then 0
           when h.yoe / v_min_years < 0.5 then 0
           else round(10 * least(1::numeric, h.yoe / v_min_years), 2) end as p_exp,
      case when v_langs_n = 0 then 0 else 5 end as m_lang,
      case when v_langs_n = 0 or h.lg_n = 0 then 0
           else round(5 * (h.lg_n::numeric / v_langs_n), 2) end as p_lang,
      case when v_promo_from is null and v_promo_to is null then 0 else 5 end as m_promo,
      case when (v_promo_from is null and v_promo_to is null) or h.graduation_year is null then 0
           when (v_promo_from is null or h.graduation_year >= v_promo_from)
            and (v_promo_to   is null or h.graduation_year <= v_promo_to) then 5
           else 0 end as p_promo
    from hard h
  ),
  totalled as (
    select s.*,
           (s.m_skills + s.m_sector + s.m_geo + s.m_avail + s.m_exp + s.m_lang + s.m_promo) as total_max,
           (s.p_skills + s.p_sector + s.p_geo + s.p_avail + s.p_exp + s.p_lang + s.p_promo) as total_pts
    from scored s
  ),
  labelled as (
    select t.*, round(t.total_pts / t.total_max * 100, 2) as sc
    from totalled t
    where t.total_max > 0
      and round(t.total_pts / t.total_max * 100, 2) >= 25
  ),
  final as (
    select
      l.*,
      (
        select coalesce(jsonb_agg(x.j order by x.ord), '[]'::jsonb)
        from (values
          (1, case when v_skills_n > 0 and l.sk_n > 0 then jsonb_build_object(
                'criterion', 'skills',
                'label', case when l.sk_n = 1
                              then 'Competence recherchee : ' || l.sk_names[1]
                              else l.sk_n || ' competences recherchees en commun' end,
                'evidence', to_jsonb(l.sk_names)) end),
          (2, case
                when v_sector is not null and l.sc_exact then jsonb_build_object(
                  'criterion', 'sector',
                  'label', 'Exerce dans le secteur ' || coalesce(v_sector_nm, 'recherche'),
                  'evidence', case when v_sector_nm is not null
                                   then jsonb_build_array(v_sector_nm) else '[]'::jsonb end)
                when v_sector is not null and l.sc_adjacent then jsonb_build_object(
                  'criterion', 'sector',
                  'label', 'Exerce dans un secteur connexe',
                  'evidence', case when v_sector_nm is not null
                                   then jsonb_build_array(v_sector_nm) else '[]'::jsonb end)
              end),
          (3, case
                when l.geo_experience then jsonb_build_object(
                  'criterion', 'geography',
                  'label', 'A deja travaille dans la zone recherchee',
                  'evidence', to_jsonb((select coalesce(array_agg(cn.name_fr), array[]::text[])
                                          from public.countries cn
                                         where cn.code = any (v_exp_countries))))
                when l.geo_residence then jsonb_build_object(
                  'criterion', 'geography',
                  'label', 'Base dans un pays recherche',
                  'evidence', to_jsonb((select coalesce(array_agg(cn.name_fr), array[]::text[])
                                          from public.countries cn
                                         where cn.code = any (v_res_countries))))
              end),
          (4, case when l.av_type_match then jsonb_build_object(
                'criterion', 'availability',
                'label', 'Se declare disponible : ' || array_to_string(l.av_names, ', '),
                'evidence', to_jsonb(l.av_names)) end),
          (5, case when v_min_years is not null and l.yoe is not null and l.yoe / v_min_years >= 1
                   then jsonb_build_object(
                'criterion', 'experience',
                'label', floor(l.yoe)::text || ' ans d''experience',
                'evidence', '[]'::jsonb) end),
          (6, case when v_langs_n > 0 and l.lg_n > 0 then jsonb_build_object(
                'criterion', 'language',
                'label', 'Langue de travail commune',
                'evidence', to_jsonb(l.lg_shared)) end),
          (7, case when (v_promo_from is not null or v_promo_to is not null)
                        and l.p_promo > 0 then jsonb_build_object(
                'criterion', 'promotion',
                'label', 'Promotion dans l''intervalle recherche',
                'evidence', '[]'::jsonb) end),
          (8, case when coalesce(cardinality(v_all_tools), 0) > 0 and l.tl_req_n > 0
                   then jsonb_build_object(
                'criterion', 'tools',
                'label', 'Outils attendus declares',
                'evidence', to_jsonb(l.tl_names)) end)
        ) as x(ord, j)
        where x.j is not null
      ) as reasons_json,
      (
        select coalesce(jsonb_agg(m.j order by m.ord), '[]'::jsonb)
        from (values
          (1, case when coalesce(cardinality(v_all_skills), 0) > 0 and l.sk_n = 0
                   then jsonb_build_object('criterion', 'skills') end),
          (2, case when v_sector is not null and not l.sc_exact and not l.sc_adjacent
                   then jsonb_build_object('criterion', 'sector') end),
          (3, case when (coalesce(cardinality(v_res_countries), 0) > 0
                         or coalesce(cardinality(v_exp_countries), 0) > 0)
                        and not l.geo_experience and not l.geo_residence
                   then jsonb_build_object('criterion', 'geography') end),
          (4, case when coalesce(cardinality(v_avail), 0) > 0 and not l.av_type_match
                   then jsonb_build_object('criterion', 'availability') end),
          (5, case when v_min_years is not null and coalesce(l.yoe, 0) < v_min_years
                   then jsonb_build_object('criterion', 'experience') end)
        ) as m(ord, j)
        where m.j is not null
      ) as missing_json
    from labelled l
  )
  select
    f.id,
    f.sc,
    jsonb_build_object(
      'skills', f.p_skills, 'sector', f.p_sector, 'geography', f.p_geo,
      'availability', f.p_avail, 'experience', f.p_exp,
      'language', f.p_lang, 'promotion', f.p_promo),
    f.reasons_json,
    f.missing_json,
    private.relevance_label(f.sc)
  from final f
  -- D-43 : aucune raison affichable, aucun resultat.
  where jsonb_array_length(f.reasons_json) > 0;
end
$fn$;

revoke all on function private.profile_match_set(uuid, jsonb) from public, anon, authenticated;

comment on function private.profile_match_set(uuid, jsonb) is
  'Moteur de correspondance partage appels/opportunites. Bareme D-40/D-41, seuils D-42, au moins une raison D-43, marqueur required = filtre dur (CA-MATCH-02). Ne renvoie aucun champ de profil.';


-- ---------------------------------------------------------------------
-- private.network_call_criteria(uuid) -- criteres d'un appel en jsonb
--
-- ARBITRAGE (D6 45 : "le type d'aide accepte entre dans le matching").
-- Les cinq valeurs de `network_call_help_types` sont projetees sur les
-- types de disponibilite REELLEMENT declarables par un membre
-- (referentiel `availability_types`, 0025). Deux d'entre elles n'ont
-- aucune contrepartie : `recommendation` et `information` ne demandent
-- pas une disponibilite, elles demandent un geste ponctuel. Elles ne
-- projettent donc rien -- plutot que d'inventer une correspondance.
-- ---------------------------------------------------------------------
create or replace function private.network_call_criteria(p_call uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'required_skill_ids',  coalesce((select jsonb_agg(s.skill_id) from public.network_call_skills s
                                      where s.call_id = c.id and s.importance = 'required'), '[]'::jsonb),
    'preferred_skill_ids', coalesce((select jsonb_agg(s.skill_id) from public.network_call_skills s
                                      where s.call_id = c.id and s.importance = 'preferred'), '[]'::jsonb),
    'required_tool_ids',   coalesce((select jsonb_agg(t.tool_id) from public.network_call_tools t
                                      where t.call_id = c.id and t.importance = 'required'), '[]'::jsonb),
    'preferred_tool_ids',  coalesce((select jsonb_agg(t.tool_id) from public.network_call_tools t
                                      where t.call_id = c.id and t.importance = 'preferred'), '[]'::jsonb),
    'required_languages',  coalesce((select jsonb_agg(jsonb_build_object(
                                              'code', l.language_code,
                                              'min_proficiency', l.min_proficiency))
                                       from public.network_call_languages l
                                      where l.call_id = c.id and l.importance = 'required'), '[]'::jsonb),
    'preferred_languages', coalesce((select jsonb_agg(jsonb_build_object(
                                              'code', l.language_code,
                                              'min_proficiency', l.min_proficiency))
                                       from public.network_call_languages l
                                      where l.call_id = c.id and l.importance = 'preferred'), '[]'::jsonb),
    'sector_id',           c.sector_id,
    'sector_required',     (c.sector_importance = 'required'),
    'residence_country_codes',
      coalesce((select jsonb_agg(distinct k.code) from (
                 select n.country_code::text as code from public.network_call_countries n
                  where n.call_id = c.id and n.scope = 'residence'
                 union
                 select c.country_code::text where c.country_code is not null) k
                where k.code is not null), '[]'::jsonb),
    'experience_country_codes',
      coalesce((select jsonb_agg(n.country_code) from public.network_call_countries n
                 where n.call_id = c.id and n.scope = 'experience'), '[]'::jsonb),
    'geography_required',  exists (select 1 from public.network_call_countries n
                                    where n.call_id = c.id and n.importance = 'required'),
    'availability_types',
      coalesce((select jsonb_agg(distinct a.code) from public.network_call_help_types h
                 cross join lateral (
                   select unnest(case h.help_type
                                   when 'direct_expert' then array['ad_hoc_expertise','consulting','mission']
                                   when 'introduction'  then array['introduction']
                                   when 'advice'        then array['advisory']
                                   else array[]::text[] end) as code) a
                where h.call_id = c.id), '[]'::jsonb),
    'min_experience_years', c.min_experience_years,
    'organization_id',      c.preferred_organization_id,
    'organization_required',(c.organization_importance = 'required'),
    'promotion_year_from',  c.promotion_year_from,
    'promotion_year_to',    c.promotion_year_to
  )
  from public.network_calls c
  where c.id = p_call
$$;

revoke all on function private.network_call_criteria(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- public.compute_network_call_matches(uuid)
--
-- SECURITY DEFINER, motif B : ecrit `network_call_matches`, table sans
-- politique d'ecriture cliente. Reserve a l'auteur de l'appel.
-- Le score est stocke mais AUCUNE lecture publique ne le renvoie.
--
-- Le calcul remplace integralement le jeu precedent : un critere retire
-- ne doit pas laisser derriere lui une correspondance perimee.
-- ---------------------------------------------------------------------
create or replace function public.compute_network_call_matches(p_call_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_call  public.network_calls;
  v_count integer := 0;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_call from public.network_calls where id = p_call_id;
  if not found or v_call.deleted_at is not null then
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;
  if v_call.author_profile_id <> v_me and not private.has_permission('calls.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.network_call_matches where call_id = p_call_id;

  insert into public.network_call_matches
    (call_id, profile_id, score, component_scores, reasons, missing_criteria,
     relevance_label, notification_tier, computed_at)
  select
    p_call_id, m.profile_id, m.score, m.component_scores, m.reasons, m.missing_criteria,
    m.relevance_label,
    -- D22 71 : >= 75 immediat, 60-74 digest, en dessous aucune notification.
    case when m.score >= 75 then 'immediate'
         when m.score >= 60 then 'digest'
         else 'none' end,
    now()
  from private.profile_match_set(v_call.author_profile_id,
                                 private.network_call_criteria(p_call_id)) m
  -- Le ciblage explicite restreint AUSSI le calcul : un appel adresse a
  -- une promotion precise ne "correspond" a personne d'autre.
  where (
    not exists (select 1 from public.network_call_audience_profiles ap where ap.call_id = p_call_id)
    and not exists (select 1 from public.network_call_audience_promotions aq where aq.call_id = p_call_id)
  )
  or exists (select 1 from public.network_call_audience_profiles ap
              where ap.call_id = p_call_id and ap.profile_id = m.profile_id)
  or exists (select 1 from public.network_call_audience_promotions aq
              join public.ise_profiles p on p.id = m.profile_id
             where aq.call_id = p_call_id and p.promotion_id = aq.promotion_id);

  get diagnostics v_count = row_count;
  return v_count;
end
$fn$;

revoke all on function public.compute_network_call_matches(uuid) from public, anon;
grant execute on function public.compute_network_call_matches(uuid) to authenticated;

comment on function public.compute_network_call_matches(uuid) is
  'Recalcule integralement l''audience pertinente d''un appel. Reserve a son auteur. Le score reste interne (MASTER PROMPT 15).';


-- =====================================================================
-- 2. Lectures
-- =====================================================================

-- Curseur keyset porteur d'un score (D-44). Non `SECURITY DEFINER` :
-- rien a contourner. Le curseur est re-chiffre par l'application avant
-- d'atteindre le navigateur (`apps/web/src/lib/opaque-cursor.ts`), sans
-- quoi le score fuirait -- defaut deja constate en 8.4 de docs/rls.md.
create or replace function private.encode_score_cursor(p_score numeric, p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_score is null or p_id is null then null
              else encode(convert_to(p_score::text || '|' || p_id::text, 'UTF8'), 'base64') end
$$;

create or replace function private.decode_score_cursor(
  p_cursor text,
  out c_score numeric,
  out c_id    uuid
)
returns record
language plpgsql
immutable
set search_path = ''
as $$
declare v_raw text;
begin
  c_score := null; c_id := null;
  if p_cursor is null or length(p_cursor) = 0 then return; end if;
  begin
    v_raw := convert_from(decode(p_cursor, 'base64'), 'UTF8');
    if v_raw !~ '^[0-9]+(\.[0-9]+)?\|[0-9a-fA-F-]{36}$' then return; end if;
    c_score := split_part(v_raw, '|', 1)::numeric;
    c_id    := split_part(v_raw, '|', 2)::uuid;
  exception when others then
    c_score := null; c_id := null;
  end;
end
$$;

revoke all on function private.encode_score_cursor(numeric, uuid) from public, anon, authenticated;
revoke all on function private.decode_score_cursor(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- private.network_call_card(uuid, boolean)
--
-- Carte d'appel telle qu'elle apparait en liste et en tete de detail.
-- SECURITY DEFINER motif A : appelle `private.network_profile_card()`,
-- qui lit la visibilite d'un tiers. `hide_author_organization` (D26 52)
-- est applique ICI, en RETIRANT le champ -- jamais en le renvoyant pour
-- le masquer ensuite (MASTER PROMPT 47).
--
-- `relevance` porte le LIBELLE et les RAISONS de la correspondance du
-- lecteur. Ni le score, ni le rang, ni un pourcentage.
-- ---------------------------------------------------------------------
create or replace function private.network_call_card(p_call uuid, p_full boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me     uuid := private.current_profile_id();
  v_c      public.network_calls;
  v_out    jsonb;
  v_author jsonb;
begin
  select * into v_c from public.network_calls where id = p_call;
  if not found then return null; end if;

  v_author := private.network_profile_card(v_c.author_profile_id);
  if v_author is not null and v_c.hide_author_organization then
    v_author := v_author - 'current_organization';
  end if;

  v_out := jsonb_build_object(
    'call_id',        v_c.id,
    'call_type',      v_c.call_type,
    'call_family',    v_c.call_family,
    'title',          v_c.title,
    'status',         v_c.status,
    'urgency',        v_c.urgency,
    'visibility',     v_c.visibility,
    'deadline',       v_c.deadline,
    'published_at',   v_c.published_at,
    'created_at',     v_c.created_at,
    'closed_at',      v_c.closed_at,
    'resolution',     v_c.resolution,
    'is_author',      (v_c.author_profile_id = v_me),
    'author',         v_author,
    'country',        (select cn.name_fr from public.countries cn where cn.code = v_c.country_code),
    'city',           v_c.city,
    'remote_allowed', v_c.remote_allowed,
    'sector',         (select s.name from public.sectors s where s.id = v_c.sector_id),
    'skills',         coalesce((select jsonb_agg(jsonb_build_object('name', s.name,
                                                                   'importance', ncs.importance)
                                                 order by ncs.importance, s.name)
                                  from public.network_call_skills ncs
                                  join public.skills s on s.id = ncs.skill_id
                                 where ncs.call_id = v_c.id), '[]'::jsonb),
    'help_types',     coalesce((select jsonb_agg(h.help_type order by h.help_type)
                                  from public.network_call_help_types h
                                 where h.call_id = v_c.id), '[]'::jsonb),
    'response_count', (select count(*) from public.network_call_responses r where r.call_id = v_c.id),
    'is_saved',       exists (select 1 from public.saved_network_calls sv
                               where sv.call_id = v_c.id and sv.profile_id = v_me),
    'my_response_id', (select r.id from public.network_call_responses r
                        where r.call_id = v_c.id and r.author_profile_id = v_me limit 1),
    -- Le libelle qualitatif et les raisons, jamais le score (D-42, D-43).
    'relevance',      (select jsonb_build_object('label', m.relevance_label, 'reasons', m.reasons)
                         from public.network_call_matches m
                        where m.call_id = v_c.id and m.profile_id = v_me),
    -- Extrait court : la carte de liste montre 2 a 3 lignes (D6 12).
    'excerpt',        left(regexp_replace(v_c.description, '\s+', ' ', 'g'), 220));

  if p_full then
    v_out := v_out || jsonb_build_object(
      'description',            v_c.description,
      'context',                v_c.context,
      'wanted_profile',         v_c.wanted_profile,
      'min_experience_years',   v_c.min_experience_years,
      'max_experience_years',   v_c.max_experience_years,
      'promotion_year_from',    v_c.promotion_year_from,
      'promotion_year_to',      v_c.promotion_year_to,
      'closure_result_type',    v_c.closure_result_type,
      'closure_missing_reason', v_c.closure_missing_reason,
      'closure_notes',          v_c.closure_notes,
      'impact_testimonial',     case when v_c.impact_testimonial_consent
                                     then v_c.impact_testimonial else null end,
      'tools',     coalesce((select jsonb_agg(jsonb_build_object('name', t.name,
                                                                'importance', nct.importance)
                                              order by nct.importance, t.name)
                               from public.network_call_tools nct
                               join public.tools t on t.id = nct.tool_id
                              where nct.call_id = v_c.id), '[]'::jsonb),
      'languages', coalesce((select jsonb_agg(jsonb_build_object('name', lg.name_fr,
                                                                'min_proficiency', ncl.min_proficiency,
                                                                'importance', ncl.importance)
                                              order by ncl.importance, lg.name_fr)
                               from public.network_call_languages ncl
                               join public.languages lg on lg.code = ncl.language_code
                              where ncl.call_id = v_c.id), '[]'::jsonb),
      'countries', coalesce((select jsonb_agg(jsonb_build_object('name', cn.name_fr,
                                                                'scope', ncc.scope,
                                                                'importance', ncc.importance)
                                              order by ncc.scope, cn.name_fr)
                               from public.network_call_countries ncc
                               join public.countries cn on cn.code = ncc.country_code
                              where ncc.call_id = v_c.id), '[]'::jsonb),
      'audience_promotions', coalesce((select jsonb_agg(concat_ws(' ', pr.program_code,
                                                                  pr.graduation_year::text)
                                                        order by pr.graduation_year)
                                         from public.network_call_audience_promotions ap
                                         join public.promotions pr on pr.id = ap.promotion_id
                                        where ap.call_id = v_c.id), '[]'::jsonb),
      'audience_profile_count', (select count(*) from public.network_call_audience_profiles ap
                                  where ap.call_id = v_c.id));
  end if;

  return v_out;
end
$fn$;

revoke all on function private.network_call_card(uuid, boolean) from public, anon, authenticated;

comment on function private.network_call_card(uuid, boolean) is
  'Carte d''appel au reseau. Retire l''organisation de l''auteur quand il l''a masquee (D26 52) au lieu de la renvoyer puis la cacher. Expose le libelle de pertinence, jamais le score.';


-- ---------------------------------------------------------------------
-- ISE-047 -- liste des appels
--
-- `p_scope` :
--   'for_me'    onglet par defaut : uniquement les appels ou une
--               correspondance REELLE existe pour le lecteur. Classement
--               par score interne decroissant, curseur portant le score.
--   'all'       tous les appels de mon perimetre (D-73 + ciblage).
--   'promotion' ceux dont l'auteur partage ma promotion.
--   'saved'     mes appels mis de cote.
-- Tri chronologique pour les trois derniers (D-44). Aucun tri par
-- popularite : le nombre de reponses n'entre dans aucun classement
-- (CA-MATCH-09).
-- ---------------------------------------------------------------------
create or replace function public.list_network_calls(
  p_scope        text    default 'for_me',
  p_query        text    default null,
  p_call_type    text    default null,
  p_skill_id     bigint  default null,
  p_sector_id    bigint  default null,
  p_country_code char(2) default null,
  p_urgency      text    default null,
  p_status       text    default 'open',
  p_cursor       text    default null,
  p_limit        integer default 20
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
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_scope not in ('for_me', 'all', 'promotion', 'saved') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  if v_scope = 'for_me' then
    select c_score, c_id into v_c_score, v_c_id from private.decode_score_cursor(p_cursor);

    with base as (
      select c.id, m.score
      from public.network_calls c
      join public.network_call_matches m on m.call_id = c.id and m.profile_id = v_me
      where private.can_see_network_call(c.id)
        and c.author_profile_id <> v_me
        and (case when coalesce(p_status, 'open') = 'open'
                  then c.status = 'active'
                  else c.status in ('active', 'paused', 'resolved', 'closed', 'expired') end)
        and (p_call_type is null or c.call_type = p_call_type)
        and (p_sector_id is null or c.sector_id = p_sector_id)
        and (p_country_code is null or c.country_code = p_country_code)
        and (p_urgency is null or c.urgency = p_urgency)
        and (p_skill_id is null or exists (select 1 from public.network_call_skills s
                                            where s.call_id = c.id and s.skill_id = p_skill_id))
        and (v_q is null or public.normalize_text(c.title) like '%' || public.normalize_text(v_q) || '%')
        and (v_c_score is null or (m.score, c.id) < (v_c_score, v_c_id))
      order by m.score desc, c.id desc
      limit v_limit
    )
    select coalesce(jsonb_agg(private.network_call_card(b.id, false) order by b.score desc, b.id desc),
                    '[]'::jsonb),
           private.encode_score_cursor(min(b.score), (array_agg(b.id order by b.score, b.id))[1])
      into v_rows, v_next
    from base b;

    if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
    return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select c.id, coalesce(c.published_at, c.created_at) as at
    from public.network_calls c
    where private.can_see_network_call(c.id)
      and c.status in ('active', 'paused', 'resolved', 'closed', 'expired')
      and (case when coalesce(p_status, 'open') = 'open' then c.status = 'active' else true end)
      and (v_scope <> 'promotion' or private.shares_promotion_with(c.author_profile_id))
      and (v_scope <> 'saved' or exists (select 1 from public.saved_network_calls sv
                                          where sv.call_id = c.id and sv.profile_id = v_me))
      and (p_call_type is null or c.call_type = p_call_type)
      and (p_sector_id is null or c.sector_id = p_sector_id)
      and (p_country_code is null or c.country_code = p_country_code)
      and (p_urgency is null or c.urgency = p_urgency)
      and (p_skill_id is null or exists (select 1 from public.network_call_skills s
                                          where s.call_id = c.id and s.skill_id = p_skill_id))
      and (v_q is null or public.normalize_text(c.title) like '%' || public.normalize_text(v_q) || '%')
      and (v_c_at is null or (coalesce(c.published_at, c.created_at), c.id) < (v_c_at, v_c_id))
    order by coalesce(c.published_at, c.created_at) desc, c.id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(private.network_call_card(b.id, false) order by b.at desc, b.id desc),
                  '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_network_calls(text, text, text, bigint, bigint, char(2), text, text, text, integer) from public, anon;
grant execute on function public.list_network_calls(text, text, text, bigint, bigint, char(2), text, text, text, integer) to authenticated;

comment on function public.list_network_calls(text, text, text, bigint, bigint, char(2), text, text, text, integer) is
  'ISE-047. Onglet "Pour moi" : uniquement les appels ou une correspondance reelle existe. Aucun tri par popularite (CA-MATCH-09).';


-- ISE-048 -- detail d'un appel.
create or replace function public.get_network_call(p_call_id uuid)
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
  if not private.can_see_network_call(p_call_id) then
    -- Indistinctement : inexistant, hors audience, bloque, brouillon d'un tiers.
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;

  v_card := private.network_call_card(p_call_id, true);

  -- Ma reponse, s'il y en a une : l'ecran doit dire "vous avez deja
  -- repondu" plutot que proposer une seconde fois le meme geste.
  v_card := v_card || jsonb_build_object(
    'my_response', (select jsonb_build_object(
                             'response_id',   r.id,
                             'response_type', r.response_type,
                             'message',       r.message,
                             'created_at',    r.created_at)
                      from public.network_call_responses r
                     where r.call_id = p_call_id and r.author_profile_id = v_me
                     limit 1));

  return v_card;
end
$fn$;

revoke all on function public.get_network_call(uuid) from public, anon;
grant execute on function public.get_network_call(uuid) to authenticated;


-- ISE-053 (onglet "Mes appels") -- mes appels, groupes par etat.
create or replace function public.list_my_network_calls(
  p_group  text    default 'active',
  p_cursor text    default null,
  p_limit  integer default 20
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
  v_group text    := coalesce(p_group, 'active');
  v_rows  jsonb   := '[]'::jsonb;
  v_next  text;
  v_c_at  timestamptz;
  v_c_id  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_group not in ('active', 'resolved', 'drafts', 'expired') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select c.id, coalesce(c.published_at, c.created_at) as at
    from public.network_calls c
    where c.author_profile_id = v_me
      and c.deleted_at is null
      and case v_group
            when 'active'   then c.status in ('active', 'paused')
            when 'resolved' then c.status in ('resolved', 'closed')
            when 'drafts'   then c.status = 'draft'
            else c.status in ('expired', 'cancelled', 'moderated')
          end
      and (v_c_at is null or (coalesce(c.published_at, c.created_at), c.id) < (v_c_at, v_c_id))
    order by coalesce(c.published_at, c.created_at) desc, c.id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(
           private.network_call_card(b.id, false)
           || jsonb_build_object(
                'useful_response_count',
                  (select count(*) from public.network_call_responses r
                    where r.call_id = b.id and r.status in ('useful','contacted','selected')),
                'recommendation_count',
                  (select count(*) from public.network_call_recommendations rc where rc.call_id = b.id),
                'targeted_count',
                  (select count(*) from public.network_call_matches m where m.call_id = b.id))
           order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_my_network_calls(text, text, integer) from public, anon;
grant execute on function public.list_my_network_calls(text, text, integer) to authenticated;


-- ISE-051 / ISE-052 -- profils pertinents d'un appel, vus par son auteur.
-- Renvoie le libelle et les raisons. JAMAIS le score, JAMAIS un rang.
create or replace function public.list_network_call_matches(
  p_call_id uuid,
  p_cursor  text    default null,
  p_limit   integer default 20
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
  v_rows    jsonb   := '[]'::jsonb;
  v_next    text;
  v_c_score numeric;
  v_c_id    uuid;
  v_total   bigint;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_network_call_author(p_call_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select c_score, c_id into v_c_score, v_c_id from private.decode_score_cursor(p_cursor);

  select count(*) into v_total
    from public.network_call_matches m
   where m.call_id = p_call_id
     and (v_c_score is null or (m.score, m.profile_id) < (v_c_score, v_c_id));

  with base as (
    select m.profile_id, m.score, m.relevance_label, m.reasons
    from public.network_call_matches m
    where m.call_id = p_call_id
      and (v_c_score is null or (m.score, m.profile_id) < (v_c_score, v_c_id))
    order by m.score desc, m.profile_id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
             'profile', private.network_profile_card(b.profile_id),
             'label',   b.relevance_label,
             'reasons', b.reasons)
           order by b.score desc, b.profile_id desc)
           filter (where private.network_profile_card(b.profile_id) is not null), '[]'::jsonb),
         private.encode_score_cursor(min(b.score),
                                     (array_agg(b.profile_id order by b.score, b.profile_id))[1])
    into v_rows, v_next
  from base b;

  if v_total <= v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_network_call_matches(uuid, text, integer) from public, anon;
grant execute on function public.list_network_call_matches(uuid, text, integer) to authenticated;


-- ISE-052 -- apercu d'audience avant publication.
-- Les chiffres sont REELLEMENT issus du calcul (D6 44) : la fonction
-- recalcule avant de compter, et l'interface n'affiche jamais un chiffre
-- qu'elle n'a pas recu.
create or replace function public.preview_network_call_audience(p_call_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_network_call_author(p_call_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform public.compute_network_call_matches(p_call_id);

  return jsonb_build_object(
    'computed', true,
    'total',          (select count(*) from public.network_call_matches m where m.call_id = p_call_id),
    'very_relevant',  (select count(*) from public.network_call_matches m
                        where m.call_id = p_call_id and m.relevance_label = 'very_relevant'),
    'relevant',       (select count(*) from public.network_call_matches m
                        where m.call_id = p_call_id and m.relevance_label = 'relevant'),
    'close_profile',  (select count(*) from public.network_call_matches m
                        where m.call_id = p_call_id and m.relevance_label = 'close_profile'),
    'priority_notice',(select count(*) from public.network_call_matches m
                        where m.call_id = p_call_id and m.notification_tier = 'immediate'),
    'samples',        coalesce((select jsonb_agg(jsonb_build_object(
                                         'profile', private.network_profile_card(x.profile_id),
                                         'label',   x.relevance_label,
                                         'reasons', x.reasons))
                                  from (select m.profile_id, m.relevance_label, m.reasons
                                          from public.network_call_matches m
                                         where m.call_id = p_call_id
                                         order by m.score desc, m.profile_id desc
                                         limit 3) x
                                 where private.network_profile_card(x.profile_id) is not null),
                               '[]'::jsonb));
end
$fn$;

revoke all on function public.preview_network_call_audience(uuid) from public, anon;
grant execute on function public.preview_network_call_audience(uuid) to authenticated;


-- ISE-053 -- indicateurs de suivi. Aucune vanity metric (D6 58) :
-- le nombre de profils CIBLES, les reponses, les reponses utiles, les
-- recommandations et les introductions proposees. Pas de "vues".
create or replace function public.get_network_call_tracking(p_call_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_network_call_author(p_call_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return private.network_call_card(p_call_id, true) || jsonb_build_object(
    'targeted',        (select count(*) from public.network_call_matches m where m.call_id = p_call_id),
    'responses',       (select count(*) from public.network_call_responses r where r.call_id = p_call_id),
    'useful',          (select count(*) from public.network_call_responses r
                         where r.call_id = p_call_id and r.status in ('useful','contacted','selected')),
    'recommendations', (select count(*) from public.network_call_recommendations rc
                         where rc.call_id = p_call_id),
    'introductions',   (select count(*) from public.network_call_recommendations rc
                         where rc.call_id = p_call_id and rc.offers_introduction),
    'first_response_at', (select min(r.created_at) from public.network_call_responses r
                           where r.call_id = p_call_id),
    'by_status', coalesce((select jsonb_object_agg(t.status, t.n)
                             from (select r.status, count(*) as n
                                     from public.network_call_responses r
                                    where r.call_id = p_call_id group by r.status) t), '{}'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
                                 'event_type',  e.event_type,
                                 'from_status', e.from_status,
                                 'to_status',   e.to_status,
                                 'created_at',  e.created_at)
                               order by e.created_at desc)
                          from public.network_call_events e where e.call_id = p_call_id), '[]'::jsonb));
end
$fn$;

revoke all on function public.get_network_call_tracking(uuid) from public, anon;
grant execute on function public.get_network_call_tracking(uuid) to authenticated;


-- ISE-053 -- reponses recues. Reservees a l'auteur de l'appel :
-- un repondant ne voit JAMAIS les reponses des autres (CA-CALL-06).
create or replace function public.list_network_call_responses(
  p_call_id uuid,
  p_status  text    default null,
  p_kind    text    default null,
  p_cursor  text    default null,
  p_limit   integer default 20
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
  v_rows  jsonb   := '[]'::jsonb;
  v_next  text;
  v_c_at  timestamptz;
  v_c_id  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_network_call_author(p_call_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select r.id, r.created_at as at
    from public.network_call_responses r
    where r.call_id = p_call_id
      and (p_status is null or r.status = p_status)
      and (p_kind is null or r.response_type = p_kind)
      and (v_c_at is null or (r.created_at, r.id) < (v_c_at, v_c_id))
    order by r.created_at desc, r.id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
             'response_id',    r.id,
             'response_type',  r.response_type,
             'message',        r.message,
             'shares_contact', r.shares_contact,
             'status',         r.status,
             'created_at',     r.created_at,
             'author',         private.network_profile_card(r.author_profile_id),
             'relevance',      (select jsonb_build_object('label', m.relevance_label,
                                                          'reasons', m.reasons)
                                  from public.network_call_matches m
                                 where m.call_id = p_call_id and m.profile_id = r.author_profile_id),
             'recommendations', coalesce((select jsonb_agg(jsonb_build_object(
                                                   'recommendation_id',      rc.id,
                                                   'rationale',              rc.rationale,
                                                   'offers_introduction',    rc.offers_introduction,
                                                   'consent_confirmed',      rc.consent_confirmed,
                                                   'status',                 rc.status,
                                                   'external_person_name',   rc.external_person_name,
                                                   'external_person_context',rc.external_person_context,
                                                   'profile', private.network_profile_card(rc.recommended_profile_id)))
                                            from public.network_call_recommendations rc
                                           where rc.response_id = r.id), '[]'::jsonb))
           order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b
  join public.network_call_responses r on r.id = b.id;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_network_call_responses(uuid, text, text, text, integer) from public, anon;
grant execute on function public.list_network_call_responses(uuid, text, text, text, integer) to authenticated;


-- ISE-054 -- contributeurs proposables a la cloture : les repondants,
-- rien d'autre. Un membre qui n'a pas repondu ne peut pas etre credite.
create or replace function public.list_network_call_respondents(p_call_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_network_call_author(p_call_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'profile_id',    x.author_profile_id,
             'profile',       private.network_profile_card(x.author_profile_id),
             'response_type', x.response_type,
             'status',        x.status)
           order by x.created_at)
      from (select distinct on (r.author_profile_id)
                   r.author_profile_id, r.response_type, r.status, r.created_at
              from public.network_call_responses r
             where r.call_id = p_call_id
             order by r.author_profile_id, r.created_at) x
     where private.network_profile_card(x.author_profile_id) is not null), '[]'::jsonb);
end
$fn$;

revoke all on function public.list_network_call_respondents(uuid) from public, anon;
grant execute on function public.list_network_call_respondents(uuid) to authenticated;


-- =====================================================================
-- 3. Ecritures
-- =====================================================================

-- ---------------------------------------------------------------------
-- ISE-049 / ISE-050 / ISE-051 -- enregistrement du brouillon
--
-- SECURITY DEFINER, motif B : le brouillon, ses criteres et son
-- audience forment UN SEUL fait. Les ecrire en huit requetes distinctes
-- laisserait un appel a moitie cible si l'une echoue.
--
-- La fonction n'ecrit QUE des brouillons : elle refuse tout appel deja
-- publie. La publication reste `publish_network_call` (0007).
-- Limitation de debit D-103 sur la CREATION.
--
-- L'urgence n'est jamais saisie : elle est DEDUITE de l'echeance
-- (D6 38). Un membre ne peut donc pas se declarer urgent a volonte.
-- ---------------------------------------------------------------------
create or replace function public.save_network_call_draft(
  p_call_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid  := private.current_profile_id();
  v_id uuid  := p_call_id;
  v_c  public.network_calls;
  p    jsonb := coalesce(p_payload, '{}'::jsonb);
  v_dl timestamptz := nullif(p->>'deadline','')::timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_id is null then
    -- D-103 : 10 creations d'appel par jour et par compte.
    if not private.consume_rate_limit(v_me::text, 'network_call.create', 10, 86400) then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;

    insert into public.network_calls (
      author_profile_id, call_family, call_type, title, description, context,
      wanted_profile, sector_id, sector_importance, country_code, city, remote_allowed,
      preferred_organization_id, organization_importance,
      min_experience_years, max_experience_years,
      promotion_year_from, promotion_year_to,
      deadline, urgency, visibility, hide_author_organization, status
    ) values (
      v_me,
      nullif(p->>'call_family',''),
      coalesce(nullif(p->>'call_type',''), 'other'),
      coalesce(nullif(btrim(p->>'title'),''), 'Brouillon sans titre'),
      coalesce(nullif(btrim(p->>'description'),''),
               'Brouillon en cours de redaction, description a completer.'),
      nullif(p->>'context',''),
      nullif(p->>'wanted_profile',''),
      nullif(p->>'sector_id','')::bigint,
      coalesce(nullif(p->>'sector_importance',''), 'preferred'),
      nullif(p->>'country_code','')::char(2),
      nullif(p->>'city',''),
      coalesce((p->>'remote_allowed')::boolean, false),
      nullif(p->>'preferred_organization_id','')::uuid,
      coalesce(nullif(p->>'organization_importance',''), 'preferred'),
      nullif(p->>'min_experience_years','')::smallint,
      nullif(p->>'max_experience_years','')::smallint,
      nullif(p->>'promotion_year_from','')::smallint,
      nullif(p->>'promotion_year_to','')::smallint,
      v_dl,
      case when v_dl is not null and v_dl <= now() + interval '14 days'
           then 'deadline_soon' else 'normal' end,
      coalesce(nullif(p->>'visibility',''), 'members'),
      coalesce((p->>'hide_author_organization')::boolean, false),
      'draft'
    ) returning id into v_id;
  else
    select * into v_c from public.network_calls where id = v_id for update;
    if not found or v_c.deleted_at is not null then
      raise exception 'network_call_not_found' using errcode = 'P0002';
    end if;
    if v_c.author_profile_id <> v_me then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if v_c.status <> 'draft' then
      -- Un appel publie ne se reecrit pas par ce chemin (0040).
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;

    update public.network_calls set
      call_family              = coalesce(nullif(p->>'call_family',''), call_family),
      call_type                = coalesce(nullif(p->>'call_type',''), call_type),
      title                    = coalesce(nullif(btrim(p->>'title'),''), title),
      description              = coalesce(nullif(btrim(p->>'description'),''), description),
      context                  = case when jsonb_exists(p, 'context') then nullif(p->>'context','') else context end,
      wanted_profile           = case when jsonb_exists(p, 'wanted_profile') then nullif(p->>'wanted_profile','') else wanted_profile end,
      sector_id                = case when jsonb_exists(p, 'sector_id') then nullif(p->>'sector_id','')::bigint else sector_id end,
      sector_importance        = coalesce(nullif(p->>'sector_importance',''), sector_importance),
      country_code             = case when jsonb_exists(p, 'country_code') then nullif(p->>'country_code','')::char(2) else country_code end,
      city                     = case when jsonb_exists(p, 'city') then nullif(p->>'city','') else city end,
      remote_allowed           = coalesce((p->>'remote_allowed')::boolean, remote_allowed),
      preferred_organization_id= case when jsonb_exists(p, 'preferred_organization_id')
                                      then nullif(p->>'preferred_organization_id','')::uuid
                                      else preferred_organization_id end,
      organization_importance  = coalesce(nullif(p->>'organization_importance',''), organization_importance),
      min_experience_years     = case when jsonb_exists(p, 'min_experience_years') then nullif(p->>'min_experience_years','')::smallint else min_experience_years end,
      max_experience_years     = case when jsonb_exists(p, 'max_experience_years') then nullif(p->>'max_experience_years','')::smallint else max_experience_years end,
      promotion_year_from      = case when jsonb_exists(p, 'promotion_year_from') then nullif(p->>'promotion_year_from','')::smallint else promotion_year_from end,
      promotion_year_to        = case when jsonb_exists(p, 'promotion_year_to') then nullif(p->>'promotion_year_to','')::smallint else promotion_year_to end,
      deadline                 = case when jsonb_exists(p, 'deadline') then v_dl else deadline end,
      urgency                  = case
                                   when (case when jsonb_exists(p, 'deadline') then v_dl else deadline end) is not null
                                    and (case when jsonb_exists(p, 'deadline') then v_dl else deadline end) <= now() + interval '14 days'
                                   then 'deadline_soon' else 'normal' end,
      visibility               = coalesce(nullif(p->>'visibility',''), visibility),
      hide_author_organization = coalesce((p->>'hide_author_organization')::boolean, hide_author_organization)
    where id = v_id;
  end if;

  -- ---- Criteres multivalues : remplacement integral, cle par cle -----
  -- Une cle absente n'est PAS une liste vide : elle signifie "cette
  -- etape n'a pas ete soumise". Sans cette distinction, revenir a
  -- l'etape 1 effacerait le ciblage de l'etape 3.
  if jsonb_exists(p, 'skills') then
    delete from public.network_call_skills where call_id = v_id;
    insert into public.network_call_skills (call_id, skill_id, importance)
    select v_id, (e->>'skill_id')::bigint, coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'skills') e
     where nullif(e->>'skill_id','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'tools') then
    delete from public.network_call_tools where call_id = v_id;
    insert into public.network_call_tools (call_id, tool_id, importance)
    select v_id, (e->>'tool_id')::bigint, coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'tools') e
     where nullif(e->>'tool_id','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'languages') then
    delete from public.network_call_languages where call_id = v_id;
    insert into public.network_call_languages (call_id, language_code, min_proficiency, importance)
    select v_id, (e->>'language_code')::varchar(10),
           coalesce(nullif(e->>'min_proficiency',''), 'professional'),
           coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'languages') e
     where nullif(e->>'language_code','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'countries') then
    delete from public.network_call_countries where call_id = v_id;
    insert into public.network_call_countries (call_id, country_code, scope, importance)
    select v_id, (e->>'country_code')::char(2),
           coalesce(nullif(e->>'scope',''), 'experience'),
           coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'countries') e
     where nullif(e->>'country_code','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'help_types') then
    delete from public.network_call_help_types where call_id = v_id;
    insert into public.network_call_help_types (call_id, help_type)
    select v_id, e from jsonb_array_elements_text(p->'help_types') e
     where e in ('direct_expert','recommendation','introduction','advice','information')
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'audience_promotion_ids') then
    delete from public.network_call_audience_promotions where call_id = v_id;
    insert into public.network_call_audience_promotions (call_id, promotion_id)
    select v_id, e::bigint from jsonb_array_elements_text(p->'audience_promotion_ids') e
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'audience_profile_ids') then
    delete from public.network_call_audience_profiles where call_id = v_id;
    insert into public.network_call_audience_profiles (call_id, profile_id)
    select v_id, e::uuid from jsonb_array_elements_text(p->'audience_profile_ids') e
    on conflict do nothing;
  end if;

  if p_call_id is null then
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('network_call.created', 'network_call', v_id, v_me,
            jsonb_build_object('call_type', coalesce(nullif(p->>'call_type',''), 'other')));
  end if;

  return jsonb_build_object('call_id', v_id);
end
$fn$;

revoke all on function public.save_network_call_draft(uuid, jsonb) from public, anon;
grant execute on function public.save_network_call_draft(uuid, jsonb) to authenticated;

comment on function public.save_network_call_draft(uuid, jsonb) is
  'ISE-049 -> ISE-051. Ecrit un BROUILLON et ses criteres de facon atomique. Refuse tout appel publie : la publication passe par publish_network_call (0007). Urgence deduite de l''echeance (D6 38).';


-- ---------------------------------------------------------------------
-- ISE-052 -- publier, puis calculer l'audience dans la meme transaction.
--
-- `publish_network_call` (0007) n'est PAS reecrite : elle est appelee.
-- Ce chemin ajoute uniquement le calcul de l'audience et l'evenement de
-- domaine, pour qu'un appel publie ne reste jamais sans correspondances.
-- ---------------------------------------------------------------------
create or replace function public.publish_network_call_with_audience(
  p_call_id     uuid,
  p_extend_days integer default 60
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_count integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform public.publish_network_call(p_call_id, p_extend_days);
  v_count := public.compute_network_call_matches(p_call_id);

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('network_call.published', 'network_call', p_call_id, v_me,
          jsonb_build_object('targeted', v_count));

  return jsonb_build_object('call_id', p_call_id, 'targeted', v_count);
end
$fn$;

revoke all on function public.publish_network_call_with_audience(uuid, integer) from public, anon;
grant execute on function public.publish_network_call_with_audience(uuid, integer) to authenticated;


-- ---------------------------------------------------------------------
-- ISE-048 / ISE-051 -- repondre a un appel
--
-- SECURITY DEFINER, motif B : la reponse et la recommandation qu'elle
-- porte forment un seul fait. La fonction rejoue explicitement chaque
-- condition de la politique `network_call_responses_create` (0040),
-- puisque SECURITY DEFINER contourne la RLS.
--
-- CA-CALL-05 : aucune coordonnee d'un tiers n'est stockee. Pour une
-- personne hors reseau, seuls un nom et un contexte sont acceptes, et
-- l'introduction reste a la main du repondant.
-- ---------------------------------------------------------------------
create or replace function public.respond_to_network_call(
  p_call_id                 uuid,
  p_response_type           text,
  p_message                 text    default null,
  p_shares_contact          boolean default false,
  p_recommended_profile_id  uuid    default null,
  p_external_person_name    text    default null,
  p_external_person_context text    default null,
  p_rationale               text    default null,
  p_offers_introduction     boolean default false,
  p_consent_confirmed       boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_call public.network_calls;
  v_id   uuid;
  v_rec  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_response_type is null or p_response_type not in
     ('direct','knows_someone','introduction','information','participate','other') then
    raise exception 'invalid_response_type' using errcode = 'P0001';
  end if;

  select * into v_call from public.network_calls where id = p_call_id for update;
  if not found or not private.can_see_network_call(p_call_id) then
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;
  if v_call.author_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if v_call.status <> 'active' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.network_call_responses r
              where r.call_id = p_call_id and r.author_profile_id = v_me) then
    raise exception 'already_responded' using errcode = 'P0001';
  end if;

  -- "Je connais quelqu'un" : soit un ISE, soit une personne nommee.
  if p_response_type = 'knows_someone'
     and p_recommended_profile_id is null
     and nullif(btrim(coalesce(p_external_person_name, '')), '') is null then
    raise exception 'recommendation_target_required' using errcode = 'P0001';
  end if;
  if p_recommended_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if p_recommended_profile_id is not null
     and private.is_blocked_between(v_me, p_recommended_profile_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  -- D-103 : 40 reponses par jour et par compte.
  if not private.consume_rate_limit(v_me::text, 'network_call.respond', 40, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.network_call_responses
    (call_id, author_profile_id, response_type, message, shares_contact, status)
  values (p_call_id, v_me, p_response_type, nullif(btrim(coalesce(p_message,'')), ''),
          coalesce(p_shares_contact, false), 'new')
  returning id into v_id;

  if p_recommended_profile_id is not null
     or nullif(btrim(coalesce(p_external_person_name, '')), '') is not null then
    insert into public.network_call_recommendations
      (response_id, call_id, recommender_profile_id, recommended_profile_id,
       external_person_name, external_person_context, rationale,
       offers_introduction, consent_confirmed, status)
    values (v_id, p_call_id, v_me,
            p_recommended_profile_id,
            case when p_recommended_profile_id is null
                 then nullif(btrim(coalesce(p_external_person_name,'')), '') end,
            case when p_recommended_profile_id is null
                 then nullif(btrim(coalesce(p_external_person_context,'')), '') end,
            nullif(btrim(coalesce(p_rationale,'')), ''),
            coalesce(p_offers_introduction, false),
            coalesce(p_consent_confirmed, false),
            'proposed')
    returning id into v_rec;

    insert into public.domain_events
      (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('network_call.recommendation_made', 'network_call', p_call_id, v_me,
            jsonb_build_object('response_id', v_id,
                               'is_external', (p_recommended_profile_id is null)));
  end if;

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('network_call.responded', 'network_call', p_call_id, v_me,
          jsonb_build_object('response_id', v_id, 'response_type', p_response_type));

  return jsonb_build_object('response_id', v_id, 'recommendation_id', v_rec);
end
$fn$;

revoke all on function public.respond_to_network_call(uuid, text, text, boolean, uuid, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.respond_to_network_call(uuid, text, text, boolean, uuid, text, text, text, boolean, boolean) to authenticated;


-- ISE-053 -- triage des reponses par l'auteur. Statuts PRIVES (D6 65).
-- Aucun libelle de rejet n'existe dans la machine : `archived` n'est pas
-- un jugement et n'est jamais montre au repondant (0040).
create or replace function public.set_network_call_response_status(
  p_response_id uuid,
  p_status      text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_r  public.network_call_responses;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_status is null or p_status not in ('new','reviewed','useful','contacted','selected','archived') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  select * into v_r from public.network_call_responses where id = p_response_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.is_network_call_author(v_r.call_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.network_call_responses
     set status = p_status,
         marked_useful_at = case
           when p_status in ('useful','contacted','selected') then coalesce(marked_useful_at, now())
           when p_status in ('new','reviewed') then null
           else marked_useful_at end,
         first_useful_response = case
           when p_status in ('useful','contacted','selected')
            and not exists (select 1 from public.network_call_responses o
                             where o.call_id = v_r.call_id
                               and o.id <> v_r.id
                               and o.marked_useful_at is not null)
           then true else first_useful_response end
   where id = p_response_id;

  return jsonb_build_object('response_id', p_response_id, 'status', p_status);
end
$fn$;

revoke all on function public.set_network_call_response_status(uuid, text) from public, anon;
grant execute on function public.set_network_call_response_status(uuid, text) to authenticated;


-- ISE-047 -- "Enregistrer" / "Retirer". Donnee strictement personnelle
-- (D-72) et sans aucun effet sur le classement (CA-MATCH-09).
create or replace function public.toggle_saved_network_call(
  p_call_id uuid,
  p_saved   boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_network_call(p_call_id) then
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;

  if coalesce(p_saved, false) then
    insert into public.saved_network_calls (profile_id, call_id)
    values (v_me, p_call_id) on conflict do nothing;
  else
    delete from public.saved_network_calls where profile_id = v_me and call_id = p_call_id;
  end if;

  return jsonb_build_object('call_id', p_call_id, 'is_saved', coalesce(p_saved, false));
end
$fn$;

revoke all on function public.toggle_saved_network_call(uuid, boolean) from public, anon;
grant execute on function public.toggle_saved_network_call(uuid, boolean) to authenticated;
