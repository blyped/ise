-- =====================================================================
-- 0029_profile_claim
-- Tranche verticale « Reclamation de profil » (ISE-005 -> ISE-007).
--
-- Sans cette tranche, un ISE reference dans l'annuaire ne peut pas devenir
-- membre : c'est la fonctionnalite d'entree du produit (MASTER PROMPT §7).
--
-- Contenu :
--   1. private.consume_rate_limit()       — limitation de debit (D-103)
--   2. private.mask_email_hint()          — indice d'e-mail masque (§47)
--   3. public.search_claimable_profiles() — ISE-005, recherche tolerante (D-45)
--   4. public.get_claimable_profile()     — ISE-006, recapitulatif
--   5. public.submit_profile_claim()      — soumission atomique + verification
--                                           par e-mail historique (ISE-007)
--   6. public.approve_profile_claim()     — revue humaine, permission profiles.verify
--   7. public.reject_profile_claim()
--   8. public.my_profile_claim()          — ISE-007, etat de MA reclamation
--
-- N'EDITE NI 0020, NI 0021, NI 0028. Aucune politique existante n'est
-- remplacee : la tranche s'appuie entierement sur des fonctions atomiques
-- (docs/rls.md §4, motif B) parce que le demandeur n'a PAS ENCORE de profil
-- et que `private.can_see_profile()` renvoie donc `false` pour lui.
--
-- References : MASTER PROMPT §6, §7, §21, §43, §47, §52, §64, §71, §72,
--              §85, §99, §100 ; D-10, D-19, D-20, D-45, D-101, D-102, D-103.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Types d'evenements de domaine ajoutes par la tranche
-- ---------------------------------------------------------------------
insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('profile.claim_submitted', 'Une reclamation de profil a ete deposee.',  'profile', 12),
  ('profile.claim_rejected',  'Une reclamation de profil a ete rejetee.',  'profile', 14)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 1. Limitation de debit (D-103, MASTER PROMPT §64 et §71)
--
-- Fenetre glissante approchee par seaux d'une minute : le compteur est
-- incremente dans le seau courant, puis la somme des seaux encore dans la
-- fenetre est comparee a la limite. Les seaux sortis de la fenetre sont
-- purges a chaque appel : la table ne croit pas indefiniment.
--
-- SECURITY DEFINER justifie (motif A) : ecrit dans `private`, table non
-- exposee. La fonction n'est accordee a AUCUN role client — elle n'est
-- appelable que depuis les fonctions metier ci-dessous.
-- ---------------------------------------------------------------------
create or replace function private.consume_rate_limit(
  p_subject_key    text,
  p_action_key     text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_bucket timestamptz := date_trunc('minute', now());
  v_total  bigint;
begin
  if p_subject_key is null or p_action_key is null or p_limit is null then
    return false;
  end if;

  delete from private.rate_limit_counters c
   where c.subject_key = p_subject_key
     and c.action_key  = p_action_key
     and c.window_start < now() - make_interval(secs => p_window_seconds);

  insert into private.rate_limit_counters (subject_key, action_key, window_start, count)
  values (p_subject_key, p_action_key, v_bucket, 1)
  on conflict (subject_key, action_key, window_start)
  do update set count = private.rate_limit_counters.count + 1;

  select coalesce(sum(c.count), 0)
    into v_total
  from private.rate_limit_counters c
  where c.subject_key = p_subject_key
    and c.action_key  = p_action_key
    and c.window_start > now() - make_interval(secs => p_window_seconds);

  return v_total <= p_limit;
end
$$;

revoke all on function private.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

comment on function private.consume_rate_limit(text, text, integer, integer) is
  'Compteur anti-abus a fenetre glissante (D-103). Renvoie false quand la limite est depassee. '
  'Non accordee aux roles clients : appelee uniquement depuis les fonctions metier.';


-- ---------------------------------------------------------------------
-- 2. Indice d'e-mail masque
--
-- MASTER PROMPT §47 : « ne jamais renvoyer puis masquer ». La forme
-- `a...@d....com` est CONSTRUITE en base ; l'adresse complete ne quitte
-- jamais le serveur. Elle sert uniquement a permettre a la personne de
-- reconnaitre SON adresse historique — pas a la deviner.
--
-- Fonction pure (ni SECURITY DEFINER, ni acces a une table).
-- ---------------------------------------------------------------------
create or replace function private.mask_email_hint(p_email text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else
      left(split_part(p_email, '@', 1), 1) || U&'\2022\2022\2022' || '@' ||
      left(split_part(p_email, '@', 2), 1) || U&'\2022\2022\2022' ||
      coalesce('.' || substring(lower(split_part(p_email, '@', 2)) from '\.([a-z0-9-]+)$'), '')
  end
$$;

comment on function private.mask_email_hint(text) is
  'Indice d''e-mail au format a<points>@d<points>.tld. Ni l''identifiant local, ni le domaine complet ne sortent (MASTER PROMPT §47).';


-- ---------------------------------------------------------------------
-- 3. ISE-005 — Recherche de profils reclamables
--
-- SECURITY DEFINER justifie (motif A) : le demandeur n'a pas encore de
-- profil, donc `private.can_see_profile()` lui refuse toute ligne de
-- `ise_profiles`, et `private.profile_contacts` n'est expose a personne.
-- La fonction ne renvoie QUE les cinq champs strictement necessaires a la
-- reconnaissance de soi ; jamais l'e-mail complet, jamais le telephone,
-- jamais la date de naissance ni l'adresse.
--
-- Restriction d'appel : reservee aux comptes NON ENCORE rattaches a un
-- profil (ou aux porteurs de `profiles.verify`). Un membre deja rattache
-- n'a aucun motif legitime d'enumerer l'annuaire non reclame avec ses
-- indices de contact ; l'annuaire des membres releve d'ISE-034.
--
-- Recherche tolerante aux accents, a la casse et aux petites fautes :
-- `public.normalize_text` + similarite trigramme, seuil 0,30 (D-45).
-- Aucun `ILIKE '%...%'` non indexe (MASTER PROMPT §85).
-- ---------------------------------------------------------------------

-- Index trigramme sur les formes normalisees effectivement interrogees.
create index if not exists ise_profiles_last_name_trgm_idx
  on public.ise_profiles using gin (public.normalize_text(last_name) extensions.gin_trgm_ops)
  where deleted_at is null;

create index if not exists ise_profiles_first_name_trgm_idx
  on public.ise_profiles using gin (public.normalize_text(first_name) extensions.gin_trgm_ops)
  where deleted_at is null;

create index if not exists ise_profiles_unclaimed_idx
  on public.ise_profiles (claim_status)
  where claim_status = 'unclaimed' and deleted_at is null;

create or replace function public.search_claimable_profiles(
  p_last_name       text,
  p_first_name      text    default null,
  p_graduation_year integer default null
)
returns table (
  profile_id           uuid,
  display_name         text,
  graduation_year      integer,
  current_organization text,
  email_hint           text
)
language plpgsql
-- VOLATILE et non STABLE : la fonction ecrit un compteur anti-abus.
volatile
security definer
set search_path = ''
as $$
declare
  v_user      uuid := (select auth.uid());
  v_last      text := public.normalize_text(p_last_name);
  v_first     text := public.normalize_text(p_first_name);
  -- Seuil de similarite trigramme (D-45).
  v_threshold real := 0.30;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Un compte deja rattache n'a pas a parcourir l'annuaire non reclame.
  if private.current_profile_id() is not null
     and not private.has_permission('profiles.verify') then
    raise exception 'account_already_linked' using errcode = '42501';
  end if;

  if v_last is null or length(v_last) < 2 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  -- 5 recherches par heure et par compte (D-103).
  if not private.consume_rate_limit('user:' || v_user::text, 'profile_claim_search', 5, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select
      p.id,
      p.display_name,
      pr.graduation_year,
      coalesce(o.canonical_name, nullif(btrim(p.current_organization_raw), '')),
      private.mask_email_hint(pc.primary_email_norm)
    from public.ise_profiles p
    left join public.promotions    pr on pr.id = p.promotion_id
    left join public.organizations o  on o.id  = p.current_organization_id
    left join private.profile_contacts pc on pc.profile_id = p.id
    where p.deleted_at is null
      and p.claim_status = 'unclaimed'
      and p.user_id is null
      and p.profile_status in ('referenced', 'active')
      and (p_graduation_year is null or pr.graduation_year = p_graduation_year)
      and extensions.similarity(public.normalize_text(p.last_name), v_last) >= v_threshold
      and (
        v_first is null
        or extensions.similarity(public.normalize_text(p.first_name), v_first) >= v_threshold
      )
    order by
      extensions.similarity(public.normalize_text(p.last_name), v_last)
        + coalesce(extensions.similarity(public.normalize_text(p.first_name), v_first), 0) desc,
      p.display_name asc,
      p.id asc
    limit 20;
end
$$;

revoke all on function public.search_claimable_profiles(text, text, integer) from public, anon;
grant execute on function public.search_claimable_profiles(text, text, integer) to authenticated;

comment on function public.search_claimable_profiles(text, text, integer) is
  'ISE-005. Profils NON RECLAMES uniquement, 20 lignes au plus, recherche trigramme seuil 0,30 (D-45). '
  'Ne renvoie ni e-mail complet, ni telephone : seulement un indice masque (MASTER PROMPT §47). '
  'Limitee a 5 appels par heure et par compte (D-103).';


-- ---------------------------------------------------------------------
-- 4. ISE-006 — Recapitulatif du profil trouve
--
-- Memes regles d'acces et de divulgation que la recherche. Aucune donnee
-- supplementaire n'est ouverte : uniquement de quoi repondre a la question
-- « est-ce bien mon profil ? ».
-- ---------------------------------------------------------------------
create or replace function public.get_claimable_profile(p_profile_id uuid)
returns table (
  profile_id           uuid,
  display_name         text,
  headline             text,
  graduation_year      integer,
  promotion_name       text,
  current_position     text,
  current_organization text,
  current_city         text,
  current_country      text,
  email_hint           text,
  has_historical_email boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if private.current_profile_id() is not null
     and not private.has_permission('profiles.verify') then
    raise exception 'account_already_linked' using errcode = '42501';
  end if;

  return query
    select
      p.id,
      p.display_name,
      p.headline,
      pr.graduation_year,
      pr.name,
      p.current_position,
      coalesce(o.canonical_name, nullif(btrim(p.current_organization_raw), '')),
      p.current_city,
      c.name_fr,
      private.mask_email_hint(pc.primary_email_norm),
      pc.primary_email_norm is not null
    from public.ise_profiles p
    left join public.promotions    pr on pr.id = p.promotion_id
    left join public.organizations o  on o.id  = p.current_organization_id
    left join public.countries     c  on c.code = p.current_country_code
    left join private.profile_contacts pc on pc.profile_id = p.id
    where p.id = p_profile_id
      and p.deleted_at is null
      and p.claim_status = 'unclaimed'
      and p.user_id is null
      and p.profile_status in ('referenced', 'active');
end
$$;

revoke all on function public.get_claimable_profile(uuid) from public, anon;
grant execute on function public.get_claimable_profile(uuid) to authenticated;

comment on function public.get_claimable_profile(uuid) is
  'ISE-006. Recapitulatif d''un profil encore reclamable. Aucune coordonnee en clair (MASTER PROMPT §47).';


-- ---------------------------------------------------------------------
-- 5. Approbation — coeur transactionnel partage
--
-- Un seul chemin d'ecriture, appele soit par la verification automatique
-- par e-mail historique (ISE-007), soit par la revue humaine.
-- SECURITY DEFINER justifie (motif B) : transition d'etat atomique.
-- ---------------------------------------------------------------------
create or replace function private.apply_claim_approval(
  p_claim_id            uuid,
  -- p_reviewer_profile_id NULL => approbation automatique (aucun humain).
  p_reviewer_profile_id uuid,
  p_verification_type   text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claim   public.profile_claims;
  v_role_id smallint;
begin
  -- Verrou sur la reclamation puis sur le profil : ordre stable, pas d'interblocage.
  select * into v_claim
  from public.profile_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;
  if v_claim.status not in ('submitted', 'under_review') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  perform 1 from public.ise_profiles where id = v_claim.profile_id for update;

  -- Le profil a pu etre reclame entre-temps par un autre compte.
  if exists (
    select 1 from public.ise_profiles p
    where p.id = v_claim.profile_id
      and (p.user_id is not null or p.claim_status = 'claimed')
  ) then
    raise exception 'profile_already_claimed' using errcode = 'P0001';
  end if;

  -- Le compte a pu obtenir un autre profil entre-temps (D-20).
  if exists (
    select 1 from public.ise_profiles p
    where p.user_id = v_claim.claimant_user_id
      and p.deleted_at is null
  ) then
    raise exception 'account_already_linked' using errcode = 'P0001';
  end if;

  update public.profile_claims
     set status      = 'approved',
         reviewed_at = now(),
         reviewed_by = p_reviewer_profile_id
   where id = p_claim_id;

  -- Toute autre reclamation en cours sur le meme profil tombe.
  update public.profile_claims
     set status      = 'rejected',
         reviewed_at = now(),
         reviewed_by = p_reviewer_profile_id,
         reason      = 'profile_claimed_by_other'
   where profile_id = v_claim.profile_id
     and id <> p_claim_id
     and status in ('submitted', 'under_review');

  update public.ise_profiles
     set user_id             = v_claim.claimant_user_id,
         claim_status        = 'claimed',
         claimed_at          = now(),
         profile_status      = 'active',
         verification_status = case when p_verification_type = 'email'
                                    then 'verified' else verification_status end,
         verification_level  = case when p_verification_type = 'email'
                                    then 'email' else verification_level end,
         verified_at         = case when p_verification_type = 'email'
                                    then now() else verified_at end
   where id = v_claim.profile_id;

  insert into public.profile_verifications
    (profile_id, verification_type, verification_result, verified_by)
  values
    (v_claim.profile_id, p_verification_type, 'passed', p_reviewer_profile_id);

  -- Role `member` (D-31 : l'autorisation ne se resout jamais par un test en dur).
  select r.id into v_role_id from private.roles r where r.code = 'member';
  if v_role_id is not null then
    insert into private.user_roles (profile_id, role_id, granted_by)
    values (v_claim.profile_id, v_role_id, p_reviewer_profile_id)
    on conflict (profile_id, role_id) do nothing;
  end if;

  perform private.log_audit(
    p_action      => 'profile.claim_approved',
    p_object_type => 'profile_claim',
    p_object_id   => p_claim_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
                       'profile_id',   v_claim.profile_id,
                       'method',       v_claim.claim_method,
                       'verification', p_verification_type,
                       'automatic',    p_reviewer_profile_id is null
                     ),
    p_actor_profile_id => coalesce(p_reviewer_profile_id, v_claim.profile_id)
  );

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload, dedupe_key)
  values
    ('profile.claimed', 'profile', v_claim.profile_id,
     coalesce(p_reviewer_profile_id, v_claim.profile_id),
     jsonb_build_object(
       'claim_id',  p_claim_id,
       'method',    v_claim.claim_method,
       'automatic', p_reviewer_profile_id is null
     ),
     'profile.claimed:' || p_claim_id::text)
  on conflict do nothing;
end
$$;

revoke all on function private.apply_claim_approval(uuid, uuid, text) from public, anon, authenticated;

comment on function private.apply_claim_approval(uuid, uuid, text) is
  'Coeur transactionnel de l''approbation d''une reclamation. Non accordee aux roles clients : '
  'appelee par submit_profile_claim (automatique) et approve_profile_claim (revue humaine).';


-- ---------------------------------------------------------------------
-- 6. Soumission d'une reclamation  (ISE-006 -> ISE-007)
--
-- REGLE DE VERIFICATION PAR E-MAIL HISTORIQUE (ISE-007), portee par la
-- BASE et non par l'application :
--   si l'adresse du compte est CONFIRMEE (auth.users.email_confirmed_at)
--   et egale a `private.profile_contacts.primary_email_norm` du profil vise,
--   la reclamation est approuvee immediatement, sans intervention humaine.
--   Sinon elle reste `submitted` et attend une revue.
--
-- La confirmation de l'adresse est exigee : sans elle, il suffirait de creer
-- un compte avec l'adresse historique d'un tiers pour s'emparer de son profil.
-- ---------------------------------------------------------------------
create or replace function public.submit_profile_claim(
  p_profile_id       uuid,
  p_claim_method     text,
  p_declared_details jsonb default '{}'::jsonb
)
returns table (
  claim_id      uuid,
  claim_status  text,
  auto_approved boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user          uuid := (select auth.uid());
  v_profile       public.ise_profiles;
  v_account_email text;
  v_confirmed     boolean;
  v_hist_email    text;
  v_claim_id      uuid;
  v_auto          boolean := false;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_claim_method is null or p_claim_method not in
     ('historical_email', 'historical_phone', 'promotion_manager', 'document') then
    raise exception 'invalid_claim_method' using errcode = 'P0001';
  end if;

  if not private.consume_rate_limit('user:' || v_user::text, 'profile_claim_submit', 5, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- D-20 : un compte ne porte qu'un seul profil.
  if exists (
    select 1 from public.ise_profiles p
    where p.user_id = v_user and p.deleted_at is null
  ) then
    raise exception 'account_already_linked' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profile_claims c
    where c.claimant_user_id = v_user and c.status = 'approved'
  ) then
    raise exception 'account_already_linked' using errcode = 'P0001';
  end if;

  -- MASTER PROMPT §100 : verrou sur la ligne pivot AVANT toute decision.
  select * into v_profile
  from public.ise_profiles
  where id = p_profile_id
  for update;

  if not found or v_profile.deleted_at is not null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if v_profile.profile_status not in ('referenced', 'active') then
    raise exception 'profile_not_claimable' using errcode = 'P0001';
  end if;
  if v_profile.user_id is not null or v_profile.claim_status = 'claimed' then
    raise exception 'profile_already_claimed' using errcode = 'P0001';
  end if;

  -- Une seule reclamation en cours par compte, quel que soit le profil vise.
  if exists (
    select 1 from public.profile_claims c
    where c.claimant_user_id = v_user
      and c.status in ('submitted', 'under_review')
  ) then
    raise exception 'claim_already_pending' using errcode = 'P0001';
  end if;

  insert into public.profile_claims
    (profile_id, claimant_user_id, status, claim_method, declared_details)
  values
    (p_profile_id, v_user, 'submitted', p_claim_method, coalesce(p_declared_details, '{}'::jsonb))
  returning id into v_claim_id;

  update public.ise_profiles
     set claim_status = 'claim_pending'
   where id = p_profile_id;

  perform private.log_audit(
    p_action      => 'profile.claim_submitted',
    p_object_type => 'profile_claim',
    p_object_id   => v_claim_id::text,
    p_result      => 'success',
    -- L'acteur est le COMPTE : il n'a pas encore de profil (D-10, exception
    -- documentee). `log_audit` renseigne seul `actor_user_id` depuis auth.uid().
    p_context     => jsonb_build_object('profile_id', p_profile_id, 'method', p_claim_method)
  );

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, payload, dedupe_key)
  values
    ('profile.claim_submitted', 'profile', p_profile_id,
     jsonb_build_object('claim_id', v_claim_id, 'method', p_claim_method),
     'profile.claim_submitted:' || v_claim_id::text)
  on conflict do nothing;

  -- ---- ISE-007 : verification par e-mail historique -------------------
  select lower(btrim(u.email)), u.email_confirmed_at is not null
    into v_account_email, v_confirmed
  from auth.users u
  where u.id = v_user;

  select pc.primary_email_norm
    into v_hist_email
  from private.profile_contacts pc
  where pc.profile_id = p_profile_id;

  if coalesce(v_confirmed, false)
     and v_account_email is not null
     and v_hist_email is not null
     and v_account_email = v_hist_email then
    perform private.apply_claim_approval(v_claim_id, null, 'email');
    v_auto := true;
  end if;

  return query
    select c.id, c.status, v_auto
    from public.profile_claims c
    where c.id = v_claim_id;
end
$$;

revoke all on function public.submit_profile_claim(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_profile_claim(uuid, text, jsonb) to authenticated;

comment on function public.submit_profile_claim(uuid, text, jsonb) is
  'ISE-006/ISE-007. Soumission atomique d''une reclamation. Approuve immediatement lorsque '
  'l''adresse CONFIRMEE du compte est celle de l''e-mail historique du profil ; sinon la '
  'reclamation attend une revue humaine. Regle portee par la base, pas par l''application.';


-- ---------------------------------------------------------------------
-- 7. Revue humaine
-- ---------------------------------------------------------------------
create or replace function public.approve_profile_claim(p_claim_id uuid)
returns public.profile_claims
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_claim public.profile_claims;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.verify') then
    perform private.log_audit(
      p_action      => 'profile.claim_approved',
      p_object_type => 'profile_claim',
      p_object_id   => p_claim_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform private.apply_claim_approval(p_claim_id, v_me, 'admin');

  select * into v_claim from public.profile_claims where id = p_claim_id;
  return v_claim;
end
$$;

revoke all on function public.approve_profile_claim(uuid) from public, anon;
grant execute on function public.approve_profile_claim(uuid) to authenticated;

comment on function public.approve_profile_claim(uuid) is
  'Approbation d''une reclamation par un porteur de `profiles.verify` (D-31). Journalisee, y compris en refus.';


create or replace function public.reject_profile_claim(p_claim_id uuid, p_reason text)
returns public.profile_claims
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_claim public.profile_claims;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.verify') then
    perform private.log_audit(
      p_action      => 'profile.claim_rejected',
      p_object_type => 'profile_claim',
      p_object_id   => p_claim_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_claim from public.profile_claims where id = p_claim_id for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;
  if v_claim.status not in ('submitted', 'under_review') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.profile_claims
     set status = 'rejected', reviewed_at = now(), reviewed_by = v_me, reason = p_reason
   where id = p_claim_id
  returning * into v_claim;

  -- Le profil ne reste `claim_pending` que s'il porte encore une demande.
  update public.ise_profiles p
     set claim_status = 'unclaimed'
   where p.id = v_claim.profile_id
     and p.claim_status = 'claim_pending'
     and p.user_id is null
     and not exists (
       select 1 from public.profile_claims c2
       where c2.profile_id = p.id and c2.status in ('submitted', 'under_review')
     );

  perform private.log_audit(
    p_action      => 'profile.claim_rejected',
    p_object_type => 'profile_claim',
    p_object_id   => p_claim_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('profile_id', v_claim.profile_id)
  );

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload, dedupe_key)
  values
    ('profile.claim_rejected', 'profile', v_claim.profile_id, v_me,
     jsonb_build_object('claim_id', p_claim_id),
     'profile.claim_rejected:' || p_claim_id::text)
  on conflict do nothing;

  return v_claim;
end
$$;

revoke all on function public.reject_profile_claim(uuid, text) from public, anon;
grant execute on function public.reject_profile_claim(uuid, text) to authenticated;

comment on function public.reject_profile_claim(uuid, text) is
  'Rejet d''une reclamation par un porteur de `profiles.verify`. Rend le profil reclamable s''il ne porte plus de demande.';


-- ---------------------------------------------------------------------
-- 8. ISE-007 — Etat de MA reclamation
--
-- La politique `profile_claims_own` autorise deja le demandeur a lire sa
-- ligne, mais PAS le nom du profil vise : `can_see_profile()` renvoie
-- `false` tant qu'il n'est pas membre. Cette fonction comble exactement ce
-- manque, et rien de plus. Aucun parametre : aucun tiers n'est atteignable.
-- ---------------------------------------------------------------------
create or replace function public.my_profile_claim()
returns table (
  claim_id             uuid,
  profile_id           uuid,
  claim_status         text,
  claim_method         text,
  submitted_at         timestamptz,
  reviewed_at          timestamptz,
  auto_approved        boolean,
  profile_display_name text,
  graduation_year      integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return query
    select
      c.id,
      c.profile_id,
      c.status,
      c.claim_method,
      c.submitted_at,
      c.reviewed_at,
      (c.status = 'approved' and c.reviewed_by is null),
      p.display_name,
      pr.graduation_year
    from public.profile_claims c
    join public.ise_profiles p on p.id = c.profile_id
    left join public.promotions pr on pr.id = p.promotion_id
    where c.claimant_user_id = v_user
    order by c.submitted_at desc, c.id desc
    limit 1;
end
$$;

revoke all on function public.my_profile_claim() from public, anon;
grant execute on function public.my_profile_claim() to authenticated;

comment on function public.my_profile_claim() is
  'ISE-007. Derniere reclamation du compte courant, et de lui seul. Sans parametre : aucun tiers atteignable.';
