-- 0035_rls_profile_sections
-- Applique le 2026-08-08 (version 20260808052700)
-- Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0035_rls_profile_sections
--
-- Tranche verticale « Onboarding ISE-008 -> ISE-014 » et
-- « Profil membre ISE-016 -> ISE-023 ».
--
-- Ce que cette migration APPORTE :
--   1. public.profile_onboarding_progress  — progression d'onboarding
--      PERSISTEE EN BASE (aucun etat d'onboarding cote client).
--   2. public.promotion_suggestions        — ISE-009, « signaler une
--      promotion absente » alimente une vraie table.
--   3. public.search_skills(text, int)     — recherche incrementale sur
--      les 543 competences, avec resolution d'alias (D-46) et
--      regroupement par domaine.
--   4. public.complete_onboarding()        — etape 7, transition d'etat
--      atomique : pose onboarding_completed_at, cloture la progression,
--      renvoie le score recalcule par le trigger de 0032.
--   5. Les politiques RLS des deux tables creees ici.
--
-- Ce que cette migration NE FAIT PAS :
--   Elle ne modifie AUCUNE politique existante. Les sections de profil
--   (experiences, educations, profile_skills, profile_sectors,
--   profile_geographies, profile_availabilities, profile_visibility)
--   sont deja ouvertes par 0021 sur le modele
--   « <t>_select = can_see_field/can_see_profile » +
--   « <t>_write_own = profile_id = current_profile_id() » : les ecrans
--   ISE-016 -> ISE-023 s'y appuient tels quels.
--
-- Modele suivi : 0021 (politiques `to authenticated` explicites,
-- autorisation resolue par private.has_permission, jamais par un test de
-- role en dur — D-31).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Progression d'onboarding (ISE-008 -> ISE-014)
--
-- D-70 : 7 etapes, dans l'ordre des noms de fichiers des maquettes
--   1 Verification · 2 Promotion · 3 Competences · 4 Secteurs
--   5 Localisation · 6 Disponibilite · 7 Finalisation
--
-- Les DONNEES saisies a chaque etape vivent dans leurs tables metier
-- reelles (ise_profiles, profile_skills, profile_sectors,
-- profile_geographies, profile_availabilities) : cette table ne porte
-- QUE le curseur de parcours. Fermer l'onglet ne perd donc rien, ni les
-- saisies, ni la position.
--
-- `furthest_step` permet de revenir en arriere sans reculer le parcours :
-- l'etape la plus avancee jamais atteinte reste joignable directement.
-- ---------------------------------------------------------------------
create table if not exists public.profile_onboarding_progress (
  profile_id    uuid primary key references public.ise_profiles(id) on delete cascade,
  current_step  smallint not null default 1 check (current_step between 1 and 7),
  furthest_step smallint not null default 1 check (furthest_step between 1 and 7),
  skipped_steps smallint[] not null default '{}'::smallint[],
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profile_onboarding_progress_furthest_ge_current
    check (furthest_step >= current_step)
);

select private.attach_updated_at('public', 'profile_onboarding_progress');

comment on table public.profile_onboarding_progress is
  'Curseur de parcours d''onboarding (ISE-008 -> ISE-014, D-70). Une ligne par profil. Les saisies elles-memes vivent dans les tables metier : cette table ne stocke aucune donnee de profil.';
comment on column public.profile_onboarding_progress.furthest_step is
  'Etape la plus avancee jamais atteinte. Revenir en arriere ne la fait jamais reculer.';
comment on column public.profile_onboarding_progress.skipped_steps is
  'Etapes explicitement passees par le membre (« Passer cette etape » des maquettes ISE-011 a ISE-013).';

-- ---------------------------------------------------------------------
-- 2. ISE-009 — Signaler une promotion absente
--
-- La maquette demande : libelle de promotion, etablissement, pays, annee
-- approximative, commentaire. `missing_member_suggestions` (0003) porte
-- un MEMBRE manquant DANS une promotion existante (promotion_id not
-- null, first_name/last_name not null) : elle ne peut pas porter une
-- promotion absente du referentiel. D'ou une table dediee.
--
-- Aucune promotion n'est creee automatiquement : le signalement part en
-- revue (`promotions.manage`), conformement au message de la maquette
-- « Aucun nouveau profil ni nouvelle promotion n'est cree
-- automatiquement sans controle ».
-- ---------------------------------------------------------------------
create table if not exists public.promotion_suggestions (
  id                      uuid primary key default extensions.gen_random_uuid(),
  submitted_by_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  promotion_label         text not null,
  institution             text,
  country_code            char(2) references public.countries(code),
  approximate_year        integer check (approximate_year is null
                                         or approximate_year between 1940 and 2100),
  comment                 text,
  status                  text not null default 'submitted'
                            check (status in ('submitted', 'under_review', 'accepted',
                                              'rejected', 'duplicate')),
  matched_promotion_id    bigint references public.promotions(id) on delete set null,
  review_note             text,
  reviewed_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  reviewed_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint promotion_suggestions_label_not_blank
    check (btrim(promotion_label) <> '')
);

select private.attach_updated_at('public', 'promotion_suggestions');

-- Anti-doublon et garde-fou anti-spam : un membre ne signale pas deux
-- fois la meme promotion. Preferable a un compteur applicatif, qui
-- serait contournable.
create unique index if not exists promotion_suggestions_unique_per_author_idx
  on public.promotion_suggestions (submitted_by_profile_id, public.normalize_text(promotion_label));

create index if not exists promotion_suggestions_status_idx
  on public.promotion_suggestions (status, created_at desc);

comment on table public.promotion_suggestions is
  'ISE-009 — promotions signalees comme absentes du referentiel. Revue par `promotions.manage`. Aucune promotion n''est creee automatiquement (MASTER PROMPT §27).';

-- ---------------------------------------------------------------------
-- 3. RLS des deux tables creees
--
-- Refus par defaut : `enable` ET `force` (docs/rls.md §1.1).
-- ---------------------------------------------------------------------
alter table public.profile_onboarding_progress enable row level security;
alter table public.profile_onboarding_progress force row level security;
alter table public.promotion_suggestions        enable row level security;
alter table public.promotion_suggestions        force row level security;

-- La progression d'onboarding est STRICTEMENT personnelle : elle n'est
-- lisible ni par un tiers, ni par un administrateur (meme logique que
-- `saved_searches` et que le score de completion, D-72).
drop policy if exists profile_onboarding_progress_own on public.profile_onboarding_progress;
create policy profile_onboarding_progress_own
  on public.profile_onboarding_progress
  for all
  to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id());

-- Un membre lit ses propres signalements ; un gestionnaire de promotions
-- lit et traite tous les signalements.
drop policy if exists promotion_suggestions_own on public.promotion_suggestions;
create policy promotion_suggestions_own
  on public.promotion_suggestions
  for select
  to authenticated
  using (
    submitted_by_profile_id = private.current_profile_id()
    or private.has_permission('promotions.manage')
  );

-- L'auteur est impose et le statut initial aussi : un membre ne depose
-- pas un signalement deja « accepte ».
drop policy if exists promotion_suggestions_create on public.promotion_suggestions;
create policy promotion_suggestions_create
  on public.promotion_suggestions
  for insert
  to authenticated
  with check (
    submitted_by_profile_id = private.current_profile_id()
    and status = 'submitted'
    and matched_promotion_id is null
    and reviewed_at is null
    and reviewed_by_profile_id is null
  );

drop policy if exists promotion_suggestions_review on public.promotion_suggestions;
create policy promotion_suggestions_review
  on public.promotion_suggestions
  for all
  to authenticated
  using (private.has_permission('promotions.manage'))
  with check (private.has_permission('promotions.manage'));

grant select, insert, update on public.profile_onboarding_progress to authenticated;
grant select, insert, update on public.promotion_suggestions        to authenticated;

-- ---------------------------------------------------------------------
-- 4. ISE-010 / ISE-022 — recherche incrementale de competences
--
-- 543 competences, 92 categories, 18 domaines, 125 alias. La liste n'est
-- JAMAIS codee en dur cote application : cet acces est le seul.
--
-- Resolution d'alias (D-46) : un alias court (`IE`, `IV`, marque
-- `is_short_acronym`) n'est resolu que s'il est saisi EN MAJUSCULES et
-- ISOLE — sinon « IE » ferait remonter des competences a chaque mot
-- contenant ces deux lettres.
--
-- Fonction `security invoker` : `skills`, `skill_aliases`,
-- `skill_categories` et `skill_domains` sont deja lisibles par tout
-- membre authentifie (politiques `..._read_authenticated`, 0020). Rien
-- a contourner, donc pas de `security definer` (MASTER PROMPT §72).
-- ---------------------------------------------------------------------
create or replace function public.search_skills(
  p_query text default null,
  p_limit integer default 30
)
returns table (
  skill_id      bigint,
  skill_name    text,
  skill_slug    text,
  category_id   bigint,
  category_name text,
  domain_id     bigint,
  domain_name   text,
  matched_alias text,
  rank          real
)
language sql
stable
set search_path = ''
as $fn$
  with q as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as raw,
      public.normalize_text(p_query)           as norm
  ),
  hit as (
    -- Correspondance sur le libelle officiel.
    select
      s.id                        as skill_id,
      null::text                  as matched_alias,
      case
        when q.norm is null then 0.50::real
        when public.normalize_text(s.name) = q.norm then 1.00::real
        when public.normalize_text(s.name) like q.norm || '%' then 0.90::real
        when public.normalize_text(s.name) like '%' || q.norm || '%' then 0.80::real
        else extensions.similarity(public.normalize_text(s.name), q.norm)
      end                         as rank
    from public.skills s
    cross join q
    where s.is_active
      and (
        q.norm is null
        or public.normalize_text(s.name) like '%' || q.norm || '%'
        or extensions.similarity(public.normalize_text(s.name), q.norm) >= 0.30
      )

    union all

    -- Correspondance sur un alias (D-46).
    select
      a.skill_id,
      a.alias,
      case when a.normalized_alias = q.norm then 0.95::real else 0.70::real end
    from public.skill_aliases a
    join public.skills s on s.id = a.skill_id and s.is_active
    cross join q
    where q.norm is not null
      and (
        a.normalized_alias like '%' || q.norm || '%'
        or extensions.similarity(a.normalized_alias, q.norm) >= 0.30
      )
      and (
        not a.is_short_acronym
        -- Alias court : uniquement en majuscules et isole.
        or (q.raw = upper(q.raw) and a.normalized_alias = q.norm)
      )
  ),
  best as (
    select
      hit.skill_id                                                     as skill_id,
      max(hit.rank)                                                    as rank,
      (array_agg(hit.matched_alias order by hit.rank desc nulls last)
        filter (where hit.matched_alias is not null))[1]               as matched_alias
    from hit
    group by hit.skill_id
  )
  select
    s.id,
    s.name,
    s.slug,
    c.id,
    c.name,
    d.id,
    d.name,
    best.matched_alias,
    best.rank
  from best
  join public.skills           s on s.id = best.skill_id
  join public.skill_categories c on c.id = s.category_id
  join public.skill_domains    d on d.id = c.domain_id
  order by best.rank desc, d.sort_order, c.sort_order, s.name
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$fn$;

comment on function public.search_skills(text, integer) is
  'ISE-010 / ISE-022 — recherche incrementale sur les competences actives, alias resolus (D-46). Regroupement par domaine assure par les colonnes domain_id / domain_name renvoyees. Requete vide = parcours du referentiel, ordonne par domaine puis categorie.';

revoke all on function public.search_skills(text, integer) from public, anon;
grant execute on function public.search_skills(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ISE-014 — Finalisation
--
-- `SECURITY DEFINER`, motif B (docs/rls.md §4, transition d'etat
-- atomique) : la fonction est le seul chemin qui pose
-- `onboarding_completed_at`, sous `FOR UPDATE`, apres verification de
-- l'acteur et de l'etat courant. Elle appelle
-- `public.calculate_profile_completion()`, revoquee a `authenticated`
-- (D-72) : le score renvoye est celui du membre courant, et de lui seul,
-- car aucun identifiant n'est accepte en parametre.
--
-- Le score n'est pas recalcule ici « a la main » : le trigger de 0032
-- l'a deja fait a chaque ecriture de section. La valeur renvoyee sert a
-- l'ecran de finalisation.
-- ---------------------------------------------------------------------
create or replace function public.complete_onboarding()
returns table (completion smallint, completed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_profile      uuid;
  v_promotion    bigint;
  v_completed_at timestamptz;
  v_score        smallint;
begin
  v_profile := private.current_profile_id();
  if v_profile is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select p.promotion_id, p.onboarding_completed_at
    into v_promotion, v_completed_at
    from public.ise_profiles p
   where p.id = v_profile
     and p.deleted_at is null
     for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  -- Une seule information est structurellement indispensable : la
  -- promotion rattache le membre a sa generation (D-70, etape 2). Les
  -- autres etapes sont explicitement « passables » dans les maquettes.
  if v_promotion is null then
    raise exception 'onboarding_promotion_required' using errcode = 'P0001';
  end if;

  if v_completed_at is null then
    v_completed_at := now();
    update public.ise_profiles p
       set onboarding_completed_at = v_completed_at
     where p.id = v_profile;
  end if;

  insert into public.profile_onboarding_progress
    (profile_id, current_step, furthest_step, completed_at)
  values (v_profile, 7, 7, v_completed_at)
  on conflict (profile_id) do update
    set current_step  = 7,
        furthest_step = 7,
        completed_at  = coalesce(profile_onboarding_progress.completed_at, excluded.completed_at);

  select public.calculate_profile_completion(v_profile) into v_score;

  perform private.log_audit(
    p_action           => 'profile.onboarding_completed',
    p_object_type      => 'ise_profile',
    p_object_id        => v_profile::text,
    p_result           => 'success',
    p_context          => jsonb_build_object('completion', v_score),
    p_actor_profile_id => v_profile
  );

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload, dedupe_key)
  values
    ('profile.updated', 'profile', v_profile, v_profile,
     jsonb_build_object('reason', 'onboarding_completed', 'completion', v_score),
     'profile.onboarding_completed:' || v_profile::text)
  on conflict do nothing;

  return query select v_score, v_completed_at;
end
$fn$;

comment on function public.complete_onboarding() is
  'ISE-014 — cloture l''onboarding du membre courant. Sans parametre : aucun tiers atteignable. Pose onboarding_completed_at, cloture profile_onboarding_progress, renvoie le score de completion recalcule par le trigger de 0032 (D-71, D-72).';

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

-- ---------------------------------------------------------------------
-- 6. Controle de non-regression
--
-- La ligne de base doit rester vide apres l'ajout de deux tables et de
-- deux fonctions. Si l'une d'elles avait ete creee sans RLS, ou une
-- fonction `security definer` sans `search_path`, la migration echouerait
-- ICI plutot qu'en production.
-- ---------------------------------------------------------------------
do $mig$
declare
  v_n bigint;
begin
  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception 'security_baseline_violations: % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.tables_without_rls();
  if v_n <> 0 then
    raise exception 'tables_without_rls: % ligne(s)', v_n;
  end if;
end
$mig$;
