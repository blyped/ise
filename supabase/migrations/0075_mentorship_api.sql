-- =====================================================================
-- 0075_mentorship_api
--
-- Couche base de donnees du module MENTORAT (ISE-078 -> ISE-083).
-- Tables : 0010. Politiques : 0043. Aucune des deux n'est modifiee ici.
--
-- DEFAUT REEL CONSTATE ET CORRIGE. 0010 livre la machine d'etats
-- complete des demandes — `draft`, `pending`, `accepted`,
-- `alternative_proposed`, `declined`, `expired`, `cancelled` — mais
-- AUCUNE fonction pour la parcourir. En particulier
-- `alternative_proposed`, conserve par D-54 parce que « proposer un
-- autre format » est decrit dans les deux sources, n'etait ATTEIGNABLE
-- PAR AUCUN CHEMIN. `respond_to_mentorship_request()` et
-- `accept_mentorship_alternative()` ouvrent enfin cette branche.
--
-- REGLES CARDINALES PORTEES ICI ---------------------------------------
--  1. AUCUN SCORE PUBLIC DE MENTOR (MASTER PROMPT 30, [F 30][U 33],
--     CA-MENT-09). `mentorship_matches.score` est ecrit en base — le
--     privilege de colonne est deja retire a `authenticated` (0043) —
--     et AUCUNE fonction de ce fichier ne le projette. Les mentors
--     recommandes portent un libelle qualitatif (D-42) et des raisons
--     (D-43). Ni note, ni etoiles, ni nombre de demandes recues, ni
--     nombre d'abonnes.
--  2. `alternative_proposed` EST ATTEIGNABLE (D-54) et symetrique :
--     le mentor propose, le mentore accepte ou refuse.
--  3. CHACUN PEUT REFUSER SANS JUSTIFICATION ([F 59][U 61-62]).
--     `p_decline_reason` est FACULTATIF ; un refus sans motif aboutit.
--  4. CAPACITE VERIFIEE AU MOMENT DE L'ACCEPTATION, cote serveur
--     ([U 131], CA-MENT-04) — pas seulement a l'affichage.
--  5. Un mentor a capacite atteinte reste VISIBLE avec la mention
--     « Capacite actuellement atteinte » ([U 104][F 32]) mais ne peut
--     pas recevoir de nouvelle demande.
--
-- References : MASTER PROMPT 15, 30, 43, 47, 98, 113 ; D-42, D-43, D-44,
--              D-54, D-93, D-101, D-102, D-103.
-- =====================================================================

insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('mentorship.request_submitted',
   'Une demande de mentorat a ete envoyee.',                              'mentorship', 140),
  ('mentorship.request_answered',
   'Le mentor a repondu a une demande : accord, refus ou autre format.',  'mentorship', 141),
  ('mentorship.paused',
   'Un mentorat a ete mis en pause par l''une des deux parties.',         'mentorship', 142),
  ('mentorship.stopped',
   'Un mentorat a ete arrete avant son terme.',                           'mentorship', 143)
on conflict (code) do nothing;


-- =====================================================================
-- 1. ISE-079 — le besoin du mentore
--
-- POURQUOI UNE TABLE. 0010 n'offre aucun support au besoin exprime a
-- l'ecran ISE-079 : `mentorship_requests` exige un `mentor_profile_id`
-- NOT NULL, donc ne peut pas porter un besoin anterieur au choix du
-- mentor. Sans cette table, l'ecran « Definir mon besoin » n'aurait rien
-- a enregistrer et le matching n'aurait aucune entree.
-- Une ligne par membre : le besoin courant, pas un historique.
-- =====================================================================
create table if not exists public.mentorship_needs (
  profile_id          uuid primary key references public.ise_profiles(id) on delete cascade,
  objective_type      text        not null,
  objective_text      text        not null,
  topics              text[]      not null default '{}',
  mentor_preference   text,
  constraints_text    text,
  preferred_format    text        not null default 'three_months',
  preferred_frequency text,
  sector_id           bigint      references public.sectors(id),
  country_code        char(2)     references public.countries(code),
  language_codes      varchar(8)[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint mentorship_needs_objective_type_ck
    check (array[objective_type] <@ public.mentorship_objective_codes()),
  constraint mentorship_needs_format_ck
    check (array[preferred_format] <@ public.mentorship_format_codes()),
  constraint mentorship_needs_frequency_ck
    check (preferred_frequency is null
           or preferred_frequency in ('monthly','twice_monthly','flexible')),
  constraint mentorship_needs_objective_text_ck
    check (length(objective_text) between 1 and 250),
  constraint mentorship_needs_mentor_preference_ck
    check (mentor_preference is null
           or mentor_preference in ('experienced_manager','domain_expert',
                                    'similar_transition','let_matching_decide'))
);

comment on table public.mentorship_needs is
  'ISE-079. Besoin de mentorat courant d''un membre : une ligne par profil, strictement personnelle.';

alter table public.mentorship_needs enable row level security;
alter table public.mentorship_needs force row level security;

drop policy if exists mentorship_needs_own on public.mentorship_needs;
create policy mentorship_needs_own on public.mentorship_needs
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id());

comment on policy mentorship_needs_own on public.mentorship_needs is
  'Le besoin de mentorat est personnel. Aucune permission administrative ne l''ouvre.';

grant select, insert, update, delete on public.mentorship_needs to authenticated;

select private.attach_updated_at('public', 'mentorship_needs');


-- =====================================================================
-- 2. Helpers
-- =====================================================================

-- Nombre de mentorats actifs d'un mentor. Sert au controle de capacite,
-- jamais a l'affichage : « ne pas afficher 2/3 mentores » ([U 30]).
create or replace function private.mentor_active_count(p_mentor uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.mentorships m
   where m.mentor_profile_id = p_mentor
     and m.status in ('planned','active','paused');
$$;

revoke all on function private.mentor_active_count(uuid) from public, anon;
grant execute on function private.mentor_active_count(uuid) to authenticated, service_role;


create or replace function private.mentor_has_capacity(p_mentor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select mp.is_active
     and mp.availability_state <> 'temporarily_unavailable'
     and (mp.available_from is null or mp.available_from <= current_date)
     and (mp.available_until is null or mp.available_until >= current_date)
     and private.mentor_active_count(p_mentor) < mp.max_active_mentees
    from public.mentor_profiles mp
   where mp.profile_id = p_mentor;
$$;

revoke all on function private.mentor_has_capacity(uuid) from public, anon;
grant execute on function private.mentor_has_capacity(uuid) to authenticated, service_role;

comment on function private.mentor_has_capacity(uuid) is
  'HARD RULE de capacite ([U 103]). Verifiee cote serveur a l''acceptation, pas seulement a l''affichage.';


-- Pertinence mentore -> mentor. Le score reste ici (MASTER PROMPT 30).
create or replace function private.mentorship_relevance(p_mentee uuid, p_mentor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_need  public.mentorship_needs;
  v_mp    public.mentor_profiles;
  v_score numeric := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_years numeric;
begin
  select * into v_need from public.mentorship_needs where profile_id = p_mentee;
  select * into v_mp   from public.mentor_profiles where profile_id = p_mentor;
  if v_mp.profile_id is null or v_need.profile_id is null then
    return jsonb_build_object('score', 0, 'label', null, 'reasons', '[]'::jsonb);
  end if;

  -- Objectif du mentore (30) — le critere le plus important : le mentor
  -- doit REELLEMENT accepter d'accompagner sur ce sujet ([F 85]).
  if v_need.objective_type = any (v_mp.accepted_objectives) then
    v_score := v_score + 30;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'objective',
      'label', 'Accompagne explicitement l''objectif que vous avez decrit'));
  end if;

  -- Domaine / expertise (25).
  if exists (select 1
               from public.mentor_domains d
               join public.profile_skills ps on ps.skill_id = d.skill_id
              where d.mentor_profile_id = p_mentor and ps.profile_id = p_mentee) then
    v_score := v_score + 25;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'domain',
      'label', 'Expertise declaree sur des competences que vous travaillez'));
  elsif exists (select 1 from public.mentor_domains d
                 where d.mentor_profile_id = p_mentor
                   and d.mentoring_topic is not null
                   and d.mentoring_topic = any (v_need.topics)) then
    v_score := v_score + 20;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'domain',
      'label', 'Accompagne sur les sujets que vous avez selectionnes'));
  end if;

  -- Secteur (15).
  if v_need.sector_id is not null
     and exists (select 1 from public.profile_sectors ps
                  where ps.profile_id = p_mentor and ps.sector_id = v_need.sector_id) then
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'sector',
      'label', (select 'Exerce dans le secteur vise : ' || s.name
                  from public.sectors s where s.id = v_need.sector_id)));
  end if;

  -- Experience du mentor (10) — anciennete PROFESSIONNELLE, jamais
  -- anciennete sur la plateforme ni popularite ([U 36]).
  v_years := private.profile_years_of_experience(p_mentor);
  if coalesce(v_years, 0) >= 10 then
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'experience',
      'label', 'Parcours professionnel de plus de dix ans'));
  elsif coalesce(v_years, 0) >= 5 then
    v_score := v_score + 6;
  end if;

  -- Pays (5).
  if v_need.country_code is not null
     and exists (select 1 from public.ise_profiles p
                  where p.id = p_mentor and p.current_country_code = v_need.country_code) then
    v_score := v_score + 5;
  end if;

  -- Langue (5) — filtre dur si le mentore en exige une.
  if array_length(v_need.language_codes, 1) is null then
    v_score := v_score + 5;
  elsif exists (select 1 from public.profile_languages pl
                 where pl.profile_id = p_mentor
                   and pl.language_code = any (v_need.language_codes)) then
    v_score := v_score + 5;
  else
    return jsonb_build_object('score', 0, 'label', null, 'reasons', '[]'::jsonb);
  end if;

  -- Format disponible (5) — filtre dur ([U 35]).
  if v_need.preferred_format = any (v_mp.preferred_formats) then
    v_score := v_score + 5;
  else
    return jsonb_build_object('score', 0, 'label', null, 'reasons', '[]'::jsonb);
  end if;

  -- Capacite disponible (5).
  if private.mentor_has_capacity(p_mentor) then
    v_score := v_score + 5;
  end if;

  -- D-43 : sans raison affichable, aucune recommandation.
  if jsonb_array_length(v_reasons) = 0 then
    return jsonb_build_object('score', 0, 'label', null, 'reasons', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'score',   v_score,
    'label',   private.relevance_label(v_score),
    'reasons', v_reasons);
end
$fn$;

revoke all on function private.mentorship_relevance(uuid, uuid) from public, anon;
grant execute on function private.mentorship_relevance(uuid, uuid) to authenticated, service_role;


-- Carte publique d'un mentor. LISTE EXHAUSTIVE de ce qui sort :
-- identite professionnelle, disponibilite qualitative, sujets accompagnes.
-- Ce qui ne sort JAMAIS : score, note, nombre de demandes recues,
-- nombre d'abonnes, agenda detaille, telephone ([U 33][U 45]).
create or replace function private.mentor_card(p_mentor uuid, p_mentee uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id',    p.id,
    'display_name',  coalesce(p.display_name, p.first_name || ' ' || p.last_name),
    'avatar_path',   p.avatar_path,
    'position',      p.current_position,
    'organization',  coalesce(o.canonical_name, p.current_organization_raw),
    'city',          p.current_city,
    'country_name',  c.name_fr,
    'promotion',     (select pr.program_code || ' ' || pr.graduation_year
                        from public.promotions pr where pr.id = p.promotion_id),
    'verification_status', p.verification_status,
    'expertises',    coalesce((select jsonb_agg(k.name)
                                 from (select s.name
                                         from public.mentor_domains d
                                         join public.skills s on s.id = d.skill_id
                                        where d.mentor_profile_id = p.id
                                        order by s.name limit 4) k), '[]'::jsonb),
    'topics',        coalesce((select jsonb_agg(distinct d.mentoring_topic)
                                 from public.mentor_domains d
                                where d.mentor_profile_id = p.id
                                  and d.mentoring_topic is not null), '[]'::jsonb),
    'formats',       to_jsonb(mp.preferred_formats),
    'frequency',     mp.preferred_frequency,
    'statement',     mp.mentor_statement,
    -- Deux etats, pas une fraction ([U 30]).
    'availability',  case when private.mentor_has_capacity(p.id)
                          then 'available' else 'capacity_reached' end,
    'relevance',     (private.mentorship_relevance(p_mentee, p.id) - 'score'))
  from public.ise_profiles p
  join public.mentor_profiles mp on mp.profile_id = p.id
  left join public.organizations o on o.id = p.current_organization_id
  left join public.countries c on c.code = p.current_country_code
 where p.id = p_mentor and p.deleted_at is null;
$$;

revoke all on function private.mentor_card(uuid, uuid) from public, anon;
grant execute on function private.mentor_card(uuid, uuid) to authenticated, service_role;

comment on function private.mentor_card(uuid, uuid) is
  'Carte mentor. Le score est retire de la projection (`- ''score''`) : MASTER PROMPT 30.';


-- =====================================================================
-- 3. ISE-078 — Espace mentorat
-- =====================================================================
create or replace function public.get_mentorship_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_need public.mentorship_needs;
  v_mp   public.mentor_profiles;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_need from public.mentorship_needs where profile_id = v_me;
  select * into v_mp   from public.mentor_profiles where profile_id = v_me;

  return jsonb_build_object(
    'need', case when v_need.profile_id is null then null else jsonb_build_object(
      'objective_type',    v_need.objective_type,
      'objective_text',    v_need.objective_text,
      'topics',            to_jsonb(v_need.topics),
      'mentor_preference', v_need.mentor_preference,
      'constraints_text',  v_need.constraints_text,
      'preferred_format',  v_need.preferred_format,
      'preferred_frequency', v_need.preferred_frequency,
      'sector_id',         v_need.sector_id,
      'country_code',      v_need.country_code,
      'language_codes',    to_jsonb(v_need.language_codes)) end,
    'mentor_profile', case when v_mp.profile_id is null then null else jsonb_build_object(
      'is_active',           v_mp.is_active,
      'availability_state',  v_mp.availability_state,
      'max_active_mentees',  v_mp.max_active_mentees,
      'active_mentorships',  private.mentor_active_count(v_me),
      'has_capacity',        private.mentor_has_capacity(v_me),
      'pending_requests',    (select count(*) from public.mentorship_requests r
                               where r.mentor_profile_id = v_me and r.status = 'pending'),
      'statement',           v_mp.mentor_statement) end,
    'as_mentee', coalesce((
      select jsonb_agg(jsonb_build_object(
               'mentorship_id', m.id,
               'status',        m.status,
               'objective',     m.objective,
               'format',        m.format,
               'start_date',    m.start_date,
               'planned_end_date', m.planned_end_date,
               'counterpart',   private.network_profile_card(m.mentor_profile_id)))
        from public.mentorships m
       where m.mentee_profile_id = v_me and m.status in ('planned','active','paused')), '[]'::jsonb),
    'as_mentor', coalesce((
      select jsonb_agg(jsonb_build_object(
               'mentorship_id', m.id,
               'status',        m.status,
               'objective',     m.objective,
               'format',        m.format,
               'counterpart',   private.network_profile_card(m.mentee_profile_id)))
        from public.mentorships m
       where m.mentor_profile_id = v_me and m.status in ('planned','active','paused')), '[]'::jsonb),
    -- 3 a 8 mentors, jamais 100 profils ([F 23]).
    'recommended', coalesce((
      select jsonb_agg(k.card order by k.s desc nulls last)
        from (select private.mentor_card(mp.profile_id, v_me) as card,
                     (private.mentorship_relevance(v_me, mp.profile_id) ->> 'score')::numeric as s
                from public.mentor_profiles mp
                join public.ise_profiles p on p.id = mp.profile_id and p.deleted_at is null
               where mp.is_active
                 and mp.profile_id <> v_me
                 and p.verification_status = 'verified'
                 and not private.is_blocked_between(v_me, mp.profile_id)
                 and (private.mentorship_relevance(v_me, mp.profile_id) ->> 'label') is not null
               order by s desc, p.last_name
               limit 4) k), '[]'::jsonb));
end
$fn$;

revoke all on function public.get_mentorship_home() from public, anon;
grant execute on function public.get_mentorship_home() to authenticated;

comment on function public.get_mentorship_home() is
  'ISE-078. Aucun score n''est projete : uniquement libelles qualitatifs et raisons (MASTER PROMPT 30).';


create or replace function public.save_mentorship_need(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if length(btrim(coalesce(p_payload ->> 'objective_text', ''))) = 0
     or length(p_payload ->> 'objective_text') > 250 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if (p_payload ->> 'objective_type') is null then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.mentorship_needs (
    profile_id, objective_type, objective_text, topics, mentor_preference,
    constraints_text, preferred_format, preferred_frequency, sector_id,
    country_code, language_codes)
  values (
    v_me,
    p_payload ->> 'objective_type',
    btrim(p_payload ->> 'objective_text'),
    coalesce((select array_agg(t.v) from jsonb_array_elements_text(
                coalesce(p_payload -> 'topics', '[]'::jsonb)) as t(v)), '{}'::text[]),
    nullif(p_payload ->> 'mentor_preference', ''),
    nullif(p_payload ->> 'constraints_text', ''),
    coalesce(p_payload ->> 'preferred_format', 'three_months'),
    nullif(p_payload ->> 'preferred_frequency', ''),
    nullif(p_payload ->> 'sector_id', '')::bigint,
    nullif(p_payload ->> 'country_code', '')::char(2),
    coalesce((select array_agg(t.v::varchar(8)) from jsonb_array_elements_text(
                coalesce(p_payload -> 'language_codes', '[]'::jsonb)) as t(v)), '{}'::varchar(8)[]))
  on conflict (profile_id) do update set
    objective_type      = excluded.objective_type,
    objective_text      = excluded.objective_text,
    topics              = excluded.topics,
    mentor_preference   = excluded.mentor_preference,
    constraints_text    = excluded.constraints_text,
    preferred_format    = excluded.preferred_format,
    preferred_frequency = excluded.preferred_frequency,
    sector_id           = excluded.sector_id,
    country_code        = excluded.country_code,
    language_codes      = excluded.language_codes,
    updated_at          = now();

  return jsonb_build_object('profile_id', v_me, 'saved', true);
end
$fn$;

revoke all on function public.save_mentorship_need(jsonb) from public, anon;
grant execute on function public.save_mentorship_need(jsonb) to authenticated;


-- =====================================================================
-- 4. ISE-080 — Mentors recommandes / recherche manuelle
--
-- Les deux chemins coexistent : l'algorithme ne s'impose pas ([F 87],
-- [U 106]). `p_manual = true` retire le filtre de pertinence et rend la
-- main a la recherche libre.
-- =====================================================================
create or replace function public.list_recommended_mentors(
  p_query        text    default null,
  p_sector_id    bigint  default null,
  p_country_code char(2) default null,
  p_format       text    default null,
  p_manual       boolean default false,
  p_cursor       text    default null,
  p_limit        integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid := private.current_profile_id();
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_at      timestamptz;
  v_cid     uuid;
  v_rows    jsonb;
  v_count   integer;
  v_tail_at timestamptz;
  v_tail_id uuid;
  v_next    text;
  v_norm    text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select c_at, c_id into v_at, v_cid from private.decode_keyset_cursor(p_cursor);

  -- Pagination par curseur chronologique (D-44). Le curseur de score est
  -- volontairement ECARTE : il porterait le score dans son contenu, ce
  -- que MASTER PROMPT 30 interdit pour un mentor.
  with page as (
    select mp.profile_id, mp.created_at
      from public.mentor_profiles mp
      join public.ise_profiles p on p.id = mp.profile_id and p.deleted_at is null
     where mp.is_active
       and mp.profile_id <> v_me
       and p.verification_status = 'verified'
       and not private.is_blocked_between(v_me, mp.profile_id)
       and (p_sector_id is null or exists (select 1 from public.profile_sectors ps
                                            where ps.profile_id = p.id and ps.sector_id = p_sector_id))
       and (p_country_code is null or p.current_country_code = p_country_code)
       and (p_format is null or p_format = any (mp.preferred_formats))
       and (v_norm is null
            or public.normalize_text(coalesce(p.display_name, p.first_name || ' ' || p.last_name))
                 like '%' || public.normalize_text(v_norm) || '%'
            or public.normalize_text(coalesce(p.current_organization_raw, ''))
                 like '%' || public.normalize_text(v_norm) || '%'
            or exists (select 1 from public.mentor_domains d
                         join public.skills s on s.id = d.skill_id
                        where d.mentor_profile_id = p.id
                          and public.normalize_text(s.name)
                                like '%' || public.normalize_text(v_norm) || '%'))
       and (p_manual
            or (private.mentorship_relevance(v_me, mp.profile_id) ->> 'label') is not null)
       and (v_at is null or (mp.created_at, mp.profile_id) < (v_at, v_cid))
     order by mp.created_at desc, mp.profile_id desc
     limit v_limit)
  select coalesce(jsonb_agg(private.mentor_card(page.profile_id, v_me)
                            order by page.created_at desc, page.profile_id desc), '[]'::jsonb),
         count(*)::integer,
         (array_agg(page.created_at order by page.created_at, page.profile_id))[1],
         (array_agg(page.profile_id order by page.created_at, page.profile_id))[1]
    into v_rows, v_count, v_tail_at, v_tail_id
    from page;

  if v_count = v_limit then
    v_next := private.encode_keyset_cursor(v_tail_at, v_tail_id);
  end if;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', v_next,
    'is_manual', p_manual,
    'has_need', exists (select 1 from public.mentorship_needs n where n.profile_id = v_me));
end
$fn$;

revoke all on function public.list_recommended_mentors(text, bigint, char, text, boolean, text, integer) from public, anon;
grant execute on function public.list_recommended_mentors(text, bigint, char, text, boolean, text, integer) to authenticated;

comment on function public.list_recommended_mentors(text, bigint, char, text, boolean, text, integer) is
  'ISE-080. Libelle qualitatif et raisons ; aucun score. Curseur chronologique volontaire (D-44).';


-- =====================================================================
-- 5. ISE-081 — Profil mentor
-- =====================================================================
create or replace function public.get_mentor_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_mentor_profile(p_profile_id) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if private.is_blocked_between(v_me, p_profile_id) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return private.mentor_card(p_profile_id, v_me) || jsonb_build_object(
    'is_self', p_profile_id = v_me,
    'help_topics', coalesce((
      select jsonb_agg(distinct d.mentoring_topic)
        from public.mentor_domains d
       where d.mentor_profile_id = p_profile_id and d.mentoring_topic is not null), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_agg(l.name_fr order by l.name_fr)
        from public.profile_languages pl join public.languages l on l.code = pl.language_code
       where pl.profile_id = p_profile_id), '[]'::jsonb),
    -- « 4 accompagnements termines » est un FAIT, pas une note ([F 30]).
    'completed_mentorships', (
      select count(*) from public.mentorships m
       where m.mentor_profile_id = p_profile_id and m.status = 'completed'),
    'mentor_since', (select mp.activated_at from public.mentor_profiles mp
                      where mp.profile_id = p_profile_id),
    'can_request', private.mentor_has_capacity(p_profile_id)
                   and p_profile_id <> v_me
                   and not exists (select 1 from public.mentorship_requests r
                                    where r.mentee_profile_id = v_me
                                      and r.mentor_profile_id = p_profile_id
                                      and r.status in ('draft','pending','alternative_proposed'))
                   and not exists (select 1 from public.mentorships m
                                    where m.mentee_profile_id = v_me
                                      and m.mentor_profile_id = p_profile_id
                                      and m.status in ('planned','active','paused')));
end
$fn$;

revoke all on function public.get_mentor_profile(uuid) from public, anon;
grant execute on function public.get_mentor_profile(uuid) to authenticated;


-- « Devenir mentor » — activation et mise en pause.
-- Tous les mentors doivent etre ISE verifies avant activation ([F 95]).
create or replace function public.save_mentor_profile(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me     uuid := private.current_profile_id();
  v_active boolean := coalesce((p_payload ->> 'is_active')::boolean, true);
  v_state  text := coalesce(p_payload ->> 'availability_state', 'available_now');
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_active and not exists (select 1 from public.ise_profiles p
                               where p.id = v_me and p.verification_status = 'verified') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_state not in ('available_now','available_from','temporarily_unavailable') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.mentor_profiles (
    profile_id, is_active, mentor_statement, max_active_mentees,
    preferred_formats, preferred_frequency, accepted_objectives,
    accepted_audiences, preferred_channels, availability_state,
    available_from, available_until, activated_at)
  values (
    v_me, v_active,
    nullif(p_payload ->> 'mentor_statement', ''),
    coalesce((p_payload ->> 'max_active_mentees')::smallint, 2::smallint),
    coalesce((select array_agg(t.v) from jsonb_array_elements_text(
                coalesce(p_payload -> 'preferred_formats', '[]'::jsonb)) as t(v)), '{}'::text[]),
    nullif(p_payload ->> 'preferred_frequency', ''),
    coalesce((select array_agg(t.v) from jsonb_array_elements_text(
                coalesce(p_payload -> 'accepted_objectives', '[]'::jsonb)) as t(v)), '{}'::text[]),
    coalesce((select array_agg(t.v) from jsonb_array_elements_text(
                coalesce(p_payload -> 'accepted_audiences', '[]'::jsonb)) as t(v)), '{}'::text[]),
    coalesce((select array_agg(t.v) from jsonb_array_elements_text(
                coalesce(p_payload -> 'preferred_channels', '[]'::jsonb)) as t(v)), '{}'::text[]),
    v_state,
    nullif(p_payload ->> 'available_from', '')::date,
    nullif(p_payload ->> 'available_until', '')::date,
    case when v_active then now() end)
  on conflict (profile_id) do update set
    is_active           = excluded.is_active,
    mentor_statement    = coalesce(excluded.mentor_statement, mentor_profiles.mentor_statement),
    max_active_mentees  = excluded.max_active_mentees,
    preferred_formats   = case when excluded.preferred_formats = '{}'::text[]
                               then mentor_profiles.preferred_formats
                               else excluded.preferred_formats end,
    preferred_frequency = coalesce(excluded.preferred_frequency, mentor_profiles.preferred_frequency),
    accepted_objectives = case when excluded.accepted_objectives = '{}'::text[]
                               then mentor_profiles.accepted_objectives
                               else excluded.accepted_objectives end,
    accepted_audiences  = case when excluded.accepted_audiences = '{}'::text[]
                               then mentor_profiles.accepted_audiences
                               else excluded.accepted_audiences end,
    preferred_channels  = case when excluded.preferred_channels = '{}'::text[]
                               then mentor_profiles.preferred_channels
                               else excluded.preferred_channels end,
    availability_state  = excluded.availability_state,
    available_from      = excluded.available_from,
    available_until     = excluded.available_until,
    -- La mise en pause n'interrompt AUCUN mentorat en cours ([F 45]).
    paused_at           = case when excluded.availability_state = 'temporarily_unavailable'
                               then now() else null end,
    activated_at        = coalesce(mentor_profiles.activated_at, excluded.activated_at),
    updated_at          = now();

  return jsonb_build_object(
    'profile_id', v_me,
    'is_active',  v_active,
    'availability_state', v_state,
    'ongoing_mentorships_unaffected', true);
end
$fn$;

revoke all on function public.save_mentor_profile(jsonb) from public, anon;
grant execute on function public.save_mentor_profile(jsonb) to authenticated;

comment on function public.save_mentor_profile(jsonb) is
  'Activation du profil mentor. Exige un ISE verifie ([F 95]). La pause n''interrompt aucun mentorat en cours.';


-- =====================================================================
-- 6. ISE-082 — Demande de mentorat
-- =====================================================================
create or replace function public.submit_mentorship_request(
  p_mentor_profile_id      uuid,
  p_objective_type         text,
  p_objective_text         text,
  p_expectations           text[] default '{}',
  p_requested_format       text   default 'three_months',
  p_requested_frequency    text   default null,
  p_requested_duration_months smallint default null,
  p_current_situation      text   default null,
  p_message                text   default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_id uuid;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_mentor_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(v_me, p_mentor_profile_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_objective_text, ''))) = 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_message is not null and length(p_message) > 800 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.mentor_profiles mp
                  where mp.profile_id = p_mentor_profile_id and mp.is_active) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  -- Mentor a capacite atteinte : visible, mais pas sollicitable
  -- ([F 32][U 104]).
  if not private.mentor_has_capacity(p_mentor_profile_id) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  -- Une seule demande active par couple ([F 57][U 130]) : la contrainte
  -- `mentorship_requests_open_pair_uidx` (0010) l'impose deja ; le
  -- controle explicite evite un 23505 opaque.
  if exists (select 1 from public.mentorship_requests r
              where r.mentee_profile_id = v_me
                and r.mentor_profile_id = p_mentor_profile_id
                and r.status in ('draft','pending','alternative_proposed')) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mentorships m
              where m.mentee_profile_id = v_me
                and m.mentor_profile_id = p_mentor_profile_id
                and m.status in ('planned','active','paused')) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;
  if not private.consume_rate_limit(v_me::text, 'mentorship.request', 5, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.mentorship_requests (
    mentee_profile_id, mentor_profile_id, objective_type, objective_text,
    current_situation, expectations, requested_format, requested_frequency,
    requested_duration_months, message, status, submitted_at, expires_at)
  values (
    v_me, p_mentor_profile_id, p_objective_type, btrim(p_objective_text),
    nullif(btrim(coalesce(p_current_situation, '')), ''),
    coalesce(p_expectations, '{}'::text[]),
    p_requested_format, p_requested_frequency, p_requested_duration_months,
    nullif(btrim(coalesce(p_message, '')), ''),
    'pending', now(), now() + interval '21 days')
  returning id into v_id;

  insert into public.mentorship_events (request_id, event_type, actor_profile_id, to_status)
  values (v_id, 'request_submitted', v_me, 'pending');

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('mentorship.request_submitted', 'mentorship', v_id, v_me,
          jsonb_build_object('mentor_profile_id', p_mentor_profile_id));

  return jsonb_build_object(
    'request_id', v_id,
    'status',     'pending',
    -- Aucune relation n'est creee avant l'accord du mentor.
    'creates_mentorship', false);
end
$fn$;

revoke all on function public.submit_mentorship_request(uuid, text, text, text[], text, text, smallint, text, text) from public, anon;
grant execute on function public.submit_mentorship_request(uuid, text, text, text[], text, text, smallint, text, text) to authenticated;


-- Reponse du mentor : accepter, refuser SANS JUSTIFICATION, ou proposer
-- un autre format (D-54).
create or replace function public.respond_to_mentorship_request(
  p_request_id         uuid,
  p_decision           text,
  p_decline_reason     text default null,
  p_alternative_format text default null,
  p_alternative_message text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_r  public.mentorship_requests;
  v_m  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_decision not in ('accept','decline','propose_alternative') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_r from public.mentorship_requests where id = p_request_id for update;
  if not found or v_r.mentor_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_r.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if p_decision = 'decline' then
    -- Aucune justification n'est exigee ([F 59][U 61-62]).
    update public.mentorship_requests
       set status = 'declined',
           decline_reason = nullif(p_decline_reason, ''),
           responded_at = now(), updated_at = now()
     where id = p_request_id;
    insert into public.mentorship_events (request_id, event_type, actor_profile_id,
                                          from_status, to_status, reason)
    values (p_request_id, 'request_declined', v_me, 'pending', 'declined',
            nullif(p_decline_reason, ''));
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('mentorship.request_answered', 'mentorship', p_request_id, v_me,
            jsonb_build_object('decision', 'declined'));
    return jsonb_build_object('request_id', p_request_id, 'status', 'declined',
                              'reason_required', false);

  elsif p_decision = 'propose_alternative' then
    -- D-54 : l'etat existe en base et devient atteignable.
    if p_alternative_format is null
       or not (array[p_alternative_format] <@ public.mentorship_format_codes()) then
      raise exception 'validation_failed' using errcode = 'P0001';
    end if;
    update public.mentorship_requests
       set status = 'alternative_proposed',
           alternative_format = p_alternative_format,
           alternative_message = nullif(p_alternative_message, ''),
           alternative_proposed_at = now(),
           responded_at = now(), updated_at = now()
     where id = p_request_id;
    insert into public.mentorship_events (request_id, event_type, actor_profile_id,
                                          from_status, to_status)
    values (p_request_id, 'alternative_proposed', v_me, 'pending', 'alternative_proposed');
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('mentorship.request_answered', 'mentorship', p_request_id, v_me,
            jsonb_build_object('decision', 'alternative_proposed',
                               'alternative_format', p_alternative_format));
    return jsonb_build_object('request_id', p_request_id, 'status', 'alternative_proposed',
                              'alternative_format', p_alternative_format);
  end if;

  -- Acceptation : capacite RE-VERIFIEE ici, cote serveur ([U 131]).
  if not private.mentor_has_capacity(v_me) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.mentorship_requests
     set status = 'accepted', responded_at = now(), updated_at = now()
   where id = p_request_id;

  insert into public.mentorships (
    mentor_profile_id, mentee_profile_id, source_request_id, objective_type,
    objective, format, frequency, start_date, planned_end_date, status)
  values (
    v_me, v_r.mentee_profile_id, p_request_id, v_r.objective_type,
    v_r.objective_text, v_r.requested_format, v_r.requested_frequency,
    current_date,
    current_date + case v_r.requested_format
                     when 'single_session' then interval '1 month'
                     when 'one_month'      then interval '1 month'
                     when 'three_months'   then interval '3 months'
                     else interval '6 months' end,
    'active')
  returning id into v_m;

  insert into public.mentorship_events (mentorship_id, request_id, event_type,
                                        actor_profile_id, from_status, to_status)
  values (v_m, p_request_id, 'request_accepted', v_me, 'pending', 'accepted');
  insert into public.mentorship_events (mentorship_id, event_type, actor_profile_id, to_status)
  values (v_m, 'mentorship_started', v_me, 'active');

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('mentorship.started', 'mentorship', v_m, v_me,
          jsonb_build_object('request_id', p_request_id));

  return jsonb_build_object('request_id', p_request_id, 'status', 'accepted',
                            'mentorship_id', v_m);
end
$fn$;

revoke all on function public.respond_to_mentorship_request(uuid, text, text, text, text) from public, anon;
grant execute on function public.respond_to_mentorship_request(uuid, text, text, text, text) to authenticated;

comment on function public.respond_to_mentorship_request(uuid, text, text, text, text) is
  'ISE-082 cote mentor. Refus sans justification ([F 59]) ; alternative_proposed atteignable (D-54).';


-- Le mentore repond a l'alternative proposee (D-54).
create or replace function public.accept_mentorship_alternative(
  p_request_id uuid,
  p_accept     boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_r  public.mentorship_requests;
  v_m  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_r from public.mentorship_requests where id = p_request_id for update;
  if not found or v_r.mentee_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_r.status <> 'alternative_proposed' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.mentorship_requests
       set status = 'cancelled', updated_at = now() where id = p_request_id;
    insert into public.mentorship_events (request_id, event_type, actor_profile_id,
                                          from_status, to_status)
    values (p_request_id, 'request_cancelled', v_me, 'alternative_proposed', 'cancelled');
    return jsonb_build_object('request_id', p_request_id, 'status', 'cancelled');
  end if;

  if not private.mentor_has_capacity(v_r.mentor_profile_id) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.mentorship_requests
     set status = 'accepted', requested_format = v_r.alternative_format, updated_at = now()
   where id = p_request_id;

  insert into public.mentorships (
    mentor_profile_id, mentee_profile_id, source_request_id, objective_type,
    objective, format, frequency, start_date, planned_end_date, status)
  values (
    v_r.mentor_profile_id, v_me, p_request_id, v_r.objective_type,
    v_r.objective_text, v_r.alternative_format, v_r.requested_frequency,
    current_date,
    current_date + case v_r.alternative_format
                     when 'single_session' then interval '1 month'
                     when 'one_month'      then interval '1 month'
                     when 'three_months'   then interval '3 months'
                     else interval '6 months' end,
    'active')
  returning id into v_m;

  insert into public.mentorship_events (mentorship_id, request_id, event_type,
                                        actor_profile_id, from_status, to_status)
  values (v_m, p_request_id, 'alternative_accepted', v_me, 'alternative_proposed', 'accepted');

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('mentorship.started', 'mentorship', v_m, v_me,
          jsonb_build_object('request_id', p_request_id, 'from_alternative', true));

  return jsonb_build_object('request_id', p_request_id, 'status', 'accepted',
                            'mentorship_id', v_m, 'format', v_r.alternative_format);
end
$fn$;

revoke all on function public.accept_mentorship_alternative(uuid, boolean) from public, anon;
grant execute on function public.accept_mentorship_alternative(uuid, boolean) to authenticated;


create or replace function public.cancel_mentorship_request(p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_r  public.mentorship_requests;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_r from public.mentorship_requests where id = p_request_id for update;
  if not found or v_r.mentee_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_r.status not in ('draft','pending','alternative_proposed') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.mentorship_requests
     set status = 'cancelled', updated_at = now() where id = p_request_id;
  insert into public.mentorship_events (request_id, event_type, actor_profile_id,
                                        from_status, to_status)
  values (p_request_id, 'request_cancelled', v_me, v_r.status, 'cancelled');

  return jsonb_build_object('request_id', p_request_id, 'status', 'cancelled');
end
$fn$;

revoke all on function public.cancel_mentorship_request(uuid) from public, anon;
grant execute on function public.cancel_mentorship_request(uuid) to authenticated;


create or replace function public.list_my_mentorship_requests(
  p_role   text    default 'mentor',
  p_scope  text    default 'open',
  p_cursor text    default null,
  p_limit  integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid := private.current_profile_id();
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_at      timestamptz;
  v_cid     uuid;
  v_rows    jsonb;
  v_count   integer;
  v_tail_at timestamptz;
  v_tail_id uuid;
  v_next    text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_role not in ('mentor','mentee') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;
  if p_scope not in ('open','closed','all') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_at, v_cid from private.decode_keyset_cursor(p_cursor);

  with page as (
    select r.id, r.created_at, r.status, r.objective_type, r.objective_text,
           r.current_situation, r.expectations, r.requested_format,
           r.requested_frequency, r.message, r.alternative_format,
           r.alternative_message, r.decline_reason,
           case when p_role = 'mentor' then r.mentee_profile_id
                else r.mentor_profile_id end as counterpart_id
      from public.mentorship_requests r
     where ((p_role = 'mentor' and r.mentor_profile_id = v_me)
            or (p_role = 'mentee' and r.mentee_profile_id = v_me))
       and (p_scope <> 'open'   or r.status in ('pending','alternative_proposed'))
       and (p_scope <> 'closed' or r.status in ('accepted','declined','expired','cancelled'))
       and (v_at is null or (r.created_at, r.id) < (v_at, v_cid))
     order by r.created_at desc, r.id desc
     limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'request_id',      page.id,
           'status',          page.status,
           'objective_type',  page.objective_type,
           'objective_text',  page.objective_text,
           'current_situation', page.current_situation,
           'expectations',    to_jsonb(page.expectations),
           'requested_format', page.requested_format,
           'requested_frequency', page.requested_frequency,
           'message',         page.message,
           'alternative_format', page.alternative_format,
           'alternative_message', page.alternative_message,
           'decline_reason',  page.decline_reason,
           'created_at',      page.created_at,
           'counterpart',     private.network_profile_card(page.counterpart_id))
           order by page.created_at desc, page.id desc), '[]'::jsonb),
         count(*)::integer,
         (array_agg(page.created_at order by page.created_at, page.id))[1],
         (array_agg(page.id order by page.created_at, page.id))[1]
    into v_rows, v_count, v_tail_at, v_tail_id
    from page;

  if v_count = v_limit then
    v_next := private.encode_keyset_cursor(v_tail_at, v_tail_id);
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next, 'role', p_role);
end
$fn$;

revoke all on function public.list_my_mentorship_requests(text, text, text, integer) from public, anon;
grant execute on function public.list_my_mentorship_requests(text, text, text, integer) to authenticated;


-- =====================================================================
-- 7. ISE-083 — Mentorat actif, suivi et bilan
-- =====================================================================
create or replace function public.get_mentorship(p_mentorship_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_m  public.mentorships;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_mentorship_party(p_mentorship_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_m from public.mentorships where id = p_mentorship_id;

  return jsonb_build_object(
    'mentorship_id',    v_m.id,
    'status',           v_m.status,
    'my_role',          case when v_m.mentor_profile_id = v_me then 'mentor' else 'mentee' end,
    'counterpart',      private.network_profile_card(
                          case when v_m.mentor_profile_id = v_me
                               then v_m.mentee_profile_id else v_m.mentor_profile_id end),
    'objective',        v_m.objective,
    'objective_type',   v_m.objective_type,
    'format',           v_m.format,
    'frequency',        v_m.frequency,
    'start_date',       v_m.start_date,
    'planned_end_date', v_m.planned_end_date,
    'actual_end_date',  v_m.actual_end_date,
    'closure_reason',   v_m.closure_reason,
    'cycle_number',     v_m.cycle_number,
    'sessions_completed', (select count(*) from public.mentorship_sessions s
                            where s.mentorship_id = v_m.id and s.status = 'completed'),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'goal_id', g.id, 'title', g.title, 'status', g.status,
               'target_date', g.target_date) order by g.sort_order, g.created_at)
        from public.mentorship_goals g where g.mentorship_id = v_m.id), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'action_id', a.id, 'title', a.title, 'status', a.status,
               'due_on', a.due_on) order by a.created_at)
        from public.mentorship_actions a where a.mentorship_id = v_m.id), '[]'::jsonb),
    'next_session', (
      select jsonb_build_object('session_id', s.id, 'scheduled_at', s.scheduled_at,
                                'format', s.format, 'topic', s.topic)
        from public.mentorship_sessions s
       where s.mentorship_id = v_m.id and s.status = 'planned'
         and s.scheduled_at >= now()
       order by s.scheduled_at limit 1),
    -- La SYNTHESE partagee est commune ; les notes privees ne le sont
    -- jamais (rls.md 10.4).
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'session_id', s.id, 'scheduled_at', s.scheduled_at,
               'completed_at', s.completed_at, 'format', s.format,
               'topic', s.topic, 'shared_summary', s.shared_summary,
               'status', s.status) order by s.scheduled_at desc nulls last)
        from public.mentorship_sessions s where s.mentorship_id = v_m.id), '[]'::jsonb),
    'my_notes', coalesce((
      select jsonb_agg(jsonb_build_object('session_id', n.session_id, 'note', n.note)
                       order by n.created_at desc)
        from public.mentorship_session_notes n
        join public.mentorship_sessions s on s.id = n.session_id
       where s.mentorship_id = v_m.id and n.author_profile_id = v_me), '[]'::jsonb),
    'my_feedback_given', exists (
      select 1 from public.mentorship_feedback f
       where f.mentorship_id = v_m.id and f.respondent_profile_id = v_me));
end
$fn$;

revoke all on function public.get_mentorship(uuid) from public, anon;
grant execute on function public.get_mentorship(uuid) to authenticated;

comment on function public.get_mentorship(uuid) is
  'ISE-083. `my_notes` ne renvoie QUE les notes de l''appelant : un mentor ne lit pas celles de son mentore.';


create or replace function public.list_my_mentorships(
  p_role   text    default 'mentee',
  p_scope  text    default 'ongoing',
  p_cursor text    default null,
  p_limit  integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid := private.current_profile_id();
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_at      timestamptz;
  v_cid     uuid;
  v_rows    jsonb;
  v_count   integer;
  v_tail_at timestamptz;
  v_tail_id uuid;
  v_next    text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_role not in ('mentor','mentee') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;
  if p_scope not in ('ongoing','finished','all') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_at, v_cid from private.decode_keyset_cursor(p_cursor);

  with page as (
    select m.id, m.created_at, m.status, m.objective, m.format,
           m.start_date, m.planned_end_date,
           case when p_role = 'mentor' then m.mentee_profile_id
                else m.mentor_profile_id end as counterpart_id
      from public.mentorships m
     where ((p_role = 'mentor' and m.mentor_profile_id = v_me)
            or (p_role = 'mentee' and m.mentee_profile_id = v_me))
       and (p_scope <> 'ongoing'  or m.status in ('planned','active','paused'))
       and (p_scope <> 'finished' or m.status in ('completed','stopped','cancelled'))
       and (v_at is null or (m.created_at, m.id) < (v_at, v_cid))
     order by m.created_at desc, m.id desc
     limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'mentorship_id',    page.id,
           'status',           page.status,
           'objective',        page.objective,
           'format',           page.format,
           'start_date',       page.start_date,
           'planned_end_date', page.planned_end_date,
           'counterpart',      private.network_profile_card(page.counterpart_id))
           order by page.created_at desc, page.id desc), '[]'::jsonb),
         count(*)::integer,
         (array_agg(page.created_at order by page.created_at, page.id))[1],
         (array_agg(page.id order by page.created_at, page.id))[1]
    into v_rows, v_count, v_tail_at, v_tail_id
    from page;

  if v_count = v_limit then
    v_next := private.encode_keyset_cursor(v_tail_at, v_tail_id);
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next, 'role', p_role);
end
$fn$;

revoke all on function public.list_my_mentorships(text, text, text, integer) from public, anon;
grant execute on function public.list_my_mentorships(text, text, text, integer) to authenticated;


-- Pause, arret anticipe, cloture. « Un participant doit pouvoir arreter
-- un mentorat sans devoir negocier longuement » ([U 102]) : les deux
-- parties disposent des memes transitions, et le motif reste facultatif.
create or replace function public.transition_mentorship(
  p_mentorship_id uuid,
  p_to_status     text,
  p_reason        text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_m  public.mentorships;
  v_ok boolean;
  v_ev text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_mentorship_party(p_mentorship_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_m from public.mentorships where id = p_mentorship_id for update;

  v_ok := case v_m.status
    when 'planned' then p_to_status in ('active','cancelled')
    when 'active'  then p_to_status in ('paused','completed','stopped','cancelled')
    when 'paused'  then p_to_status in ('active','completed','stopped','cancelled')
    else false end;
  if not v_ok then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_reason is not null and p_reason not in (
       'objective_reached','duration_ended','availability','coordination_difficulty',
       'objective_changed','incompatibility','inactive','other') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  update public.mentorships set
    status         = p_to_status,
    closure_reason = case when p_to_status in ('completed','stopped','cancelled')
                          then p_reason else closure_reason end,
    closed_by_profile_id = case when p_to_status in ('completed','stopped','cancelled')
                                then v_me else closed_by_profile_id end,
    paused_at      = case when p_to_status = 'paused' then now() else null end,
    completed_at   = case when p_to_status = 'completed' then now() else completed_at end,
    actual_end_date = case when p_to_status in ('completed','stopped','cancelled')
                           then current_date else actual_end_date end,
    updated_at     = now()
   where id = p_mentorship_id;

  v_ev := case p_to_status
            when 'paused'    then 'mentorship_paused'
            when 'active'    then 'mentorship_resumed'
            when 'completed' then 'mentorship_completed'
            when 'stopped'   then 'mentorship_stopped'
            else 'mentorship_cancelled' end;

  insert into public.mentorship_events (mentorship_id, event_type, actor_profile_id,
                                        from_status, to_status, reason)
  values (p_mentorship_id, v_ev, v_me, v_m.status, p_to_status, p_reason);

  if p_to_status = 'completed' then
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('mentorship.completed', 'mentorship', p_mentorship_id, v_me,
            jsonb_build_object('reason', p_reason));
  elsif p_to_status = 'paused' then
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('mentorship.paused', 'mentorship', p_mentorship_id, v_me, '{}'::jsonb);
  elsif p_to_status = 'stopped' then
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('mentorship.stopped', 'mentorship', p_mentorship_id, v_me, '{}'::jsonb);
  end if;

  return jsonb_build_object('mentorship_id', p_mentorship_id, 'status', p_to_status,
                            'reason_required', false);
end
$fn$;

revoke all on function public.transition_mentorship(uuid, text, text) from public, anon;
grant execute on function public.transition_mentorship(uuid, text, text) to authenticated;


-- Objectifs et actions convenues. Un seul point d'entree pour deux
-- listes tres proches : « ce n'est pas un logiciel de gestion de
-- projet » ([F 61][U 81]).
create or replace function public.set_mentorship_item(
  p_mentorship_id uuid,
  p_kind          text,
  p_item_id       uuid    default null,
  p_title         text    default null,
  p_status        text    default null,
  p_due_on        date    default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_id uuid := p_item_id;
  v_n  integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_mentorship_party(p_mentorship_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_kind not in ('goal','action') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_kind = 'goal' then
    if v_id is null then
      -- « Pas de plan de 25 objectifs » ([U 68]) : cinq au maximum.
      select count(*) into v_n from public.mentorship_goals where mentorship_id = p_mentorship_id;
      if v_n >= 5 then
        raise exception 'invalid_transition' using errcode = 'P0001';
      end if;
      if length(btrim(coalesce(p_title, ''))) = 0 then
        raise exception 'validation_failed' using errcode = 'P0001';
      end if;
      insert into public.mentorship_goals (mentorship_id, title, status, target_date, sort_order)
      values (p_mentorship_id, btrim(p_title), coalesce(p_status, 'todo'), p_due_on, v_n + 1)
      returning id into v_id;
    else
      update public.mentorship_goals set
        title = coalesce(nullif(btrim(coalesce(p_title, '')), ''), title),
        status = coalesce(p_status, status),
        target_date = coalesce(p_due_on, target_date),
        updated_at = now()
       where id = v_id and mentorship_id = p_mentorship_id;
      if not found then
        raise exception 'not_found' using errcode = 'P0002';
      end if;
    end if;
  else
    if v_id is null then
      if length(btrim(coalesce(p_title, ''))) = 0 then
        raise exception 'validation_failed' using errcode = 'P0001';
      end if;
      insert into public.mentorship_actions (mentorship_id, assignee_profile_id, title, status, due_on)
      values (p_mentorship_id, v_me, btrim(p_title), coalesce(p_status, 'todo'), p_due_on)
      returning id into v_id;
    else
      update public.mentorship_actions set
        title = coalesce(nullif(btrim(coalesce(p_title, '')), ''), title),
        status = coalesce(p_status, status),
        due_on = coalesce(p_due_on, due_on),
        completed_at = case when p_status = 'done' then now() else null end,
        updated_at = now()
       where id = v_id and mentorship_id = p_mentorship_id;
      if not found then
        raise exception 'not_found' using errcode = 'P0002';
      end if;
    end if;
  end if;

  return jsonb_build_object('item_id', v_id, 'kind', p_kind);
end
$fn$;

revoke all on function public.set_mentorship_item(uuid, text, uuid, text, text, date) from public, anon;
grant execute on function public.set_mentorship_item(uuid, text, uuid, text, text, date) to authenticated;


-- Session : planification, cloture et SYNTHESE PARTAGEE. La note privee
-- passe par `p_private_note` et n'est jamais lisible par l'autre partie.
create or replace function public.log_mentorship_session(
  p_mentorship_id uuid,
  p_session_id    uuid        default null,
  p_scheduled_at  timestamptz default null,
  p_format        text        default null,
  p_topic         text        default null,
  p_shared_summary text       default null,
  p_private_note  text        default null,
  p_status        text        default 'planned')
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_id uuid := p_session_id;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_mentorship_party(p_mentorship_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_status not in ('planned','completed','cancelled','no_show') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.mentorship_sessions (
      mentorship_id, scheduled_at, format, topic, shared_summary, status, completed_at,
      session_number)
    values (p_mentorship_id, p_scheduled_at, p_format, p_topic, p_shared_summary, p_status,
            case when p_status = 'completed' then now() end,
            (select coalesce(max(s.session_number), 0) + 1
               from public.mentorship_sessions s where s.mentorship_id = p_mentorship_id))
    returning id into v_id;
  else
    update public.mentorship_sessions set
      scheduled_at   = coalesce(p_scheduled_at, scheduled_at),
      format         = coalesce(p_format, format),
      topic          = coalesce(p_topic, topic),
      shared_summary = coalesce(p_shared_summary, shared_summary),
      status         = p_status,
      completed_at   = case when p_status = 'completed' then coalesce(completed_at, now())
                            else completed_at end,
      updated_at     = now()
     where id = v_id and mentorship_id = p_mentorship_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  if nullif(btrim(coalesce(p_private_note, '')), '') is not null then
    -- Note strictement personnelle : un mentor ne lit pas les notes de
    -- son mentore, et reciproquement (rls.md 10.4).
    insert into public.mentorship_session_notes (session_id, author_profile_id, note)
    values (v_id, v_me, btrim(p_private_note));
  end if;

  return jsonb_build_object('session_id', v_id, 'status', p_status);
end
$fn$;

revoke all on function public.log_mentorship_session(uuid, uuid, timestamptz, text, text, text, text, text) from public, anon;
grant execute on function public.log_mentorship_session(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated;


-- Bilan. Les evaluations servent a ameliorer le dispositif, JAMAIS a
-- etablir un classement public ([F 82][U 93], CA-MENT-09) : aucune
-- fonction de ce fichier ne les agrege ni ne les projette sur un profil.
create or replace function public.submit_mentorship_feedback(
  p_mentorship_id uuid,
  p_payload       jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_m    public.mentorships;
  v_role text;
  v_id   uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_mentorship_party(p_mentorship_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_m from public.mentorships where id = p_mentorship_id;
  v_role := case when v_m.mentor_profile_id = v_me then 'mentor' else 'mentee' end;

  if v_m.status not in ('completed','stopped') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mentorship_feedback f
              where f.mentorship_id = p_mentorship_id and f.respondent_profile_id = v_me) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;

  insert into public.mentorship_feedback (
    mentorship_id, respondent_profile_id, respondent_role, usefulness,
    objective_progress, objective_reached, outcome_type, comment,
    platform_feedback, public_testimonial_consent, testimonial_text,
    is_anonymous_testimonial)
  values (
    p_mentorship_id, v_me, v_role,
    nullif(p_payload ->> 'usefulness', ''),
    nullif(p_payload ->> 'objective_progress', ''),
    nullif(p_payload ->> 'objective_reached', ''),
    nullif(p_payload ->> 'outcome_type', ''),
    nullif(p_payload ->> 'comment', ''),
    nullif(p_payload ->> 'platform_feedback', ''),
    coalesce((p_payload ->> 'public_testimonial_consent')::boolean, false),
    -- Un temoignage n'existe que si le consentement est explicite
    -- ([F 83]) : la contrainte de 0010 le verifie, la fonction aussi.
    case when coalesce((p_payload ->> 'public_testimonial_consent')::boolean, false)
              then nullif(p_payload ->> 'testimonial_text', '') end,
    coalesce((p_payload ->> 'is_anonymous_testimonial')::boolean, false))
  returning id into v_id;

  -- Impact : uniquement si le mentorat est ALLE A SON TERME et que le
  -- mentore le declare. Un emploi obtenu est un evenement DISTINCT
  -- ([U 96-97]) : il n'est pas ecrit ici.
  if v_role = 'mentee' and v_m.status = 'completed' then
    insert into analytics.impact_events (
      impact_type, beneficiary_profile_id, contributor_profile_id,
      source_type, source_id, attribution_level, declared_by_profile_id,
      occurred_at, metadata)
    values ('mentorship_completed', v_me, v_m.mentor_profile_id,
            'mentorship', p_mentorship_id, 'self_reported', v_me, now(),
            jsonb_build_object('outcome_type', nullif(p_payload ->> 'outcome_type', '')));
  end if;

  return jsonb_build_object('feedback_id', v_id, 'role', v_role, 'is_public_rating', false);
end
$fn$;

revoke all on function public.submit_mentorship_feedback(uuid, jsonb) from public, anon;
grant execute on function public.submit_mentorship_feedback(uuid, jsonb) to authenticated;

comment on function public.submit_mentorship_feedback(uuid, jsonb) is
  'ISE-083. Aucune note publique : is_public_rating = false ([F 82][U 93], CA-MENT-09).';
