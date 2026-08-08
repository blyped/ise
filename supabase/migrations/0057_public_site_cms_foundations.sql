-- =====================================================================
-- 0057_public_site_cms_foundations
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- Couche CMS et site public (PUB-001, CMS-001 -> CMS-010).
-- Sources : ADDENDUM AU MASTER PROMPT §8 a §51 ; cahier des charges
-- fonctionnel additionnel §6 a §40 ; docs/cms.md.
--
-- REGLE CARDINALE DE CE LOT
--   Le CMS NE DUPLIQUE AUCUNE DONNEE METIER. Actualites, evenements,
--   opportunites, profils ISE, promotions et organisations continuent de
--   vivre dans leurs tables actuelles. Le CMS n'ajoute qu'une couche
--   d'ORCHESTRATION editoriale : quoi montrer, quand, dans quel ordre.
--   Le rattachement se fait TOUJOURS par entity_type + entity_id
--   (addendum §10), jamais par une URL interne stockee.
--
-- MIGRATION STRICTEMENT ADDITIVE : aucun DROP, aucune reecriture de table
-- existante, aucune remise a zero. Les trois seules tables metier touchees
-- le sont par `add column if not exists`.
--
-- CE QUI EST REUTILISE PLUTOT QUE RECREE (audit complet : docs/cms.md)
--   news.is_featured / featured_at / editorial_status / published_at /
--   image_path / visibility ; events.status / starts_at / visibility ;
--   opportunities.status / deadline / visibility ; expertise_areas ;
--   promotions ; organizations ; profile_expertise_areas ; le bucket
--   Storage `public-assets` (0027) ; private.permissions / roles /
--   user_roles (0004) ; private.log_audit (0018) ; schema analytics (0019).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSION MINIMALE DE ise_profiles  (addendum §15, §16 ; CDC §13)
--
--    DEUX colonnes, pas une de plus. Le teaser « ISE du jour » se compose
--    a la lecture depuis les colonnes existantes (display_name,
--    current_position, current_organization_id, avatar_path, promotion_id)
--    et depuis profile_expertise_areas : rien n'est recopie dans le CMS.
--
--    public_summary existe parce que bio et headline sont des champs
--    INTERNES, rediges pour un lectorat de membres authentifies. Les
--    promouvoir sur le web ouvert sans consentement violerait D-73 et le
--    MASTER PROMPT §47.
--
--    allow_public_feature est faux par defaut : l'opt-in est explicite.
--    L'exclusion temporaire (addendum §22) N'EST PAS une colonne de profil :
--    c'est un acte editorial, porte par cms_content_overrides
--    (override_kind = 'exclude'). Voir docs/featured-profile.md.
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  add column if not exists public_summary        text,
  add column if not exists allow_public_feature  boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ise_profiles'::regclass
      and conname  = 'ise_profiles_public_summary_length'
  ) then
    alter table public.ise_profiles
      add constraint ise_profiles_public_summary_length
      check (
        public_summary is null
        or char_length(btrim(public_summary)) between 40 and 400
      );
  end if;
end $$;

comment on column public.ise_profiles.public_summary is
  'Resume PUBLIC-SAFE, 40 a 400 caracteres, redige par le membre en sachant qu''il peut paraitre sur PUB-001. Distinct de bio et headline, qui restent internes (D-73, addendum §16).';
comment on column public.ise_profiles.allow_public_feature is
  'Consentement explicite a la mise en avant publique (« ISE du jour »). FAUX par defaut (addendum §15, CDC §15).';

-- Depuis 0028, `authenticated` n'a plus de privilege SELECT/UPDATE/INSERT au
-- niveau TABLE sur ise_profiles mais colonne par colonne. Toute colonne
-- ajoutee doit etre GRANT-ee explicitement, sinon elle est invisible et non
-- modifiable meme par son proprietaire.
grant select (public_summary, allow_public_feature) on public.ise_profiles to authenticated;
grant update (public_summary, allow_public_feature) on public.ise_profiles to authenticated;
grant insert (public_summary, allow_public_feature) on public.ise_profiles to authenticated;

-- Index de selection « ISE du jour » : le predicat d'eligibilite complet.
create index if not exists ise_profiles_public_feature_idx
  on public.ise_profiles (promotion_id, id)
  where allow_public_feature
    and public_summary is not null
    and profile_status = 'active'
    and deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. MISE EN AVANT LANDING SUR LES TABLES METIER (addendum §11, §12, §13)
--
--    STRICT MINIMUM. news.is_featured et news.featured_at EXISTENT DEJA
--    (0013) : elles sont reutilisees telles quelles pour « A la une ».
--    Ce qui manquait reellement :
--      * une eligibilite landing distincte de la visibilite membre. La
--        colonne visibility (members / promotion / community) exprime a
--        QUI un contenu s'adresse DANS le reseau ; elle ne dit pas s'il
--        peut paraitre sur le web ouvert. Confondre les deux publierait
--        automatiquement des contenus de promotion.
--      * un ordre editorial stable : landing_priority.
--
--    AUCUNE colonne public_teaser : le teaser se compose a la lecture
--    depuis summary (news), title (events) et les champs autorises
--    d'opportunities. Dupliquer le texte creerait deux verites.
-- ---------------------------------------------------------------------
alter table public.news
  add column if not exists landing_visibility text     not null default 'hidden',
  add column if not exists landing_priority   smallint not null default 0;

alter table public.events
  add column if not exists landing_visibility text     not null default 'hidden',
  add column if not exists landing_priority   smallint not null default 0;

alter table public.opportunities
  add column if not exists landing_visibility text     not null default 'hidden',
  add column if not exists landing_priority   smallint not null default 0;

do $$
declare r record;
begin
  for r in select unnest(array['news','events','opportunities']) as t loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = ('public.' || r.t)::regclass
        and conname  = r.t || '_landing_visibility_check'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (landing_visibility in (''hidden'', ''visible''))',
        r.t, r.t || '_landing_visibility_check');
    end if;
    if not exists (
      select 1 from pg_constraint
      where conrelid = ('public.' || r.t)::regclass
        and conname  = r.t || '_landing_priority_range'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (landing_priority between 0 and 1000)',
        r.t, r.t || '_landing_priority_range');
    end if;
  end loop;
end $$;

comment on column public.news.landing_visibility is
  'Eligibilite a PUB-001. Distincte de visibility, qui designe l''audience INTERNE (addendum §11).';
comment on column public.events.landing_visibility is
  'Eligibilite a PUB-001, distincte de l''audience interne visibility (addendum §12).';
comment on column public.opportunities.landing_visibility is
  'Eligibilite au TEASER public de PUB-001. Le detail complet reste authentifie (addendum §13).';

create index if not exists news_landing_idx
  on public.news (landing_priority desc, published_at desc, id desc)
  where landing_visibility = 'visible' and editorial_status = 'published' and deleted_at is null;

create index if not exists events_landing_idx
  on public.events (landing_priority desc, starts_at asc, id desc)
  where landing_visibility = 'visible' and status = 'published' and deleted_at is null;

create index if not exists opportunities_landing_idx
  on public.opportunities (landing_priority desc, published_at desc, id desc)
  where landing_visibility = 'visible' and status = 'active' and deleted_at is null;

-- ---------------------------------------------------------------------
-- 3. VOCABULAIRES PARTAGES (D-13 : text + CHECK, jamais un type ENUM)
-- ---------------------------------------------------------------------
create or replace function public.is_cms_status(v text)
returns boolean language sql immutable as $$
  select v in ('draft', 'scheduled', 'published', 'expired', 'archived')
$$;

comment on function public.is_cms_status(text) is
  'Cycle de vie unique de tout contenu CMS (addendum §30). Transitions exclusivement par les fonctions serveur de 0059.';

create or replace function public.is_cms_entity_type(v text)
returns boolean language sql immutable as $$
  select v in ('news', 'event', 'opportunity', 'profile', 'promotion',
               'organization', 'community', 'project', 'network_call',
               'expertise_area', 'external')
$$;

comment on function public.is_cms_entity_type(text) is
  'Types d''objets referencables par le CMS (addendum §10). entity_type + entity_id remplace toute URL interne stockee.';

-- ---------------------------------------------------------------------
-- 4. CMS_MEDIA_ASSETS (CMS-008, addendum §38, §39 ; CDC §33, §34)
--    Supabase Storage detient les octets ; la base detient les metadonnees
--    et les references d'usage. Le bucket public-assets existe deja (0027).
--    alt_text est NOT NULL : un media sans alternative textuelle n'est pas
--    publiable (addendum §52, CDC §47).
-- ---------------------------------------------------------------------
create table if not exists public.cms_media_assets (
  id                      uuid primary key default extensions.gen_random_uuid(),
  bucket_id               text not null default 'public-assets'
                            check (bucket_id in ('public-assets')),
  storage_path            text not null,
  filename                text not null,
  mime_type               text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  width                   integer check (width  is null or width  between 1 and 20000),
  height                  integer check (height is null or height between 1 and 20000),
  size_bytes              bigint  check (size_bytes is null or size_bytes between 1 and 5242880),
  alt_text                text not null check (char_length(btrim(alt_text)) >= 3),
  credit                  text,
  variant_kind            text not null default 'original'
                            check (variant_kind in ('original', 'desktop', 'mobile', 'thumbnail')),
  source_media_id         uuid references public.cms_media_assets(id) on delete cascade,
  created_by_profile_id   uuid references public.ise_profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  constraint cms_media_assets_variant_coherence check (
    (variant_kind = 'original' and source_media_id is null)
    or (variant_kind <> 'original' and source_media_id is not null)
  )
);

create unique index if not exists cms_media_assets_path_uidx
  on public.cms_media_assets (bucket_id, storage_path);
create index if not exists cms_media_assets_source_idx
  on public.cms_media_assets (source_media_id) where source_media_id is not null;
create index if not exists cms_media_assets_live_idx
  on public.cms_media_assets (created_at desc, id desc) where deleted_at is null;
create index if not exists cms_media_assets_search_idx
  on public.cms_media_assets using gin (public.normalize_text(filename) extensions.gin_trgm_ops);

select private.attach_updated_at('public', 'cms_media_assets');

comment on table public.cms_media_assets is
  'Mediatheque CMS-008 : metadonnees des visuels stockes dans le bucket public-assets (0027). Le fichier vit dans Storage, jamais dans la base.';

-- ---------------------------------------------------------------------
-- 5. CMS_SECTIONS (CMS-003, addendum §33 ; CDC §28)
--
--    Separation brouillon / version publiee (addendum §48) et rollback
--    (addendum §49) : chaque table publiable porte
--      * ses colonnes vivantes         = LE BROUILLON,
--      * published_snapshot            = ce que voit le site public,
--      * previous_published_snapshot   = la cible du rollback.
--    Les fonctions de PUB-001 lisent le snapshot, jamais les colonnes
--    vivantes : une edition en cours n'atteint pas le site (§48), et si le
--    CMS tombe, la derniere version publiee reste servie (§47).
-- ---------------------------------------------------------------------
create table if not exists public.cms_sections (
  id                            uuid primary key default extensions.gen_random_uuid(),
  section_key                   text not null,
  title                         text,
  subtitle                      text,
  is_enabled                    boolean  not null default true,
  display_order                 smallint not null default 0 check (display_order between 0 and 1000),
  source_mode                   text not null default 'automatic'
                                  check (source_mode in ('automatic', 'manual', 'hybrid')),
  max_items                     smallint not null default 3 check (max_items between 0 and 24),
  cta_label                     text,
  cta_entity_type               text check (cta_entity_type is null or public.is_cms_entity_type(cta_entity_type)),
  cta_entity_id                 uuid,
  configuration                 jsonb not null default '{}'::jsonb,
  is_structural                 boolean not null default false,
  status                        text not null default 'draft' check (public.is_cms_status(status)),
  published_snapshot            jsonb,
  previous_published_snapshot   jsonb,
  published_at                  timestamptz,
  published_by_profile_id       uuid references public.ise_profiles(id) on delete set null,
  created_by_profile_id         uuid references public.ise_profiles(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint cms_sections_published_has_snapshot check (
    status <> 'published' or (published_snapshot is not null and published_at is not null)
  )
);

create unique index if not exists cms_sections_key_uidx on public.cms_sections (section_key);
create index if not exists cms_sections_order_idx
  on public.cms_sections (display_order, section_key) where status = 'published' and is_enabled;

select private.attach_updated_at('public', 'cms_sections');

comment on table public.cms_sections is
  'CMS-003 : squelette de PUB-001 (ordre, visibilite, source automatique/manuelle, nombre de cartes). Aucun contenu metier.';
comment on column public.cms_sections.published_snapshot is
  'Configuration REELLEMENT servie au site public (addendum §48). Les colonnes vivantes sont le brouillon.';
comment on column public.cms_sections.previous_published_snapshot is
  'Version publiee precedente. Cible du rollback en un appel (addendum §49).';

-- ---------------------------------------------------------------------
-- 6. CMS_PARTNER_CAMPAIGNS (CMS-007, addendum §25, §26, §27 ; CDC §7, §32)
--    Declaree AVANT cms_carousel_items : une slide sponsorisee la reference.
--    sponsored_label est NOT NULL : la transparence n'est pas une option.
-- ---------------------------------------------------------------------
create table if not exists public.cms_partner_campaigns (
  id                            uuid primary key default extensions.gen_random_uuid(),
  organization_id               uuid not null references public.organizations(id) on delete restrict,
  campaign_name                 text not null check (char_length(btrim(campaign_name)) >= 3),
  admin_contact_profile_id      uuid references public.ise_profiles(id) on delete set null,
  placement                     text not null
                                  check (placement in ('carousel', 'partners_band', 'news_inline', 'sidebar', 'footer')),
  title                         text,
  description                   text,
  media_id                      uuid references public.cms_media_assets(id) on delete set null,
  mobile_media_id               uuid references public.cms_media_assets(id) on delete set null,
  cta_label                     text,
  target_entity_type            text check (target_entity_type is null or public.is_cms_entity_type(target_entity_type)),
  target_entity_id              uuid,
  target_url                    text check (target_url is null or target_url ~ '^https://'),
  sponsored_label               text not null check (char_length(btrim(sponsored_label)) >= 3),
  start_at                      timestamptz not null,
  end_at                        timestamptz not null,
  status                        text not null default 'draft' check (public.is_cms_status(status)),
  published_snapshot            jsonb,
  previous_published_snapshot   jsonb,
  published_at                  timestamptz,
  published_by_profile_id       uuid references public.ise_profiles(id) on delete set null,
  expired_at                    timestamptz,
  created_by_profile_id         uuid references public.ise_profiles(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint cms_partner_campaigns_period       check (end_at > start_at),
  constraint cms_partner_campaigns_entity_pair  check ((target_entity_type is null) = (target_entity_id is null)),
  constraint cms_partner_campaigns_has_target   check (
    target_entity_id is not null or target_url is not null
  ),
  constraint cms_partner_campaigns_published_has_snapshot check (
    status <> 'published' or (published_snapshot is not null and published_at is not null)
  )
);

create index if not exists cms_partner_campaigns_live_idx
  on public.cms_partner_campaigns (placement, start_at, end_at) where status = 'published';
create index if not exists cms_partner_campaigns_org_idx
  on public.cms_partner_campaigns (organization_id);
create index if not exists cms_partner_campaigns_expiry_idx
  on public.cms_partner_campaigns (end_at) where status in ('published', 'scheduled');

select private.attach_updated_at('public', 'cms_partner_campaigns');

comment on table public.cms_partner_campaigns is
  'CMS-007 : campagnes partenaires. sponsored_label est NOT NULL : aucune campagne ne peut exister sans mention de transparence (addendum §26). Expiration automatique a end_at (§27).';
comment on column public.cms_partner_campaigns.sponsored_label is
  'Mention affichee obligatoirement : « Partenaire », « Sponsorise », « Contenu partenaire » (CDC §7).';

-- ---------------------------------------------------------------------
-- 7. CMS_CAROUSEL_ITEMS (CMS-002, addendum §9, §32 ; CDC §6, §27)
-- ---------------------------------------------------------------------
create table if not exists public.cms_carousel_items (
  id                            uuid primary key default extensions.gen_random_uuid(),
  title                         text not null check (char_length(btrim(title)) >= 3),
  subtitle                      text,
  description                   text,
  media_id                      uuid references public.cms_media_assets(id) on delete set null,
  mobile_media_id               uuid references public.cms_media_assets(id) on delete set null,
  content_type                  text not null default 'institutional'
                                  check (content_type in ('event', 'news', 'opportunity', 'program',
                                                          'initiative', 'partner', 'institutional')),
  entity_type                   text check (entity_type is null or public.is_cms_entity_type(entity_type)),
  entity_id                     uuid,
  cta_label                     text,
  start_at                      timestamptz,
  end_at                        timestamptz,
  priority                      smallint not null default 0 check (priority between 0 and 1000),
  is_sponsored                  boolean not null default false,
  partner_campaign_id           uuid references public.cms_partner_campaigns(id) on delete set null,
  status                        text not null default 'draft' check (public.is_cms_status(status)),
  published_snapshot            jsonb,
  previous_published_snapshot   jsonb,
  published_at                  timestamptz,
  published_by_profile_id       uuid references public.ise_profiles(id) on delete set null,
  expired_at                    timestamptz,
  created_by_profile_id         uuid references public.ise_profiles(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint cms_carousel_items_period      check (end_at is null or start_at is null or end_at > start_at),
  constraint cms_carousel_items_entity_pair check ((entity_type is null) = (entity_id is null)),
  constraint cms_carousel_items_sponsored_traceable check (
    is_sponsored = (partner_campaign_id is not null)
  ),
  constraint cms_carousel_items_published_has_snapshot check (
    status <> 'published' or (published_snapshot is not null and published_at is not null)
  )
);

create index if not exists cms_carousel_items_live_idx
  on public.cms_carousel_items (priority desc, created_at desc, id desc) where status = 'published';
create index if not exists cms_carousel_items_entity_idx
  on public.cms_carousel_items (entity_type, entity_id) where entity_id is not null;
create index if not exists cms_carousel_items_campaign_idx
  on public.cms_carousel_items (partner_campaign_id) where partner_campaign_id is not null;
create index if not exists cms_carousel_items_expiry_idx
  on public.cms_carousel_items (end_at) where status in ('published', 'scheduled') and end_at is not null;

select private.attach_updated_at('public', 'cms_carousel_items');

comment on table public.cms_carousel_items is
  'CMS-002 : slides du carrousel principal. Chaque slide pointe une ressource reelle par entity_type + entity_id (addendum §10). Une slide sponsorisee est rattachee a sa campagne, qui porte la mention obligatoire (§26).';

-- ---------------------------------------------------------------------
-- 8. CMS_PUBLICATION_SCHEDULE (CMS-009, addendum §40 ; CDC §35)
--    Table COMMUNE volontairement : le calendrier CMS-009 doit montrer sur
--    une seule ligne de temps actualites, evenements, slides, campagnes et
--    sections. Une colonne publish_at par table l'aurait rendu impossible.
-- ---------------------------------------------------------------------
create table if not exists public.cms_publication_schedule (
  id                      uuid primary key default extensions.gen_random_uuid(),
  entity_type             text not null check (entity_type in (
                            'news', 'event', 'opportunity',
                            'cms_carousel_item', 'cms_partner_campaign', 'cms_section')),
  entity_id               uuid not null,
  publish_at              timestamptz,
  unpublish_at            timestamptz,
  status                  text not null default 'pending'
                            check (status in ('pending', 'applied', 'cancelled', 'failed')),
  applied_at              timestamptz,
  last_run_at             timestamptz,
  run_count               integer not null default 0 check (run_count >= 0),
  last_error              text,
  created_by_profile_id   uuid references public.ise_profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint cms_publication_schedule_has_date check (publish_at is not null or unpublish_at is not null),
  constraint cms_publication_schedule_order    check (
    publish_at is null or unpublish_at is null or unpublish_at > publish_at
  )
);

create unique index if not exists cms_publication_schedule_pending_uidx
  on public.cms_publication_schedule (entity_type, entity_id) where status = 'pending';
create index if not exists cms_publication_schedule_due_idx
  on public.cms_publication_schedule (publish_at) where status = 'pending' and publish_at is not null;
create index if not exists cms_publication_schedule_unpublish_idx
  on public.cms_publication_schedule (unpublish_at) where status = 'pending' and unpublish_at is not null;

select private.attach_updated_at('public', 'cms_publication_schedule');

comment on table public.cms_publication_schedule is
  'CMS-009 : calendrier commun de programmation. Une seule table pour que le calendrier montre actualites, evenements, slides et campagnes sur la meme ligne de temps.';

-- ---------------------------------------------------------------------
-- 9. CMS_CONTENT_OVERRIDES (addendum §43 ; CDC §38)
--    Primitive generique « source automatique + override editorial » :
--    epingler, exclure, masquer, pendant une periode bornee. A expiration,
--    le systeme revient de lui-meme a la source automatique.
--    Porte aussi l'exclusion d'un profil de « ISE du jour » (addendum §22).
-- ---------------------------------------------------------------------
create table if not exists public.cms_content_overrides (
  id                      uuid primary key default extensions.gen_random_uuid(),
  section_key             text not null references public.cms_sections(section_key) on delete cascade,
  override_kind           text not null check (override_kind in ('pin', 'exclude', 'hide')),
  entity_type             text check (entity_type is null or public.is_cms_entity_type(entity_type)),
  entity_id               uuid,
  display_position        smallint check (display_position is null or display_position between 0 and 100),
  starts_at               timestamptz not null default now(),
  ends_at                 timestamptz,
  reason                  text,
  created_by_profile_id   uuid references public.ise_profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint cms_content_overrides_period      check (ends_at is null or ends_at > starts_at),
  constraint cms_content_overrides_entity_pair check ((entity_type is null) = (entity_id is null)),
  constraint cms_content_overrides_target check (
    (override_kind = 'hide'  and entity_id is null)
    or (override_kind in ('pin', 'exclude') and entity_id is not null)
  )
);

create index if not exists cms_content_overrides_active_idx
  on public.cms_content_overrides (section_key, override_kind, starts_at, ends_at);
create index if not exists cms_content_overrides_entity_idx
  on public.cms_content_overrides (entity_type, entity_id) where entity_id is not null;

select private.attach_updated_at('public', 'cms_content_overrides');

comment on table public.cms_content_overrides is
  'Override editorial borne dans le temps au-dessus d''une source automatique (addendum §43). Porte aussi l''exclusion temporaire d''un profil de « ISE du jour » (§22).';

-- ---------------------------------------------------------------------
-- 10. ISE DU JOUR : REGLES ET HISTORIQUE (addendum §14 a §22 ; CDC §12 a §20)
--     AUCUN SIGNAL DE POPULARITE (addendum §19) : ni connexions, ni
--     messages, ni likes, ni score reseau. Les reglages ci-dessous ne
--     permettent PAS d'exprimer un classement de merite, seulement une
--     rotation editoriale equitable.
-- ---------------------------------------------------------------------
create table if not exists public.cms_featured_profile_rules (
  id                          uuid primary key default extensions.gen_random_uuid(),
  rule_key                    text not null default 'default',
  min_days_between_features   integer not null default 90 check (min_days_between_features between 1 and 3650),
  require_claimed_profile     boolean not null default true,
  require_avatar              boolean not null default false,
  require_promotion           boolean not null default true,
  require_expertise_or_position boolean not null default true,
  balance_dimension           text not null default 'promotion'
                                check (balance_dimension in ('none', 'promotion', 'country', 'sector', 'expertise')),
  is_automation_enabled       boolean not null default true,
  is_active                   boolean not null default true,
  updated_by_profile_id       uuid references public.ise_profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create unique index if not exists cms_featured_profile_rules_key_uidx
  on public.cms_featured_profile_rules (rule_key);
create unique index if not exists cms_featured_profile_rules_active_uidx
  on public.cms_featured_profile_rules (is_active) where is_active;

select private.attach_updated_at('public', 'cms_featured_profile_rules');

comment on table public.cms_featured_profile_rules is
  'CMS-006 : parametres de selection de « ISE du jour ». Une seule ligne active. Aucun parametre n''exprime une popularite : l''addendum §19 l''interdit.';

create table if not exists public.cms_featured_profile_history (
  id                      uuid primary key default extensions.gen_random_uuid(),
  profile_id              uuid not null references public.ise_profiles(id) on delete cascade,
  featured_date           date not null,
  selection_mode          text not null check (selection_mode in ('automatic', 'manual', 'fallback')),
  selected_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  status                  text not null default 'published'
                            check (status in ('scheduled', 'published', 'superseded')),
  published_at            timestamptz,
  selection_context       jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  constraint cms_featured_profile_history_manual_actor check (
    selection_mode <> 'manual' or selected_by_profile_id is not null
  ),
  constraint cms_featured_profile_history_published_dated check (
    status <> 'published' or published_at is not null
  )
);

create unique index if not exists cms_featured_profile_history_date_uidx
  on public.cms_featured_profile_history (featured_date) where status in ('scheduled', 'published');
create index if not exists cms_featured_profile_history_profile_idx
  on public.cms_featured_profile_history (profile_id, featured_date desc);

comment on table public.cms_featured_profile_history is
  'Historique des mises en avant « ISE du jour ». Ne stocke AUCUNE donnee de profil : seulement qui, quand, selon quel mode. Le teaser est recompose depuis ise_profiles a chaque lecture (addendum §15).';
comment on column public.cms_featured_profile_history.selection_context is
  'Trace de la decision : regle appliquee, taille du vivier, dimension d''equilibrage. Rend la selection rejouable (addendum §20). Aucune donnee personnelle.';

-- ---------------------------------------------------------------------
-- 11. RLS ACTIVEE ET FORCEE (conventions §9 ; refus par defaut).
--     Les politiques arrivent en 0058. Sans elles, ces tables sont fermees
--     a tout le monde : c'est l'etat souhaite entre les deux migrations.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select unnest(array[
      'cms_media_assets', 'cms_sections', 'cms_partner_campaigns',
      'cms_carousel_items', 'cms_publication_schedule', 'cms_content_overrides',
      'cms_featured_profile_rules', 'cms_featured_profile_history'
    ]) as t
  loop
    execute format('alter table public.%I enable row level security', r.t);
    execute format('alter table public.%I force  row level security', r.t);
    execute format('revoke all on public.%I from anon', r.t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12. SQUELETTE DE LA LANDING (seed idempotent).
--     Les sections sont creees en `draft` : publier une section vide
--     afficherait un bloc creux. C'est le CMS qui decide, pas la migration.
-- ---------------------------------------------------------------------
insert into public.cms_sections (section_key, title, subtitle, is_enabled, display_order,
                                 source_mode, max_items, is_structural, status)
values
  ('hero_carousel',       'A la une',                  null, true,  10, 'manual',    5, true,  'draft'),
  ('network_highlights',  'A la une du reseau',        null, true,  20, 'hybrid',    4, false, 'draft'),
  ('news',                'Actualites',                null, true,  30, 'automatic', 3, true,  'draft'),
  ('events',              'Prochains evenements',      null, true,  40, 'automatic', 3, true,  'draft'),
  ('opportunities',       'Opportunites ouvertes',     null, true,  50, 'automatic', 3, true,  'draft'),
  ('featured_profile',    'ISE du jour',               null, true,  60, 'automatic', 1, true,  'draft'),
  ('expertises',          'Explorer les expertises',   null, true,  70, 'automatic', 8, true,  'draft'),
  ('network_stats',       'Le reseau en chiffres',     null, true,  80, 'automatic', 4, true,  'draft'),
  ('partners',            'Nos partenaires',           null, true,  90, 'automatic', 6, true,  'draft')
on conflict (section_key) do nothing;

insert into public.cms_featured_profile_rules (rule_key) values ('default')
on conflict (rule_key) do nothing;
