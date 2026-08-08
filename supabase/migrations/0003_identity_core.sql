-- =====================================================================
-- 0003_identity_core
-- Profil ISE (entite centrale), donnees de contact privees, visibilite
-- par champ, reclamation de profil, verification, appartenance promotion.
--
-- REGLE FONDAMENTALE (MASTER PROMPT §6) :
--   Un profil ISE peut exister SANS compte Auth. `user_id` est nullable.
--   Aucun compte Auth n'est jamais cree pour representer un profil importe.
-- Reference : docs/decisions.md D-10, D-18, D-19, D-20, D-73, D-74.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profil ISE
-- ---------------------------------------------------------------------
create table if not exists public.ise_profiles (
  id                        uuid primary key default extensions.gen_random_uuid(),

  -- Lien vers le compte Auth. NULL = profil reference non reclame.
  -- ON DELETE SET NULL : la suppression du compte ne detruit pas le profil (D-19).
  user_id                   uuid references auth.users(id) on delete set null,

  promotion_id              bigint references public.promotions(id) on delete set null,

  -- Identite
  first_name                text not null,
  middle_names              text,
  last_name                 text not null,
  display_name              text generated always as (
                              btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
                            ) stored,
  normalized_name           text generated always as (
                              public.normalize_text(
                                coalesce(first_name, '') || ' ' ||
                                coalesce(middle_names, '') || ' ' ||
                                coalesce(last_name, '')
                              )
                            ) stored,

  -- D-18 : indispensable au module Stages (ISE-072..077) et au role « Eleve ISE ».
  profile_type              text not null default 'graduate'
                              check (profile_type in ('graduate', 'student')),
  student_number            text,

  -- Presentation
  headline                  text check (headline is null or length(headline) <= 160),
  bio                       text check (bio is null or length(bio) <= 2000),
  avatar_path               text,
  linkedin_url              text,
  website_url               text,

  -- Situation professionnelle courante
  current_position          text,
  current_organization_id   uuid references public.organizations(id) on delete set null,
  current_organization_raw  text,
  current_country_code      char(2) references public.countries(code),
  current_city              text,

  -- Cycle de vie du profil
  profile_status            text not null default 'referenced'
                              check (profile_status in ('referenced', 'active', 'suspended', 'archived')),
  claim_status              text not null default 'unclaimed'
                              check (claim_status in ('unclaimed', 'claim_pending', 'claimed')),
  verification_status       text not null default 'unverified'
                              check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  verification_level        text check (verification_level is null or verification_level in
                              ('none', 'email', 'promotion_manager', 'document', 'admin')),

  -- Complecion : PRIVEE, jamais affichee sur un profil tiers (D-72, MASTER PROMPT §17).
  profile_completion        smallint not null default 0
                              check (profile_completion between 0 and 100),

  onboarding_completed_at   timestamptz,
  claimed_at                timestamptz,
  verified_at               timestamptz,
  last_confirmed_at         timestamptz,
  last_active_at            timestamptz,

  -- Compte de test explicitement marque (D-104, MASTER PROMPT §78).
  is_test_account           boolean not null default false,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,

  -- Coherence : un profil reclame a forcement un compte et une date.
  constraint ise_profiles_claim_coherence check (
    (claim_status = 'claimed' and user_id is not null and claimed_at is not null)
    or claim_status <> 'claimed'
  ),
  constraint ise_profiles_student_number_only_for_students check (
    student_number is null or profile_type = 'student'
  )
);

-- D-20 : un compte ne peut etre lie qu'a un seul profil, et reciproquement.
create unique index if not exists ise_profiles_user_uidx
  on public.ise_profiles(user_id) where user_id is not null;

create index if not exists ise_profiles_promotion_idx    on public.ise_profiles(promotion_id);
create index if not exists ise_profiles_organization_idx on public.ise_profiles(current_organization_id);
create index if not exists ise_profiles_country_idx      on public.ise_profiles(current_country_code);
create index if not exists ise_profiles_status_idx       on public.ise_profiles(profile_status)
  where deleted_at is null;
create index if not exists ise_profiles_claim_status_idx on public.ise_profiles(claim_status);
create index if not exists ise_profiles_verif_idx        on public.ise_profiles(verification_status);
create index if not exists ise_profiles_confirmed_idx    on public.ise_profiles(last_confirmed_at desc nulls last);
create index if not exists ise_profiles_name_trgm_idx    on public.ise_profiles
  using gin (normalized_name extensions.gin_trgm_ops);

select private.attach_updated_at('public', 'ise_profiles');

comment on table  public.ise_profiles is
  'Entite metier centrale. Un profil peut exister sans compte Auth (user_id NULL) : MASTER PROMPT §6.';
comment on column public.ise_profiles.user_id is
  'Compte Auth rattache. NULL = profil reference non reclame. Jamais de faux compte Auth pour un import.';
comment on column public.ise_profiles.profile_completion is
  'Score prive, outil d''aide. Jamais un classement (MASTER PROMPT §17).';

-- ---------------------------------------------------------------------
-- 2. Coordonnees privees — schema `private`, jamais servies au client
--    MASTER PROMPT §11, §47 ; principe : « ne jamais renvoyer puis masquer ».
-- ---------------------------------------------------------------------
create table if not exists private.profile_contacts (
  profile_id             uuid primary key references public.ise_profiles(id) on delete cascade,
  primary_email          text,
  primary_email_norm     text generated always as (lower(btrim(primary_email))) stored,
  secondary_email        text,
  phone_e164             text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  secondary_phone_e164   text check (secondary_phone_e164 is null or secondary_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  postal_address         text,
  birth_date             date,
  email_verified_at      timestamptz,
  phone_verified_at      timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists profile_contacts_email_idx on private.profile_contacts(primary_email_norm);
select private.attach_updated_at('private', 'profile_contacts');

-- ---------------------------------------------------------------------
-- 3. Visibilite par champ  (D-73, D-74)
-- ---------------------------------------------------------------------
create table if not exists public.profile_visibility (
  profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  field_key   text not null,
  visibility  text not null check (public.is_visibility_level(visibility)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, field_key)
);
select private.attach_updated_at('public', 'profile_visibility');

-- Valeurs par defaut appliquees a la creation d'un profil (D-74).
create table if not exists public.profile_visibility_defaults (
  field_key         text primary key,
  label             text not null,
  default_visibility text not null check (public.is_visibility_level(default_visibility)),
  -- Niveaux que le membre a le droit de choisir pour ce champ.
  allowed_levels    text[] not null,
  sort_order        integer not null default 0
);

-- ---------------------------------------------------------------------
-- 4. Reclamation de profil  (MASTER PROMPT §7)
-- ---------------------------------------------------------------------
create table if not exists public.profile_claims (
  id               uuid primary key default extensions.gen_random_uuid(),
  profile_id       uuid not null references public.ise_profiles(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'submitted'
                     check (status in ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'expired')),
  claim_method     text not null
                     check (claim_method in ('historical_email', 'historical_phone',
                                             'promotion_manager', 'document', 'admin')),
  declared_details jsonb not null default '{}'::jsonb,
  submitted_at     timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.ise_profiles(id) on delete set null,
  reason           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Un seul claim approuve par profil : empeche la double reclamation.
create unique index if not exists profile_claims_one_approved_per_profile
  on public.profile_claims(profile_id) where status = 'approved';

-- Un seul claim en cours par (profil, demandeur).
create unique index if not exists profile_claims_one_pending_per_pair
  on public.profile_claims(profile_id, claimant_user_id)
  where status in ('submitted', 'under_review');

-- Un compte ne peut pas obtenir deux profils.
create unique index if not exists profile_claims_one_approved_per_user
  on public.profile_claims(claimant_user_id) where status = 'approved';

create index if not exists profile_claims_profile_idx on public.profile_claims(profile_id);
create index if not exists profile_claims_status_idx  on public.profile_claims(status, submitted_at desc);
select private.attach_updated_at('public', 'profile_claims');

-- Litiges de reclamation (deux personnes revendiquent le meme profil).
create table if not exists public.profile_claim_disputes (
  id            uuid primary key default extensions.gen_random_uuid(),
  profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  claim_id      uuid references public.profile_claims(id) on delete set null,
  raised_by     uuid references public.ise_profiles(id) on delete set null,
  description   text not null,
  status        text not null default 'open'
                  check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution    text,
  resolved_by   uuid references public.ise_profiles(id) on delete set null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profile_claim_disputes_profile_idx on public.profile_claim_disputes(profile_id);
select private.attach_updated_at('public', 'profile_claim_disputes');

-- Preuves de verification : sensibles, schema `private`.
create table if not exists private.verification_evidence (
  id            uuid primary key default extensions.gen_random_uuid(),
  claim_id      uuid not null references public.profile_claims(id) on delete cascade,
  evidence_type text not null,
  storage_path  text not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists verification_evidence_claim_idx on private.verification_evidence(claim_id);

-- Historique des verifications.
create table if not exists public.profile_verifications (
  id                  uuid primary key default extensions.gen_random_uuid(),
  profile_id          uuid not null references public.ise_profiles(id) on delete cascade,
  verification_type   text not null
                        check (verification_type in ('email', 'phone', 'promotion_manager', 'document', 'admin')),
  verification_result text not null check (verification_result in ('passed', 'failed', 'inconclusive')),
  verified_by         uuid references public.ise_profiles(id) on delete set null,
  verified_at         timestamptz not null default now(),
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists profile_verifications_profile_idx
  on public.profile_verifications(profile_id, verified_at desc);

-- Notes administratives : sensibles, jamais lisibles par un membre.
create table if not exists private.profile_admin_notes (
  id          uuid primary key default extensions.gen_random_uuid(),
  profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  author_id   uuid references public.ise_profiles(id) on delete set null,
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists profile_admin_notes_profile_idx on private.profile_admin_notes(profile_id);

-- ---------------------------------------------------------------------
-- 5. Appartenance a une promotion
-- ---------------------------------------------------------------------
create table if not exists public.promotion_memberships (
  id                  uuid primary key default extensions.gen_random_uuid(),
  promotion_id        bigint not null references public.promotions(id) on delete cascade,
  profile_id          uuid not null references public.ise_profiles(id) on delete cascade,
  -- D-53 : liste la plus fine retenue.
  membership_status   text not null default 'referenced'
                        check (membership_status in ('referenced', 'active', 'verified',
                                                     'unconfirmed', 'disputed', 'duplicate', 'archived')),
  verification_status text not null default 'unverified'
                        check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (promotion_id, profile_id)
);
create index if not exists promotion_memberships_profile_idx on public.promotion_memberships(profile_id);
create index if not exists promotion_memberships_promo_idx   on public.promotion_memberships(promotion_id, membership_status);
select private.attach_updated_at('public', 'promotion_memberships');

create table if not exists public.promotion_managers (
  id           uuid primary key default extensions.gen_random_uuid(),
  promotion_id bigint not null references public.promotions(id) on delete cascade,
  profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  manager_role text not null default 'delegate' check (manager_role in ('delegate', 'co_delegate', 'referent')),
  active       boolean not null default true,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  created_at   timestamptz not null default now()
);
create unique index if not exists promotion_managers_active_uidx
  on public.promotion_managers(promotion_id, profile_id) where active;

-- Invitations a rejoindre / reclamer un profil. Le token brut n'est jamais stocke.
create table if not exists public.promotion_invitations (
  id                  uuid primary key default extensions.gen_random_uuid(),
  promotion_id        bigint not null references public.promotions(id) on delete cascade,
  profile_id          uuid references public.ise_profiles(id) on delete set null,
  invited_email_hash  text,
  invited_phone_hash  text,
  inviter_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  token_hash          text not null unique,
  status              text not null default 'sent'
                        check (status in ('sent', 'opened', 'claimed', 'expired', 'revoked')),
  expires_at          timestamptz not null,
  opened_at           timestamptz,
  claimed_at          timestamptz,
  created_at          timestamptz not null default now(),
  constraint promotion_invitations_target_present
    check (profile_id is not null or invited_email_hash is not null or invited_phone_hash is not null)
);
create index if not exists promotion_invitations_promo_idx   on public.promotion_invitations(promotion_id, status);
create index if not exists promotion_invitations_inviter_idx on public.promotion_invitations(inviter_profile_id);

-- « Aidez-nous a retrouver un camarade » (ISE-069).
create table if not exists public.missing_member_suggestions (
  id                     uuid primary key default extensions.gen_random_uuid(),
  promotion_id           bigint not null references public.promotions(id) on delete cascade,
  submitted_by_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  first_name             text not null,
  last_name              text not null,
  country_code           char(2) references public.countries(code),
  status                 text not null default 'submitted'
                           check (status in ('submitted', 'reviewing', 'matched', 'created', 'dismissed')),
  matched_profile_id     uuid references public.ise_profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  reviewed_at            timestamptz
);
create index if not exists missing_member_suggestions_promo_idx
  on public.missing_member_suggestions(promotion_id, status);

-- L'indice de contact fourni par le camarade est une donnee personnelle d'un tiers.
create table if not exists private.missing_member_contact_hints (
  suggestion_id uuid primary key references public.missing_member_suggestions(id) on delete cascade,
  contact_hint  text not null,
  created_at    timestamptz not null default now()
);
