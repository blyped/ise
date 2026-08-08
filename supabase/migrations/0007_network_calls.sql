-- =====================================================================
-- 0007_network_calls
-- Appels au reseau (ISE-047 -> ISE-054).
--
-- Un appel au reseau n'est PAS un post : c'est une demande professionnelle
-- structuree, ciblee, mesurable. La chaine de valeur est :
--   Besoin -> Structuration -> Matching -> Ciblage -> Reponses
--   -> Mise en relation -> Resolution -> Mesure de l'impact.
--
-- Decisions appliquees :
--   D-10  rattachement metier sur ise_profiles(id), jamais auth.users
--   D-13  text + CHECK, aucun type ENUM PostgreSQL
--   D-44  index de pagination par curseur (critere desc, id desc)
--   D-52  cloture TERNAIRE : resolved / partially_resolved / not_resolved
--   D-73  echelle de visibilite a 4 niveaux (public.is_visibility_level)
--   D-101 SECURITY DEFINER : search_path = '' et objets qualifies
--   D-102 codes d'erreur machine, jamais de phrase
--   Q-02  expiration automatique d'un appel sans activite : 60 jours
--
-- RLS : AUCUNE policy ici, une migration dediee s'en charge.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Appel au reseau
-- ---------------------------------------------------------------------
-- Machine d'etats (D6 §84, complete par arbitrage, voir plus bas) :
--   draft    --(publier)--------------> active
--   active   --(mettre en pause)------> paused --(reprendre)--> active
--   active   --(echeance / 60 j)------> expired --(prolonger)-> active
--   active   --(cloture resolue)------> resolved
--   active   --(cloture non resolue)--> closed
--   active   --(besoin abandonne)-----> cancelled
--   *        --(moderation)-----------> moderated
--
-- ARBITRAGE : les documents ne tranchaient pas le mapping entre `cancelled`,
-- `closed` et « mon besoin n'est plus d'actualite ». Convention retenue :
--   resolved  = cloture avec resolution in ('resolved','partially_resolved')
--   closed    = cloture avec resolution = 'not_resolved' (le besoin a ete
--               instruit mais le reseau n'a pas repondu) -> aucun impact
--   cancelled = besoin abandonne avant instruction -> aucune resolution
create table if not exists public.network_calls (
  id                          uuid primary key default extensions.gen_random_uuid(),

  author_profile_id           uuid not null references public.ise_profiles(id) on delete cascade,

  -- Famille choisie en ISE-050 (etape « De quoi avez-vous besoin ? »).
  call_family                 text
                                check (call_family is null or call_family in (
                                  'find_person', 'career', 'collaboration',
                                  'information', 'business', 'other')),

  -- Type precis. Les 15 categories de D6 §3 / D26 §5, libelles harmonises
  -- cote application ; la base ne stocke que le code machine (D-13).
  call_type                   text not null
                                check (call_type in (
                                  'expert', 'consultant', 'job', 'internship',
                                  'partner', 'contact', 'recommendation',
                                  'information', 'skill', 'speaker', 'funding',
                                  'collaborators', 'mentor', 'consortium', 'other')),

  -- Limite haute retenue : 120 caracteres (D26 §38 l'emporte sur les
  -- « 100 recommandes » de D6 §34, cf. D-02).
  title                       text not null
                                check (length(btrim(title)) between 3 and 120),
  -- Longueur recommandee 200-1500 (D26 §38) ; la base ne pose qu'un
  -- plafond dur, l'incitation a la concision reste cote interface.
  description                 text not null
                                check (length(btrim(description)) between 20 and 5000),
  -- « Pourquoi en avez-vous besoin ? » (D26 §39), facultatif.
  context                     text check (context is null or length(context) <= 2000),
  -- Section distincte « Profil recherche » (D6 §22, D26 §23).
  wanted_profile              text check (wanted_profile is null or length(wanted_profile) <= 2000),

  -- Criteres structurants portes par la ligne. Les criteres multivalues
  -- vivent dans les tables de ciblage ci-dessous (MASTER PROMPT §9).
  sector_id                   bigint references public.sectors(id) on delete set null,
  sector_importance           text not null default 'preferred'
                                check (sector_importance in ('required', 'preferred')),
  country_code                char(2) references public.countries(code),
  city                        text,
  remote_allowed              boolean not null default false,

  preferred_organization_id   uuid references public.organizations(id) on delete set null,
  organization_importance     text not null default 'preferred'
                                check (organization_importance in ('required', 'preferred')),

  -- Comparaison bidirectionnelle de l'experience (D22 §36) : un besoin
  -- junior ne doit pas privilegier mecaniquement un profil a 25 ans.
  min_experience_years        smallint check (min_experience_years is null or min_experience_years between 0 and 60),
  max_experience_years        smallint check (max_experience_years is null or max_experience_years between 0 and 60),

  -- Intervalle de promotions vise (ex. « ISE 1995-2010 »).
  promotion_year_from         smallint,
  promotion_year_to           smallint,

  -- Echeance reelle. L'urgence est DEDUITE de la date (D6 §38) : le membre
  -- ne coche jamais librement « urgent ».
  deadline                    timestamptz,
  urgency                     text not null default 'normal'
                                check (urgency in ('normal', 'deadline_soon')),

  visibility                  text not null default 'members'
                                check (public.is_visibility_level(visibility)),
  -- D26 §52 : l'auteur peut masquer son organisation dans cet appel.
  hide_author_organization    boolean not null default false,

  status                      text not null default 'draft'
                                check (status in (
                                  'draft', 'active', 'paused', 'resolved',
                                  'closed', 'expired', 'cancelled', 'moderated')),

  -- ---- Cloture et impact (ISE-054) ---------------------------------
  -- D-52 : resultat TERNAIRE. Un booleen ne peut pas porter « partiellement ».
  resolution                  text
                                check (resolution is null or resolution in (
                                  'resolved', 'partially_resolved', 'not_resolved')),
  -- Union dedupliquee des listes D6 §72 (11) et D26 §90 (10).
  closure_result_type         text
                                check (closure_result_type is null or closure_result_type in (
                                  'expert_found', 'consultant_found', 'internship_found',
                                  'job_found', 'introduction_made', 'advice_received',
                                  'partner_found', 'collaborator_found', 'team_formed',
                                  'information_obtained', 'funding_identified', 'other')),
  -- « Qu'est-ce qui a manque ? » (D6 §75 / D26 §93) : sert a calibrer le matching.
  closure_missing_reason      text
                                check (closure_missing_reason is null or closure_missing_reason in (
                                  'no_response', 'irrelevant_profiles', 'deadline_too_short',
                                  'need_changed', 'other')),
  closure_notes               text check (closure_notes is null or length(closure_notes) <= 2000),
  -- Temoignage d'impact facultatif. Le consentement est SEPARE et explicite
  -- (D6 §74, D26 §94) : sans consentement, le temoignage reste interne.
  impact_testimonial          text check (impact_testimonial is null or length(impact_testimonial) <= 1000),
  impact_testimonial_consent  boolean not null default false,

  -- ---- Horodatages -------------------------------------------------
  published_at                timestamptz,
  paused_at                   timestamptz,
  -- Q-02 : expiration automatique a 60 jours sans activite, positionnee
  -- a la publication et repoussee a chaque prolongation.
  expires_at                  timestamptz,
  closed_at                   timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz,

  -- Un appel publie porte toujours sa date de publication.
  constraint network_calls_published_state
    check (status = 'draft' or published_at is not null),
  -- L'echeance ne peut pas preceder la publication (qualite, [17] §227).
  constraint network_calls_deadline_order
    check (deadline is null or published_at is null or deadline >= published_at),
  constraint network_calls_experience_order
    check (min_experience_years is null or max_experience_years is null
           or min_experience_years <= max_experience_years),
  constraint network_calls_promotion_order
    check (promotion_year_from is null or promotion_year_to is null
           or promotion_year_from <= promotion_year_to),
  -- Une resolution n'existe que dans le cadre d'une cloture effective.
  constraint network_calls_resolution_requires_closure
    check (resolution is null or closed_at is not null),
  -- Coherence stricte statut <-> resolution (voir arbitrage ci-dessus).
  constraint network_calls_status_resolution
    check (
      (status = 'resolved' and resolution in ('resolved', 'partially_resolved'))
      or (status = 'closed' and resolution = 'not_resolved')
      or (status not in ('resolved', 'closed') and resolution is null)
    ),
  -- Le motif « ce qui a manque » n'a de sens que si le besoin n'est pas resolu.
  constraint network_calls_missing_reason_scope
    check (closure_missing_reason is null
           or resolution in ('partially_resolved', 'not_resolved')),
  -- Pas de consentement sans temoignage : evite un consentement orphelin.
  constraint network_calls_testimonial_consent
    check (impact_testimonial_consent = false or impact_testimonial is not null)
);

comment on table public.network_calls is
  'Demande professionnelle structuree adressee au reseau (ISE-047..054). Jamais un post : le ciblage est explicite et la resolution est mesuree (D-52).';
comment on column public.network_calls.resolution is
  'Cloture ternaire D-52 : resolved / partially_resolved / not_resolved. Remplace le booleen resolved_by_network du doc 17.';
comment on column public.network_calls.expires_at is
  'Q-02 : 60 jours apres publication. Depasse, l''appel passe en expired sauf prolongation.';
comment on column public.network_calls.urgency is
  'Deduit de la date d''echeance (D6 §38). Le membre ne coche jamais « urgent » lui-meme.';

select private.attach_updated_at('public', 'network_calls');

-- Index. Toute FK utilisee en filtre ou jointure est indexee (conventions §6).
create index if not exists network_calls_author_idx
  on public.network_calls(author_profile_id, created_at desc, id desc);
create index if not exists network_calls_status_published_idx
  on public.network_calls(status, published_at desc, id desc);
create index if not exists network_calls_country_idx
  on public.network_calls(country_code) where deleted_at is null;
create index if not exists network_calls_sector_idx
  on public.network_calls(sector_id) where deleted_at is null;
create index if not exists network_calls_organization_idx
  on public.network_calls(preferred_organization_id) where preferred_organization_id is not null;
create index if not exists network_calls_status_deadline_idx
  on public.network_calls(status, deadline);
-- Filtre quasi systematique : le fil ne montre que les appels ouverts.
create index if not exists network_calls_active_idx
  on public.network_calls(published_at desc, id desc)
  where status = 'active' and deleted_at is null;
-- Balayage du job d'expiration (Q-02).
create index if not exists network_calls_expiry_sweep_idx
  on public.network_calls(expires_at)
  where status = 'active';
-- Recherche plein texte tolerante sur le titre (D-45).
create index if not exists network_calls_title_trgm_idx
  on public.network_calls using gin (public.normalize_text(title) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 2. Ciblage par criteres (« Qui peut vous aider ? », etape 2 de ISE-049)
-- ---------------------------------------------------------------------
-- Chaque critere porte un marqueur Obligatoire / Souhaite (D26 §47-48).
-- `required` = hard filter, TOUJOURS respecte (CA-MATCH-02).
-- `preferred` = soft filter, degrade le score sans exclure (D22 §23).

create table if not exists public.network_call_skills (
  call_id    uuid not null references public.network_calls(id) on delete cascade,
  skill_id   bigint not null references public.skills(id) on delete cascade,
  importance text not null default 'preferred'
               check (importance in ('required', 'preferred')),
  created_at timestamptz not null default now(),
  primary key (call_id, skill_id)
);
comment on table public.network_call_skills is
  'Competences visees par l''appel. importance = required (hard filter) ou preferred (soft filter).';
-- Sens inverse : « quels appels correspondent a mes competences ? » (onglet Pour moi).
create index if not exists network_call_skills_skill_idx
  on public.network_call_skills(skill_id, call_id);

create table if not exists public.network_call_tools (
  call_id    uuid not null references public.network_calls(id) on delete cascade,
  tool_id    bigint not null references public.tools(id) on delete cascade,
  importance text not null default 'preferred'
               check (importance in ('required', 'preferred')),
  created_at timestamptz not null default now(),
  primary key (call_id, tool_id)
);
comment on table public.network_call_tools is
  'Outils attendus (D26 §45). Un outil required exclut le profil qui ne le declare pas (D22 §47).';
create index if not exists network_call_tools_tool_idx
  on public.network_call_tools(tool_id, call_id);

create table if not exists public.network_call_languages (
  call_id         uuid not null references public.network_calls(id) on delete cascade,
  language_code   varchar(10) not null references public.languages(code) on delete cascade,
  -- Niveau minimal exige : une langue required non satisfaite exclut (D22 §49).
  min_proficiency text not null default 'professional'
                    check (min_proficiency in ('basic', 'intermediate', 'professional', 'fluent', 'native')),
  importance      text not null default 'preferred'
                    check (importance in ('required', 'preferred')),
  created_at      timestamptz not null default now(),
  primary key (call_id, language_code)
);
comment on table public.network_call_languages is
  'Langues attendues et niveau minimal. Une langue required non satisfaite est un hard filter (D22 §49).';
create index if not exists network_call_languages_language_idx
  on public.network_call_languages(language_code, call_id);

create table if not exists public.network_call_countries (
  call_id      uuid not null references public.network_calls(id) on delete cascade,
  country_code char(2) not null references public.countries(code) on delete cascade,
  -- D26 §43 : le pays de residence souhaite et le pays d'experience souhaite
  -- sont deux criteres distincts, jamais confondus (D5 §11, §78).
  scope        text not null default 'experience'
                 check (scope in ('residence', 'experience')),
  importance   text not null default 'preferred'
                 check (importance in ('required', 'preferred')),
  created_at   timestamptz not null default now(),
  primary key (call_id, country_code, scope)
);
comment on table public.network_call_countries is
  'Pays vises. scope distingue le pays de residence du pays d''experience (D26 §43).';
create index if not exists network_call_countries_country_idx
  on public.network_call_countries(country_code, call_id);

-- Type d'aide accepte par l'auteur (D6 §82). Determine les reponses
-- proposees en ISE-051 et pese dans le matching (D6 §45).
create table if not exists public.network_call_help_types (
  call_id    uuid not null references public.network_calls(id) on delete cascade,
  help_type  text not null
               check (help_type in ('direct_expert', 'recommendation',
                                    'introduction', 'advice', 'information')),
  created_at timestamptz not null default now(),
  primary key (call_id, help_type)
);
comment on table public.network_call_help_types is
  'Types d''aide acceptes (D6 §82). Couvre le cas « je ne peux pas aider directement mais je peux etre utile ».';

-- ---------------------------------------------------------------------
-- 3. Ciblage d'audience (qui peut VOIR l'appel)
-- ---------------------------------------------------------------------
-- Ciblage = visibilite (qui voit) x matching (qui est notifie) (D26 §4.13).
-- La colonne network_calls.visibility porte les 4 niveaux D-73 ; les tables
-- ci-dessous restreignent en plus l'audience a des promotions ou a des
-- membres nommement designes (« Prive sur invitation », D26 §50).

create table if not exists public.network_call_audience_promotions (
  call_id      uuid not null references public.network_calls(id) on delete cascade,
  promotion_id bigint not null references public.promotions(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (call_id, promotion_id)
);
comment on table public.network_call_audience_promotions is
  'Restriction de l''audience a une ou plusieurs promotions. Complete network_calls.visibility.';
create index if not exists network_call_audience_promotions_promo_idx
  on public.network_call_audience_promotions(promotion_id, call_id);

create table if not exists public.network_call_audience_profiles (
  call_id    uuid not null references public.network_calls(id) on delete cascade,
  profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (call_id, profile_id)
);
comment on table public.network_call_audience_profiles is
  'Membres nommement autorises a voir l''appel (option « Membres selectionnes » / « Prive sur invitation »).';
create index if not exists network_call_audience_profiles_profile_idx
  on public.network_call_audience_profiles(profile_id, call_id);

-- ---------------------------------------------------------------------
-- 4. Matching persiste
-- ---------------------------------------------------------------------
-- Le score interne n'est JAMAIS renvoye au client (D-42, D26 §132) :
-- l'application n'expose que le label qualitatif et les raisons.
create table if not exists public.network_call_matches (
  call_id           uuid not null references public.network_calls(id) on delete cascade,
  profile_id        uuid not null references public.ise_profiles(id) on delete cascade,
  score             numeric(6,2) not null check (score >= 0 and score <= 100),
  -- D22 §113 : savoir quelle version d'algorithme a produit le score.
  score_version     text not null default 'matching-v1',
  component_scores  jsonb not null default '{}'::jsonb,
  -- D-43 : un candidat sans aucune raison affichable est exclu du resultat.
  reasons           jsonb not null default '[]'::jsonb,
  missing_criteria  jsonb not null default '[]'::jsonb,
  -- D-42, seuils normalises sur 100.
  relevance_label   text not null
                      check (relevance_label in ('very_relevant', 'relevant', 'close_profile')),
  -- D22 §71 : >= 75 immediat, 60-74 digest, < 60 aucune notification.
  notification_tier text not null default 'none'
                      check (notification_tier in ('immediate', 'digest', 'none')),
  notified_at       timestamptz,
  computed_at       timestamptz not null default now(),
  expires_at        timestamptz,
  primary key (call_id, profile_id)
);
comment on table public.network_call_matches is
  'Resultat du moteur de matching pour un appel. Score interne non expose au client (D26 §132) ; recalcule si l''appel ou le profil change (D22 §116).';
-- Pagination par curseur du classement (D-44).
create index if not exists network_call_matches_rank_idx
  on public.network_call_matches(call_id, score desc, profile_id desc);
-- Sens inverse : le fil « Pour moi » du membre.
create index if not exists network_call_matches_profile_idx
  on public.network_call_matches(profile_id, score desc, call_id desc);
create index if not exists network_call_matches_notify_idx
  on public.network_call_matches(notification_tier, computed_at desc)
  where notified_at is null;

-- ---------------------------------------------------------------------
-- 5. Reponses a un appel (ISE-051 / ISE-053)
-- ---------------------------------------------------------------------
create table if not exists public.network_call_responses (
  id                    uuid primary key default extensions.gen_random_uuid(),
  call_id               uuid not null references public.network_calls(id) on delete cascade,
  author_profile_id     uuid not null references public.ise_profiles(id) on delete cascade,

  response_type         text not null
                          check (response_type in (
                            'direct', 'knows_someone', 'introduction',
                            'information', 'participate', 'other')),
  message               text check (message is null or length(message) <= 4000),
  -- « Partager mes coordonnees » : geste explicite, jamais implicite (D6 §51).
  shares_contact        boolean not null default false,

  -- Statuts PRIVES cote auteur de l'appel (D6 §65, D26 §86-87). Le repondant
  -- ne voit jamais « archived » comme un jugement. Le vocabulaire de rejet
  -- (« rejete ») est interdit (D6 §66).
  status                text not null default 'new'
                          check (status in ('new', 'reviewed', 'useful',
                                            'contacted', 'selected', 'archived')),
  marked_useful_at      timestamptz,
  first_useful_response boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Marqueur d'utilite et statut restent coherents.
  constraint network_call_responses_useful_coherence
    check (marked_useful_at is null
           or status in ('useful', 'contacted', 'selected', 'archived'))
);
comment on table public.network_call_responses is
  'Reponse a un appel. Reste privee entre le repondant et l''auteur de l''appel (CA-CALL-06) : jamais visible du reseau.';
comment on column public.network_call_responses.status is
  'Statut de traitement PRIVE cote auteur (D6 §65). Aucun libelle de rejet (D6 §66).';

select private.attach_updated_at('public', 'network_call_responses');

create index if not exists network_call_responses_call_idx
  on public.network_call_responses(call_id, created_at desc, id desc);
create index if not exists network_call_responses_call_status_idx
  on public.network_call_responses(call_id, status);
create index if not exists network_call_responses_author_idx
  on public.network_call_responses(author_profile_id, created_at desc, id desc);

-- ---------------------------------------------------------------------
-- 6. Recommandation d'un ISE dans une reponse (« Je connais quelqu'un »)
-- ---------------------------------------------------------------------
-- CA-CALL-05 : aucun partage de coordonnees d'un tiers sans son accord.
-- Pour une personne HORS reseau, on ne stocke qu'un nom et jamais un
-- telephone ou un e-mail ; l'introduction est proposee par le repondant.
create table if not exists public.network_call_recommendations (
  id                      uuid primary key default extensions.gen_random_uuid(),
  response_id             uuid not null references public.network_call_responses(id) on delete cascade,
  -- Denormalise volontairement : filtrage et RLS par appel sans jointure.
  call_id                 uuid not null references public.network_calls(id) on delete cascade,
  recommender_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,

  -- Soit un ISE du reseau, soit une personne externe nommee. Jamais les deux.
  recommended_profile_id  uuid references public.ise_profiles(id) on delete cascade,
  external_person_name    text check (external_person_name is null or length(btrim(external_person_name)) between 2 and 160),
  external_person_context text check (external_person_context is null or length(external_person_context) <= 500),

  -- « Pourquoi ce profil parait-il pertinent ? » (D6 §52).
  rationale               text check (rationale is null or length(rationale) <= 2000),
  -- Le repondant propose de faire lui-meme l'introduction (D26 §66).
  offers_introduction     boolean not null default false,
  -- Accord obtenu de la personne recommandee avant tout partage de contact.
  consent_confirmed       boolean not null default false,

  status                  text not null default 'proposed'
                            check (status in ('proposed', 'viewed', 'contacted',
                                              'introduction_requested', 'retained', 'dismissed')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint network_call_recommendations_target_exclusive
    check (num_nonnulls(recommended_profile_id, external_person_name) = 1),
  -- Le contexte externe n'a de sens que pour une personne hors reseau.
  constraint network_call_recommendations_external_scope
    check (external_person_context is null or external_person_name is not null),
  -- On ne se recommande pas soi-meme.
  constraint network_call_recommendations_not_self
    check (recommended_profile_id is null or recommended_profile_id <> recommender_profile_id)
);
comment on table public.network_call_recommendations is
  'Un ISE en recommande un autre en reponse a un appel. Aucune coordonnee de tiers n''est stockee (CA-CALL-05) ; seul un nom est admis pour une personne hors reseau.';

select private.attach_updated_at('public', 'network_call_recommendations');

create index if not exists network_call_recommendations_call_idx
  on public.network_call_recommendations(call_id, created_at desc, id desc);
create index if not exists network_call_recommendations_response_idx
  on public.network_call_recommendations(response_id);
create index if not exists network_call_recommendations_recommended_idx
  on public.network_call_recommendations(recommended_profile_id)
  where recommended_profile_id is not null;
create index if not exists network_call_recommendations_recommender_idx
  on public.network_call_recommendations(recommender_profile_id);
-- Anti-doublon : un meme ISE n'est recommande qu'une fois par reponse.
create unique index if not exists network_call_recommendations_pair_uidx
  on public.network_call_recommendations(response_id, recommended_profile_id)
  where recommended_profile_id is not null;

-- ---------------------------------------------------------------------
-- 7. Contributeurs reconnus a la cloture (question 3 de ISE-054)
-- ---------------------------------------------------------------------
-- « Quels membres vous ont particulierement aide ? » : valorise la
-- contribution SANS systeme de likes ni note publique (D6 §73, D26 §85).
create table if not exists public.network_call_contributors (
  call_id         uuid not null references public.network_calls(id) on delete cascade,
  profile_id      uuid not null references public.ise_profiles(id) on delete cascade,
  response_id     uuid references public.network_call_responses(id) on delete set null,
  acknowledged_at timestamptz not null default now(),
  primary key (call_id, profile_id)
);
comment on table public.network_call_contributors is
  'Membres designes par l''auteur comme ayant reellement aide. Base de l''attribution d''impact ; aucune note publique (D26 §85).';
create index if not exists network_call_contributors_profile_idx
  on public.network_call_contributors(profile_id, acknowledged_at desc);

-- ---------------------------------------------------------------------
-- 8. Journal des transitions (suivi)
-- ---------------------------------------------------------------------
create table if not exists public.network_call_events (
  id               uuid primary key default extensions.gen_random_uuid(),
  call_id          uuid not null references public.network_calls(id) on delete cascade,
  event_type       text not null,
  actor_profile_id uuid references public.ise_profiles(id) on delete set null,
  from_status      text,
  to_status        text,
  note             text,
  created_at       timestamptz not null default now()
);
comment on table public.network_call_events is
  'Journal des transitions d''un appel. Alimente par les fonctions metier (conventions §7), jamais ecrit directement par le client.';
create index if not exists network_call_events_call_idx
  on public.network_call_events(call_id, created_at desc, id desc);

-- ---------------------------------------------------------------------
-- 9. Appels enregistres (action « Enregistrer » de ISE-047)
-- ---------------------------------------------------------------------
create table if not exists public.saved_network_calls (
  profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  call_id    uuid not null references public.network_calls(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, call_id)
);
comment on table public.saved_network_calls is
  'Appels mis de cote par un membre. Aucun effet sur la visibilite ni sur le classement (pas de signal de popularite, CA-MATCH-09).';
create index if not exists saved_network_calls_call_idx
  on public.saved_network_calls(call_id);
create index if not exists saved_network_calls_cursor_idx
  on public.saved_network_calls(profile_id, created_at desc, call_id desc);

-- ---------------------------------------------------------------------
-- 10. Fonctions metier de transition d'etat
-- ---------------------------------------------------------------------
-- Conventions §7 : toute transition sensible passe par une fonction
-- atomique qui valide acteur -> etat courant -> transition, verrouille la
-- ligne pivot (SELECT ... FOR UPDATE) et journalise l'evenement.
-- Les messages leves sont des CODES MACHINE (D-102).

-- Publication d'un appel : draft|expired|paused -> active.
-- Positionne published_at et l'echeance d'inactivite a 60 jours (Q-02).
create or replace function public.publish_network_call(
  p_call_id uuid,
  p_extend_days integer default 60
)
returns public.network_calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_call public.network_calls;
  v_from text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_extend_days is null or p_extend_days < 1 or p_extend_days > 365 then
    raise exception 'invalid_expiry_window' using errcode = 'P0001';
  end if;

  select * into v_call from public.network_calls where id = p_call_id for update;
  if not found or v_call.deleted_at is not null then
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;
  if v_call.author_profile_id <> v_me then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_call.status not in ('draft', 'paused', 'expired') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_from := v_call.status;

  update public.network_calls
     set status       = 'active',
         published_at = coalesce(published_at, now()),
         paused_at    = null,
         expires_at   = now() + make_interval(days => p_extend_days)
   where id = p_call_id
  returning * into v_call;

  insert into public.network_call_events (call_id, event_type, actor_profile_id, from_status, to_status)
  values (p_call_id, case when v_from = 'draft' then 'published' else 'reopened' end,
          v_me, v_from, 'active');

  return v_call;
end
$$;

comment on function public.publish_network_call(uuid, integer) is
  'Publie ou prolonge un appel. Fixe l''expiration d''inactivite (Q-02 : 60 jours par defaut).';

-- Transitions non terminales : pause, reprise, annulation, moderation.
-- La cloture avec resolution passe obligatoirement par close_network_call.
create or replace function public.transition_network_call(
  p_call_id   uuid,
  p_to_status text,
  p_note      text default null
)
returns public.network_calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_call    public.network_calls;
  v_from    text;
  v_is_author boolean;
  v_allowed boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_call from public.network_calls where id = p_call_id for update;
  if not found or v_call.deleted_at is not null then
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;

  v_from      := v_call.status;
  v_is_author := (v_call.author_profile_id = v_me);

  -- Matrice de transitions autorisees, par acteur.
  v_allowed := case
    when p_to_status = 'paused'
      then v_from = 'active' and v_is_author
    when p_to_status = 'active'
      then v_from in ('paused', 'expired') and v_is_author
    when p_to_status = 'cancelled'
      then v_from in ('draft', 'active', 'paused', 'expired') and v_is_author
    when p_to_status = 'expired'
      then v_from = 'active' and (v_is_author or private.has_permission('calls.moderate'))
    when p_to_status = 'moderated'
      then v_from <> 'moderated' and private.has_permission('calls.moderate')
    else false
  end;

  if not v_allowed then
    -- Distinguer « pas le droit » de « transition impossible » (D-102).
    if not v_is_author and not private.has_permission('calls.moderate') then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.network_calls
     set status    = p_to_status,
         paused_at = case when p_to_status = 'paused' then now()
                          when p_to_status = 'active' then null
                          else paused_at end,
         closed_at = case when p_to_status = 'cancelled' then now() else closed_at end
   where id = p_call_id
  returning * into v_call;

  insert into public.network_call_events (call_id, event_type, actor_profile_id, from_status, to_status, note)
  values (p_call_id, p_to_status, v_me, v_from, p_to_status, p_note);

  return v_call;
end
$$;

comment on function public.transition_network_call(uuid, text, text) is
  'Machine d''etats des appels hors cloture resolue. Transitions non listees interdites au niveau base.';

-- Cloture d'un appel avec mesure d'impact (ISE-054).
-- D-52 : la resolution est TERNAIRE. Aucun faux impact positif n'est
-- enregistre lorsque le besoin n'est pas resolu (D26 §143, test 10).
create or replace function public.close_network_call(
  p_call_id             uuid,
  p_resolution          text,
  p_result_type         text default null,
  p_missing_reason      text default null,
  p_notes               text default null,
  p_testimonial         text default null,
  p_testimonial_consent boolean default false,
  p_contributor_ids     uuid[] default null
)
returns public.network_calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_call   public.network_calls;
  v_from   text;
  v_status text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_resolution is null or p_resolution not in ('resolved', 'partially_resolved', 'not_resolved') then
    raise exception 'invalid_resolution' using errcode = 'P0001';
  end if;

  select * into v_call from public.network_calls where id = p_call_id for update;
  if not found or v_call.deleted_at is not null then
    raise exception 'network_call_not_found' using errcode = 'P0002';
  end if;
  if v_call.author_profile_id <> v_me then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_call.status not in ('active', 'paused', 'expired') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_from   := v_call.status;
  -- Voir l'arbitrage en tete de fichier : not_resolved -> closed.
  v_status := case when p_resolution = 'not_resolved' then 'closed' else 'resolved' end;

  update public.network_calls
     set status                     = v_status,
         resolution                 = p_resolution,
         closure_result_type        = case when p_resolution = 'not_resolved' then null else p_result_type end,
         closure_missing_reason     = case when p_resolution = 'resolved' then null else p_missing_reason end,
         closure_notes              = p_notes,
         impact_testimonial         = p_testimonial,
         impact_testimonial_consent = (p_testimonial is not null and coalesce(p_testimonial_consent, false)),
         closed_at                  = now()
   where id = p_call_id
  returning * into v_call;

  -- Contributeurs reconnus (facultatif). Rejoue sans doublon.
  if p_contributor_ids is not null then
    insert into public.network_call_contributors (call_id, profile_id)
    select p_call_id, c
      from unnest(p_contributor_ids) as c
     where c is not null
    on conflict (call_id, profile_id) do nothing;
  end if;

  insert into public.network_call_events (call_id, event_type, actor_profile_id, from_status, to_status, note)
  values (p_call_id, 'closed:' || p_resolution, v_me, v_from, v_status, p_notes);

  return v_call;
end
$$;

comment on function public.close_network_call(uuid, text, text, text, text, text, boolean, uuid[]) is
  'Cloture ternaire D-52. Un resultat not_resolved met le statut a closed et ne produit AUCUN impact positif.';

-- Expiration automatique (Q-02, D6 §60). Appelee par un job planifie ;
-- reservee aux operations, jamais exposee au membre.
create or replace function public.expire_stale_network_calls()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_row   record;
begin
  for v_row in
    update public.network_calls
       set status = 'expired'
     where status = 'active'
       and deleted_at is null
       and (
         (expires_at is not null and expires_at <= now())
         or (deadline is not null and deadline <= now())
       )
    returning id
  loop
    insert into public.network_call_events (call_id, event_type, from_status, to_status, note)
    values (v_row.id, 'expired', 'active', 'expired', 'auto_expiry');
    v_count := v_count + 1;
  end loop;

  return v_count;
end
$$;

comment on function public.expire_stale_network_calls() is
  'Passe en expired les appels actifs dont l''echeance ou la fenetre de 60 jours (Q-02) est depassee.';

revoke all on function public.expire_stale_network_calls() from public;
