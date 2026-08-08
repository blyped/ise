-- =====================================================================
-- 0008_opportunities
-- Opportunites (ISE-055 -> ISE-066) et documents de profil / candidature.
--
-- Une opportunite = « j'ai quelque chose a proposer », par symetrie avec
-- l'appel au reseau = « j'ai besoin de quelque chose » (D6 §41-52).
-- Le module n'est pas un job board : il expose d'abord les offres
-- reellement pertinentes, et chaque recommandation est expliquee.
--
-- Decisions appliquees :
--   D-10  rattachement metier sur ise_profiles(id), jamais auth.users
--   D-11  chemins Storage indexes par profile_id
--   D-13  text + CHECK, aucun type ENUM PostgreSQL
--   D-44  index de pagination par curseur (critere desc, id desc)
--   D-55  aucun statut ne franchit une etape non constatee : une
--         candidature externe n'est JAMAIS posee par un clic, le membre
--         la declare lui-meme
--   D-73  echelle de visibilite a 4 niveaux (public.is_visibility_level)
--   D-74  le CV est prive par defaut
--   D-101 SECURITY DEFINER : search_path = '' et objets qualifies
--   D-102 codes d'erreur machine, jamais de phrase
--
-- RLS : AUCUNE policy ici, une migration dediee s'en charge.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Documents de profil et pieces de candidature (PARTIE M)
-- ---------------------------------------------------------------------
-- Cree en premier : `applications.cv_document_id` s'y refere.
-- D-11 : le chemin Storage est indexe par profile_id, jamais par user_id,
-- car un document peut preexister a la reclamation du profil.
create table if not exists public.profile_documents (
  id                uuid primary key default extensions.gen_random_uuid(),
  profile_id        uuid not null references public.ise_profiles(id) on delete cascade,

  document_type     text not null
                      check (document_type in (
                        'cv', 'cover_letter', 'certificate', 'diploma',
                        'portfolio', 'publication', 'technical_proposal',
                        'financial_proposal', 'other')),
  title             text check (title is null or length(btrim(title)) <= 200),

  storage_path      text not null unique,
  original_filename text not null,
  mime_type         text not null,
  size_bytes        bigint not null check (size_bytes > 0),

  -- D-74 : le CV est prive par defaut. Il ne devient lisible par l'auteur
  -- d'une offre que dans le contexte d'une candidature (CA-OPP-07).
  visibility        text not null default 'private'
                      check (public.is_visibility_level(visibility)),
  -- CV principal propose par defaut a la candidature (« Utiliser mon CV enregistre »).
  is_primary        boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  -- D-11 : le chemin doit rester sous le prefixe du profil proprietaire.
  constraint profile_documents_storage_path_scope
    check (storage_path like ('profile-documents/' || profile_id::text || '/%'))
);
comment on table public.profile_documents is
  'CV et pieces jointes de candidature. Chemin Storage prefixe par profile_id (D-11) ; visibilite privee par defaut (D-74).';
comment on column public.profile_documents.is_primary is
  'CV principal. Un seul document primaire par type et par profil (index unique partiel).';

select private.attach_updated_at('public', 'profile_documents');

create index if not exists profile_documents_profile_idx
  on public.profile_documents(profile_id, document_type)
  where deleted_at is null;
create index if not exists profile_documents_cursor_idx
  on public.profile_documents(profile_id, created_at desc, id desc);
create unique index if not exists profile_documents_primary_uidx
  on public.profile_documents(profile_id, document_type)
  where is_primary and deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. Opportunite
-- ---------------------------------------------------------------------
-- DISTINCTION INTERNE / EXTERNE (D7 §17, D27 §122-125), toujours affichee :
--   origin = 'internal' : publiee dans la plateforme par un ISE. La
--     candidature peut etre suivie de bout en bout.
--   origin = 'external' : relayee depuis une source hors plateforme. La
--     plateforme ne peut PAS connaitre le resultat d'une candidature ; elle
--     ne suit que le clic sortant (D-55, voir opportunity_outbound_clicks).
--
-- Machine d'etats :
--   draft --(publier)--> active --(pause)--> paused --(reprendre)--> active
--   active --(echeance)--> expired · active --(cloture)--> closed
--   draft|active --(annuler)--> cancelled · * --(moderation)--> moderated
create table if not exists public.opportunities (
  id                        uuid primary key default extensions.gen_random_uuid(),

  -- Nullable : une offre externe relayee n'a pas forcement d'auteur ISE.
  author_profile_id         uuid references public.ise_profiles(id) on delete set null,
  organization_id           uuid references public.organizations(id) on delete set null,
  -- Organisation saisie librement et pas encore rattachee au referentiel.
  organization_name_raw     text,

  opportunity_type          text not null
                              check (opportunity_type in (
                                'job', 'internship', 'mission',
                                'business', 'research', 'scholarship')),
  contract_type             text
                              check (contract_type is null or contract_type in (
                                'permanent', 'fixed_term', 'local_contract',
                                'international_contract', 'public_service',
                                'graduate_program', 'consultancy',
                                'short_term_expert', 'long_term_expert',
                                'team_leader', 'key_expert', 'technical_assistance',
                                'academic_internship', 'professional_internship',
                                'final_year_internship', 'research_internship',
                                'pre_employment_internship', 'other')),

  title                     text not null check (length(btrim(title)) between 3 and 160),
  summary                   text check (summary is null or length(summary) <= 400),
  description               text not null check (length(btrim(description)) between 20 and 20000),

  sector_id                 bigint references public.sectors(id) on delete set null,
  sector_importance         text not null default 'preferred'
                              check (sector_importance in ('required', 'preferred')),
  job_function_id           bigint references public.job_functions(id) on delete set null,

  experience_level          text
                              check (experience_level is null or experience_level in (
                                'junior', 'intermediate', 'senior', 'executive')),
  min_experience_years      smallint check (min_experience_years is null or min_experience_years between 0 and 60),
  ideal_experience_years    smallint check (ideal_experience_years is null or ideal_experience_years between 0 and 60),
  -- Filtre « Premier emploi » / « Adapte aux jeunes diplomes » (D7 §20).
  suitable_for_new_graduates boolean not null default false,

  country_code              char(2) references public.countries(code),
  city                      text,
  remote_allowed            boolean not null default false,
  -- Nuance d'affichage (« Abidjan • Hybride »), coherente avec remote_allowed.
  remote_mode               text
                              check (remote_mode is null or remote_mode in ('onsite', 'hybrid', 'remote')),

  start_date                date,
  duration_days             integer check (duration_days is null or duration_days > 0),

  -- D27 §32 : ne jamais inventer une remuneration. Non renseignee = non affichee.
  compensation_min          numeric(14,2) check (compensation_min is null or compensation_min >= 0),
  compensation_max          numeric(14,2) check (compensation_max is null or compensation_max >= 0),
  currency                  char(3),
  compensation_disclosed    boolean not null default false,

  deadline                  timestamptz,
  positions_count           integer not null default 1 check (positions_count > 0),

  -- Mode de candidature. Seul 'internal' permet un suivi reel du resultat.
  application_mode          text not null default 'internal'
                              check (application_mode in (
                                'internal', 'external_url', 'external_email', 'contact_recruiter')),
  external_application_url  text,
  external_application_email text,
  contact_profile_id        uuid references public.ise_profiles(id) on delete set null,
  -- « Pas de formulaire geant » (D7 §57) : plafond de questions complementaires.
  max_extra_questions       smallint not null default 3 check (max_extra_questions between 0 and 10),

  -- Origine et confiance (D27 §122-125).
  origin                    text not null default 'internal'
                              check (origin in ('internal', 'external')),
  source_type               text not null default 'ise_member'
                              check (source_type in (
                                'ise_member', 'partner_organization',
                                'external_source', 'administration')),
  source_url                text,
  -- Badge « Source verifiee » UNIQUEMENT si reellement validee (D27 §123).
  source_verified_at        timestamptz,
  source_verified_by        uuid references public.ise_profiles(id) on delete set null,

  visibility                text not null default 'members'
                              check (public.is_visibility_level(visibility)),

  status                    text not null default 'draft'
                              check (status in (
                                'draft', 'active', 'paused', 'closed',
                                'expired', 'cancelled', 'moderated')),
  -- Moderation avant publication selon le niveau de confiance (D7 §62) :
  -- ISE verifie -> not_required ; partenaire externe -> pending obligatoire.
  moderation_status         text not null default 'not_required'
                              check (moderation_status in (
                                'not_required', 'pending', 'approved', 'rejected')),

  published_at              timestamptz,
  paused_at                 timestamptz,
  closed_at                 timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,

  constraint opportunities_published_state
    check (status = 'draft' or published_at is not null),
  -- Qualite [17] §227 : l'echeance ne precede jamais la publication.
  constraint opportunities_deadline_order
    check (deadline is null or published_at is null or deadline >= published_at),
  constraint opportunities_compensation_order
    check (compensation_min is null or compensation_max is null
           or compensation_min <= compensation_max),
  -- Une remuneration affichee suppose au moins un montant et une devise.
  constraint opportunities_compensation_disclosure
    check (compensation_disclosed = false
           or (currency is not null and num_nonnulls(compensation_min, compensation_max) >= 1)),
  constraint opportunities_experience_order
    check (min_experience_years is null or ideal_experience_years is null
           or min_experience_years <= ideal_experience_years),
  -- Coherence du mode de teletravail.
  constraint opportunities_remote_coherence
    check (remote_mode is null
           or (remote_mode = 'onsite' and remote_allowed = false)
           or (remote_mode in ('hybrid', 'remote') and remote_allowed = true)),
  -- Le canal de candidature externe exige sa coordonnee.
  constraint opportunities_application_target
    check (
      (application_mode = 'internal')
      or (application_mode = 'external_url' and external_application_url is not null)
      or (application_mode = 'external_email' and external_application_email is not null)
      or (application_mode = 'contact_recruiter' and contact_profile_id is not null)
    ),
  -- Une offre interne est publiee par un ISE ; une offre externe cite sa source.
  constraint opportunities_origin_coherence
    check (
      (origin = 'internal' and source_type = 'ise_member' and author_profile_id is not null)
      or (origin = 'external' and source_type <> 'ise_member' and source_url is not null)
    ),
  -- La verification est un fait date et impute, jamais un simple booleen.
  constraint opportunities_source_verification
    check ((source_verified_at is null) = (source_verified_by is null)),
  -- Une offre externe ne peut pas etre en candidature interne : la
  -- plateforme ne pourrait pas constater le resultat (D-55).
  constraint opportunities_external_application_mode
    check (origin = 'internal' or application_mode <> 'internal')
);
comment on table public.opportunities is
  'Offre proposee au reseau (ISE-055..066). origin distingue une publication interne d''une offre externe relayee : seule une offre interne permet de constater le resultat (D-55).';
comment on column public.opportunities.origin is
  'internal = publiee par un ISE dans la plateforme ; external = relayee d''une source exterieure, suivi limite au clic sortant.';
comment on column public.opportunities.compensation_disclosed is
  'La remuneration n''est jamais inventee (D27 §32). Non divulguee = « Remuneration : non precisee ».';

select private.attach_updated_at('public', 'opportunities');

create index if not exists opportunities_author_idx
  on public.opportunities(author_profile_id, created_at desc, id desc);
create index if not exists opportunities_organization_idx
  on public.opportunities(organization_id) where deleted_at is null;
create index if not exists opportunities_sector_idx
  on public.opportunities(sector_id) where deleted_at is null;
create index if not exists opportunities_function_idx
  on public.opportunities(job_function_id) where job_function_id is not null;
create index if not exists opportunities_country_idx
  on public.opportunities(country_code) where deleted_at is null;
create index if not exists opportunities_contact_idx
  on public.opportunities(contact_profile_id) where contact_profile_id is not null;
-- Index critique MVP [17 §213] : le hub filtre par type puis par fraicheur.
create index if not exists opportunities_type_status_published_idx
  on public.opportunities(opportunity_type, status, published_at desc, id desc);
create index if not exists opportunities_status_deadline_idx
  on public.opportunities(status, deadline);
-- Filtre quasi systematique du hub.
create index if not exists opportunities_active_idx
  on public.opportunities(published_at desc, id desc)
  where status = 'active' and deleted_at is null;
-- File de moderation des offres externes (D7 §62).
create index if not exists opportunities_moderation_idx
  on public.opportunities(moderation_status, created_at desc)
  where moderation_status = 'pending';
-- Balayage du job d'expiration a l'echeance.
create index if not exists opportunities_expiry_sweep_idx
  on public.opportunities(deadline)
  where status = 'active' and deadline is not null;
-- Onglet « Adapte aux jeunes diplomes » / promotion sortante.
create index if not exists opportunities_new_graduates_idx
  on public.opportunities(opportunity_type, published_at desc, id desc)
  where suitable_for_new_graduates and status = 'active';
create index if not exists opportunities_title_trgm_idx
  on public.opportunities using gin (public.normalize_text(title) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. Criteres de matching de l'offre
-- ---------------------------------------------------------------------
-- CA-OPP-03 : les criteres REQUIS et SOUHAITES sont distincts.
-- Un critere required est un hard filter ; un critere preferred degrade le
-- score sans jamais exclure (D27 §116 : un champ non renseigne n'exclut pas).

create table if not exists public.opportunity_skills (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  skill_id       bigint not null references public.skills(id) on delete cascade,
  importance     text not null default 'preferred'
                   check (importance in ('required', 'preferred')),
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, skill_id)
);
comment on table public.opportunity_skills is
  'Competences de l''offre. importance = required (obligatoire) ou preferred (souhaitee) — CA-OPP-03.';
create index if not exists opportunity_skills_skill_idx
  on public.opportunity_skills(skill_id, opportunity_id);

create table if not exists public.opportunity_tools (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  tool_id        bigint not null references public.tools(id) on delete cascade,
  importance     text not null default 'preferred'
                   check (importance in ('required', 'preferred')),
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, tool_id)
);
comment on table public.opportunity_tools is
  'Outils attendus. Un outil required exclut le profil qui ne le declare pas (D22 §47).';
create index if not exists opportunity_tools_tool_idx
  on public.opportunity_tools(tool_id, opportunity_id);

create table if not exists public.opportunity_languages (
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  language_code   varchar(10) not null references public.languages(code) on delete cascade,
  min_proficiency text not null default 'professional'
                    check (min_proficiency in ('basic', 'intermediate', 'professional', 'fluent', 'native')),
  importance      text not null default 'preferred'
                    check (importance in ('required', 'preferred')),
  created_at      timestamptz not null default now(),
  primary key (opportunity_id, language_code)
);
comment on table public.opportunity_languages is
  'Langues et niveau minimal. Hard filter typique des offres (D27 §115).';
create index if not exists opportunity_languages_language_idx
  on public.opportunity_languages(language_code, opportunity_id);

create table if not exists public.opportunity_countries (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  country_code   char(2) not null references public.countries(code) on delete cascade,
  -- Le lieu d'execution et le pays d'experience attendu sont deux criteres
  -- distincts, jamais confondus (D5 §11, §78).
  scope          text not null default 'experience'
                   check (scope in ('work_location', 'experience')),
  importance     text not null default 'preferred'
                   check (importance in ('required', 'preferred')),
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, country_code, scope)
);
comment on table public.opportunity_countries is
  'Pays vises. scope distingue le lieu d''execution du pays d''experience attendu.';
create index if not exists opportunity_countries_country_idx
  on public.opportunity_countries(country_code, opportunity_id);

-- ---------------------------------------------------------------------
-- 4. Ciblage d'audience et invitations
-- ---------------------------------------------------------------------
create table if not exists public.opportunity_audience_promotions (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  promotion_id   bigint not null references public.promotions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, promotion_id)
);
comment on table public.opportunity_audience_promotions is
  'Promotions ciblees (« promotion sortante » pour un stage). Complete opportunities.visibility.';
create index if not exists opportunity_audience_promotions_promo_idx
  on public.opportunity_audience_promotions(promotion_id, opportunity_id);

create table if not exists public.opportunity_audience_profiles (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, profile_id)
);
comment on table public.opportunity_audience_profiles is
  'Membres nommement autorises a voir l''offre (option « Membres selectionnes »).';
create index if not exists opportunity_audience_profiles_profile_idx
  on public.opportunity_audience_profiles(profile_id, opportunity_id);

-- Invitation ciblee (D7 §64) : « Koffi pense que votre profil peut
-- correspondre a cette mission. » Une invitation n'est PAS une candidature.
create table if not exists public.opportunity_invitations (
  id                 uuid primary key default extensions.gen_random_uuid(),
  opportunity_id     uuid not null references public.opportunities(id) on delete cascade,
  invited_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  inviter_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  message            text check (message is null or length(message) <= 1000),
  viewed_at          timestamptz,
  created_at         timestamptz not null default now(),
  constraint opportunity_invitations_not_self
    check (invited_profile_id <> inviter_profile_id)
);
comment on table public.opportunity_invitations is
  'Invitation nominative a consulter une offre. N''emporte aucun engagement et ne cree jamais de candidature (D-55).';
create unique index if not exists opportunity_invitations_pair_uidx
  on public.opportunity_invitations(opportunity_id, invited_profile_id);
create index if not exists opportunity_invitations_invited_idx
  on public.opportunity_invitations(invited_profile_id, created_at desc, id desc);
create index if not exists opportunity_invitations_inviter_idx
  on public.opportunity_invitations(inviter_profile_id);

-- ---------------------------------------------------------------------
-- 5. Matching persiste (bidirectionnel)
-- ---------------------------------------------------------------------
-- Meme moteur de scoring dans les deux sens (D27 §139) ; seules les
-- ponderations changent. Le score interne n'est jamais expose au client.
create table if not exists public.opportunity_matches (
  opportunity_id     uuid not null references public.opportunities(id) on delete cascade,
  profile_id         uuid not null references public.ise_profiles(id) on delete cascade,
  score              numeric(6,2) not null check (score >= 0 and score <= 100),
  score_version      text not null default 'matching-v1',
  component_scores   jsonb not null default '{}'::jsonb,
  reasons            jsonb not null default '[]'::jsonb,
  -- « ✗ Ghana non renseigne » : les criteres souhaites manquants sont
  -- affiches explicitement au recruteur comme au candidat (D22 §63).
  missing_criteria   jsonb not null default '[]'::jsonb,
  relevance_label    text not null
                       check (relevance_label in ('very_relevant', 'relevant', 'close_profile')),
  notification_tier  text not null default 'none'
                       check (notification_tier in ('immediate', 'digest', 'none')),
  notified_at        timestamptz,
  computed_at        timestamptz not null default now(),
  expires_at         timestamptz,
  primary key (opportunity_id, profile_id)
);
comment on table public.opportunity_matches is
  'Matching bidirectionnel offre <-> profil. Le score n''elimine JAMAIS un candidat (CA-OPP-06) : il ne sert qu''au classement d''aide a la lecture.';
create index if not exists opportunity_matches_rank_idx
  on public.opportunity_matches(opportunity_id, score desc, profile_id desc);
create index if not exists opportunity_matches_profile_idx
  on public.opportunity_matches(profile_id, score desc, opportunity_id desc);
create index if not exists opportunity_matches_notify_idx
  on public.opportunity_matches(notification_tier, computed_at desc)
  where notified_at is null;

-- ---------------------------------------------------------------------
-- 6. Interet declare (ISE-055 / ISE-061) — n'est PAS une candidature
-- ---------------------------------------------------------------------
create table if not exists public.opportunity_interests (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  interest_level text not null default 'interested'
                   check (interest_level in ('interested', 'considering', 'following')),
  note           text check (note is null or length(note) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (opportunity_id, profile_id)
);
comment on table public.opportunity_interests is
  'Manifestation d''interet legere. Ne vaut jamais candidature (D-55) et n''est pas un signal de popularite (CA-MATCH-09).';

select private.attach_updated_at('public', 'opportunity_interests');

create index if not exists opportunity_interests_profile_idx
  on public.opportunity_interests(profile_id, created_at desc, opportunity_id desc);

-- ---------------------------------------------------------------------
-- 7. Recommandation d'un ISE vers une opportunite
-- ---------------------------------------------------------------------
-- « Ce poste pourrait interesser Jean Kouassi. » Comme pour les appels,
-- aucune coordonnee de tiers n'est stockee sans accord (CA-CALL-05).
create table if not exists public.opportunity_referrals (
  id                    uuid primary key default extensions.gen_random_uuid(),
  opportunity_id        uuid not null references public.opportunities(id) on delete cascade,
  referrer_profile_id   uuid not null references public.ise_profiles(id) on delete cascade,

  -- Soit un ISE du reseau, soit une personne externe nommee. Jamais les deux.
  referred_profile_id   uuid references public.ise_profiles(id) on delete cascade,
  external_person_name  text check (external_person_name is null or length(btrim(external_person_name)) between 2 and 160),

  message               text check (message is null or length(message) <= 1000),
  consent_confirmed     boolean not null default false,

  -- `applied` n'est jamais pose par la plateforme : il resulte d'une
  -- candidature reellement constatee ou declaree (D-55).
  status                text not null default 'shared'
                          check (status in ('shared', 'viewed', 'applied', 'declined', 'expired')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint opportunity_referrals_target_exclusive
    check (num_nonnulls(referred_profile_id, external_person_name) = 1),
  constraint opportunity_referrals_not_self
    check (referred_profile_id is null or referred_profile_id <> referrer_profile_id)
);
comment on table public.opportunity_referrals is
  'Un ISE oriente un pair (ou une personne externe nommee) vers une offre. Le statut applied n''est jamais deduit d''un clic (D-55).';

select private.attach_updated_at('public', 'opportunity_referrals');

create index if not exists opportunity_referrals_opportunity_idx
  on public.opportunity_referrals(opportunity_id, created_at desc, id desc);
create index if not exists opportunity_referrals_referrer_idx
  on public.opportunity_referrals(referrer_profile_id, created_at desc, id desc);
create index if not exists opportunity_referrals_referred_idx
  on public.opportunity_referrals(referred_profile_id)
  where referred_profile_id is not null;
create unique index if not exists opportunity_referrals_pair_uidx
  on public.opportunity_referrals(opportunity_id, referrer_profile_id, referred_profile_id)
  where referred_profile_id is not null;

-- ---------------------------------------------------------------------
-- 8. Clic sortant vers une offre externe
-- ---------------------------------------------------------------------
-- D7 §58 et D-55 : pour une offre externe, la plateforme suit UNIQUEMENT
-- le clic sortant. Elle ne sait pas si une candidature a ete deposee.
-- Cette table ne doit jamais servir a inferer un statut de candidature.
create table if not exists public.opportunity_outbound_clicks (
  id             uuid primary key default extensions.gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  clicked_at     timestamptz not null default now()
);
comment on table public.opportunity_outbound_clicks is
  'Clic vers une offre externe. Fait technique uniquement : ne vaut NI candidature NI resultat (D-55).';
create index if not exists opportunity_outbound_clicks_opportunity_idx
  on public.opportunity_outbound_clicks(opportunity_id, clicked_at desc);
create index if not exists opportunity_outbound_clicks_profile_idx
  on public.opportunity_outbound_clicks(profile_id, clicked_at desc);

-- ---------------------------------------------------------------------
-- 9. Questions complementaires de l'offre
-- ---------------------------------------------------------------------
create table if not exists public.opportunity_questions (
  id             uuid primary key default extensions.gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  display_order  smallint not null default 1 check (display_order between 1 and 10),
  question       text not null check (length(btrim(question)) between 5 and 300),
  is_required    boolean not null default false,
  created_at     timestamptz not null default now()
);
comment on table public.opportunity_questions is
  'Questions complementaires, en nombre limite (D27 §83). Pas de formulaire geant : jamais 25 questions.';
create unique index if not exists opportunity_questions_order_uidx
  on public.opportunity_questions(opportunity_id, display_order);
create index if not exists opportunity_questions_opportunity_idx
  on public.opportunity_questions(opportunity_id);

-- ---------------------------------------------------------------------
-- 10. Candidatures (ISE-063 / ISE-064 / ISE-066)
-- ---------------------------------------------------------------------
-- D-55 — REGLE CENTRALE : aucun statut ne franchit une etape non constatee.
--   channel = 'platform' : la candidature transite par la plateforme, le
--     recruteur constate lui-meme chaque etape (viewed, interview...).
--   channel = 'external' : le membre DECLARE avoir postule hors plateforme.
--     Aucun clic ne cree cette ligne ; le membre en est la seule source et
--     tous les statuts qui suivent sont auto-declares.
-- Le vocabulaire de rejet reste neutre : `not_selected`, jamais « rejete ».
create table if not exists public.applications (
  id                   uuid primary key default extensions.gen_random_uuid(),
  opportunity_id       uuid not null references public.opportunities(id) on delete cascade,
  applicant_profile_id uuid not null references public.ise_profiles(id) on delete cascade,

  channel              text not null default 'platform'
                         check (channel in ('platform', 'external')),
  -- Vrai quand l'etat provient d'une declaration du membre et non d'un
  -- fait constate par la plateforme.
  is_self_declared     boolean not null default false,

  status               text not null default 'draft'
                         check (status in (
                           'draft', 'submitted', 'viewed', 'under_review',
                           'interview', 'selected', 'not_selected',
                           'withdrawn', 'closed')),

  message              text check (message is null or length(message) <= 2000),
  cv_document_id       uuid references public.profile_documents(id) on delete set null,

  submitted_at         timestamptz,
  -- Date reellement declaree par le membre pour une candidature externe.
  declared_at          timestamptz,
  viewed_at            timestamptz,
  reviewed_at          timestamptz,
  decided_at           timestamptz,
  withdrawn_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- CA-OPP / D27 §176 : une seule candidature par couple offre + candidat.
  constraint applications_unique_pair unique (opportunity_id, applicant_profile_id),
  -- Une candidature n'existe qu'a partir du moment ou elle est envoyee.
  constraint applications_submitted_state
    check (status = 'draft' or submitted_at is not null),
  -- Toute candidature externe est, par construction, auto-declaree (D-55).
  constraint applications_external_is_declared
    check (channel = 'platform' or is_self_declared = true),
  constraint applications_declared_at_scope
    check (declared_at is null or is_self_declared = true),
  constraint applications_withdrawn_state
    check ((status = 'withdrawn') = (withdrawn_at is not null)),
  constraint applications_decision_state
    check (decided_at is not null or status not in ('selected', 'not_selected'))
);
comment on table public.applications is
  'Candidature a une opportunite. Toujours un acte explicite du membre : jamais posee par un clic, et declaree par lui pour une offre externe (D-55).';
comment on column public.applications.is_self_declared is
  'True quand le statut resulte d''une declaration du membre et non d''un fait constate par la plateforme (D-55).';
comment on column public.applications.status is
  'Vocabulaire neutre : not_selected, jamais « rejete ». not_selected ne revient pas automatiquement a under_review (D27 §109).';

select private.attach_updated_at('public', 'applications');

create index if not exists applications_opportunity_idx
  on public.applications(opportunity_id, submitted_at desc, id desc);
create index if not exists applications_opportunity_status_idx
  on public.applications(opportunity_id, status);
create index if not exists applications_applicant_idx
  on public.applications(applicant_profile_id, submitted_at desc, id desc);
create index if not exists applications_cv_document_idx
  on public.applications(cv_document_id) where cv_document_id is not null;

-- Pieces jointes d'une candidature (D7 §69).
create table if not exists public.application_documents (
  application_id uuid not null references public.applications(id) on delete cascade,
  document_id    uuid not null references public.profile_documents(id) on delete cascade,
  role           text not null default 'other'
                   check (role in ('cv', 'cover_letter', 'diploma',
                                   'technical_proposal', 'financial_proposal', 'other')),
  created_at     timestamptz not null default now(),
  primary key (application_id, document_id)
);
comment on table public.application_documents is
  'Pieces jointes a une candidature. Le document reste accessible a l''auteur de l''offre UNIQUEMENT dans le contexte de cette candidature (CA-OPP-07).';
create index if not exists application_documents_document_idx
  on public.application_documents(document_id, application_id);

create table if not exists public.application_answers (
  application_id uuid not null references public.applications(id) on delete cascade,
  question_id    uuid not null references public.opportunity_questions(id) on delete cascade,
  answer         text not null check (length(btrim(answer)) between 1 and 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (application_id, question_id)
);
comment on table public.application_answers is
  'Reponses aux questions complementaires de l''offre.';

select private.attach_updated_at('public', 'application_answers');

create index if not exists application_answers_question_idx
  on public.application_answers(question_id, application_id);

-- ---------------------------------------------------------------------
-- 11. Historique de statut de candidature
-- ---------------------------------------------------------------------
-- Timeline affichee au candidat (D7 §77) et trace de qui a constate quoi.
-- `actor_kind = 'applicant'` marque une etape DECLAREE par le membre.
create table if not exists public.application_status_history (
  id               uuid primary key default extensions.gen_random_uuid(),
  application_id   uuid not null references public.applications(id) on delete cascade,
  from_status      text,
  to_status        text not null,
  actor_profile_id uuid references public.ise_profiles(id) on delete set null,
  actor_kind       text not null default 'system'
                     check (actor_kind in ('applicant', 'recruiter', 'admin', 'system')),
  note             text check (note is null or length(note) <= 1000),
  created_at       timestamptz not null default now()
);
comment on table public.application_status_history is
  'Historique des transitions d''une candidature. actor_kind = applicant signale une etape declaree par le membre (D-55).';
create index if not exists application_status_history_application_idx
  on public.application_status_history(application_id, created_at desc, id desc);

-- ---------------------------------------------------------------------
-- 12. Resultat d'une opportunite (cloture) et beneficiaires
-- ---------------------------------------------------------------------
-- Un impact n'est enregistre QUE lorsqu'un resultat professionnel est
-- effectivement obtenu grace a la plateforme (D27 §176, test 13).
create table if not exists public.opportunity_outcomes (
  id                      uuid primary key default extensions.gen_random_uuid(),
  opportunity_id          uuid not null unique references public.opportunities(id) on delete cascade,

  -- Union dedupliquee des listes D7 §94 (5) et D27 §110 (8).
  outcome_type            text not null
                            check (outcome_type in (
                              'ise_hired', 'mission_awarded', 'intern_selected',
                              'multiple_selected', 'no_selection', 'external_hire',
                              'cancelled', 'other')),
  hires_count             smallint not null default 0 check (hires_count >= 0),
  -- « Cette mise en relation a-t-elle ete realisee grace a Competences ISE ? »
  facilitated_by_platform boolean not null default false,
  -- D27 §113 : directe = candidature ET selection via la plateforme ;
  -- partielle = la plateforme a seulement facilite l'introduction.
  attribution_level       text not null default 'unknown'
                            check (attribution_level in ('direct', 'partial', 'self_reported', 'unknown')),
  notes                   text check (notes is null or length(notes) <= 2000),
  declared_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Aucun faux impact : un resultat sans recrutement ne peut pas etre
  -- attribue a la plateforme (test 13).
  constraint opportunity_outcomes_no_false_impact
    check (
      outcome_type in ('ise_hired', 'mission_awarded', 'intern_selected', 'multiple_selected')
      or (facilitated_by_platform = false and attribution_level = 'unknown' and hires_count = 0)
    ),
  -- Un recrutement declare compte au moins un beneficiaire.
  constraint opportunity_outcomes_hires_coherence
    check (
      outcome_type not in ('ise_hired', 'mission_awarded', 'intern_selected', 'multiple_selected')
      or hires_count >= 1
    ),
  -- Une attribution reelle suppose que la plateforme a joue un role.
  constraint opportunity_outcomes_attribution_coherence
    check (attribution_level not in ('direct', 'partial') or facilitated_by_platform = true)
);
comment on table public.opportunity_outcomes is
  'Resultat constate d''une opportunite. Une attribution d''impact n''est posee que si le resultat a reellement ete obtenu grace a la plateforme (D27 §176).';

select private.attach_updated_at('public', 'opportunity_outcomes');

create index if not exists opportunity_outcomes_type_idx
  on public.opportunity_outcomes(outcome_type, created_at desc);
create index if not exists opportunity_outcomes_declared_by_idx
  on public.opportunity_outcomes(declared_by_profile_id)
  where declared_by_profile_id is not null;

create table if not exists public.opportunity_outcome_beneficiaries (
  outcome_id     uuid not null references public.opportunity_outcomes(id) on delete cascade,
  profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (outcome_id, profile_id)
);
comment on table public.opportunity_outcome_beneficiaries is
  'ISE effectivement retenus. application_id relie le resultat a la candidature lorsqu''elle a transite par la plateforme (attribution directe).';
create index if not exists opportunity_outcome_beneficiaries_profile_idx
  on public.opportunity_outcome_beneficiaries(profile_id);
create index if not exists opportunity_outcome_beneficiaries_application_idx
  on public.opportunity_outcome_beneficiaries(application_id)
  where application_id is not null;

-- ---------------------------------------------------------------------
-- 13. Opportunites enregistrees (favoris, PARTIE V)
-- ---------------------------------------------------------------------
create table if not exists public.saved_opportunities (
  profile_id     uuid not null references public.ise_profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (profile_id, opportunity_id)
);
comment on table public.saved_opportunities is
  'Offres mises de cote par un membre. Aucun effet sur le classement : pas de signal de popularite (CA-MATCH-09).';
create index if not exists saved_opportunities_opportunity_idx
  on public.saved_opportunities(opportunity_id);
create index if not exists saved_opportunities_cursor_idx
  on public.saved_opportunities(profile_id, created_at desc, opportunity_id desc);

-- ---------------------------------------------------------------------
-- 14. Fonctions metier
-- ---------------------------------------------------------------------

-- Depot d'une candidature via la plateforme.
-- Acte explicite du membre : la fonction refuse toute offre non active,
-- toute offre externe (le resultat y serait inconstatable, D-55) et tout
-- doublon (D27 §176, test 7).
create or replace function public.submit_application(
  p_opportunity_id uuid,
  p_message        text default null,
  p_cv_document_id uuid default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_opp   public.opportunities;
  v_app   public.applications;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id for update;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.status <> 'active' then
    raise exception 'opportunity_not_open' using errcode = 'P0001';
  end if;
  if v_opp.application_mode <> 'internal' then
    raise exception 'external_application_must_be_declared' using errcode = 'P0001';
  end if;
  if v_opp.deadline is not null and v_opp.deadline <= now() then
    raise exception 'opportunity_deadline_passed' using errcode = 'P0001';
  end if;
  if v_opp.author_profile_id = v_me then
    raise exception 'cannot_apply_to_own_opportunity' using errcode = 'P0001';
  end if;

  -- Le CV joint doit appartenir au candidat (CA-OPP-07).
  if p_cv_document_id is not null then
    perform 1
       from public.profile_documents d
      where d.id = p_cv_document_id
        and d.profile_id = v_me
        and d.deleted_at is null;
    if not found then
      raise exception 'document_not_found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.applications (
    opportunity_id, applicant_profile_id, channel, is_self_declared,
    status, message, cv_document_id, submitted_at
  )
  values (p_opportunity_id, v_me, 'platform', false,
          'submitted', p_message, p_cv_document_id, now())
  on conflict on constraint applications_unique_pair do nothing
  returning * into v_app;

  if v_app.id is null then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, to_status, actor_profile_id, actor_kind)
  values (v_app.id, 'submitted', v_me, 'applicant');

  return v_app;
end
$$;

comment on function public.submit_application(uuid, text, uuid) is
  'Depose une candidature interne. Refuse les doublons (test 7) et les offres externes, dont le resultat ne peut pas etre constate (D-55).';

-- Declaration d'une candidature deposee HORS plateforme (D-55).
-- Le membre est la seule source : rien n'est deduit d'un clic sortant.
create or replace function public.declare_external_application(
  p_opportunity_id uuid,
  p_declared_at    timestamptz default now(),
  p_note           text default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := private.current_profile_id();
  v_opp public.opportunities;
  v_app public.applications;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_declared_at is null or p_declared_at > now() then
    raise exception 'invalid_declared_date' using errcode = 'P0001';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  insert into public.applications (
    opportunity_id, applicant_profile_id, channel, is_self_declared,
    status, message, submitted_at, declared_at
  )
  values (p_opportunity_id, v_me, 'external', true,
          'submitted', p_note, p_declared_at, p_declared_at)
  on conflict on constraint applications_unique_pair do nothing
  returning * into v_app;

  if v_app.id is null then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, to_status, actor_profile_id, actor_kind, note)
  values (v_app.id, 'submitted', v_me, 'applicant', p_note);

  return v_app;
end
$$;

comment on function public.declare_external_application(uuid, timestamptz, text) is
  'Le membre declare avoir postule hors plateforme. Aucun clic ne cree cette ligne (D-55).';

-- Transition de statut d'une candidature.
-- Le candidat ne peut que retirer sa candidature (ou declarer l'issue reelle
-- d'une candidature externe). Le recruteur constate les etapes de son cote.
-- `not_selected` ne revient jamais automatiquement a `under_review` (D27 §109) :
-- seule une permission d'administration peut corriger une decision.
create or replace function public.transition_application_status(
  p_application_id uuid,
  p_to_status      text,
  p_note           text default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me           uuid := private.current_profile_id();
  v_app          public.applications;
  v_opp_author   uuid;
  v_opp_contact  uuid;
  v_from         text;
  v_is_applicant boolean;
  v_is_recruiter boolean;
  v_is_admin     boolean;
  v_actor_kind   text;
  v_allowed      boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  select o.author_profile_id, o.contact_profile_id
    into v_opp_author, v_opp_contact
    from public.opportunities o
   where o.id = v_app.opportunity_id;

  v_from         := v_app.status;
  v_is_applicant := (v_app.applicant_profile_id = v_me);
  v_is_recruiter := (v_me is not distinct from v_opp_author)
                    or (v_me is not distinct from v_opp_contact);
  v_is_admin     := private.has_permission('opportunities.manage');

  if not (v_is_applicant or v_is_recruiter or v_is_admin) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_allowed := case
    -- Retrait : toujours a l'initiative du candidat, avant decision.
    when p_to_status = 'withdrawn'
      then v_is_applicant and v_from in ('submitted', 'viewed', 'under_review', 'interview')
    -- Etapes constatees par le recruteur sur une candidature interne.
    when p_to_status = 'viewed'
      then v_from = 'submitted' and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'under_review'
      then v_from in ('submitted', 'viewed') and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'interview'
      then v_from in ('viewed', 'under_review') and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'selected'
      then v_from in ('under_review', 'interview') and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'not_selected'
      then v_from in ('submitted', 'viewed', 'under_review', 'interview')
           and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    -- Cloture sans decision individuelle (offre fermee).
    when p_to_status = 'closed'
      then v_from in ('submitted', 'viewed', 'under_review', 'interview')
           and (v_is_recruiter or v_is_admin)
    else false
  end;

  -- D27 §109 : `not_selected` ne revient jamais automatiquement en arriere.
  -- Seule une correction administrative explicite le permet.
  if v_from = 'not_selected' then
    v_allowed := v_is_admin and p_to_status in ('under_review', 'interview');
  end if;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_actor_kind := case
    when v_is_applicant then 'applicant'
    when v_is_recruiter then 'recruiter'
    else 'admin'
  end;

  update public.applications
     set status       = p_to_status,
         viewed_at    = case when p_to_status = 'viewed' then coalesce(viewed_at, now()) else viewed_at end,
         reviewed_at  = case when p_to_status in ('under_review', 'interview') then coalesce(reviewed_at, now()) else reviewed_at end,
         decided_at   = case when p_to_status in ('selected', 'not_selected') then now() else decided_at end,
         withdrawn_at = case when p_to_status = 'withdrawn' then now() else withdrawn_at end
   where id = p_application_id
  returning * into v_app;

  insert into public.application_status_history (
    application_id, from_status, to_status, actor_profile_id, actor_kind, note
  )
  values (p_application_id, v_from, p_to_status, v_me, v_actor_kind, p_note);

  return v_app;
end
$$;

comment on function public.transition_application_status(uuid, text, text) is
  'Machine d''etats des candidatures. Sur une candidature auto-declaree, seul le membre constate les etapes (D-55) ; un retour depuis not_selected exige opportunities.manage (D27 §109).';

-- Cloture d'une opportunite avec enregistrement du resultat.
create or replace function public.close_opportunity(
  p_opportunity_id     uuid,
  p_outcome_type       text,
  p_hires_count        smallint default 0,
  p_facilitated        boolean default false,
  p_attribution_level  text default 'unknown',
  p_notes              text default null,
  p_beneficiary_ids    uuid[] default null
)
returns public.opportunities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_opp     public.opportunities;
  v_from    text;
  v_outcome uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id for update;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.author_profile_id is distinct from v_me
     and not private.has_permission('opportunities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_opp.status not in ('active', 'paused', 'expired') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_from := v_opp.status;

  update public.opportunities
     set status    = 'closed',
         closed_at = now()
   where id = p_opportunity_id
  returning * into v_opp;

  insert into public.opportunity_outcomes (
    opportunity_id, outcome_type, hires_count, facilitated_by_platform,
    attribution_level, notes, declared_by_profile_id
  )
  values (p_opportunity_id, p_outcome_type, coalesce(p_hires_count, 0::smallint),
          coalesce(p_facilitated, false), coalesce(p_attribution_level, 'unknown'),
          p_notes, v_me)
  on conflict (opportunity_id) do update
     set outcome_type            = excluded.outcome_type,
         hires_count             = excluded.hires_count,
         facilitated_by_platform = excluded.facilitated_by_platform,
         attribution_level       = excluded.attribution_level,
         notes                   = excluded.notes,
         declared_by_profile_id  = excluded.declared_by_profile_id
  returning id into v_outcome;

  if p_beneficiary_ids is not null then
    insert into public.opportunity_outcome_beneficiaries (outcome_id, profile_id, application_id)
    select v_outcome,
           b,
           (select a.id
              from public.applications a
             where a.opportunity_id = p_opportunity_id
               and a.applicant_profile_id = b)
      from unnest(p_beneficiary_ids) as b
     where b is not null
    on conflict (outcome_id, profile_id) do nothing;
  end if;

  return v_opp;
end
$$;

comment on function public.close_opportunity(uuid, text, smallint, boolean, text, text, uuid[]) is
  'Cloture une offre et enregistre son resultat. Une cloture sans recrutement ne produit aucun impact (test 13).';

-- Expiration automatique a l'echeance (D27 §98).
-- ARBITRAGE : le doc hesitait entre « expiree » et « cloture automatique ».
-- Retenu : passage a `expired` seulement. La cloture reste un acte de
-- l'auteur, car elle porte la declaration du resultat (D-55).
create or replace function public.expire_stale_opportunities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.opportunities
       set status = 'expired'
     where status = 'active'
       and deleted_at is null
       and deadline is not null
       and deadline <= now()
    returning id
  )
  select count(*) into v_count from expired;

  return coalesce(v_count, 0);
end
$$;

comment on function public.expire_stale_opportunities() is
  'Passe en expired les offres actives dont l''echeance est depassee. Ne cloture jamais : la cloture porte la declaration du resultat.';

revoke all on function public.expire_stale_opportunities() from public;
