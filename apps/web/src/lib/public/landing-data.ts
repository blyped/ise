import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicEnv } from '@/lib/env';
import { isEntityType, type EntityRef } from './entity-routes';

/**
 * ADDENDUM §8, §21, §23, §26, §42, §46, §47 — Couche de donnees de PUB-001.
 *
 * Regles tenues par ce fichier, et par lui seul :
 *  - **aucune donnee metier n'est ecrite ici**. Pas un nom, pas un chiffre,
 *    pas une carte. Les nombres des maquettes (1842, 37, 29, 126) sont
 *    illustratifs et n'existent nulle part dans le code ;
 *  - la landing lit les projections `public-safe` livrees par les migrations
 *    0057 -> 0066. Chaque parseur est ecrit sur la **forme reellement
 *    observee** de la fonction, pas sur une forme supposee ;
 *  - une projection en panne ne casse ni sa section ni la page : la section
 *    reprend sa derniere version valide, ou se declare `indisponible` (§47) ;
 *  - la lecture est mise en cache et invalidee par etiquette (§46).
 *
 * Formes observees sur la base du projet, par appel reel des neuf fonctions :
 *
 *   get_landing_carousel()             -> tableau { id, title, subtitle, description,
 *                                         content_type, entity_type, entity_id, cta_label,
 *                                         priority, media, mobile_media, is_sponsored,
 *                                         sponsored_label }
 *   get_landing_carousel_settings()    -> **objet** { autoplay_seconds } (0111, D-163).
 *                                         Reglage global (`platform_settings`), borne 3-60
 *                                         cote base ; repli 7 si la lecture echoue.
 *   get_landing_sections()             -> tableau { section_key, title, subtitle,
 *                                         display_order, source_mode, max_items, cta_label,
 *                                         cta_entity_type, cta_entity_id, configuration }
 *   get_landing_news(p_limit)          -> tableau { id, entity_type:'news', title, slug,
 *                                         summary, category_code, image, published_at,
 *                                         is_featured, is_pinned }
 *   get_landing_events(p_limit)        -> tableau { id, entity_type:'event', title, slug,
 *                                         event_type_code, starts_at, ends_at, timezone,
 *                                         format, city, country_code, is_pinned }
 *   get_landing_opportunities(p_limit) -> tableau { id, entity_type:'opportunity', title,
 *                                         opportunity_type, contract_type, sector,
 *                                         country_code, city, remote_allowed, deadline,
 *                                         organization, is_pinned }
 *   get_landing_featured_profile()     -> objet **ou `null`** { entity_type:'profile',
 *                                         profile_id, display_name,
 *                                         promotion{id,name,graduation_year},
 *                                         current_position, organization, public_summary,
 *                                         expertise_areas[], photo, tagline, featured_date,
 *                                         selection_mode }
 *                                       (0068 : `avatar_path` a ete RETIRE de la
 *                                        projection — D-135. 0112 : `photo` et
 *                                        `tagline` AJOUTES — D-165. `photo` est un
 *                                        media de la mediatheque PUBLIQUE choisi par
 *                                        l'admin, jamais l'avatar prive du membre.)
 *   get_landing_expertises(p_limit)    -> tableau { id:**nombre**,
 *                                         entity_type:'expertise_area', name, slug,
 *                                         description, profile_count }
 *   get_landing_partners(p_placement)  -> tableau { id, entity_type:'organization',
 *                                         organization_id, organization_name,
 *                                         organization_logo (media), campaign_name,
 *                                         placement, title, description, cta_label,
 *                                         target_entity_type, target_entity_id, target_url,
 *                                         sponsored_label, media, mobile_media }
 *   get_landing_stats()                -> **objet** { profiles{value,source},
 *                                         promotions{...}, countries{...},
 *                                         organizations{...}, computed_at }
 *
 * Trois pieges que ces formes reservent, et qui sont traites ici :
 *  - `get_landing_expertises()` renvoie un `id` **numerique** (bigint) la ou
 *    toutes les autres projections renvoient des UUID textuels ;
 *  - `get_landing_stats()` et `get_landing_featured_profile()` ne renvoient
 *    **pas** un tableau ;
 *  - `get_landing_featured_profile()` renvoie `null` quand aucun profil n'est
 *    eligible : c'est un etat nominal, pas une panne (§21).
 */

/** Etiquette de cache unique de PUB-001 (ADDENDUM §46). */
export const LANDING_CACHE_TAG = 'pub-001-landing';

/** Duree de revalidation, en secondes. */
export const LANDING_REVALIDATE_SECONDS = 300;

/**
 * Delai au-dela duquel une projection est consideree en panne. Une landing
 * publique ne peut pas attendre indefiniment une agregation (§47).
 */
export const LANDING_RPC_TIMEOUT_MS = 4000;

/** Noms des projections `public-safe` lues par PUB-001. */
export const LANDING_FUNCTIONS = {
  carousel: 'get_landing_carousel',
  carouselSettings: 'get_landing_carousel_settings',
  sections: 'get_landing_sections',
  news: 'get_landing_news',
  events: 'get_landing_events',
  opportunities: 'get_landing_opportunities',
  featuredProfile: 'get_landing_featured_profile',
  expertises: 'get_landing_expertises',
  partners: 'get_landing_partners',
  stats: 'get_landing_stats',
} as const;

/**
 * Cles de section telles qu'elles existent dans `cms_sections`. Elles servent
 * a rattacher un reglage editorial a une section rendue, et d'etiquette
 * `section_key` aux evenements d'analytique (§50).
 */
export const LANDING_SECTION_KEYS = {
  carousel: 'hero_carousel',
  highlights: 'network_highlights',
  news: 'news',
  events: 'events',
  opportunities: 'opportunities',
  featuredProfile: 'featured_profile',
  expertises: 'expertises',
  stats: 'network_stats',
  partners: 'partners',
} as const;

export type LandingSectionKey = (typeof LANDING_SECTION_KEYS)[keyof typeof LANDING_SECTION_KEYS];

/**
 * Quantites demandees a la base. Volontairement superieures au nombre
 * reellement affiche : le reglage `max_items` du CMS est applique **apres**
 * lecture, ce qui evite un second aller-retour pour connaitre la limite.
 * Les projections plafonnent elles-memes a 24.
 */
const FETCH_LIMITS = { news: 12, events: 12, opportunities: 12, expertises: 24 } as const;

/** Nombre d'elements affiches par defaut, quand le CMS ne dit rien. */
const DEFAULT_MAX_ITEMS: Record<string, number> = {
  [LANDING_SECTION_KEYS.carousel]: 5,
  [LANDING_SECTION_KEYS.news]: 1,
  [LANDING_SECTION_KEYS.events]: 1,
  [LANDING_SECTION_KEYS.opportunities]: 1,
  [LANDING_SECTION_KEYS.expertises]: 8,
  [LANDING_SECTION_KEYS.partners]: 3,
};

// ---------------------------------------------------------------------------
// Interface par section
// ---------------------------------------------------------------------------

export type SectionStatus = 'ok' | 'indisponible';

export interface LandingSection<TItem> {
  readonly status: SectionStatus;
  readonly items: readonly TItem[];
  /** Motif technique, journalise ; jamais affiche a l'utilisateur. */
  readonly reason?: string;
  /** `true` si la lecture a echoue et que la version precedente est servie. */
  readonly stale?: boolean;
}

/**
 * Media editorial du CMS, tel que la vitrine peut l'afficher.
 *
 * `alt` est **obligatoire et non vide** : c'est le contrat, pas une
 * recommandation. `cms_media_assets.alt_text` est `NOT NULL` en base, la
 * projection le reverifie, et `parseMedia()` le reverifie une troisieme fois.
 * Un media sans alternative textuelle n'est pas un media incomplet : c'est un
 * media **non publiable** (ADDENDUM §52). Il est donc ecarte, et la section
 * s'affiche sans image plutot qu'avec une image que personne ne peut decrire.
 */
export interface LandingMedia {
  readonly bucket: string;
  readonly path: string;
  readonly alt: string;
  readonly credit: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

/** Le seul bucket public de la plateforme (migration 0068, D-134). */
export const LANDING_MEDIA_BUCKET = 'landing-media';

/**
 * Buckets Storage reellement publics.
 *
 * Un seul, et c'est delibere : `avatars`, `profile-documents`,
 * `message-attachments`, `verification-documents`, `admin-imports`,
 * `project-assets`, `support-attachments` et `public-assets` restent prives
 * (MASTER PROMPT §12, §47 ; D-73). `private.storage_baseline_violations()`
 * fait echouer la CI si l'un d'eux devient public.
 */
export const PUBLIC_MEDIA_BUCKETS: readonly string[] = [LANDING_MEDIA_BUCKET];

/** Longueur minimale d'une alternative textuelle, alignee sur la contrainte SQL. */
export const MEDIA_ALT_MIN_LENGTH = 3;

/**
 * URL publique reelle d'un media, ou `null`.
 *
 * Forme servie par Supabase Storage pour un bucket public :
 *   {SUPABASE_URL}/storage/v1/object/public/{bucket}/{chemin}
 *
 * Trois refus explicites, dans cet ordre :
 *  - pas de media ;
 *  - media dans un bucket qui n'est pas public — fabriquer l'URL produirait
 *    un 400 et une image cassee ;
 *  - alternative textuelle absente (verifiee par `parseMedia`, redite ici
 *    pour les appelants qui construisent un `LandingMedia` a la main).
 *
 * Chaque segment est encode separement : `encodeURIComponent` sur le chemin
 * entier transformerait les `/` en `%2F` et casserait la route.
 */
export function landingMediaUrl(media: LandingMedia | null): string | null {
  if (media === null) return null;
  if (!PUBLIC_MEDIA_BUCKETS.includes(media.bucket)) return null;
  if (media.path.trim().length === 0) return null;
  const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
  const path = media.path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join('/');
  if (path.length === 0) return null;
  return `${base}/storage/v1/object/public/${encodeURIComponent(media.bucket)}/${path}`;
}

/** Reglage editorial d'une section, publie par le CMS. */
export interface LandingSectionConfig {
  readonly sectionKey: string;
  readonly title: string | null;
  readonly subtitle: string | null;
  readonly displayOrder: number;
  readonly sourceMode: string | null;
  readonly maxItems: number | null;
  readonly ctaLabel: string | null;
  readonly ctaTarget: EntityRef | null;
}

/** ADDENDUM §9 — une diapositive du carrousel. */
export interface LandingSlide {
  readonly id: string;
  /** Code de nature de contenu (`event`, `news`...). Le libelle est en i18n. */
  readonly contentType: string | null;
  readonly title: string;
  readonly subtitle: string | null;
  readonly description: string | null;
  readonly ctaLabel: string | null;
  readonly target: EntityRef | null;
  readonly media: LandingMedia | null;
  readonly mobileMedia: LandingMedia | null;
  /** ADDENDUM §26 — transparence publicitaire. */
  readonly sponsored: boolean;
  /** Mention imposee par §26. Jamais vide des que `sponsored` est vrai. */
  readonly sponsoredLabel: string | null;
  /** 0109 — position des textes : sur l'image, dessous, ou masques. */
  readonly textPosition: 'overlay' | 'below' | 'hidden';
  /** 0109 — voile sombre sur le visuel. */
  readonly dimMedia: boolean;
}

/** ADDENDUM §12 — une actualite, teaser public-safe. */
export interface LandingNews {
  readonly id: string;
  readonly title: string;
  readonly slug: string | null;
  readonly summary: string | null;
  readonly categoryCode: string | null;
  readonly publishedAt: string | null;
  readonly featured: boolean;
  readonly pinned: boolean;
  readonly target: EntityRef;
  /**
   * Couverture. `news.image_path` est un chemin libre, anterieur au CMS : la
   * projection le resout dans la mediatheque (0068). Une couverture qui n'y
   * est pas enregistree, decrite et mesuree vaut `null` — la carte s'affiche
   * alors sans visuel, jamais avec une image cassee.
   */
  readonly image: LandingMedia | null;
}

/** ADDENDUM §13 — un evenement a venir. */
export interface LandingEvent {
  readonly id: string;
  readonly title: string;
  readonly slug: string | null;
  readonly eventTypeCode: string | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly timezone: string | null;
  readonly format: string | null;
  readonly city: string | null;
  readonly countryCode: string | null;
  readonly pinned: boolean;
  readonly target: EntityRef;
}

/**
 * ADDENDUM §14 — teaser d'opportunite.
 *
 * La projection ne descend **que** ce qui est public-safe : ni remuneration,
 * ni description, ni auteur. L'organisation n'est nommee que si elle est
 * verifiee — c'est la fonction en base qui en decide, pas l'interface.
 */
export interface LandingOpportunity {
  readonly id: string;
  readonly title: string;
  readonly opportunityType: string | null;
  readonly contractType: string | null;
  readonly sector: string | null;
  readonly countryCode: string | null;
  readonly city: string | null;
  readonly remoteAllowed: boolean;
  readonly deadline: string | null;
  readonly organization: string | null;
  readonly pinned: boolean;
  readonly target: EntityRef;
}

/**
 * ADDENDUM §11 et §21 — « ISE du jour ».
 *
 * Liste blanche stricte. Le parseur **reconstruit** l'objet champ par champ :
 * une cle ajoutee demain a la projection (courriel, telephone, score de
 * completude) ne peut pas se retrouver dans le HTML par accident.
 */
export interface LandingFeaturedProfile {
  readonly profileId: string;
  readonly displayName: string;
  readonly promotionName: string | null;
  readonly promotionYear: number | null;
  readonly currentPosition: string | null;
  readonly organization: string | null;
  /** Resume public, tronque. Aucune autre prose du profil n'est exposee. */
  readonly summary: string | null;
  readonly expertiseAreas: readonly string[];
  readonly target: EntityRef;
  /**
   * D-165 — visuel editorial choisi par l'admin pour CETTE mise en avant,
   * tire de la mediatheque PUBLIQUE (`landing-media`). Ce n'est PAS
   * l'avatar prive du membre : D-135 (aucun avatar_path projete) reste en
   * vigueur, inchangee par cet ajout.
   */
  readonly photo: LandingMedia | null;
  /** D-165 — accroche courte (3-160 caracteres), propre a cette mise en avant. */
  readonly tagline: string | null;
}

/** ADDENDUM §24 — une expertise de la taxonomie reelle. */
export interface LandingExpertise {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly profileCount: number;
}

/** ADDENDUM §25 et §26 — une campagne partenaire en cours de diffusion. */
export interface LandingPartnerCampaign {
  readonly id: string;
  readonly organizationId: string | null;
  readonly partnerName: string;
  readonly campaignName: string | null;
  readonly placement: string | null;
  readonly title: string;
  readonly body: string | null;
  readonly ctaLabel: string | null;
  readonly target: EntityRef | null;
  /** Cible externe, uniquement si elle est en `https:`. */
  readonly externalUrl: string | null;
  readonly media: LandingMedia | null;
  /** Logo du partenaire, resolu dans la mediatheque. `null` s'il n'y est pas. */
  readonly logo: LandingMedia | null;
  /** Mention de transparence imposee par §26. Jamais vide. */
  readonly sponsoredLabel: string;
}

/** ADDENDUM §23 — un chiffre du reseau, calcule en base. */
export type LandingStatId = 'profiles' | 'promotions' | 'countries' | 'organizations';

export interface LandingStat {
  readonly id: LandingStatId;
  readonly value: number;
  /** Phrase de provenance fournie par la base. Jamais reecrite ici. */
  readonly source: string;
}

export interface LandingStatsSection extends LandingSection<LandingStat> {
  readonly computedAt: string | null;
  /** `true` quand la base mesure zero partout : l'annuaire n'est pas importe. */
  readonly allZero: boolean;
}

/**
 * ADDENDUM §52, D-163 — le carrousel porte, en plus de ses diapositives, un
 * reglage global de duree de rotation. Meme principe que
 * `LandingStatsSection` : la section standard est etendue de champs propres
 * a sa projection plutot que de creer un second etat parallele.
 */
export interface LandingCarouselSection extends LandingSection<LandingSlide> {
  /** Secondes entre deux diapositives (`platform_settings`, borne 3-60, repli 7). */
  readonly autoplaySeconds: number;
}

export interface LandingData {
  /** Horodatage de la lecture reellement servie (peut etre anterieur, §47). */
  readonly generatedAt: string;
  /** `true` si au moins une section provient d'une lecture reussie plus ancienne. */
  readonly servedFromLastKnownGood: boolean;
  readonly sections: readonly LandingSectionConfig[];
  readonly carousel: LandingCarouselSection;
  readonly news: LandingSection<LandingNews>;
  readonly events: LandingSection<LandingEvent>;
  readonly opportunities: LandingSection<LandingOpportunity>;
  readonly featuredProfile: LandingSection<LandingFeaturedProfile>;
  readonly expertises: LandingSection<LandingExpertise>;
  readonly partners: LandingSection<LandingPartnerCampaign>;
  readonly stats: LandingStatsSection;
}

// ---------------------------------------------------------------------------
// Briques de validation
// ---------------------------------------------------------------------------

const nullableText = z
  .unknown()
  .transform((value) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null,
  );

const requiredText = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

/** `bigint` cote base -> nombre JSON. `uuid` -> chaine. Les deux sont acceptes. */
const identifier = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().min(1));

const booleanFlag = z.unknown().transform((value) => value === true);

const nullableInteger = z
  .unknown()
  .transform((value) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null,
  );

const nonNegativeCount = z
  .unknown()
  .transform((value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0,
  );

/**
 * Horodatage. La base renvoie du `timestamptz` serialise ; on ne garde que ce
 * qui est effectivement analysable, pour ne jamais afficher « Invalid Date ».
 */
const nullableTimestamp = z.unknown().transform((value) => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
});

/**
 * Reference d'entite reconstruite depuis un couple `entity_type` /
 * `entity_id` plat. Un type inconnu de l'application (`expertise_area`,
 * `organization`...) ne produit pas de reference : la carte s'affichera sans
 * action plutot qu'avec un lien mort (ADDENDUM §10).
 */
export function toEntityRef(entityType: unknown, entityId: unknown): EntityRef | null {
  if (!isEntityType(entityType)) return null;
  if (typeof entityId !== 'string' && typeof entityId !== 'number') return null;
  const id = String(entityId).trim();
  return id.length === 0 ? null : { entityType, entityId: id };
}

const mediaSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
  alt_text: nullableText,
  credit: nullableText,
  width: nullableInteger,
  height: nullableInteger,
});

/**
 * Un media n'est retenu que s'il est **reellement affichable**. Trois refus,
 * et tous les trois produisent le meme resultat : `null`, c'est-a-dire une
 * mise en page complete sans image, jamais une image cassee (ADDENDUM §47).
 *
 *  1. forme inattendue — la projection a change sans que le client le sache ;
 *  2. bucket non public — l'URL construite renverrait un 400 ;
 *  3. alternative textuelle absente ou trop courte — non publiable (§52).
 *
 * Les dimensions, elles, sont conservees telles quelles : elles ne
 * conditionnent pas l'affichage parce que le rendu reserve sa place par un
 * rapport d'aspect fixe (`fill`), et non par les dimensions intrinseques.
 * Un media mesure ou non ne provoque donc aucun decalage (CLS, §58).
 */
export function parseMedia(value: unknown): LandingMedia | null {
  const parsed = mediaSchema.safeParse(value);
  if (!parsed.success) return null;

  const row = parsed.data;
  if (!PUBLIC_MEDIA_BUCKETS.includes(row.bucket)) return null;
  if (row.alt_text === null || row.alt_text.length < MEDIA_ALT_MIN_LENGTH) return null;

  return {
    bucket: row.bucket,
    path: row.path,
    alt: row.alt_text,
    credit: row.credit,
    width: row.width,
    height: row.height,
  };
}

/**
 * ADDENDUM §26 — mentions de transparence admises. Une campagne dont le CMS
 * ne fournit pas de mention reconnue recoit la mention par defaut : il n'est
 * pas possible d'afficher un contenu commercial sans mention.
 */
export const SPONSORED_LABELS = ['Partenaire', 'Sponsorisé', 'Contenu partenaire'] as const;
export const DEFAULT_SPONSORED_LABEL = 'Contenu partenaire';

export function normalizeSponsoredLabel(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_SPONSORED_LABEL;
  const value = raw.trim();
  if (value.length === 0) return DEFAULT_SPONSORED_LABEL;
  const match = SPONSORED_LABELS.find((label) => label.toLowerCase() === value.toLowerCase());
  return match ?? DEFAULT_SPONSORED_LABEL;
}

/** Longueur du resume de l'« ISE du jour ». La maquette tient sur deux lignes. */
export const FEATURED_SUMMARY_MAX = 180;

export function truncate(value: string | null, max: number): string | null {
  if (value === null) return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Cible externe d'une campagne partenaire. Seul `https:` est accepte : une
 * `javascript:` ou une `data:` venue du CMS ne doit pas devenir un `href`.
 */
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parseurs, ecrits sur la forme observee
// ---------------------------------------------------------------------------

export const sectionConfigSchema = z
  .object({
    section_key: requiredText,
    title: nullableText,
    subtitle: nullableText,
    display_order: nullableInteger,
    source_mode: nullableText,
    max_items: nullableInteger,
    cta_label: nullableText,
    cta_entity_type: z.unknown(),
    cta_entity_id: z.unknown(),
  })
  .transform<LandingSectionConfig>((row) => ({
    sectionKey: row.section_key,
    title: row.title,
    subtitle: row.subtitle,
    displayOrder: row.display_order ?? 0,
    sourceMode: row.source_mode,
    maxItems: row.max_items !== null && row.max_items > 0 ? row.max_items : null,
    ctaLabel: row.cta_label,
    ctaTarget: toEntityRef(row.cta_entity_type, row.cta_entity_id),
  }));

export const slideSchema = z
  .object({
    id: identifier,
    title: requiredText,
    subtitle: nullableText,
    description: nullableText,
    content_type: nullableText,
    entity_type: z.unknown(),
    entity_id: z.unknown(),
    cta_label: nullableText,
    media: z.unknown(),
    mobile_media: z.unknown(),
    is_sponsored: booleanFlag,
    sponsored_label: z.unknown(),
    // 0109 — repli 'overlay'/voile pour les instantanes anterieurs.
    text_position: z.unknown(),
    dim_media: z.unknown(),
  })
  .transform<LandingSlide>((row) => ({
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    ctaLabel: row.cta_label,
    target: toEntityRef(row.entity_type, row.entity_id),
    media: parseMedia(row.media),
    mobileMedia: parseMedia(row.mobile_media),
    sponsored: row.is_sponsored,
    // §26 : des qu'une diapositive est commerciale, elle porte une mention.
    sponsoredLabel: row.is_sponsored ? normalizeSponsoredLabel(row.sponsored_label) : null,
    textPosition:
      row.text_position === 'below' || row.text_position === 'hidden'
        ? row.text_position
        : 'overlay',
    dimMedia: row.dim_media !== false,
  }));

export const newsSchema = z
  .object({
    id: identifier,
    title: requiredText,
    slug: nullableText,
    summary: nullableText,
    category_code: nullableText,
    image: z.unknown(),
    published_at: nullableTimestamp,
    is_featured: booleanFlag,
    is_pinned: booleanFlag,
  })
  .transform<LandingNews>((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: truncate(row.summary, 160),
    categoryCode: row.category_code,
    publishedAt: row.published_at,
    featured: row.is_featured,
    pinned: row.is_pinned,
    target: { entityType: 'news', entityId: row.id },
    image: parseMedia(row.image),
  }));

export const eventSchema = z
  .object({
    id: identifier,
    title: requiredText,
    slug: nullableText,
    event_type_code: nullableText,
    starts_at: nullableTimestamp,
    ends_at: nullableTimestamp,
    timezone: nullableText,
    format: nullableText,
    city: nullableText,
    country_code: nullableText,
    is_pinned: booleanFlag,
  })
  .transform<LandingEvent>((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    eventTypeCode: row.event_type_code,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    format: row.format,
    city: row.city,
    countryCode: row.country_code,
    pinned: row.is_pinned,
    target: { entityType: 'event', entityId: row.id },
  }));

export const opportunitySchema = z
  .object({
    id: identifier,
    title: requiredText,
    opportunity_type: nullableText,
    contract_type: nullableText,
    sector: nullableText,
    country_code: nullableText,
    city: nullableText,
    remote_allowed: booleanFlag,
    deadline: nullableTimestamp,
    organization: nullableText,
    is_pinned: booleanFlag,
  })
  .transform<LandingOpportunity>((row) => ({
    id: row.id,
    title: row.title,
    opportunityType: row.opportunity_type,
    contractType: row.contract_type,
    sector: row.sector,
    countryCode: row.country_code,
    city: row.city,
    remoteAllowed: row.remote_allowed,
    deadline: row.deadline,
    organization: row.organization,
    pinned: row.is_pinned,
    target: { entityType: 'opportunity', entityId: row.id },
  }));

const promotionSchema = z.object({ name: nullableText, graduation_year: nullableInteger });
const expertiseNameSchema = z.array(z.object({ name: nullableText }));

/**
 * ADDENDUM §11, §21, §45 — « ISE du jour ».
 *
 * PAS D'AVATAR PRIVE — D-135, INCHANGEE. Le bucket `avatars` est prive et le
 * reste. Depuis 0068, `get_landing_featured_profile()` ne projette meme plus
 * `avatar_path`. `allow_public_feature` consent a un teaser textuel, pas a
 * la publication d'une photographie personnelle.
 *
 * `photo` (D-165, migration 0112) N'EST PAS CET AVATAR : c'est un visuel
 * choisi par l'admin dans la mediatheque PUBLIQUE (`landing-media`), la meme
 * que le carrousel et les actualites — deja soumis a l'obligation d'un texte
 * alternatif. `parseMedia()` lui applique exactement les memes controles.
 * Quand aucun visuel n'a ete choisi, `photo` vaut `null` et le composant
 * retombe sur le monogramme construit depuis `display_name`. `tagline` est
 * l'accroche courte associee, distincte de `public_summary`. `selection_mode`
 * reste ignore : c'est une information d'exploitation interne.
 */
/** D-165 — accroche courte, alignee sur la contrainte SQL (3-160 caracteres). */
export const FEATURED_TAGLINE_MAX = 160;

export const featuredProfileSchema = z
  .object({
    profile_id: identifier,
    display_name: requiredText,
    promotion: z.unknown(),
    current_position: nullableText,
    organization: nullableText,
    public_summary: nullableText,
    expertise_areas: z.unknown(),
    photo: z.unknown(),
    tagline: z.unknown(),
  })
  .transform<LandingFeaturedProfile>((row) => {
    const promotion = promotionSchema.safeParse(row.promotion);
    const areas = expertiseNameSchema.safeParse(row.expertise_areas);

    return {
      profileId: row.profile_id,
      displayName: row.display_name,
      promotionName: promotion.success ? promotion.data.name : null,
      promotionYear: promotion.success ? promotion.data.graduation_year : null,
      currentPosition: row.current_position,
      organization: row.organization,
      summary: truncate(row.public_summary, FEATURED_SUMMARY_MAX),
      expertiseAreas: areas.success
        ? areas.data
            .map((area) => area.name)
            .filter((name): name is string => name !== null)
            .slice(0, 3)
        : [],
      target: { entityType: 'profile', entityId: row.profile_id },
      // D-165 : visuel de mediatheque publique (jamais l'avatar prive) et
      // accroche courte, propres a CETTE mise en avant.
      photo: parseMedia(row.photo),
      tagline: nullableText.parse(row.tagline)?.slice(0, FEATURED_TAGLINE_MAX) ?? null,
    };
  });

export const expertiseSchema = z
  .object({
    id: identifier,
    name: requiredText,
    slug: requiredText,
    description: nullableText,
    profile_count: nonNegativeCount,
  })
  .transform<LandingExpertise>((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    profileCount: row.profile_count,
  }));

export const partnerSchema = z
  .object({
    id: identifier,
    organization_id: z.unknown(),
    organization_name: requiredText,
    campaign_name: nullableText,
    placement: nullableText,
    title: requiredText,
    description: nullableText,
    cta_label: nullableText,
    target_entity_type: z.unknown(),
    target_entity_id: z.unknown(),
    target_url: z.unknown(),
    sponsored_label: z.unknown(),
    media: z.unknown(),
    organization_logo: z.unknown(),
  })
  .transform<LandingPartnerCampaign>((row) => ({
    id: row.id,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : null,
    partnerName: row.organization_name,
    campaignName: row.campaign_name,
    placement: row.placement,
    title: row.title,
    body: row.description,
    ctaLabel: row.cta_label,
    target: toEntityRef(row.target_entity_type, row.target_entity_id),
    externalUrl: safeExternalUrl(row.target_url),
    media: parseMedia(row.media),
    logo: parseMedia(row.organization_logo),
    // §26 : la mention n'est jamais facultative, ni laissee au CMS.
    sponsoredLabel: normalizeSponsoredLabel(row.sponsored_label),
  }));

const STAT_IDS: readonly LandingStatId[] = ['profiles', 'promotions', 'countries', 'organizations'];

const statValueSchema = z.object({ value: nonNegativeCount, source: nullableText });

function emptySection<TItem>(reason: string): LandingSection<TItem> {
  return { status: 'indisponible', items: [], reason };
}

function unavailableStats(reason: string): LandingStatsSection {
  return { ...emptySection<LandingStat>(reason), computedAt: null, allZero: true };
}

/**
 * ADDENDUM §23 — les chiffres du reseau.
 *
 * La fonction renvoie un objet, pas un tableau. Elle renvoie aujourd'hui zero
 * partout : l'annuaire n'est pas importe. C'est la reponse correcte de la
 * base, elle est transmise telle quelle. La decision d'affichage (montrer
 * zero ou masquer le bloc) appartient au composant, pas au parseur.
 */
export function parseStats(payload: unknown): LandingStatsSection {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return unavailableStats('reponse-inattendue');
  }

  const source = payload as Record<string, unknown>;
  const items: LandingStat[] = [];
  for (const id of STAT_IDS) {
    const parsed = statValueSchema.safeParse(source[id]);
    if (!parsed.success) continue;
    items.push({ id, value: parsed.data.value, source: parsed.data.source ?? '' });
  }

  if (items.length === 0) return unavailableStats('aucun-chiffre');

  return {
    status: 'ok',
    items,
    computedAt: nullableTimestamp.parse(source['computed_at']),
    allZero: items.every((stat) => stat.value === 0),
  };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Client anonyme, sans cookie. La landing est publique : elle ne lit que des
 * fonctions explicitement `public-safe` (ADDENDUM §44, §45), jamais une table
 * metier. Un client sans cookie est aussi la condition pour que la lecture
 * puisse etre mise en cache.
 */
function publicClient() {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(LANDING_RPC_TIMEOUT_MS)
    : undefined;
}

type RpcOutcome =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: string };

async function callProjection(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<RpcOutcome> {
  try {
    const signal = timeoutSignal();
    const query = publicClient().rpc(functionName, args);
    const { data, error } = await (signal === undefined ? query : query.abortSignal(signal));

    if (error) {
      // `PGRST202` : la fonction est absente. Depuis les migrations 0057 -> 0066
      // ce n'est plus l'etat nominal, c'est une anomalie de deploiement.
      return { ok: false, reason: error.code ? `erreur:${error.code}` : 'erreur' };
    }
    return { ok: true, value: data };
  } catch (cause) {
    console.error('[ISE] projection de landing injoignable', { functionName, cause });
    return { ok: false, reason: 'exception' };
  }
}

async function readList<TItem>(
  functionName: string,
  args: Record<string, unknown>,
  schema: z.ZodType<TItem, z.ZodTypeDef, unknown>,
): Promise<LandingSection<TItem>> {
  const outcome = await callProjection(functionName, args);
  if (!outcome.ok) return emptySection(outcome.reason);
  if (!Array.isArray(outcome.value)) return emptySection('reponse-inattendue');

  // Une ligne invalide est ecartee ; elle n'invalide pas la section.
  const items: TItem[] = [];
  for (const row of outcome.value) {
    const parsed = schema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
    else console.warn('[ISE] ligne de landing ignoree', { functionName });
  }
  return { status: 'ok', items };
}

/**
 * ADDENDUM §21 — « ISE du jour ».
 *
 * Trois issues, une seule signification par issue :
 *  - profil eligible : `status: 'ok'`, un element ;
 *  - `null` renvoye par la base (aucun profil eligible, ou section masquee par
 *    une consigne editoriale) : `status: 'ok'`, **zero** element. Ce n'est pas
 *    une panne : le repli editorial du composant s'applique ;
 *  - projection en erreur : `status: 'indisponible'`, la derniere version
 *    valide prend le relais si elle existe.
 */
async function readFeaturedProfile(): Promise<LandingSection<LandingFeaturedProfile>> {
  const outcome = await callProjection(LANDING_FUNCTIONS.featuredProfile);
  if (!outcome.ok) return emptySection(outcome.reason);
  if (outcome.value === null || outcome.value === undefined) return { status: 'ok', items: [] };

  const parsed = featuredProfileSchema.safeParse(outcome.value);
  if (!parsed.success) {
    console.warn('[ISE] profil du jour ignore : forme inattendue');
    return { status: 'ok', items: [] };
  }
  return { status: 'ok', items: [parsed.data] };
}

async function readStats(): Promise<LandingStatsSection> {
  const outcome = await callProjection(LANDING_FUNCTIONS.stats);
  if (!outcome.ok) return unavailableStats(outcome.reason);
  return parseStats(outcome.value);
}

/** Repli si la lecture du reglage echoue : comportement identique a avant 0111. */
const DEFAULT_CAROUSEL_AUTOPLAY_SECONDS = 7;

const carouselSettingsSchema = z.object({
  autoplay_seconds: z.number().int().min(3).max(60),
});

/**
 * D-163 — duree de rotation du carrousel. Reglage cosmetique, pas un
 * contenu : contrairement aux autres projections, un echec de lecture ne
 * degrade pas la section (§47 ne s'applique qu'au contenu editorial) ; il
 * retombe silencieusement sur le comportement fige d'avant 0111.
 */
async function readCarouselAutoplaySeconds(): Promise<number> {
  const outcome = await callProjection(LANDING_FUNCTIONS.carouselSettings);
  if (!outcome.ok) return DEFAULT_CAROUSEL_AUTOPLAY_SECONDS;
  const parsed = carouselSettingsSchema.safeParse(outcome.value);
  return parsed.success ? parsed.data.autoplay_seconds : DEFAULT_CAROUSEL_AUTOPLAY_SECONDS;
}

/**
 * Derniere version valide, **par section**.
 *
 * ADDENDUM §47 : si une projection tombe, seule sa section degrade. Les
 * autres s'affichent normalement, et la section en panne reprend sa derniere
 * lecture reussie plutot que de se vider.
 */
const lastKnownGood = new Map<string, LandingSection<unknown>>();

function withLastKnownGood<TSection extends LandingSection<unknown>>(
  key: string,
  section: TSection,
): TSection {
  if (section.status === 'ok') {
    lastKnownGood.set(key, section);
    return section;
  }
  const previous = lastKnownGood.get(key) as TSection | undefined;
  if (previous === undefined) return section;
  return { ...previous, stale: true, reason: section.reason };
}

/** Reinitialise la memoire de repli. Reserve aux tests. */
export function resetLandingFallbackCache(): void {
  lastKnownGood.clear();
}

/** Nombre d'elements a afficher pour une section, selon le reglage du CMS. */
export function sectionLimit(
  sections: readonly LandingSectionConfig[],
  sectionKey: string,
): number {
  const configured = sections.find((section) => section.sectionKey === sectionKey)?.maxItems;
  return configured ?? DEFAULT_MAX_ITEMS[sectionKey] ?? 3;
}

/** Titre publie par le CMS, ou `null` : l'i18n prend alors le relais. */
export function sectionTitle(
  sections: readonly LandingSectionConfig[],
  sectionKey: string,
): string | null {
  return sections.find((section) => section.sectionKey === sectionKey)?.title ?? null;
}

function limited<TItem>(
  section: LandingSection<TItem>,
  sections: readonly LandingSectionConfig[],
  sectionKey: string,
): LandingSection<TItem> {
  return { ...section, items: section.items.slice(0, sectionLimit(sections, sectionKey)) };
}

async function fetchLandingData(): Promise<LandingData> {
  const [
    sectionsRead,
    carouselRead,
    carouselAutoplaySeconds,
    newsRead,
    eventsRead,
    opportunitiesRead,
    featuredRead,
    expertisesRead,
    partnersRead,
    statsRead,
  ] = await Promise.all([
    readList(LANDING_FUNCTIONS.sections, {}, sectionConfigSchema),
    readList(LANDING_FUNCTIONS.carousel, {}, slideSchema),
    readCarouselAutoplaySeconds(),
    readList(LANDING_FUNCTIONS.news, { p_limit: FETCH_LIMITS.news }, newsSchema),
    readList(LANDING_FUNCTIONS.events, { p_limit: FETCH_LIMITS.events }, eventSchema),
    readList(
      LANDING_FUNCTIONS.opportunities,
      { p_limit: FETCH_LIMITS.opportunities },
      opportunitySchema,
    ),
    readFeaturedProfile(),
    readList(LANDING_FUNCTIONS.expertises, { p_limit: FETCH_LIMITS.expertises }, expertiseSchema),
    readList(LANDING_FUNCTIONS.partners, { p_placement: null }, partnerSchema),
    readStats(),
  ]);

  const sectionsSection = withLastKnownGood('sections', sectionsRead);
  const carousel = withLastKnownGood('carousel', carouselRead);
  const news = withLastKnownGood('news', newsRead);
  const events = withLastKnownGood('events', eventsRead);
  const opportunities = withLastKnownGood('opportunities', opportunitiesRead);
  const featuredProfile = withLastKnownGood('featuredProfile', featuredRead);
  const expertises = withLastKnownGood('expertises', expertisesRead);
  const partners = withLastKnownGood('partners', partnersRead);
  const stats = withLastKnownGood('stats', statsRead);

  const sections = sectionsSection.items;
  const servedFromLastKnownGood = [
    sectionsSection,
    carousel,
    news,
    events,
    opportunities,
    featuredProfile,
    expertises,
    partners,
    stats,
  ].some((section) => section.stale === true);

  return {
    generatedAt: new Date().toISOString(),
    servedFromLastKnownGood,
    sections,
    carousel: {
      ...limited(carousel, sections, LANDING_SECTION_KEYS.carousel),
      autoplaySeconds: carouselAutoplaySeconds,
    },
    news: limited(news, sections, LANDING_SECTION_KEYS.news),
    events: limited(events, sections, LANDING_SECTION_KEYS.events),
    opportunities: limited(opportunities, sections, LANDING_SECTION_KEYS.opportunities),
    featuredProfile,
    expertises: limited(expertises, sections, LANDING_SECTION_KEYS.expertises),
    partners: limited(partners, sections, LANDING_SECTION_KEYS.partners),
    stats,
  };
}

/** Version **non** mise en cache, utilisee par les tests. */
export const fetchLandingDataUncached = fetchLandingData;

/**
 * Lecture mise en cache de PUB-001 (ADDENDUM §46).
 *
 * Cache serveur etiquete : `revalidateTag(LANDING_CACHE_TAG)` suffit a
 * publier une nouvelle version, sans purger le reste du site.
 */
export const loadLandingData: () => Promise<LandingData> = unstable_cache(
  fetchLandingData,
  ['pub-001-landing-data'],
  { tags: [LANDING_CACHE_TAG], revalidate: LANDING_REVALIDATE_SECONDS },
);

/** `true` si aucune section n'a de contenu : rien n'est encore publie. */
export function isLandingEmpty(data: LandingData): boolean {
  return (
    data.carousel.items.length === 0 &&
    data.news.items.length === 0 &&
    data.events.items.length === 0 &&
    data.opportunities.items.length === 0 &&
    data.featuredProfile.items.length === 0 &&
    data.expertises.items.length === 0 &&
    data.partners.items.length === 0 &&
    data.stats.allZero
  );
}
