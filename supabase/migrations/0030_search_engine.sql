-- =====================================================================
-- 0030_search_engine
-- Couche base de donnees du MOTEUR DE RECHERCHE (D22 sections 1.x du
-- digest C, decisions D-17, D-44, D-45, D-46, D-72, D-73).
--
-- Contenu :
--   1. Alimentation de public.profile_search_documents (D-17)
--      - private.rebuild_profile_search_document(uuid)
--      - private.mark_search_document_stale()  (triggers)
--      - private.refresh_stale_search_documents(int)  (cron)
--   2. private.profile_years_of_experience(uuid)  (partage avec 0031)
--   3. public.search_profiles(...)  (RPC, pagination par curseur)
--   4. Index reellement reclames par le plan d'execution
--
-- Aucune politique RLS n'est creee ni modifiee ici.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. profile_search_documents : refreshed_at devient nullable
--
-- `refreshed_at is null` est le MARQUEUR DE PERIMEE. La colonne etait
-- `not null default now()` en 0005 : on lui retire seulement la
-- contrainte de non-nullite. Aucune donnee n'est detruite, aucune
-- colonne n'est supprimee (db-conventions section 1).
-- ---------------------------------------------------------------------
alter table public.profile_search_documents
  alter column refreshed_at drop not null;

comment on column public.profile_search_documents.refreshed_at is
  'NULL = document a reconstruire. Pose par trigger, consomme par '
  'private.refresh_stale_search_documents().';

-- Index de la file de reconstruction : tres selectif, partiel.
create index if not exists profile_search_documents_stale_idx
  on public.profile_search_documents (profile_id)
  where refreshed_at is null;

-- ---------------------------------------------------------------------
-- 1. Composition du tsvector
--
-- Ponderations (prompt de lot) :
--   A : nom, prenom, nom d'usage
--   B : competences (libelles + alias), poste actuel, organisation actuelle
--   C : secteurs, fonctions, domaines d'expertise, titres d'experiences
--   D : ville, pays, promotion, langues, outils
--
-- ARBITRAGE : `ise_profiles` ne porte pas de colonne « nom d'usage ».
-- `middle_names` en tient lieu dans le poids A, comme le fait deja la
-- colonne generee `normalized_name` (0003).
-- ARBITRAGE : D22 section 89 impose l'indexation de `headline` et `bio`.
-- Ils sont ajoutes au poids D (le plus faible) pour ne pas perturber les
-- quatre niveaux imposes ci-dessus, et parce qu'une occurrence en bio ne
-- doit jamais peser autant qu'une competence structuree (CA-MATCH-01).
-- ---------------------------------------------------------------------
create or replace function private.rebuild_profile_search_document(p_profile_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.profile_search_documents (profile_id, search_vector, refreshed_at)
  select
    p.id,
       setweight(to_tsvector('public.french_unaccent',
         coalesce(concat_ws(' ', p.first_name, p.middle_names, p.last_name), '')), 'A')
    || setweight(to_tsvector('public.french_unaccent',
         coalesce(concat_ws(' ', p.current_position,
                                 org.canonical_name,
                                 p.current_organization_raw,
                                 wb.txt), '')), 'B')
    || setweight(to_tsvector('public.french_unaccent', coalesce(wc.txt, '')), 'C')
    || setweight(to_tsvector('public.french_unaccent',
         coalesce(concat_ws(' ', wd.txt, p.headline, p.bio), '')), 'D'),
    now()
  from public.ise_profiles p
  left join public.organizations org on org.id = p.current_organization_id
  left join lateral (
    select string_agg(distinct t.txt, ' ') as txt
    from (
      select s.name
        from public.profile_skills ps
        join public.skills s on s.id = ps.skill_id
       where ps.profile_id = p.id
      union
      select a.alias
        from public.profile_skills ps
        join public.skill_aliases a on a.skill_id = ps.skill_id
       where ps.profile_id = p.id
    ) t(txt)
  ) wb on true
  left join lateral (
    select string_agg(distinct t.txt, ' ') as txt
    from (
      select sec.name
        from public.profile_sectors x
        join public.sectors sec on sec.id = x.sector_id
       where x.profile_id = p.id
      union
      select jf.name
        from public.profile_functions x
        join public.job_functions jf on jf.id = x.job_function_id
       where x.profile_id = p.id
      union
      select ea.name
        from public.profile_expertise_areas x
        join public.expertise_areas ea on ea.id = x.expertise_area_id
       where x.profile_id = p.id
      union
      select e.position_title
        from public.experiences e
       where e.profile_id = p.id
      union
      select sec2.name
        from public.experiences e
        join public.sectors sec2 on sec2.id = e.sector_id
       where e.profile_id = p.id
    ) t(txt)
  ) wc on true
  left join lateral (
    select string_agg(distinct t.txt, ' ') as txt
    from (
      select p.current_city
      union
      select c.name_fr
        from public.countries c
       where c.code = p.current_country_code
      union
      select cg.name_fr
        from public.profile_geographies g
        join public.countries cg on cg.code = g.country_code
       where g.profile_id = p.id
      union
      select concat_ws(' ', pr.name, pr.program_code, pr.graduation_year::text)
        from public.promotions pr
       where pr.id = p.promotion_id
      union
      select l.name_fr
        from public.profile_languages pl
        join public.languages l on l.code = pl.language_code
       where pl.profile_id = p.id
      union
      select tl.name
        from public.profile_tools pt
        join public.tools tl on tl.id = pt.tool_id
       where pt.profile_id = p.id
    ) t(txt)
  ) wd on true
  where p.id = p_profile_id
  on conflict (profile_id) do update
    set search_vector = excluded.search_vector,
        refreshed_at  = excluded.refreshed_at;
$$;

comment on function private.rebuild_profile_search_document(uuid) is
  'Recompose le tsvector ponderé d''un profil (D-17, D-45). SECURITY DEFINER : '
  'profile_search_documents n''a aucune politique, la table est fermee aux membres.';

-- ---------------------------------------------------------------------
-- 1bis. Marquage « a reconstruire »
--
-- CHOIX ASSUME : le trigger NE recalcule PAS le vecteur en synchrone.
-- Justification :
--   - la recomposition parcourt neuf tables satellites et deux jointures
--     laterales d'agregation ; la payer sur chaque INSERT unitaire de
--     `profile_skills` ferait payer O(profil complet) a chaque ligne
--     ajoutee pendant l'onboarding ou un import d'annuaire (10 competences
--     saisies = 10 recompositions completes) ;
--   - le meme profil est typiquement touche plusieurs fois dans la meme
--     transaction : marquer puis reconstruire une seule fois est
--     strictement moins couteux, et rigoureusement equivalent en resultat ;
--   - l'ecriture du tsvector reconstruit une entree GIN a chaque fois :
--     c'est exactement ce que D-17 cherchait a isoler du chemin d'ecriture
--     du profil ;
--   - l'index de recherche tolere une latence de quelques secondes ; la
--     coherence forte n'est pas requise (D22 section 114 : la recherche
--     directe n'est pas cachee, mais l'index l'est par nature).
-- Le trigger se contente donc de poser `refreshed_at = null`, et
-- private.refresh_stale_search_documents() est appelable par cron.
-- Le document reste interrogeable entre-temps avec son ancien vecteur.
-- ---------------------------------------------------------------------
create or replace function private.mark_search_document_stale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_col text := coalesce(tg_argv[0], 'profile_id');
  v_rec jsonb;
  v_id  uuid;
begin
  if tg_op = 'DELETE' then v_rec := to_jsonb(old); else v_rec := to_jsonb(new); end if;
  v_id := nullif(v_rec ->> v_col, '')::uuid;
  if v_id is null then
    return null;
  end if;

  -- Suppression en cascade du profil parent : ne pas ressusciter la ligne.
  if not exists (select 1 from public.ise_profiles p where p.id = v_id) then
    return null;
  end if;

  begin
    insert into public.profile_search_documents (profile_id, search_vector, refreshed_at)
    values (v_id, ''::tsvector, null)
    on conflict (profile_id) do update set refreshed_at = null;
  exception when foreign_key_violation then
    -- Course avec une suppression concurrente du profil : sans objet.
    null;
  end;
  return null;
end
$$;

comment on function private.mark_search_document_stale() is
  'Marque un document de recherche a reconstruire. tg_argv[0] = nom de la colonne '
  'portant l''identifiant de profil (defaut profile_id).';

do $$
declare
  v_spec  text[][] := array[
    ['ise_profiles',            'id'],
    ['profile_skills',          'profile_id'],
    ['experiences',             'profile_id'],
    ['profile_sectors',         'profile_id'],
    ['profile_functions',       'profile_id'],
    ['profile_expertise_areas', 'profile_id'],
    ['profile_languages',       'profile_id'],
    ['profile_tools',           'profile_id'],
    ['profile_geographies',     'profile_id']
  ];
  v_i     integer;
  v_table text;
  v_col   text;
  v_events text;
begin
  for v_i in 1 .. array_length(v_spec, 1) loop
    v_table := v_spec[v_i][1];
    v_col   := v_spec[v_i][2];
    -- Sur ise_profiles, pas de AFTER DELETE : la cascade FK supprime deja
    -- le document, et un marquage post-suppression violerait la FK.
    v_events := case when v_table = 'ise_profiles'
                     then 'insert or update' else 'insert or update or delete' end;
    execute format('drop trigger if exists %I on public.%I',
                   'trg_search_stale_' || v_table, v_table);
    execute format(
      'create trigger %I after %s on public.%I for each row execute function private.mark_search_document_stale(%L)',
      'trg_search_stale_' || v_table, v_events, v_table, v_col);
  end loop;
end
$$;

create or replace function private.refresh_stale_search_documents(p_limit int default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id  uuid;
  v_n   integer := 0;
begin
  select array_agg(d.profile_id) into v_ids
  from (
    select s.profile_id
    from public.profile_search_documents s
    where s.refreshed_at is null
    order by s.profile_id
    limit least(greatest(coalesce(p_limit, 500), 1), 5000)
  ) d;

  if v_ids is null then
    return 0;
  end if;

  foreach v_id in array v_ids loop
    perform private.rebuild_profile_search_document(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$$;

comment on function private.refresh_stale_search_documents(int) is
  'Reconstruit par lot les documents marques perimes. Appelable par cron (service_role). '
  'Jamais expose a authenticated.';

revoke all on function private.rebuild_profile_search_document(uuid)  from public, anon, authenticated;
revoke all on function private.mark_search_document_stale()           from public, anon, authenticated;
revoke all on function private.refresh_stale_search_documents(int)    from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Anciennete professionnelle
--
-- Definition retenue (aucune specification chiffree cote documents) :
-- amplitude entre la premiere date de debut d'experience et la derniere
-- date de fin connue (aujourd'hui si une experience est en cours),
-- exprimee en annees decimales. Non SECURITY DEFINER : la fonction reste
-- inlinable par le planificateur, et soumise a la RLS quand elle est
-- appelee hors d'une fonction definer.
-- ---------------------------------------------------------------------
create or replace function private.profile_years_of_experience(p_profile_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select round(
           greatest(
             0,
             (max(coalesce(e.end_date, current_date)) - min(e.start_date))::numeric / 365.25
           ), 2)
  from public.experiences e
  where e.profile_id = p_profile_id
$$;

comment on function private.profile_years_of_experience(uuid) is
  'Anciennete professionnelle en annees decimales. NULL si aucune experience declaree.';

revoke all on function private.profile_years_of_experience(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. public.search_profiles(...)
--
-- SECURITY DEFINER + search_path fige (D-101). Justification du definer :
-- la fonction lit `profile_search_documents`, table sans aucune politique
-- RLS donc fermee a `authenticated`, et la colonne masquee n'est jamais
-- projetee. Le controle d'acces est fait en tete par
-- private.is_active_member(), puis ligne a ligne par les memes predicats
-- que private.can_see_profile() (blocage, suppression, statut).
--
-- CONFIDENTIALITE (D-72, D5 section 23, CA-MATCH-07) : la signature de
-- retour ne comporte ni e-mail, ni telephone, ni profile_completion, ni
-- score. Le rang de pertinence lui-meme n'est pas projete : il n'existe
-- que dans le curseur opaque (MASTER PROMPT section 15).
--
-- PAGINATION (D-44) : curseur keyset sur (rang, id) decroissant.
-- Aucun OFFSET. Page 20 par defaut, 50 au maximum.
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
as $$
declare
  v_me       uuid;
  v_limit    int;
  v_q        text;
  v_nq       text;
  v_tsq      tsquery;
  v_aliases  bigint[];
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

  -- ---- Resolution des alias de competences (D-46) -------------------
  -- Un alias est reconnu s'il apparait comme suite de MOTS COMPLETS dans
  -- la requete normalisee. La variante `X et Y` est repliee sur `X Y`
  -- pour couvrir la normalisation des alias contenant « & »
  -- (`M&E` -> `m e`, saisi « M et E »).
  -- Regle anti-collision D-46 : un alias de moins de 4 caracteres
  -- normalises (IE, IV, ACP...) n'est resolu que si la requete BRUTE le
  -- contient en majuscules et isole.
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

  -- ---- Curseur opaque ----------------------------------------------
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
  with base as (
    select
      p.id,
      round(greatest(
        coalesce(ts_rank(d.search_vector, v_tsq), 0)::numeric,
        coalesce(extensions.similarity(p.normalized_name, v_nq), 0)::numeric
      ), 6) as rank
    from public.ise_profiles p
    left join public.profile_search_documents d on d.profile_id = p.id
    where p.deleted_at is null
      -- Meme perimetre de visibilite que private.can_see_profile() :
      -- `suspended` et `archived` sont exclus, `referenced` reste dans
      -- l'annuaire (un profil importe non reclame doit etre trouvable,
      -- MASTER PROMPT section 6).
      and p.profile_status in ('referenced', 'active')
      and not private.is_blocked_between(p.id, v_me)
      and (
        v_q is null
        or (v_tsq is not null and d.search_vector @@ v_tsq)
        or (v_nq is not null and extensions.similarity(p.normalized_name, v_nq) >= 0.30)
        or (v_aliases is not null and exists (
              select 1 from public.profile_skills ps
              where ps.profile_id = p.id and ps.skill_id = any (v_aliases)))
      )
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
      and (p_min_years_experience is null
           or coalesce(private.profile_years_of_experience(p.id), 0) >= p_min_years_experience)
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
  order by pg.rank desc, pg.id desc;
end
$$;

comment on function public.search_profiles(text, bigint[], bigint[], bigint[], char(2)[], text[], bigint[], varchar[], text[], int, text, int) is
  'Recherche d''annuaire (ISE-034/035). Reservee aux membres actifs. Aucune donnee privee '
  'projetee (D-72) : ni e-mail, ni telephone, ni score de completion, ni rang de pertinence. '
  'Pagination par curseur opaque (D-44), jamais d''OFFSET.';

revoke all on function public.search_profiles(text, bigint[], bigint[], bigint[], char(2)[], text[], bigint[], varchar[], text[], int, text, int) from public, anon;
grant execute on function public.search_profiles(text, bigint[], bigint[], bigint[], char(2)[], text[], bigint[], varchar[], text[], int, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Index reclames par le plan (D22 section 148)
--
-- Deja presents : profile_skills(skill_id), experiences(sector_id),
-- experiences(country_code), profile_tools(tool_id),
-- profile_availabilities(availability_type) where active,
-- ise_profiles(promotion_id), ise_profiles(current_organization_id),
-- profile_search_documents GIN, ise_profiles GIN trigramme sur
-- normalized_name.
-- Manquants constates a l'EXPLAIN :
-- ---------------------------------------------------------------------

-- Filtre `langue` : la PK est (profile_id, language_code), inutilisable
-- pour un anti-scan par code de langue.
create index if not exists profile_languages_language_idx
  on public.profile_languages (language_code);

-- Filtre `fonction` via les experiences (job_function_id n'etait pas indexe).
create index if not exists experiences_job_function_idx
  on public.experiences (job_function_id)
  where job_function_id is not null;

-- Balayage de l'annuaire visible : evite de relire les profils supprimes
-- ou suspendus quand la requete n'a aucun critere selectif.
create index if not exists ise_profiles_searchable_idx
  on public.ise_profiles (id)
  where deleted_at is null and profile_status in ('referenced', 'active');

-- ---------------------------------------------------------------------
-- 5. Amorcage : construire les documents des profils existants
-- ---------------------------------------------------------------------
do $$
declare v_id uuid;
begin
  for v_id in select p.id from public.ise_profiles p where p.deleted_at is null loop
    perform private.rebuild_profile_search_document(v_id);
  end loop;
end
$$;
