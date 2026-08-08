-- =====================================================================
-- 0071_internships_api
--
-- Couche base de donnees du module STAGES (ISE-072 -> ISE-077).
-- Tables : 0009. Politiques : 0042. Aucune des deux n'est modifiee ici.
--
-- DEFAUT REEL CONSTATE ET CORRIGE : 0009 livre un carnet de bord de
-- candidature, un placement et un suivi, mais AUCUNE fonction pour les
-- parcourir. Les six ecrans n'avaient aucun chemin d'acces.
--
-- REGLE CARDINALE (MASTER PROMPT 27, D-55) ----------------------------
-- La plateforme ne declare JAMAIS une candidature envoyee a un organisme
-- externe :
--   * `save_internship_application_draft()` cree et modifie un dossier
--     `to_prepare`. Le statut y est invariant : elle ne peut pas
--     soumettre.
--   * `declare_internship_application_sent()` est le SEUL chemin vers
--     `submitted`. Elle exige une DATE D'ENVOI fournie par l'eleve —
--     parametre obligatoire, pas un `now()` implicite — et refuse une
--     date future. C'est une declaration, pas un constat.
--   * `declare_internship_application_step()` porte les etapes
--     suivantes, toutes declaratives, journalisees dans
--     `internship_application_events` avec `declared_by_profile_id`.
--   * Aucune fonction n'envoie de dossier a un tiers :
--     `get_internship_offer()` renvoie `platform_transmits = false`,
--     que l'interface affiche litteralement.
--
-- PERIMETRE D'AUDIENCE : le module de recherche s'adresse aux profils
-- `profile_type = 'student'` et a eux seuls. Un diplome recoit `42501`
-- et dispose de son propre point d'entree
-- (`get_internship_alumni_home`, `respond_to_internship_help_request`).
--
-- SCORE : `private.internship_relevance()` calcule en base et ne renvoie
-- QUE le libelle qualitatif (D-42) et les raisons (D-43).
-- ARBITRAGE DE PONDERATION — la grille du digest (Domaine 30,
-- Competences 25, Periode 15, Localisation 15, Type d'organisation 5,
-- Outils 5, Langues 5) suppose des outils et des langues portes par
-- l'offre. `internship_offers` n'a ni l'un ni l'autre (0009) : ces deux
-- criteres n'ont AUCUN support de donnees. Plutot qu'inventer une
-- correspondance, leurs 10 points vont au MODE DE TRAVAIL, que l'offre
-- et le besoin declarent reellement. La somme reste 100.
--
-- References : MASTER PROMPT 15, 27, 43, 47, 98, 113 ; D-42, D-43, D-44,
--              D-55, D-93, D-101, D-102, D-103.
-- =====================================================================

insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('internship.need_activated',
   'Un eleve a active sa recherche de stage.',                            'internship', 130),
  ('internship.application_declared_sent',
   'L''eleve DECLARE avoir envoye sa candidature (D-55).',                'internship', 131),
  ('internship.application_step_declared',
   'L''eleve declare une etape de sa candidature (D-55).',                'internship', 132),
  ('internship.help_requested',
   'Un eleve sollicite un ancien : conseil, relecture ou introduction.',  'internship', 133),
  ('internship.help_answered',
   'Un ancien a repondu a une sollicitation d''eleve.',                   'internship', 134),
  ('internship.result_declared',
   'L''eleve declare le resultat de sa candidature de stage.',            'internship', 135)
on conflict (code) do nothing;


-- =====================================================================
-- 1. Audience du module
-- =====================================================================
create or replace function private.is_internship_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member()
     and exists (select 1 from public.ise_profiles p
                  where p.id = private.current_profile_id()
                    and p.profile_type = 'student'
                    and p.deleted_at is null);
$$;

revoke all on function private.is_internship_student() from public, anon;
grant execute on function private.is_internship_student() to authenticated, service_role;

comment on function private.is_internship_student() is
  'Le module de recherche de stage ne s''adresse qu''aux profils student. Un diplome recoit 42501.';


-- =====================================================================
-- 2. Pertinence besoin <-> offre — score interne, libelle publie
-- =====================================================================
create or replace function private.internship_relevance(p_need uuid, p_offer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_n public.internship_needs;
  v_o public.internship_offers;
  v_score numeric := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_hit integer;
  v_req integer;
begin
  if p_need is null then
    return jsonb_build_object('label', null, 'reasons', '[]'::jsonb);
  end if;
  select * into v_n from public.internship_needs where id = p_need;
  select * into v_o from public.internship_offers where id = p_offer;
  if not found or v_n.id is null then
    return jsonb_build_object('label', null, 'reasons', '[]'::jsonb);
  end if;

  -- Domaine (30) — correspondance exacte pleine, secondaire partielle.
  if v_o.sector_id is not null then
    if exists (select 1 from public.internship_need_sectors s
                where s.need_id = v_n.id and s.sector_id = v_o.sector_id and s.is_primary) then
      v_score := v_score + 30;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
        'criterion', 'sector', 'label',
        (select 'Domaine principal de votre recherche : ' || s.name
           from public.sectors s where s.id = v_o.sector_id)));
    elsif exists (select 1 from public.internship_need_sectors s
                   where s.need_id = v_n.id and s.sector_id = v_o.sector_id) then
      v_score := v_score + 20;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
        'criterion', 'sector', 'label',
        (select 'Domaine connexe a votre recherche : ' || s.name
           from public.sectors s where s.id = v_o.sector_id)));
    end if;
  end if;

  -- Competences (25) — part des competences requises couvertes.
  select count(*) filter (where t.covered), count(*)
    into v_hit, v_req
    from (select exists (select 1 from public.internship_need_skills ns
                          where ns.need_id = v_n.id and ns.skill_id = os.skill_id)
                 or exists (select 1 from public.profile_skills ps
                             where ps.profile_id = v_n.student_profile_id
                               and ps.skill_id = os.skill_id) as covered
            from public.internship_offer_skills os
           where os.offer_id = v_o.id and os.is_required) t;
  if coalesce(v_req, 0) > 0 and v_hit > 0 then
    v_score := v_score + 25 * (v_hit::numeric / v_req);
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'skills', 'label',
      format('%s competence(s) recherchee(s) sur %s figurent dans votre dossier', v_hit, v_req)));
  end if;

  -- Periode (15).
  if v_n.dates_flexible then
    v_score := v_score + 10;
  elsif v_o.start_date is not null and v_n.start_date is not null
        and abs(v_o.start_date - v_n.start_date) <= 60 then
    v_score := v_score + 15;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'period', 'label', 'Periode compatible avec votre disponibilite'));
  end if;

  -- Localisation (15).
  if v_o.country_code is not null then
    if exists (select 1 from public.internship_need_countries c
                where c.need_id = v_n.id and c.country_code = v_o.country_code) then
      v_score := v_score + 15;
      v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
        'criterion', 'location', 'label',
        (select 'Pays souhaite : ' || k.name_fr from public.countries k
          where k.code = v_o.country_code)));
    elsif v_n.mobility_international = 'yes' then
      v_score := v_score + 8;
    end if;
  end if;

  -- Type d'organisation (5).
  if exists (select 1
               from public.internship_need_organization_types t
               join public.organizations o on o.id = v_o.organization_id
              where t.need_id = v_n.id and t.organization_type = o.organization_type) then
    v_score := v_score + 5;
  end if;

  -- Mode de travail (10) — voir l'arbitrage de ponderation en tete.
  if v_o.work_mode = v_n.work_mode
     or (v_o.work_mode = 'remote' and v_n.remote_allowed) then
    v_score := v_score + 10;
    v_reasons := v_reasons || jsonb_build_array(jsonb_build_object(
      'criterion', 'work_mode', 'label', 'Mode de travail compatible avec votre recherche'));
  end if;

  -- D-43 : un resultat sans raison affichable n'est pas propose.
  if jsonb_array_length(v_reasons) = 0 then
    return jsonb_build_object('label', null, 'reasons', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'label',   private.relevance_label(v_score),
    'reasons', v_reasons);
end
$fn$;

revoke all on function private.internship_relevance(uuid, uuid) from public, anon;
grant execute on function private.internship_relevance(uuid, uuid) to authenticated, service_role;

comment on function private.internship_relevance(uuid, uuid) is
  'Libelle qualitatif (D-42) et raisons (D-43). Le score numerique ne sort jamais de cette fonction.';


-- Carte d'offre. `platform_transmits` dit la verite sur ce que la
-- plateforme fait — c'est-a-dire rien (D-55).
create or replace function private.internship_offer_card(p_offer uuid, p_need uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'offer_id',       o.id,
    'offer_type',     o.offer_type,
    'title',          o.title,
    'organization',   coalesce(g.canonical_name, o.organization_raw),
    'organization_id', o.organization_id,
    'department',     o.department,
    'city',           o.city,
    'country_code',   o.country_code,
    'country_name',   c.name_fr,
    'work_mode',      o.work_mode,
    'duration_months', o.duration_months,
    'period_label',   o.period_label,
    'start_date',     o.start_date,
    'slots',          o.slots,
    'deadline',       o.application_deadline,
    'application_mode', o.application_mode,
    'source',         o.source,
    'status',         o.status,
    'sector',         (select s.name from public.sectors s where s.id = o.sector_id),
    'skills',         coalesce((select jsonb_agg(sk.name order by sk.name)
                                  from public.internship_offer_skills os
                                  join public.skills sk on sk.id = os.skill_id
                                 where os.offer_id = o.id), '[]'::jsonb),
    'relevance',      private.internship_relevance(p_need, o.id),
    'network_ise_count', (select count(*) from public.ise_profiles n
                           where o.organization_id is not null
                             and n.current_organization_id = o.organization_id
                             and n.claim_status = 'claimed' and n.deleted_at is null),
    -- La plateforme ne transmet aucun dossier : elle le dit (D-55).
    'platform_transmits', false)
  from public.internship_offers o
  left join public.organizations g on g.id = o.organization_id
  left join public.countries c on c.code = o.country_code
 where o.id = p_offer and o.deleted_at is null;
$$;

revoke all on function private.internship_offer_card(uuid, uuid) from public, anon;
grant execute on function private.internship_offer_card(uuid, uuid) to authenticated, service_role;


-- =====================================================================
-- 3. ISE-072 — Espace stages (eleve) et point d'entree des anciens
-- =====================================================================
create or replace function public.get_internship_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_need public.internship_needs;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    -- Un diplome n'entre pas ici par erreur : il a son propre espace.
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_need from public.internship_needs
   where student_profile_id = v_me and deleted_at is null
     and status in ('draft','active','paused','matched')
   limit 1;

  return jsonb_build_object(
    'audience', 'student',
    'need', case when v_need.id is null then null else jsonb_build_object(
      'need_id',        v_need.id,
      'status',         v_need.status,
      'internship_type', v_need.internship_type,
      'objective',      v_need.objective,
      'start_date',     v_need.start_date,
      'end_date',       v_need.end_date,
      'duration_months', v_need.duration_months,
      'work_mode',      v_need.work_mode,
      'remote_allowed', v_need.remote_allowed,
      'mobility_international', v_need.mobility_international,
      'dates_flexible', v_need.dates_flexible,
      'visibility',     v_need.visibility,
      'sectors', coalesce((select jsonb_agg(jsonb_build_object(
                             'sector_id', s.sector_id, 'name', k.name,
                             'is_primary', s.is_primary)
                             order by s.preference_rank)
                             from public.internship_need_sectors s
                             join public.sectors k on k.id = s.sector_id
                            where s.need_id = v_need.id), '[]'::jsonb),
      'countries', coalesce((select jsonb_agg(jsonb_build_object(
                               'country_code', c.country_code, 'name', k.name_fr))
                               from public.internship_need_countries c
                               join public.countries k on k.code = c.country_code
                              where c.need_id = v_need.id), '[]'::jsonb)) end,
    'counters', jsonb_build_object(
      'applications', (select count(*) from public.internship_applications a
                        where a.student_profile_id = v_me and a.status <> 'to_prepare'),
      'drafts',       (select count(*) from public.internship_applications a
                        where a.student_profile_id = v_me and a.status = 'to_prepare'),
      'interviews',   (select count(*) from public.internship_applications a
                        where a.student_profile_id = v_me and a.status = 'interview'),
      'offers_received', (select count(*) from public.internship_applications a
                           where a.student_profile_id = v_me and a.status = 'offered'),
      'helpers',      (select count(*) from public.internship_help_requests h
                        where h.student_profile_id = v_me
                          and h.status in ('sent','viewed','accepted','answered'))),
    -- Etudiant deja place : le tableau de bord de recherche cede la
    -- place a « Mon stage » ([U 135]).
    'placement', (
      select jsonb_build_object(
               'placement_id', pl.id,
               'organization', coalesce(g.canonical_name, pl.organization_raw),
               'start_date',   pl.start_date,
               'end_date',     pl.end_date,
               'status',       pl.status,
               'agreement_status', pl.agreement_status)
        from public.internship_placements pl
        left join public.organizations g on g.id = pl.organization_id
       where pl.student_profile_id = v_me
         and pl.status not in ('cancelled','completed','interrupted')
       order by pl.confirmed_at desc limit 1),
    -- 3 a 5 offres au maximum sur le tableau de bord ([U 45]).
    'recommended', coalesce((
      select jsonb_agg(k.card)
        from (select private.internship_offer_card(o.id, v_need.id) as card
                from public.internship_offers o
               where o.status = 'published' and o.deleted_at is null
                 and (o.application_deadline is null or o.application_deadline >= current_date)
                 and (private.internship_relevance(v_need.id, o.id) ->> 'label') is not null
               order by o.published_at desc nulls last
               limit 5) k), '[]'::jsonb));
end
$fn$;

revoke all on function public.get_internship_home() from public, anon;
grant execute on function public.get_internship_home() to authenticated;

comment on function public.get_internship_home() is
  'ISE-072 (eleve). Refuse un profil non student avec 42501 : le module ne s''adresse qu''aux eleves.';


create or replace function public.get_internship_alumni_home()
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

  return jsonb_build_object(
    'audience', 'alumni',
    -- « Seulement si reellement pertinent » ([U 13]) : le compte porte
    -- sur les eleves dont un domaine recoupe un secteur declare par
    -- l'ancien, jamais sur la promotion sortante entiere.
    'students_in_my_sectors', (
      select count(distinct n.student_profile_id)
        from public.internship_needs n
        join public.internship_need_sectors ns on ns.need_id = n.id
       where n.status = 'active' and n.deleted_at is null
         and exists (select 1 from public.profile_sectors ps
                      where ps.profile_id = v_me and ps.sector_id = ns.sector_id)),
    'my_offers', (select count(*) from public.internship_offers o
                   where o.created_by_profile_id = v_me and o.deleted_at is null),
    'pending_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'request_id',   h.id,
               'request_type', h.request_type,
               'message',      h.message,
               'created_at',   h.created_at,
               'student',      private.network_profile_card(h.student_profile_id))
             order by h.created_at desc)
        from public.internship_help_requests h
       where h.alumni_profile_id = v_me and h.status in ('sent','viewed')), '[]'::jsonb));
end
$fn$;

revoke all on function public.get_internship_alumni_home() from public, anon;
grant execute on function public.get_internship_alumni_home() to authenticated;


-- ---------------------------------------------------------------------
-- Enregistrer / ajuster la recherche. Un besoin par eleve : la
-- contrainte `internship_needs_active_per_student_uidx` (0009) l'impose,
-- la fonction s'y conforme par un UPSERT explicite.
-- ---------------------------------------------------------------------
create or replace function public.save_internship_need(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me     uuid := private.current_profile_id();
  v_id     uuid;
  v_status text;
  v_promo  bigint;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_status := coalesce(p_payload ->> 'status', 'active');
  if v_status not in ('draft','active','paused') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if (p_payload ->> 'objective') is not null and length(p_payload ->> 'objective') > 500 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if (p_payload ->> 'start_date') is not null and (p_payload ->> 'end_date') is not null
     and (p_payload ->> 'end_date')::date <= (p_payload ->> 'start_date')::date then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select promotion_id into v_promo from public.ise_profiles where id = v_me;

  select id into v_id from public.internship_needs
   where student_profile_id = v_me and deleted_at is null
     and status in ('draft','active','paused','matched');

  if v_id is null then
    insert into public.internship_needs (
      student_profile_id, promotion_id, internship_type, objective, purposes,
      start_date, end_date, duration_months, dates_flexible, work_mode,
      remote_allowed, mobility_international, thesis_topic, visibility, status,
      activated_at)
    values (
      v_me, v_promo,
      coalesce(p_payload ->> 'internship_type', 'academic'),
      p_payload ->> 'objective',
      coalesce((select array_agg(t.v) from jsonb_array_elements_text(
                  coalesce(p_payload -> 'purposes', '[]'::jsonb)) as t(v)), '{}'::text[]),
      (p_payload ->> 'start_date')::date,
      (p_payload ->> 'end_date')::date,
      (p_payload ->> 'duration_months')::numeric,
      coalesce((p_payload ->> 'dates_flexible')::boolean, false),
      coalesce(p_payload ->> 'work_mode', 'on_site'),
      coalesce((p_payload ->> 'remote_allowed')::boolean, false),
      coalesce(p_payload ->> 'mobility_international', 'no'),
      p_payload ->> 'thesis_topic',
      coalesce(p_payload ->> 'visibility', 'internship_managers_and_relevant_alumni'),
      v_status,
      case when v_status = 'active' then now() end)
    returning id into v_id;
  else
    update public.internship_needs set
      internship_type        = coalesce(p_payload ->> 'internship_type', internship_type),
      objective              = coalesce(p_payload ->> 'objective', objective),
      start_date             = coalesce((p_payload ->> 'start_date')::date, start_date),
      end_date               = coalesce((p_payload ->> 'end_date')::date, end_date),
      duration_months        = coalesce((p_payload ->> 'duration_months')::numeric, duration_months),
      dates_flexible         = coalesce((p_payload ->> 'dates_flexible')::boolean, dates_flexible),
      work_mode              = coalesce(p_payload ->> 'work_mode', work_mode),
      remote_allowed         = coalesce((p_payload ->> 'remote_allowed')::boolean, remote_allowed),
      mobility_international = coalesce(p_payload ->> 'mobility_international', mobility_international),
      thesis_topic           = coalesce(p_payload ->> 'thesis_topic', thesis_topic),
      visibility             = coalesce(p_payload ->> 'visibility', visibility),
      status                 = v_status,
      activated_at           = case when v_status = 'active' and activated_at is null
                                    then now() else activated_at end,
      paused_at              = case when v_status = 'paused' then now() else null end,
      updated_at             = now()
     where id = v_id;
  end if;

  if p_payload ? 'sector_ids' then
    delete from public.internship_need_sectors where need_id = v_id;
    insert into public.internship_need_sectors (need_id, sector_id, preference_rank, is_primary)
    select v_id, t.value::bigint, t.ord::smallint, t.ord = 1
      from jsonb_array_elements_text(p_payload -> 'sector_ids') with ordinality as t(value, ord)
     limit 3;
  end if;

  if p_payload ? 'country_codes' then
    delete from public.internship_need_countries where need_id = v_id;
    insert into public.internship_need_countries (need_id, country_code, preference_level)
    select v_id, t.v::char(2), 'preferred'
      from jsonb_array_elements_text(p_payload -> 'country_codes') as t(v);
  end if;

  if p_payload ? 'skill_ids' then
    delete from public.internship_need_skills where need_id = v_id;
    insert into public.internship_need_skills (need_id, skill_id, priority, intent)
    select v_id, t.value::bigint, case when t.ord = 1 then 'primary' else 'secondary' end, 'apply'
      from jsonb_array_elements_text(p_payload -> 'skill_ids') with ordinality as t(value, ord)
     limit 5;
  end if;

  if v_status = 'active' then
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('internship.need_activated', 'internship', v_id, v_me, jsonb_build_object('need_id', v_id));
  end if;

  return jsonb_build_object('need_id', v_id, 'status', v_status);
end
$fn$;

revoke all on function public.save_internship_need(jsonb) from public, anon;
grant execute on function public.save_internship_need(jsonb) to authenticated;


-- =====================================================================
-- 4. ISE-072 / ISE-073 — liste et detail des offres
-- =====================================================================
create or replace function public.list_internship_offers(
  p_scope        text    default 'for_me',
  p_query        text    default null,
  p_country_code char(2) default null,
  p_sector_id    bigint  default null,
  p_max_months   numeric default null,
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
  v_need    uuid;
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
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_scope not in ('for_me','all','partners') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select id into v_need from public.internship_needs
   where student_profile_id = v_me and deleted_at is null
     and status in ('draft','active','paused','matched');

  select c_at, c_id into v_at, v_cid from private.decode_keyset_cursor(p_cursor);

  with page as (
    select o.id, coalesce(o.published_at, o.created_at) as ranked_at
      from public.internship_offers o
     where o.deleted_at is null
       and o.status in ('published','to_confirm')
       and private.can_see_internship_offer(o.id)
       and (p_country_code is null or o.country_code = p_country_code)
       and (p_sector_id is null or o.sector_id = p_sector_id)
       and (p_max_months is null or o.duration_months is null or o.duration_months <= p_max_months)
       and (p_scope <> 'partners' or o.source = 'partner_organization')
       and (p_scope <> 'for_me'
            or (private.internship_relevance(v_need, o.id) ->> 'label') is not null)
       and (v_norm is null
            or public.normalize_text(o.title) like '%' || public.normalize_text(v_norm) || '%'
            or public.normalize_text(coalesce(o.organization_raw, ''))
                 like '%' || public.normalize_text(v_norm) || '%')
       and (v_at is null or (coalesce(o.published_at, o.created_at), o.id) < (v_at, v_cid))
     order by coalesce(o.published_at, o.created_at) desc, o.id desc
     limit v_limit)
  select coalesce(jsonb_agg(private.internship_offer_card(page.id, v_need)
                            order by page.ranked_at desc, page.id desc), '[]'::jsonb),
         count(*)::integer,
         (array_agg(page.ranked_at order by page.ranked_at, page.id))[1],
         (array_agg(page.id order by page.ranked_at, page.id))[1]
    into v_rows, v_count, v_tail_at, v_tail_id
    from page;

  if v_count = v_limit then
    v_next := private.encode_keyset_cursor(v_tail_at, v_tail_id);
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next, 'has_need', v_need is not null);
end
$fn$;

revoke all on function public.list_internship_offers(text, text, char, bigint, numeric, text, integer) from public, anon;
grant execute on function public.list_internship_offers(text, text, char, bigint, numeric, text, integer) to authenticated;


create or replace function public.get_internship_offer(p_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_need uuid;
  v_o    public.internship_offers;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not private.can_see_internship_offer(p_offer_id) then
    raise exception 'internship_offer_not_found' using errcode = 'P0002';
  end if;

  select * into v_o from public.internship_offers
   where id = p_offer_id and deleted_at is null;
  if not found then
    raise exception 'internship_offer_not_found' using errcode = 'P0002';
  end if;

  select id into v_need from public.internship_needs
   where student_profile_id = v_me and deleted_at is null
     and status in ('draft','active','paused','matched');

  return private.internship_offer_card(p_offer_id, v_need) || jsonb_build_object(
    'description',      v_o.description,
    'profile_wanted',   v_o.profile_wanted,
    'compensation_details', v_o.compensation_details,
    'application_instructions', v_o.application_instructions,
    'external_url',     v_o.external_url,
    'conditions_to_confirm', v_o.conditions_to_confirm,
    -- ISE lies a l'organisation : un fait constate, pas une promesse.
    'network_members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'profile_id',   n.id,
               'display_name', coalesce(n.display_name, n.first_name || ' ' || n.last_name),
               'position',     n.current_position,
               'promotion',    (select pr.program_code || ' ' || pr.graduation_year
                                  from public.promotions pr where pr.id = n.promotion_id)))
        from public.ise_profiles n
       where v_o.organization_id is not null
         and n.current_organization_id = v_o.organization_id
         and n.claim_status = 'claimed' and n.deleted_at is null
         and not private.is_blocked_between(v_me, n.id)
       limit 5), '[]'::jsonb),
    'my_application', (
      select jsonb_build_object('application_id', a.id, 'status', a.status)
        from public.internship_applications a
       where a.offer_id = p_offer_id and a.student_profile_id = v_me
       order by a.created_at desc limit 1));
end
$fn$;

revoke all on function public.get_internship_offer(uuid) from public, anon;
grant execute on function public.get_internship_offer(uuid) to authenticated;

comment on function public.get_internship_offer(uuid) is
  'ISE-073. Renvoie platform_transmits = false : la plateforme ne depose aucun dossier (D-55).';


-- =====================================================================
-- 5. ISE-074 / ISE-076 — dossier de candidature, DECLARATIF de bout en
--    bout (D-55)
-- =====================================================================
create or replace function public.save_internship_application_draft(
  p_application_id uuid,
  p_offer_id       uuid,
  p_payload        jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_id    uuid := p_application_id;
  v_need  uuid;
  v_title text;
  v_org   uuid;
  v_raw   text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select id into v_need from public.internship_needs
   where student_profile_id = v_me and deleted_at is null
     and status in ('draft','active','paused','matched');

  if v_id is null then
    if p_offer_id is null then
      raise exception 'validation_failed' using errcode = 'P0001';
    end if;
    if not private.can_see_internship_offer(p_offer_id) then
      raise exception 'internship_offer_not_found' using errcode = 'P0002';
    end if;
    select o.title, o.organization_id, o.organization_raw
      into v_title, v_org, v_raw
      from public.internship_offers o where o.id = p_offer_id;

    insert into public.internship_applications (
      need_id, student_profile_id, offer_id, organization_id, organization_raw,
      position_title, application_channel, cv_storage_path, message, status)
    values (v_need, v_me, p_offer_id, v_org, v_raw,
            coalesce(p_payload ->> 'position_title', v_title),
            coalesce(p_payload ->> 'application_channel', 'platform'),
            p_payload ->> 'cv_storage_path',
            p_payload ->> 'message',
            'to_prepare')
    returning id into v_id;
  else
    -- Statut INVARIANT : ce chemin ne soumet jamais (D-55).
    update public.internship_applications set
      position_title      = coalesce(p_payload ->> 'position_title', position_title),
      application_channel = coalesce(p_payload ->> 'application_channel', application_channel),
      cv_storage_path     = coalesce(p_payload ->> 'cv_storage_path', cv_storage_path),
      message             = coalesce(p_payload ->> 'message', message),
      notes               = coalesce(p_payload ->> 'notes', notes),
      updated_at          = now()
     where id = v_id and student_profile_id = v_me and status = 'to_prepare';
    if not found then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
  end if;

  return jsonb_build_object('application_id', v_id, 'status', 'to_prepare', 'is_sent', false);
end
$fn$;

revoke all on function public.save_internship_application_draft(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_internship_application_draft(uuid, uuid, jsonb) to authenticated;

comment on function public.save_internship_application_draft(uuid, uuid, jsonb) is
  'ISE-074. Le statut to_prepare est invariant : aucun chemin de soumission ici (D-55).';


-- SEUL chemin vers `submitted`. La date d'envoi est OBLIGATOIRE et
-- fournie par l'eleve : la plateforme ne constate rien, elle enregistre
-- une declaration (MASTER PROMPT 27, D-55).
create or replace function public.declare_internship_application_sent(
  p_application_id uuid,
  p_channel        text,
  p_sent_on        date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_a  public.internship_applications;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_sent_on is null then
    -- Sans date declaree, il n'y a pas de declaration.
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_sent_on > current_date then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_channel not in ('platform','email','external_site','via_introduction','other') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_a from public.internship_applications
   where id = p_application_id for update;
  if not found or v_a.student_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_a.status <> 'to_prepare' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.internship_applications
     set status = 'submitted',
         application_channel = p_channel,
         submitted_on = p_sent_on,
         status_changed_at = now(),
         updated_at = now()
   where id = p_application_id;

  insert into public.internship_application_events
    (application_id, from_status, to_status, declared_by_profile_id, occurred_on, note)
  values (p_application_id, 'to_prepare', 'submitted', v_me, p_sent_on,
          'Envoi declare par l''eleve.');

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('internship.application_declared_sent', 'internship', p_application_id, v_me,
          jsonb_build_object('channel', p_channel, 'sent_on', p_sent_on));

  return jsonb_build_object(
    'application_id', p_application_id,
    'status',         'submitted',
    'sent_on',        p_sent_on,
    -- L'origine de l'information est nommee : c'est l'eleve.
    'declared_by',    'student');
end
$fn$;

revoke all on function public.declare_internship_application_sent(uuid, text, date) from public, anon;
grant execute on function public.declare_internship_application_sent(uuid, text, date) to authenticated;

comment on function public.declare_internship_application_sent(uuid, text, date) is
  'Seul chemin vers submitted. Exige une date d''envoi declaree par l''eleve (MASTER PROMPT 27, D-55).';


create or replace function public.declare_internship_application_step(
  p_application_id uuid,
  p_to_status      text,
  p_occurred_on    date default null,
  p_note           text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_a  public.internship_applications;
  v_ok boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_a from public.internship_applications
   where id = p_application_id for update;
  if not found or v_a.student_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Matrice de transitions. `to_prepare -> submitted` est ABSENT : il
  -- n'appartient qu'a `declare_internship_application_sent()`.
  v_ok := case v_a.status
    when 'submitted' then p_to_status in ('reviewed','interview','offered','declined','withdrawn')
    when 'reviewed'  then p_to_status in ('interview','offered','declined','withdrawn')
    when 'interview' then p_to_status in ('offered','declined','withdrawn')
    when 'offered'   then p_to_status in ('accepted','declined','withdrawn')
    when 'to_prepare' then p_to_status = 'withdrawn'
    else false end;
  if not v_ok then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.internship_applications
     set status = p_to_status, status_changed_at = now(), updated_at = now()
   where id = p_application_id;

  insert into public.internship_application_events
    (application_id, from_status, to_status, declared_by_profile_id, occurred_on, note)
  values (p_application_id, v_a.status, p_to_status, v_me,
          coalesce(p_occurred_on, current_date), p_note);

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('internship.application_step_declared', 'internship', p_application_id, v_me,
          jsonb_build_object('from', v_a.status, 'to', p_to_status));

  return jsonb_build_object('application_id', p_application_id, 'status', p_to_status,
                            'declared_by', 'student');
end
$fn$;

revoke all on function public.declare_internship_application_step(uuid, text, date, text) from public, anon;
grant execute on function public.declare_internship_application_step(uuid, text, date, text) to authenticated;


create or replace function public.get_internship_application(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_a  public.internship_applications;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_a from public.internship_applications where id = p_application_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- Le carnet de bord est strictement personnel ; la gestion des stages
  -- le lit sans le modifier (rls.md 10.3).
  if v_a.student_profile_id <> v_me and not private.has_permission('internships.manage') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'application_id', v_a.id,
    'offer_id',       v_a.offer_id,
    'position_title', v_a.position_title,
    'organization',   coalesce((select g.canonical_name from public.organizations g
                                 where g.id = v_a.organization_id), v_a.organization_raw),
    'status',         v_a.status,
    'application_channel', v_a.application_channel,
    'submitted_on',   v_a.submitted_on,
    'message',        v_a.message,
    'notes',          v_a.notes,
    'next_action',    v_a.next_action,
    'next_action_due_on', v_a.next_action_due_on,
    'cv_storage_path', v_a.cv_storage_path,
    -- Chaque etape porte son auteur : rien n'a ete pose par la
    -- plateforme (D-55).
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
               'from_status',  e.from_status,
               'to_status',    e.to_status,
               'occurred_on',  e.occurred_on,
               'note',         e.note,
               'declared_by_me', e.declared_by_profile_id = v_me)
             order by e.occurred_on, e.created_at)
        from public.internship_application_events e
       where e.application_id = v_a.id), '[]'::jsonb),
    'helpers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'request_id',   h.id,
               'request_type', h.request_type,
               'status',       h.status,
               'responded_at', h.responded_at,
               'alumni',       private.network_profile_card(h.alumni_profile_id)))
        from public.internship_help_requests h
       where h.student_profile_id = v_a.student_profile_id
         and (h.related_offer_id = v_a.offer_id or h.related_offer_id is null)
         and h.status in ('accepted','answered')), '[]'::jsonb),
    'placement', (
      select jsonb_build_object('placement_id', pl.id, 'status', pl.status)
        from public.internship_placements pl where pl.application_id = v_a.id));
end
$fn$;

revoke all on function public.get_internship_application(uuid) from public, anon;
grant execute on function public.get_internship_application(uuid) to authenticated;


create or replace function public.list_my_internship_applications(
  p_group  text    default 'in_progress',
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
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_group not in ('in_progress','to_prepare','closed','all') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_at, v_cid from private.decode_keyset_cursor(p_cursor);

  with page as (
    select a.id, a.created_at, a.position_title, a.status, a.submitted_on,
           a.next_action, a.next_action_due_on, a.offer_id,
           coalesce(g.canonical_name, a.organization_raw) as organization
      from public.internship_applications a
      left join public.organizations g on g.id = a.organization_id
     where a.student_profile_id = v_me
       and (p_group <> 'to_prepare'  or a.status = 'to_prepare')
       and (p_group <> 'in_progress' or a.status in ('submitted','reviewed','interview','offered'))
       and (p_group <> 'closed'      or a.status in ('accepted','declined','withdrawn'))
       and (v_at is null or (a.created_at, a.id) < (v_at, v_cid))
     order by a.created_at desc, a.id desc
     limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'application_id', page.id,
           'offer_id',       page.offer_id,
           'position_title', page.position_title,
           'organization',   page.organization,
           'status',         page.status,
           'submitted_on',   page.submitted_on,
           'next_action',    page.next_action,
           'next_action_due_on', page.next_action_due_on)
           order by page.created_at desc, page.id desc), '[]'::jsonb),
         count(*)::integer,
         (array_agg(page.created_at order by page.created_at, page.id))[1],
         (array_agg(page.id order by page.created_at, page.id))[1]
    into v_rows, v_count, v_tail_at, v_tail_id
    from page;

  if v_count = v_limit then
    v_next := private.encode_keyset_cursor(v_tail_at, v_tail_id);
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_my_internship_applications(text, text, integer) from public, anon;
grant execute on function public.list_my_internship_applications(text, text, integer) to authenticated;


-- =====================================================================
-- 6. ISE-075 — demander une relecture, un conseil, une introduction
--
-- « L'une des specificites les plus importantes du module » ([F 38]).
-- Chaque proposition porte ses RAISONS (D-43) ; aucune ne porte de
-- score. La disponibilite declaree pese, mais ne suffit pas seule.
-- =====================================================================
create or replace function public.list_internship_helpers(
  p_offer_id uuid    default null,
  p_limit    integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_need  uuid;
  v_org   uuid;
  v_sec   bigint;
  v_limit integer := least(greatest(coalesce(p_limit, 6), 1), 20);
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select id into v_need from public.internship_needs
   where student_profile_id = v_me and deleted_at is null
     and status in ('draft','active','paused','matched');

  if p_offer_id is not null then
    if not private.can_see_internship_offer(p_offer_id) then
      raise exception 'internship_offer_not_found' using errcode = 'P0002';
    end if;
    select o.organization_id, o.sector_id into v_org, v_sec
      from public.internship_offers o where o.id = p_offer_id;
  end if;

  return jsonb_build_object('rows', coalesce((
    select jsonb_agg(jsonb_build_object(
             'profile_id',   k.profile_id,
             'display_name', k.display_name,
             'position',     k.job_position,
             'organization', k.organization,
             'avatar_path',  k.avatar_path,
             'promotion',    k.promotion,
             'available',    k.available,
             -- Les RAISONS sortent, le decompte de signaux reste ici
             -- (D-42, D-119 par analogie : jamais de chiffre publie).
             'reasons',      k.reasons)
           order by k.signals desc, k.display_name)
      from (
        select a.id as profile_id,
               coalesce(a.display_name, a.first_name || ' ' || a.last_name) as display_name,
               a.current_position as job_position,
               coalesce(g.canonical_name, a.current_organization_raw) as organization,
               a.avatar_path,
               (select pr.program_code || ' ' || pr.graduation_year
                  from public.promotions pr where pr.id = a.promotion_id) as promotion,
               exists (select 1 from public.profile_availabilities av
                        where av.profile_id = a.id and av.active) as available,
               (case when v_org is not null and a.current_organization_id = v_org then 1 else 0 end
                + case when v_sec is not null and exists (
                    select 1 from public.profile_sectors ps
                     where ps.profile_id = a.id and ps.sector_id = v_sec) then 1 else 0 end
                + case when exists (
                    select 1 from public.profile_availabilities av
                     where av.profile_id = a.id and av.active) then 1 else 0 end) as signals,
               (select jsonb_agg(t.r)
                  from unnest(array_remove(array[
                    case when v_org is not null and a.current_organization_id = v_org
                         then 'Travaille dans l''organisation concernee par votre recherche' end,
                    case when v_sec is not null and exists (
                           select 1 from public.profile_sectors ps
                            where ps.profile_id = a.id and ps.sector_id = v_sec)
                         then 'Exerce dans le secteur vise par cette offre' end,
                    case when exists (
                           select 1 from public.profile_availabilities av
                            where av.profile_id = a.id and av.active)
                         then 'A declare etre disponible pour aider' end,
                    case when a.promotion_id is not null and exists (
                           select 1 from public.ise_profiles me
                            where me.id = v_me and me.promotion_id = a.promotion_id)
                         then 'Membre de votre promotion' end
                  ], null)) as t(r)) as reasons
          from public.ise_profiles a
          left join public.organizations g on g.id = a.current_organization_id
         where a.profile_type = 'graduate'
           and a.claim_status = 'claimed'
           and a.deleted_at is null
           and a.id <> v_me
           and not private.is_blocked_between(v_me, a.id)
           and (
             (v_org is not null and a.current_organization_id = v_org)
             or (v_sec is not null and exists (select 1 from public.profile_sectors ps
                                                where ps.profile_id = a.id and ps.sector_id = v_sec))
             or (v_need is not null and exists (
                   select 1 from public.internship_need_sectors ns
                     join public.profile_sectors ps on ps.sector_id = ns.sector_id
                    where ns.need_id = v_need and ps.profile_id = a.id)))
         limit v_limit) k
     -- D-43 : une proposition sans raison affichable est exclue.
     where k.reasons is not null), '[]'::jsonb));
end
$fn$;

revoke all on function public.list_internship_helpers(uuid, integer) from public, anon;
grant execute on function public.list_internship_helpers(uuid, integer) to authenticated;

comment on function public.list_internship_helpers(uuid, integer) is
  'ISE-075. Raisons explicites (D-43), aucun score. Une proposition sans raison est exclue.';


create or replace function public.request_internship_help(
  p_alumni_profile_id uuid,
  p_request_type      text,
  p_message           text,
  p_related_offer_id  uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid := private.current_profile_id();
  v_need uuid;
  v_id   uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_alumni_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if p_request_type not in ('advice','cv_review','organization_info','introduction','internship_possibility') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_message, ''))) = 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(v_me, p_alumni_profile_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.ise_profiles a
                  where a.id = p_alumni_profile_id and a.deleted_at is null
                    and a.claim_status = 'claimed' and a.profile_status = 'active') then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  -- Anti-spam ([F 52][U 56]) : les sollicitations repetees sont bornees.
  if not private.consume_rate_limit(v_me::text, 'internship.help_request', 5, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select id into v_need from public.internship_needs
   where student_profile_id = v_me and deleted_at is null
     and status in ('draft','active','paused','matched');

  insert into public.internship_help_requests
    (need_id, student_profile_id, alumni_profile_id, request_type,
     related_offer_id, message, status, expires_at)
  values (v_need, v_me, p_alumni_profile_id, p_request_type,
          p_related_offer_id, btrim(p_message), 'sent', now() + interval '21 days')
  returning id into v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('internship.help_requested', 'internship', v_id, v_me,
          jsonb_build_object('request_type', p_request_type));

  return jsonb_build_object('request_id', v_id, 'status', 'sent',
                            -- Un ancien peut toujours refuser.
                            'commits_alumni', false);
end
$fn$;

revoke all on function public.request_internship_help(uuid, text, text, uuid) from public, anon;
grant execute on function public.request_internship_help(uuid, text, text, uuid) to authenticated;


create or replace function public.respond_to_internship_help_request(
  p_request_id uuid,
  p_decision   text,
  p_message    text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_h  public.internship_help_requests;
  v_to text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_decision not in ('view','accept','decline','answer') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_h from public.internship_help_requests
   where id = p_request_id for update;
  if not found or v_h.alumni_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_h.status not in ('sent','viewed','accepted') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_to := case p_decision
            when 'view'    then 'viewed'
            when 'accept'  then 'accepted'
            when 'decline' then 'declined'
            else 'answered' end;

  update public.internship_help_requests
     set status = v_to,
         response_message = coalesce(p_message, response_message),
         viewed_at   = coalesce(viewed_at, now()),
         responded_at = case when v_to in ('accepted','declined','answered')
                             then now() else responded_at end,
         updated_at  = now()
   where id = p_request_id;

  if v_to in ('accepted','answered') then
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('internship.help_answered', 'internship', p_request_id, v_me,
            jsonb_build_object('status', v_to));
  end if;

  return jsonb_build_object('request_id', p_request_id, 'status', v_to);
end
$fn$;

revoke all on function public.respond_to_internship_help_request(uuid, text, text) from public, anon;
grant execute on function public.respond_to_internship_help_request(uuid, text, text) to authenticated;

comment on function public.respond_to_internship_help_request(uuid, text, text) is
  'ISE-075, cote ancien. Un refus n''exige aucune justification.';


-- =====================================================================
-- 7. ISE-077 — Resultat du stage et impact
--
-- Le placement est DECLARE par l'eleve. L'attribution au reseau est une
-- reponse a une question posee ([U 83-84]), jamais une deduction : sans
-- `network_attribution` explicite, aucun `impact_event` n'est ecrit.
-- =====================================================================
create or replace function public.record_internship_result(
  p_application_id uuid,
  p_payload        jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_a     public.internship_applications;
  v_pl    uuid;
  v_attr  text := coalesce(p_payload ->> 'network_attribution', 'unknown');
  v_src   text := coalesce(p_payload ->> 'placement_source', 'other');
  v_helper uuid := nullif(p_payload ->> 'attributed_helper_profile_id', '')::uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_internship_student() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_attr not in ('direct','partial','none','unknown') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if v_src not in ('ise_offer','ise_introduction','alumni_contact','school',
                   'personal_search','external_offer','other') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_a from public.internship_applications
   where id = p_application_id for update;
  if not found or v_a.student_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- Un stage obtenu se constate a partir d'une proposition acceptee ou
  -- recue : on ne saute pas d'etape (D-55).
  if v_a.status not in ('offered','accepted') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.internship_placements pl
              where pl.application_id = p_application_id) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;
  if (p_payload ->> 'start_date') is null or (p_payload ->> 'end_date') is null
     or (p_payload ->> 'country_code') is null then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.internship_placements (
    student_profile_id, need_id, offer_id, application_id,
    organization_id, organization_raw, department, sector_id,
    country_code, city, start_date, end_date, work_mode,
    thesis_topic, professional_supervisor_name, professional_supervisor_role,
    placement_source, network_attribution, attributed_offer_id,
    attributed_helper_profile_id, status, agreement_status)
  values (
    v_me, v_a.need_id, v_a.offer_id, p_application_id,
    v_a.organization_id, coalesce(p_payload ->> 'organization_raw', v_a.organization_raw),
    p_payload ->> 'department', nullif(p_payload ->> 'sector_id', '')::bigint,
    (p_payload ->> 'country_code')::char(2), p_payload ->> 'city',
    (p_payload ->> 'start_date')::date, (p_payload ->> 'end_date')::date,
    coalesce(p_payload ->> 'work_mode', 'on_site'),
    p_payload ->> 'thesis_topic',
    p_payload ->> 'professional_supervisor_name',
    p_payload ->> 'professional_supervisor_role',
    v_src, v_attr, v_a.offer_id, v_helper,
    'confirmed', coalesce(p_payload ->> 'agreement_status', 'not_started'))
  returning id into v_pl;

  update public.internship_applications
     set status = 'accepted', status_changed_at = now(), updated_at = now()
   where id = p_application_id and status <> 'accepted';

  insert into public.internship_application_events
    (application_id, from_status, to_status, declared_by_profile_id, occurred_on, note)
  values (p_application_id, v_a.status, 'accepted', v_me, current_date,
          'Resultat declare par l''eleve.');

  update public.internship_needs
     set status = 'placed', placed_at = now(), updated_at = now()
   where id = v_a.need_id and status in ('active','paused','matched','draft');

  -- Impact : uniquement si le reseau a REELLEMENT contribue ([U 93]).
  -- « Je ne sais pas » et « Non » n'ecrivent rien.
  if v_attr in ('direct','partial') then
    insert into analytics.impact_events (
      impact_type, beneficiary_profile_id, contributor_profile_id,
      source_type, source_id, attribution_level, declared_by_profile_id,
      organization_id, promotion_id, country_code, occurred_at, metadata)
    select 'internship_obtained', v_me, v_helper,
           'internship', v_pl, v_attr, v_me,
           v_a.organization_id, p.promotion_id, (p_payload ->> 'country_code')::char(2),
           now(), jsonb_build_object('placement_source', v_src)
      from public.ise_profiles p where p.id = v_me;
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('internship.result_declared', 'internship', v_pl, v_me,
          jsonb_build_object('network_attribution', v_attr, 'placement_source', v_src));

  return jsonb_build_object(
    'placement_id',        v_pl,
    'status',              'confirmed',
    'network_attribution', v_attr,
    'impact_recorded',     v_attr in ('direct','partial'));
end
$fn$;

revoke all on function public.record_internship_result(uuid, jsonb) from public, anon;
grant execute on function public.record_internship_result(uuid, jsonb) to authenticated;

comment on function public.record_internship_result(uuid, jsonb) is
  'ISE-077. Sans attribution reseau explicite, aucun impact_event n''est ecrit ([U 93], D-55).';
