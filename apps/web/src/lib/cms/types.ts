/**
 * Formes lues par le back-office CMS.
 *
 * Ce sont des vues de LECTURE : elles decrivent ce que la base renvoie
 * reellement (colonnes enumerees, jamais `select('*')` sur une table a
 * privileges de colonne revoques). Rien ici n'est une source de verite —
 * la base l'est.
 */

/** Vocabulaire ferme de `docs/cms.md` §3. */
export const CMS_STATUSES = ['draft', 'scheduled', 'published', 'expired', 'archived'] as const;
export type CmsStatus = (typeof CMS_STATUSES)[number];

export const CMS_ENTITY_TYPES = [
  'news',
  'event',
  'opportunity',
  'profile',
  'promotion',
  'organization',
  'community',
  'project',
  'network_call',
  'expertise_area',
  'external',
] as const;
export type CmsEntityType = (typeof CMS_ENTITY_TYPES)[number];

export const CMS_CONTENT_TYPES = [
  'event',
  'news',
  'opportunity',
  'program',
  'initiative',
  'partner',
  'institutional',
] as const;
export type CmsContentType = (typeof CMS_CONTENT_TYPES)[number];

/**
 * Position des textes d'une slide (0109) : sur l'image (historique), sous
 * l'image sur le bandeau bleu nuit, ou masques (le titre reste en base :
 * administration et lecteurs d'ecran).
 */
export const CMS_TEXT_POSITIONS = ['overlay', 'below', 'hidden'] as const;
export type CmsTextPosition = (typeof CMS_TEXT_POSITIONS)[number];

export const CMS_PLACEMENTS = [
  'carousel',
  'partners_band',
  'news_inline',
  'sidebar',
  'footer',
] as const;
export type CmsPlacement = (typeof CMS_PLACEMENTS)[number];

export const CMS_SOURCE_MODES = ['automatic', 'manual', 'hybrid'] as const;
export type CmsSourceMode = (typeof CMS_SOURCE_MODES)[number];

export const CMS_SCHEDULE_ENTITY_TYPES = [
  'news',
  'event',
  'opportunity',
  'cms_carousel_item',
  'cms_partner_campaign',
  'cms_section',
] as const;
export type CmsScheduleEntityType = (typeof CMS_SCHEDULE_ENTITY_TYPES)[number];

export const CMS_SCHEDULE_STATUSES = ['pending', 'applied', 'cancelled', 'failed'] as const;
export type CmsScheduleStatus = (typeof CMS_SCHEDULE_STATUSES)[number];

/** Types d'entite acceptes par `publish_cms_content` / `transition_cms_content`. */
export const CMS_PUBLISHABLE_TYPES = [
  'cms_carousel_item',
  'cms_partner_campaign',
  'cms_section',
] as const;
export type CmsPublishableType = (typeof CMS_PUBLISHABLE_TYPES)[number];

export interface CmsMediaAsset {
  id: string;
  /** Bucket de destination. `landing-media` depuis 0068 ; public. */
  bucketId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  altText: string;
  credit: string | null;
  variantKind: 'original' | 'desktop' | 'mobile' | 'thumbnail';
  sourceMediaId: string | null;
  createdAt: string;
  /** Variantes rattachees a cet original. Vide tant qu'aucune n'est generee. */
  variants: readonly CmsMediaVariant[];
  /** Nombre de contenus qui referencent ce media (§38). */
  usage: { carousel: number; campaigns: number };
}

export interface CmsMediaVariant {
  id: string;
  variantKind: 'desktop' | 'mobile' | 'thumbnail';
  width: number | null;
  height: number | null;
  storagePath: string;
}

export interface CmsCarouselItem {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  mediaId: string | null;
  mobileMediaId: string | null;
  mediaAlt: string | null;
  mobileMediaAlt: string | null;
  contentType: CmsContentType;
  entityType: CmsEntityType | null;
  entityId: string | null;
  ctaLabel: string | null;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  /** 0109 — position des textes sur la landing. */
  textPosition: CmsTextPosition;
  /** 0109 — voile sombre sur le visuel (option independante des textes). */
  dimMedia: boolean;
  isSponsored: boolean;
  partnerCampaignId: string | null;
  sponsoredLabel: string | null;
  status: CmsStatus;
  publishedAt: string | null;
  hasPublishedSnapshot: boolean;
  hasPreviousSnapshot: boolean;
  /** `true` si le brouillon differe de l'instantane publie (§48). */
  hasUnpublishedChanges: boolean;
  updatedAt: string;
}

export interface CmsSection {
  id: string;
  sectionKey: string;
  title: string | null;
  subtitle: string | null;
  isEnabled: boolean;
  displayOrder: number;
  sourceMode: CmsSourceMode;
  maxItems: number;
  ctaLabel: string | null;
  ctaEntityType: CmsEntityType | null;
  ctaEntityId: string | null;
  isStructural: boolean;
  status: CmsStatus;
  publishedAt: string | null;
  hasPublishedSnapshot: boolean;
  hasPreviousSnapshot: boolean;
  hasUnpublishedChanges: boolean;
  configuration: Record<string, unknown>;
}

export interface CmsPartnerCampaign {
  id: string;
  organizationId: string;
  organizationName: string | null;
  campaignName: string;
  placement: CmsPlacement;
  title: string | null;
  description: string | null;
  mediaId: string | null;
  mobileMediaId: string | null;
  ctaLabel: string | null;
  targetEntityType: CmsEntityType | null;
  targetEntityId: string | null;
  targetUrl: string | null;
  sponsoredLabel: string;
  startAt: string;
  endAt: string;
  status: CmsStatus;
  publishedAt: string | null;
  hasPreviousSnapshot: boolean;
  hasUnpublishedChanges: boolean;
  /** Calcule a la lecture : publiee ET dans sa periode. */
  isLive: boolean;
}

export interface CmsNewsRow {
  id: string;
  title: string;
  slug: string;
  summary: string;
  categoryCode: string;
  imagePath: string | null;
  editorialStatus: string;
  visibility: string;
  landingVisibility: 'hidden' | 'visible';
  landingPriority: number;
  isFeatured: boolean;
  featuredAt: string | null;
  publishedAt: string | null;
  pendingSchedule: CmsPendingSchedule | null;
}

export interface CmsEventRow {
  id: string;
  title: string;
  slug: string;
  eventTypeCode: string;
  format: string;
  city: string | null;
  countryCode: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  visibility: string;
  cancelledAt: string | null;
  landingVisibility: 'hidden' | 'visible';
  landingPriority: number;
  isUpcoming: boolean;
  isPinned: boolean;
  pendingSchedule: CmsPendingSchedule | null;
}

export interface CmsPendingSchedule {
  id: string;
  publishAt: string | null;
  unpublishAt: string | null;
  status: CmsScheduleStatus;
}

export interface CmsScheduleOrder {
  id: string;
  entityType: CmsScheduleEntityType;
  entityId: string;
  publishAt: string | null;
  unpublishAt: string | null;
  status: CmsScheduleStatus;
  appliedAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  lastError: string | null;
  createdAt: string;
  /** Libelle resolu du contenu vise, ou `null` s'il n'est pas lisible ici. */
  label: string | null;
}

export interface CmsDashboardCounters {
  total: number;
  [key: string]: number;
}

export interface CmsDashboardAlert {
  code: string;
  severity: 'error' | 'warning' | 'info';
  count: number;
}

export interface CmsDashboard {
  readAt: string;
  day: string;
  carousel: Record<string, number>;
  sections: Record<string, number>;
  news: Record<string, number>;
  events: Record<string, number>;
  partners: Record<string, number>;
  media: Record<string, number>;
  schedule: Record<string, number>;
  featuredProfile: {
    automationEnabled: boolean;
    todayStatus: string | null;
    todayMode: string | null;
    activeOverride: boolean;
    historyCount: number;
  };
  publishedToday: number;
  lastPublishedAt: string | null;
  alerts: readonly CmsDashboardAlert[];
}

export interface CmsAutomationJob {
  jobName: string;
  schedule: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
}

export interface CmsFeaturedRules {
  minDaysBetweenFeatures: number;
  requireClaimedProfile: boolean;
  requireAvatar: boolean;
  requirePromotion: boolean;
  requireExpertiseOrPosition: boolean;
  balanceDimension: string;
  isAutomationEnabled: boolean;
}

export interface CmsFeaturedCurrent {
  profileId: string;
  displayName: string;
  currentPosition: string | null;
  organization: string | null;
  promotion: string | null;
  publicSummary: string | null;
  avatarPath: string | null;
  featuredDate: string;
  selectionMode: string;
  status: string;
  publishedAt: string | null;
  selectionContext: Record<string, unknown>;
}

export interface CmsFeaturedHistoryRow {
  featuredDate: string;
  profileId: string;
  displayName: string;
  currentPosition: string | null;
  selectionMode: string;
  status: string;
  publishedAt: string | null;
  selectedBy: string | null;
}

export interface CmsFeaturedOverrideRow {
  id: string;
  overrideKind: 'pin' | 'exclude' | 'hide';
  profileId: string | null;
  displayName: string | null;
  startsAt: string;
  endsAt: string | null;
  reason: string | null;
  isActive: boolean;
  createdBy: string | null;
}

export interface CmsFeaturedOverview {
  rules: CmsFeaturedRules | null;
  current: CmsFeaturedCurrent | null;
  history: readonly CmsFeaturedHistoryRow[];
  overrides: readonly CmsFeaturedOverrideRow[];
  eligibleCount: number;
}

export interface CmsFeaturedCandidate {
  id: string;
  displayName: string;
  currentPosition: string | null;
  organization: string | null;
  promotion: string | null;
  lastFeaturedDate: string | null;
}

export interface CmsOrganizationOption {
  id: string;
  name: string;
  isVerified: boolean;
}

export interface CmsCampaignMetrics {
  impressions: number;
  clicks: number;
  /** `null` tant qu'aucune impression n'a ete enregistree : aucun taux invente. */
  ctr: number | null;
}
