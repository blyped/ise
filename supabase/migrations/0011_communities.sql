-- =====================================================================
-- 0011_communities
-- Module Communautes (ISE-084 -> ISE-087) + tables complementaires du
-- module Promotions (ISE-067 -> ISE-071).
--
-- PRINCIPES APPLIQUES
--   * MASTER PROMPT §1 : AUCUNE mecanique de popularite. Pas de compteur
--     de likes, pas de score social, pas de classement de communautes,
--     pas de « top contributeurs ». Le seul marquage autorise est
--     « reponse utile » pose par l'auteur de la question.
--   * CA-COMM-05 / [U §131-132] : les objets d'autres modules (opportunite,
--     appel au reseau, evenement, projet, actualite) sont REFERENCES,
--     jamais copies. Reference polymorphe volontairement sans FK : les
--     tables cibles appartiennent a d'autres migrations.
--   * D-13 : aucun type ENUM PostgreSQL, uniquement text + CHECK.
--   * D-10 : rattachement metier sur profile_id -> public.ise_profiles(id).
--   * RLS et policies : migration dediee ulterieure (conventions §9).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Communautes
--    Types : country / sector / thematic / special  ([U §125])
--    Creation reservee a l'administration au MVP ([F §17][U §83]) :
--    regle applicative + RLS, pas une contrainte de schema.
-- ---------------------------------------------------------------------
create table if not exists public.communities (
  id                     uuid primary key default extensions.gen_random_uuid(),

  name                   text not null,
  slug                   text not null unique,
  -- Description courte affichee sur les cartes.
  description            text not null,
  -- « Qu'est-ce que cette communaute permet aux ISE de faire ensemble ? »
  -- Question fondamentale [F §108][U §175] : sans reponse claire, pas de communaute.
  purpose                text,
  -- Charte propre a la communaute, en complement de la charte generale [F §77-78].
  charter_text           text,
  cover_image_path       text,

  community_type         text not null
                           check (community_type in ('country', 'sector', 'thematic', 'special')),

  -- Discriminants selon le type. FK vers les referentiels de 0002.
  country_code           char(2) references public.countries(code),
  sector_id              bigint  references public.sectors(id) on delete set null,
  skill_domain_id        bigint  references public.skill_domains(id) on delete set null,

  -- Pas de visibilite « web public » en V1 (D-73, MASTER PROMPT §47).
  visibility             text not null default 'network'
                           check (visibility in ('network', 'private')),
  join_policy            text not null default 'open'
                           check (join_policy in ('open', 'request', 'invitation')),
  -- Publication immediate ou validation prealable, selon la communaute [U §73].
  post_moderation_mode   text not null default 'immediate'
                           check (post_moderation_mode in ('immediate', 'pre_approval')),

  -- Cycle de vie [F §80-81] : relancer / changer le responsable / fusionner / archiver.
  status                 text not null default 'active'
                           check (status in ('draft', 'active', 'inactive', 'merged', 'archived')),
  merged_into_community_id uuid references public.communities(id) on delete set null,

  created_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,

  -- Le discriminant obligatoire depend du type (types country et sector).
  constraint communities_type_discriminant check (
    (community_type <> 'country' or country_code is not null)
    and (community_type <> 'sector' or sector_id is not null)
  ),
  constraint communities_not_merged_into_self
    check (merged_into_community_id is null or merged_into_community_id <> id)
);

create index if not exists communities_type_idx on public.communities(community_type)
  where deleted_at is null;
create index if not exists communities_status_idx on public.communities(status)
  where deleted_at is null;
create index if not exists communities_country_idx     on public.communities(country_code);
create index if not exists communities_sector_idx      on public.communities(sector_id);
create index if not exists communities_skill_domain_idx on public.communities(skill_domain_id);
create index if not exists communities_created_by_idx  on public.communities(created_by_profile_id);
create index if not exists communities_merged_into_idx on public.communities(merged_into_community_id)
  where merged_into_community_id is not null;
create index if not exists communities_name_trgm_idx on public.communities
  using gin (public.normalize_text(name) extensions.gin_trgm_ops);

select private.attach_updated_at('public', 'communities');

comment on table public.communities is
  'Communaute professionnelle. Ni groupe WhatsApp, ni fil social : elle existe pour permettre aux ISE de se trouver et de produire ensemble (MASTER PROMPT §1).';
comment on column public.communities.purpose is
  'Valeur particuliere apportee aux membres. Sans reponse claire, la communaute ne doit pas exister.';

-- ---------------------------------------------------------------------
-- 2. Adhesions
--    Nommage `community_memberships` (et non `community_members` des
--    specifications) : coherence avec `promotion_memberships` de 0003.
--    Roles [F §84][U §128] : member / moderator / manager. Le responsable
--    ANIME, il n'est pas proprietaire de la communaute [F §54][U §79].
-- ---------------------------------------------------------------------
create table if not exists public.community_memberships (
  id                    uuid primary key default extensions.gen_random_uuid(),
  community_id          uuid not null references public.communities(id) on delete cascade,
  profile_id            uuid not null references public.ise_profiles(id) on delete cascade,

  role                  text not null default 'member'
                          check (role in ('member', 'moderator', 'manager')),

  -- Machine d'etats d'adhesion [F §88] :
  --   open       : Rejoindre               -> active immediatement
  --   request    : Demander a rejoindre    -> pending -> active | declined
  --   invitation : adhesion sur invitation -> pending -> active | declined
  --   active -> left (quitter) | suspended (sanction de moderation)
  membership_status     text not null default 'active'
                          check (membership_status in ('pending', 'active', 'declined',
                                                       'suspended', 'left')),

  -- Notifications : ne JAMAIS notifier chaque publication [F §73][U §97].
  -- Defaut recommande [U §99] : important + digest hebdomadaire.
  notification_level    text not null default 'important'
                          check (notification_level in ('all', 'important', 'none')),
  digest_frequency      text not null default 'weekly'
                          check (digest_frequency in ('none', 'daily', 'weekly')),

  requested_at          timestamptz,
  joined_at             timestamptz,
  decided_at            timestamptz,
  decided_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  left_at               timestamptz,
  suspended_until       timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- D-15 : une seule ligne par couple (communaute, profil).
  unique (community_id, profile_id)
);

create index if not exists community_memberships_profile_idx
  on public.community_memberships(profile_id);
create index if not exists community_memberships_community_idx
  on public.community_memberships(community_id, membership_status);
-- File des demandes a traiter par le responsable.
create index if not exists community_memberships_pending_idx
  on public.community_memberships(community_id, requested_at)
  where membership_status = 'pending';
create index if not exists community_memberships_role_idx
  on public.community_memberships(community_id, role)
  where role in ('moderator', 'manager');
create index if not exists community_memberships_decided_by_idx
  on public.community_memberships(decided_by_profile_id);

select private.attach_updated_at('public', 'community_memberships');

comment on table public.community_memberships is
  'Adhesion a une communaute : role et statut. Aucune notion de reputation ni de score de participation (MASTER PROMPT §1).';

-- ---------------------------------------------------------------------
-- 3. Invitations
--    Token jamais stocke en clair : seule l'empreinte (conventions §10).
-- ---------------------------------------------------------------------
create table if not exists public.community_invitations (
  id                    uuid primary key default extensions.gen_random_uuid(),
  community_id          uuid not null references public.communities(id) on delete cascade,
  inviter_profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  invited_profile_id    uuid references public.ise_profiles(id) on delete cascade,
  -- Invitation adressee a un contact non encore reference : empreinte uniquement.
  invited_email_hash    text,
  message               text,
  token_hash            text unique,
  status                text not null default 'sent'
                          check (status in ('sent', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at            timestamptz not null,
  responded_at          timestamptz,
  created_at            timestamptz not null default now(),

  constraint community_invitations_target_present
    check (invited_profile_id is not null or invited_email_hash is not null),
  constraint community_invitations_no_self_invite
    check (invited_profile_id is null or invited_profile_id <> inviter_profile_id)
);

create index if not exists community_invitations_community_idx
  on public.community_invitations(community_id, status);
create index if not exists community_invitations_invited_idx
  on public.community_invitations(invited_profile_id, status);
create index if not exists community_invitations_inviter_idx
  on public.community_invitations(inviter_profile_id);
-- Une seule invitation en cours par (communaute, profil invite) : anti-relance abusive.
create unique index if not exists community_invitations_pending_uidx
  on public.community_invitations(community_id, invited_profile_id)
  where status = 'sent' and invited_profile_id is not null;

-- ---------------------------------------------------------------------
-- 4. Publications
--    9 types [U §130]. Les 4 types « _reference » ne dupliquent jamais
--    l'objet source : ils portent une reference polymorphe.
-- ---------------------------------------------------------------------
create table if not exists public.community_posts (
  id                      uuid primary key default extensions.gen_random_uuid(),
  community_id            uuid not null references public.communities(id) on delete cascade,
  author_profile_id       uuid not null references public.ise_profiles(id) on delete cascade,

  post_type               text not null
                            check (post_type in ('question', 'experience', 'resource', 'analysis',
                                                 'news', 'opportunity_reference',
                                                 'network_call_reference', 'event_reference',
                                                 'project_reference')),
  title                   text not null,
  body                    text,

  -- [F §85] porte une visibilite au niveau du post ; [U §129] non. Conservee :
  -- un contenu peut rester interne a la communaute ou etre ouvert au reseau.
  visibility              text not null default 'community'
                            check (visibility in ('community', 'network')),

  -- Statut de contenu / moderation [F §79], complete du cas « validation prealable » [U §73].
  status                  text not null default 'published'
                            check (status in ('draft', 'pending_review', 'published',
                                              'flagged', 'hidden', 'removed', 'archived')),

  -- Reference vers un objet d'un autre module. AUCUNE FK : la source reste
  -- `opportunities`, `network_calls`, `events`, `projects`, `news` (CA-COMM-05).
  referenced_entity_type  text check (referenced_entity_type is null or referenced_entity_type in
                            ('opportunity', 'network_call', 'event', 'project', 'news')),
  referenced_entity_id    uuid,

  -- Cross-posting autorise, mais une publication canonique est conservee [U §106].
  canonical_post_id       uuid references public.community_posts(id) on delete set null,
  -- Empreinte normalisee du contenu : sert exclusivement a la detection
  -- anti-spam (meme publicite diffusee dans N communautes) [U §105].
  content_fingerprint     text,

  -- Verrouillage de discussion : action de moderation [U §103].
  is_locked               boolean not null default false,
  locked_at               timestamptz,
  locked_by_profile_id    uuid references public.ise_profiles(id) on delete set null,

  published_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,

  -- Un post de type reference doit porter sa reference, et reciproquement.
  constraint community_posts_reference_coherence check (
    (post_type in ('opportunity_reference', 'network_call_reference',
                   'event_reference', 'project_reference'))
      = (referenced_entity_type is not null and referenced_entity_id is not null)
  ),
  constraint community_posts_canonical_not_self
    check (canonical_post_id is null or canonical_post_id <> id),
  constraint community_posts_published_has_date
    check (status <> 'published' or published_at is not null)
);

-- Index de performance exiges par [U §141] + pagination par curseur (D-44).
create index if not exists community_posts_community_published_idx
  on public.community_posts(community_id, published_at desc, id desc)
  where status = 'published' and deleted_at is null;
create index if not exists community_posts_author_idx
  on public.community_posts(author_profile_id, created_at desc);
create index if not exists community_posts_type_idx
  on public.community_posts(community_id, post_type)
  where status = 'published' and deleted_at is null;
create index if not exists community_posts_moderation_idx
  on public.community_posts(community_id, status)
  where status in ('pending_review', 'flagged');
create index if not exists community_posts_reference_idx
  on public.community_posts(referenced_entity_type, referenced_entity_id)
  where referenced_entity_id is not null;
create index if not exists community_posts_canonical_idx
  on public.community_posts(canonical_post_id)
  where canonical_post_id is not null;
create index if not exists community_posts_locked_by_idx
  on public.community_posts(locked_by_profile_id);

select private.attach_updated_at('public', 'community_posts');

comment on table public.community_posts is
  'Publication de communaute. Aucun compteur de vues, de likes ni de reactions : MASTER PROMPT §1 et [U §16].';
comment on column public.community_posts.referenced_entity_id is
  'Reference polymorphe volontairement sans FK : la source reste le module d''origine (CA-COMM-05).';

-- Tags structures d'une publication : ce sont des competences du referentiel,
-- jamais une liste stockee dans un champ texte (MASTER PROMPT §9).
create table if not exists public.community_post_skills (
  post_id  uuid   not null references public.community_posts(id) on delete cascade,
  skill_id bigint not null references public.skills(id) on delete cascade,
  primary key (post_id, skill_id)
);
create index if not exists community_post_skills_skill_idx
  on public.community_post_skills(skill_id);

comment on table public.community_post_skills is
  'Tags d''une publication, resolus sur la taxonomie. Alimente « Questions qui attendent votre experience » [F §52].';

-- ---------------------------------------------------------------------
-- 5. Commentaires
--    Threads simples : « pas besoin d'un systeme Reddit complet » [U §46].
-- ---------------------------------------------------------------------
create table if not exists public.community_comments (
  id                        uuid primary key default extensions.gen_random_uuid(),
  post_id                   uuid not null references public.community_posts(id) on delete cascade,
  author_profile_id         uuid not null references public.ise_profiles(id) on delete cascade,
  parent_comment_id         uuid references public.community_comments(id) on delete cascade,

  body                      text not null,
  status                    text not null default 'published'
                              check (status in ('published', 'flagged', 'hidden', 'removed')),

  -- « Reponse utile » posee par l'auteur de la question [F §53].
  -- Ce n'est ni un vote, ni un classement des personnes : pas de « meilleure
  -- reponse » obligatoire, pas de compteur (MASTER PROMPT §1).
  marked_helpful_at         timestamptz,
  marked_helpful_by_profile_id uuid references public.ise_profiles(id) on delete set null,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,

  constraint community_comments_parent_not_self
    check (parent_comment_id is null or parent_comment_id <> id),
  constraint community_comments_helpful_coherence
    check ((marked_helpful_at is null) = (marked_helpful_by_profile_id is null))
);

create index if not exists community_comments_post_idx
  on public.community_comments(post_id, created_at)
  where deleted_at is null;
create index if not exists community_comments_author_idx
  on public.community_comments(author_profile_id, created_at desc);
create index if not exists community_comments_parent_idx
  on public.community_comments(parent_comment_id)
  where parent_comment_id is not null;
create index if not exists community_comments_helpful_by_idx
  on public.community_comments(marked_helpful_by_profile_id);
create index if not exists community_comments_moderation_idx
  on public.community_comments(status)
  where status = 'flagged';

select private.attach_updated_at('public', 'community_comments');

-- ---------------------------------------------------------------------
-- 6. Actions de moderation
--    « Toute action importante est auditee » [U §104].
--    Le motif s'appuie sur le referentiel unique de signalement (D-66).
--    Le signalement lui-meme vit dans la table generique `reports`
--    (module Support & Moderation, migration ulterieure).
-- ---------------------------------------------------------------------
create table if not exists public.community_moderation_actions (
  id                    uuid primary key default extensions.gen_random_uuid(),
  community_id          uuid not null references public.communities(id) on delete cascade,
  actor_profile_id      uuid not null references public.ise_profiles(id) on delete restrict,

  target_type           text not null
                          check (target_type in ('post', 'comment', 'membership', 'community')),
  target_post_id        uuid references public.community_posts(id) on delete cascade,
  target_comment_id     uuid references public.community_comments(id) on delete cascade,
  target_membership_id  uuid references public.community_memberships(id) on delete cascade,

  action                text not null
                          check (action in ('approve', 'reject', 'hide', 'unhide',
                                            'request_edit', 'lock', 'unlock', 'remove',
                                            'restore', 'suspend_member', 'reinstate_member',
                                            'merge_community', 'archive_community')),
  reason_code           text references public.report_reasons(code),
  reason_text           text,
  created_at            timestamptz not null default now(),

  -- La cible declaree doit etre la seule renseignee.
  constraint community_moderation_actions_target_coherence check (
    case target_type
      when 'post'       then target_post_id is not null and target_comment_id is null and target_membership_id is null
      when 'comment'    then target_comment_id is not null and target_post_id is null and target_membership_id is null
      when 'membership' then target_membership_id is not null and target_post_id is null and target_comment_id is null
      else target_post_id is null and target_comment_id is null and target_membership_id is null
    end
  )
);

create index if not exists community_moderation_actions_community_idx
  on public.community_moderation_actions(community_id, created_at desc);
create index if not exists community_moderation_actions_actor_idx
  on public.community_moderation_actions(actor_profile_id, created_at desc);
create index if not exists community_moderation_actions_post_idx
  on public.community_moderation_actions(target_post_id)
  where target_post_id is not null;
create index if not exists community_moderation_actions_comment_idx
  on public.community_moderation_actions(target_comment_id)
  where target_comment_id is not null;
create index if not exists community_moderation_actions_membership_idx
  on public.community_moderation_actions(target_membership_id)
  where target_membership_id is not null;
create index if not exists community_moderation_actions_reason_idx
  on public.community_moderation_actions(reason_code);

comment on table public.community_moderation_actions is
  'Journal des actions de moderation de communaute. Immuable en usage : on ajoute une action inverse, on ne modifie jamais une ligne.';

-- ---------------------------------------------------------------------
-- 7. Anti-spam
--    Regles [U §105] : meme publicite dans 10 communautes, publication
--    repetee, prospection commerciale agressive.
--    Les compteurs de fenetre glissante reutilisent
--    `private.rate_limit_counters` (D-103) : aucune table n'est recreee ici.
--    Seule l'empreinte de contenu, necessaire a la detection du cross-posting
--    massif, est ajoutee — en schema `private` car c'est un signal d'abus.
-- ---------------------------------------------------------------------
create table if not exists private.community_post_fingerprints (
  id                  bigint generated always as identity primary key,
  author_profile_id   uuid not null references public.ise_profiles(id) on delete cascade,
  community_id        uuid not null references public.communities(id) on delete cascade,
  post_id             uuid references public.community_posts(id) on delete set null,
  content_fingerprint text not null,
  created_at          timestamptz not null default now()
);

-- Detection : meme empreinte, meme auteur, N communautes distinctes sur une fenetre.
create index if not exists community_post_fingerprints_lookup_idx
  on private.community_post_fingerprints(author_profile_id, content_fingerprint, created_at desc);
create index if not exists community_post_fingerprints_community_idx
  on private.community_post_fingerprints(community_id, created_at desc);
create index if not exists community_post_fingerprints_post_idx
  on private.community_post_fingerprints(post_id);
-- Une empreinte n'est comptee qu'une fois par couple (auteur, communaute).
create unique index if not exists community_post_fingerprints_uidx
  on private.community_post_fingerprints(author_profile_id, community_id, content_fingerprint);

-- Seuils anti-spam parametrables sans migration (meme logique que D-71).
create table if not exists private.community_spam_thresholds (
  rule_key    text primary key,
  label       text not null,
  threshold   integer not null check (threshold > 0),
  window_hours integer not null check (window_hours > 0),
  action      text not null default 'flag'
                check (action in ('flag', 'throttle', 'block')),
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);
select private.attach_updated_at('private', 'community_spam_thresholds');

insert into private.community_spam_thresholds (rule_key, label, threshold, window_hours, action)
values
  ('cross_post_same_content', 'Meme contenu publie dans plusieurs communautes', 10, 168, 'block'),
  ('repeated_post_same_community', 'Publications repetees dans la meme communaute', 5, 24, 'throttle'),
  ('commercial_solicitation', 'Sollicitation commerciale signalee', 3, 720, 'flag')
on conflict (rule_key) do nothing;

-- =====================================================================
-- 8. TABLES COMPLEMENTAIRES DU MODULE PROMOTIONS (ISE-067 -> ISE-071)
--
--    Les tables de base (`promotions`, `promotion_memberships`,
--    `promotion_managers`, `promotion_invitations`,
--    `missing_member_suggestions`) EXISTENT DEJA en 0002 et 0003 et ne
--    sont ni recreees ni modifiees ici.
--
--    Les trois tables ci-dessous comblent des besoins du module que
--    0003 ne couvre pas :
--      a) tracer la reponse « Je ne sais pas » a une demande de validation
--         d'appartenance, que le responsable a le droit de donner [U §69] ;
--      b) publier les statistiques partagees de reconstitution [F §98-103] ;
--      c) encadrer les campagnes d'activation par des quotas [F §66].
-- =====================================================================

-- 8a. Validation d'appartenance a une promotion [F §65][U §67-69].
--     Le responsable n'est JAMAIS oblige de trancher : « unknown » est
--     une reponse legitime, elle ne fait pas avancer le statut.
create table if not exists public.promotion_membership_confirmations (
  id                    uuid primary key default extensions.gen_random_uuid(),
  membership_id         uuid not null references public.promotion_memberships(id) on delete cascade,
  responder_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,
  responder_role        text not null default 'peer'
                          check (responder_role in ('peer', 'promotion_manager', 'admin')),
  response              text not null
                          check (response in ('confirmed', 'unknown', 'disputed')),
  comment               text,
  created_at            timestamptz not null default now(),

  -- Une seule reponse courante par (adhesion, repondant) : une nouvelle
  -- reponse remplace la precedente cote applicatif.
  unique (membership_id, responder_profile_id)
);
create index if not exists promotion_membership_confirmations_membership_idx
  on public.promotion_membership_confirmations(membership_id, response);
create index if not exists promotion_membership_confirmations_responder_idx
  on public.promotion_membership_confirmations(responder_profile_id);

comment on table public.promotion_membership_confirmations is
  'Reponses a une demande de validation d''appartenance. « unknown » est une reponse valide : le responsable n''est jamais force de trancher [U §69].';

-- 8b. Statistiques partagees d'une promotion [F §98-103][U §121-125].
--     Instantane date, calcule par lot. Ces chiffres decrivent la
--     reconstitution d'UNE promotion ; ils ne servent JAMAIS a comparer
--     ni a classer les promotions entre elles ([U §126], MASTER PROMPT §1).
create table if not exists public.promotion_stat_snapshots (
  id                    uuid primary key default extensions.gen_random_uuid(),
  promotion_id          bigint not null references public.promotions(id) on delete cascade,
  snapshot_date         date not null default current_date,

  estimated_size        integer not null default 0 check (estimated_size >= 0),
  referenced_count      integer not null default 0 check (referenced_count >= 0),
  contactable_count     integer not null default 0 check (contactable_count >= 0),
  invited_count         integer not null default 0 check (invited_count >= 0),
  activated_count       integer not null default 0 check (activated_count >= 0),
  verified_count        integer not null default 0 check (verified_count >= 0),
  -- Moyenne de completude des profils de la promotion. Agregat uniquement :
  -- le score individuel reste prive (D-72).
  average_completion    smallint not null default 0
                          check (average_completion between 0 and 100),
  -- « Membres retrouves grace au reseau » [F §103][U §124].
  reconnected_count     integer not null default 0 check (reconnected_count >= 0),

  computed_at           timestamptz not null default now(),
  created_at            timestamptz not null default now(),

  unique (promotion_id, snapshot_date)
);
create index if not exists promotion_stat_snapshots_promo_idx
  on public.promotion_stat_snapshots(promotion_id, snapshot_date desc);

comment on table public.promotion_stat_snapshots is
  'Statistiques de reconstitution d''une promotion (funnel estime -> reference -> invite -> active -> verifie). Aucun classement inter-promotions : interdit par [U §126].';

-- 8c. Campagnes d'activation d'une promotion [F §66].
--     Autorisees « mais avec quotas et regles anti-spam ». Le quota est
--     porte par la campagne ; l'envoi de masse sans respect des
--     preferences de notification reste interdit [F §67].
create table if not exists public.promotion_activation_campaigns (
  id                     uuid primary key default extensions.gen_random_uuid(),
  promotion_id           bigint not null references public.promotions(id) on delete cascade,
  created_by_profile_id  uuid not null references public.ise_profiles(id) on delete cascade,

  name                   text not null,
  objective              text,
  channel                text not null default 'in_app'
                           check (channel in ('in_app', 'email')),
  status                 text not null default 'draft'
                           check (status in ('draft', 'scheduled', 'running',
                                             'paused', 'completed', 'cancelled')),

  -- Quotas anti-spam, obligatoires.
  daily_quota            integer not null default 20 check (daily_quota between 1 and 200),
  total_quota            integer check (total_quota is null or total_quota > 0),
  sent_count             integer not null default 0 check (sent_count >= 0),

  starts_at              timestamptz,
  ends_at                timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint promotion_activation_campaigns_dates_order
    check (starts_at is null or ends_at is null or starts_at <= ends_at)
);
create index if not exists promotion_activation_campaigns_promo_idx
  on public.promotion_activation_campaigns(promotion_id, status);
create index if not exists promotion_activation_campaigns_author_idx
  on public.promotion_activation_campaigns(created_by_profile_id);
select private.attach_updated_at('public', 'promotion_activation_campaigns');

comment on table public.promotion_activation_campaigns is
  'Campagne de reactivation d''une promotion. Quota obligatoire : une campagne ne peut pas se transformer en envoi de masse [F §66-67].';
