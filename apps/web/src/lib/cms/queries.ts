import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  CmsAutomationJob,
  CmsCampaignMetrics,
  CmsCarouselItem,
  CmsContentType,
  CmsDashboard,
  CmsDashboardAlert,
  CmsEntityType,
  CmsEventRow,
  CmsFeaturedCandidate,
  CmsFeaturedOverview,
  CmsMediaAsset,
  CmsMediaOption,
  CmsNewsRow,
  CmsOpportunityRow,
  CmsOrganizationOption,
  CmsPartnerCampaign,
  CmsPendingSchedule,
  CmsPillarRow,
  CmsPlacement,
  CmsScheduleEntityType,
  CmsScheduleOrder,
  CmsScheduleStatus,
  CmsSection,
  CmsTextPosition,
  CmsSourceMode,
  CmsStatus,
} from './types';

/**
 * LECTURES DU BACK-OFFICE CMS.
 *
 * Deux chemins, jamais melanges :
 *
 *   * les huit tables `cms_*` sont lues DIRECTEMENT — leur RLS accorde
 *     `SELECT` a `cms.read`, c'est exactement ce qu'il faut. Les colonnes
 *     sont toujours ENUMEREES, jamais `select('*')` ;
 *   * `news`, `events` et les profils passent par les fonctions
 *     `SECURITY DEFINER` de 0067. Leur RLS ne connait pas les permissions
 *     CMS, et les privileges de colonne d'`ise_profiles` sont revoques
 *     (0028, 0046, 0050).
 *
 * Aucun message PostgreSQL ne franchit cette frontiere (D-102) : seuls
 * remontent un code metier et le `correlation_id`.
 */

export type CmsResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function fail<T>(raw: unknown, correlationId: string, what: string): CmsResult<T> {
  const code = (raw as { code?: string } | null)?.code;
  console.error('[ISE] lecture CMS en echec', { correlationId, what, code });
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

/* ------------------------------------------------------------------ */
/* Coercions — la base renvoie du `unknown`, on ne suppose rien        */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

const asRow = (value: unknown): Row =>
  typeof value === 'object' && value !== null ? (value as Row) : {};
const asRows = (value: unknown): Row[] => (Array.isArray(value) ? value.map(asRow) : []);

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const nstr = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown): boolean => value === true;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

const STATUSES: readonly CmsStatus[] = ['draft', 'scheduled', 'published', 'expired', 'archived'];
const ENTITY_TYPES: readonly CmsEntityType[] = [
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
];
const CONTENT_TYPES: readonly CmsContentType[] = [
  'event',
  'news',
  'opportunity',
  'program',
  'initiative',
  'partner',
  'institutional',
];
const PLACEMENTS: readonly CmsPlacement[] = [
  'carousel',
  'partners_band',
  'news_inline',
  'sidebar',
  'footer',
];
const SOURCE_MODES: readonly CmsSourceMode[] = ['automatic', 'manual', 'hybrid'];
const TEXT_POSITIONS: readonly CmsTextPosition[] = ['overlay', 'below', 'hidden'];
const SCHEDULE_STATUSES: readonly CmsScheduleStatus[] = [
  'pending',
  'applied',
  'cancelled',
  'failed',
];
const SCHEDULE_ENTITY_TYPES: readonly CmsScheduleEntityType[] = [
  'news',
  'event',
  'opportunity',
  'cms_carousel_item',
  'cms_partner_campaign',
  'cms_section',
];

/**
 * Un brouillon differe-t-il de la version publiee ?
 *
 * On compare les HORODATAGES plutot que les instantanes : `updated_at` est
 * pose par un trigger a chaque ecriture, `published_at` au moment ou
 * l'instantane est fige. Si le premier est posterieur au second, une
 * edition n'a pas ete publiee. Comparer les JSON serait plus precis mais
 * exigerait de rapatrier deux fois chaque ligne pour la meme conclusion.
 */
function hasUnpublishedChanges(updatedAt: string | null, publishedAt: string | null): boolean {
  if (publishedAt === null) return false;
  if (updatedAt === null) return false;
  return Date.parse(updatedAt) > Date.parse(publishedAt) + 1000;
}

function toPendingSchedule(value: unknown): CmsPendingSchedule | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = asRow(value);
  const id = nstr(row['id']);
  if (id === null) return null;
  return {
    id,
    publishAt: nstr(row['publish_at']),
    unpublishAt: nstr(row['unpublish_at']),
    status: oneOf(row['status'], SCHEDULE_STATUSES, 'pending'),
  };
}

/* ------------------------------------------------------------------ */
/* CMS-001 — Tableau de bord                                          */
/* ------------------------------------------------------------------ */

function toCounters(value: unknown): Record<string, number> {
  const row = asRow(value);
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(row)) out[key] = num(raw);
  return out;
}

export async function loadCmsDashboard(correlationId: string): Promise<CmsResult<CmsDashboard>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_cms_dashboard', {});
  if (error) return fail(error, correlationId, 'get_cms_dashboard');

  const root = asRow(data);
  const featured = asRow(root['featured_profile']);
  const alerts: CmsDashboardAlert[] = asRows(root['alerts']).map((alert) => ({
    code: str(alert['code']),
    severity: oneOf(alert['severity'], ['error', 'warning', 'info'] as const, 'info'),
    count: num(alert['count']),
  }));

  return {
    ok: true,
    data: {
      readAt: str(root['read_at']),
      day: str(root['day']),
      carousel: toCounters(root['carousel']),
      sections: toCounters(root['sections']),
      news: toCounters(root['news']),
      events: toCounters(root['events']),
      partners: toCounters(root['partners']),
      media: toCounters(root['media']),
      schedule: toCounters(root['schedule']),
      featuredProfile: {
        automationEnabled: bool(featured['automation_enabled']),
        todayStatus: nstr(featured['today_status']),
        todayMode: nstr(featured['today_mode']),
        activeOverride: bool(featured['active_override']),
        historyCount: num(featured['history_count']),
      },
      publishedToday: num(root['published_today']),
      lastPublishedAt: nstr(root['last_published_at']),
      alerts,
    },
  };
}

/**
 * Etat REEL des taches planifiees, lu dans `cron.job` et
 * `cron.job_run_details`. Aucune tache n'est declaree « qui tourne » sans
 * preuve (D-129).
 */
export async function loadCmsAutomationStatus(
  correlationId: string,
): Promise<CmsResult<readonly CmsAutomationJob[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_cms_automation_status', {});
  if (error) return fail(error, correlationId, 'get_cms_automation_status');

  const jobs = asRows(asRow(data)['jobs']).map((job) => ({
    jobName: str(job['job_name']),
    schedule: str(job['schedule']),
    isActive: bool(job['is_active']),
    lastRunAt: nstr(job['last_run_at']),
    lastStatus: nstr(job['last_status']),
    lastMessage: nstr(job['last_message']),
  }));
  return { ok: true, data: jobs };
}

/* ------------------------------------------------------------------ */
/* CMS-002 — Carrousel                                                */
/* ------------------------------------------------------------------ */

const CAROUSEL_COLUMNS =
  'id, title, subtitle, description, media_id, mobile_media_id, content_type, entity_type,' +
  ' entity_id, cta_label, start_at, end_at, priority, is_sponsored, partner_campaign_id,' +
  ' text_position, dim_media,' +
  ' status, published_at, published_snapshot, previous_published_snapshot, updated_at';

function toCarouselItem(
  row: Row,
  altByMedia: ReadonlyMap<string, string>,
  labelByCampaign: ReadonlyMap<string, string>,
): CmsCarouselItem {
  const mediaId = nstr(row['media_id']);
  const mobileMediaId = nstr(row['mobile_media_id']);
  const campaignId = nstr(row['partner_campaign_id']);
  const publishedAt = nstr(row['published_at']);
  const updatedAt = str(row['updated_at']);

  return {
    id: str(row['id']),
    title: str(row['title']),
    subtitle: nstr(row['subtitle']),
    description: nstr(row['description']),
    mediaId,
    mobileMediaId,
    mediaAlt: mediaId === null ? null : (altByMedia.get(mediaId) ?? null),
    mobileMediaAlt: mobileMediaId === null ? null : (altByMedia.get(mobileMediaId) ?? null),
    contentType: oneOf(row['content_type'], CONTENT_TYPES, 'institutional'),
    entityType: optionalOneOf(row['entity_type'], ENTITY_TYPES),
    entityId: nstr(row['entity_id']),
    ctaLabel: nstr(row['cta_label']),
    startAt: nstr(row['start_at']),
    endAt: nstr(row['end_at']),
    priority: num(row['priority']),
    textPosition: oneOf(row['text_position'], TEXT_POSITIONS, 'overlay'),
    dimMedia: bool(row['dim_media']),
    isSponsored: bool(row['is_sponsored']),
    partnerCampaignId: campaignId,
    sponsoredLabel: campaignId === null ? null : (labelByCampaign.get(campaignId) ?? null),
    status: oneOf(row['status'], STATUSES, 'draft'),
    publishedAt,
    hasPublishedSnapshot: row['published_snapshot'] !== null,
    hasPreviousSnapshot: row['previous_published_snapshot'] !== null,
    hasUnpublishedChanges: hasUnpublishedChanges(updatedAt, publishedAt),
    updatedAt,
  };
}

/** Index `media_id -> alt_text` : un visuel sans alternative n'est pas publiable. */
async function loadMediaAltIndex(): Promise<ReadonlyMap<string, string>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_media_assets')
    .select('id, alt_text')
    .is('deleted_at', null);
  const index = new Map<string, string>();
  for (const row of asRows(data)) index.set(str(row['id']), str(row['alt_text']));
  return index;
}

/** Index `campaign_id -> sponsored_label` : pas de mention, pas de diffusion (§26). */
async function loadCampaignLabelIndex(): Promise<ReadonlyMap<string, string>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('cms_partner_campaigns').select('id, sponsored_label');
  const index = new Map<string, string>();
  for (const row of asRows(data)) index.set(str(row['id']), str(row['sponsored_label']));
  return index;
}

export async function loadCarouselItems(
  query: string | null,
  correlationId: string,
): Promise<CmsResult<readonly CmsCarouselItem[]>> {
  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from('cms_carousel_items')
    .select(CAROUSEL_COLUMNS)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (query !== null && query.length > 0) {
    request = request.ilike('title', `%${query}%`);
  }

  const { data, error } = await request;
  if (error) return fail(error, correlationId, 'cms_carousel_items');

  const [alts, labels] = await Promise.all([loadMediaAltIndex(), loadCampaignLabelIndex()]);
  return { ok: true, data: asRows(data).map((row) => toCarouselItem(row, alts, labels)) };
}

export async function loadCarouselItem(
  itemId: string,
  correlationId: string,
): Promise<CmsResult<CmsCarouselItem | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cms_carousel_items')
    .select(CAROUSEL_COLUMNS)
    .eq('id', itemId)
    .maybeSingle();
  if (error) return fail(error, correlationId, 'cms_carousel_item');
  if (data === null) return { ok: true, data: null };

  const [alts, labels] = await Promise.all([loadMediaAltIndex(), loadCampaignLabelIndex()]);
  return { ok: true, data: toCarouselItem(asRow(data), alts, labels) };
}

/* ------------------------------------------------------------------ */
/* CMS-003 — Sections d'accueil                                       */
/* ------------------------------------------------------------------ */

const SECTION_COLUMNS =
  'id, section_key, title, subtitle, is_enabled, display_order, source_mode, max_items,' +
  ' cta_label, cta_entity_type, cta_entity_id, configuration, is_structural, status,' +
  ' published_at, published_snapshot, previous_published_snapshot, updated_at';

function toSection(row: Row): CmsSection {
  const publishedAt = nstr(row['published_at']);
  const configuration = row['configuration'];
  return {
    id: str(row['id']),
    sectionKey: str(row['section_key']),
    title: nstr(row['title']),
    subtitle: nstr(row['subtitle']),
    isEnabled: bool(row['is_enabled']),
    displayOrder: num(row['display_order']),
    sourceMode: oneOf(row['source_mode'], SOURCE_MODES, 'automatic'),
    maxItems: num(row['max_items']),
    ctaLabel: nstr(row['cta_label']),
    ctaEntityType: optionalOneOf(row['cta_entity_type'], ENTITY_TYPES),
    ctaEntityId: nstr(row['cta_entity_id']),
    isStructural: bool(row['is_structural']),
    status: oneOf(row['status'], STATUSES, 'draft'),
    publishedAt,
    hasPublishedSnapshot: row['published_snapshot'] !== null,
    hasPreviousSnapshot: row['previous_published_snapshot'] !== null,
    hasUnpublishedChanges: hasUnpublishedChanges(str(row['updated_at']), publishedAt),
    configuration:
      typeof configuration === 'object' && configuration !== null
        ? (configuration as Record<string, unknown>)
        : {},
  };
}

export async function loadSections(
  correlationId: string,
): Promise<CmsResult<readonly CmsSection[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cms_sections')
    .select(SECTION_COLUMNS)
    .order('display_order', { ascending: true });
  if (error) return fail(error, correlationId, 'cms_sections');
  return { ok: true, data: asRows(data).map(toSection) };
}

/* ------------------------------------------------------------------ */
/* CMS-004 / CMS-005 — Actualites et evenements                       */
/* ------------------------------------------------------------------ */

export interface CmsPage<T> {
  total: number;
  rows: readonly T[];
}

export async function loadCmsNews(
  query: string | null,
  correlationId: string,
  limit = 40,
): Promise<CmsResult<CmsPage<CmsNewsRow>>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_cms_news', {
    p_query: query,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) return fail(error, correlationId, 'list_cms_news');

  const root = asRow(data);
  const rows: CmsNewsRow[] = asRows(root['rows']).map((row) => ({
    id: str(row['id']),
    title: str(row['title']),
    slug: str(row['slug']),
    summary: str(row['summary']),
    categoryCode: str(row['category_code']),
    imagePath: nstr(row['image_path']),
    coverMediaId: nstr(row['cover_media_id']),
    coverHasText: bool(row['cover_has_text']),
    editorialStatus: str(row['editorial_status']),
    visibility: str(row['visibility']),
    landingVisibility: oneOf(row['landing_visibility'], ['hidden', 'visible'] as const, 'hidden'),
    landingPriority: num(row['landing_priority']),
    isFeatured: bool(row['is_featured']),
    featuredAt: nstr(row['featured_at']),
    publishedAt: nstr(row['published_at']),
    pendingSchedule: toPendingSchedule(row['pending_schedule']),
  }));

  return { ok: true, data: { total: num(root['total']), rows } };
}

export async function loadCmsEvents(
  query: string | null,
  correlationId: string,
  limit = 40,
): Promise<CmsResult<CmsPage<CmsEventRow>>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_cms_events', {
    p_query: query,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) return fail(error, correlationId, 'list_cms_events');

  const root = asRow(data);
  const rows: CmsEventRow[] = asRows(root['rows']).map((row) => ({
    id: str(row['id']),
    title: str(row['title']),
    slug: str(row['slug']),
    eventTypeCode: str(row['event_type_code']),
    format: str(row['format']),
    city: nstr(row['city']),
    countryCode: nstr(row['country_code']),
    startsAt: str(row['starts_at']),
    endsAt: nstr(row['ends_at']),
    timezone: str(row['timezone']),
    status: str(row['status']),
    visibility: str(row['visibility']),
    cancelledAt: nstr(row['cancelled_at']),
    landingVisibility: oneOf(row['landing_visibility'], ['hidden', 'visible'] as const, 'hidden'),
    landingPriority: num(row['landing_priority']),
    isUpcoming: bool(row['is_upcoming']),
    isPinned: bool(row['is_pinned']),
    landingBlockedReason: nstr(row['landing_blocked_reason']),
    coverMediaId: nstr(row['cover_media_id']),
    pendingSchedule: toPendingSchedule(row['pending_schedule']),
  }));

  return { ok: true, data: { total: num(root['total']), rows } };
}

/* ------------------------------------------------------------------ */
/* CMS-006bis (0113) — Opportunites                                   */
/* ------------------------------------------------------------------ */

export async function loadCmsOpportunities(
  query: string | null,
  correlationId: string,
  limit = 40,
): Promise<CmsResult<CmsPage<CmsOpportunityRow>>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_cms_opportunities', {
    p_query: query,
    p_limit: limit,
    p_offset: 0,
  });
  if (error) return fail(error, correlationId, 'list_cms_opportunities');

  const root = asRow(data);
  const rows: CmsOpportunityRow[] = asRows(root['rows']).map((row) => ({
    id: str(row['id']),
    title: str(row['title']),
    summary: nstr(row['summary']),
    opportunityType: nstr(row['opportunity_type']),
    contractType: nstr(row['contract_type']),
    sector: nstr(row['sector']),
    countryCode: nstr(row['country_code']),
    city: nstr(row['city']),
    remoteAllowed: bool(row['remote_allowed']),
    deadline: nstr(row['deadline']),
    status: str(row['status']),
    moderationStatus: str(row['moderation_status']),
    visibility: str(row['visibility']),
    landingVisibility: oneOf(row['landing_visibility'], ['hidden', 'visible'] as const, 'hidden'),
    landingPriority: num(row['landing_priority']),
    coverMediaId: nstr(row['cover_media_id']),
    publishedAt: nstr(row['published_at']),
    organization: nstr(row['organization']),
    isPinned: bool(row['is_pinned']),
    landingBlockedReason: nstr(row['landing_blocked_reason']),
    pendingSchedule: toPendingSchedule(row['pending_schedule']),
  }));

  return { ok: true, data: { total: num(root['total']), rows } };
}

/* ------------------------------------------------------------------ */
/* CMS-006 — ISE du jour                                              */
/* ------------------------------------------------------------------ */

export async function loadFeaturedOverview(
  correlationId: string,
): Promise<CmsResult<CmsFeaturedOverview>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_cms_featured_profile_overview', {
    p_history_limit: 20,
  });
  if (error) return fail(error, correlationId, 'get_cms_featured_profile_overview');

  const root = asRow(data);
  const rulesRow = root['rules'];
  const currentRow = root['current'];

  return {
    ok: true,
    data: {
      rules:
        rulesRow === null || rulesRow === undefined
          ? null
          : {
              minDaysBetweenFeatures: num(asRow(rulesRow)['min_days_between_features'], 90),
              requireClaimedProfile: bool(asRow(rulesRow)['require_claimed_profile']),
              requirePublicPhoto: bool(asRow(rulesRow)['require_public_photo']),
              requirePromotion: bool(asRow(rulesRow)['require_promotion']),
              requireExpertiseOrPosition: bool(asRow(rulesRow)['require_expertise_or_position']),
              balanceDimension: str(asRow(rulesRow)['balance_dimension'], 'none'),
              isAutomationEnabled: bool(asRow(rulesRow)['is_automation_enabled']),
            },
      current:
        currentRow === null || currentRow === undefined
          ? null
          : {
              profileId: str(asRow(currentRow)['profile_id']),
              displayName: str(asRow(currentRow)['display_name']),
              currentPosition: nstr(asRow(currentRow)['current_position']),
              organization: nstr(asRow(currentRow)['organization']),
              promotion: nstr(asRow(currentRow)['promotion']),
              publicSummary: nstr(asRow(currentRow)['public_summary']),
              avatarPath: nstr(asRow(currentRow)['avatar_path']),
              featuredDate: str(asRow(currentRow)['featured_date']),
              selectionMode: str(asRow(currentRow)['selection_mode'], 'automatic'),
              status: str(asRow(currentRow)['status'], 'scheduled'),
              publishedAt: nstr(asRow(currentRow)['published_at']),
              selectionContext: asRow(asRow(currentRow)['selection_context']),
              showcaseMediaId: nstr(asRow(currentRow)['showcase_media_id']),
              showcaseTagline: nstr(asRow(currentRow)['showcase_tagline']),
            },
      history: asRows(root['history']).map((row) => ({
        featuredDate: str(row['featured_date']),
        profileId: str(row['profile_id']),
        displayName: str(row['display_name']),
        currentPosition: nstr(row['current_position']),
        selectionMode: str(row['selection_mode'], 'automatic'),
        status: str(row['status'], 'published'),
        publishedAt: nstr(row['published_at']),
        selectedBy: nstr(row['selected_by']),
      })),
      overrides: asRows(root['overrides']).map((row) => ({
        id: str(row['id']),
        overrideKind: oneOf(row['override_kind'], ['pin', 'exclude', 'hide'] as const, 'pin'),
        profileId: nstr(row['profile_id']),
        displayName: nstr(row['display_name']),
        startsAt: str(row['starts_at']),
        endsAt: nstr(row['ends_at']),
        reason: nstr(row['reason']),
        isActive: bool(row['is_active']),
        createdBy: nstr(row['created_by']),
      })),
      eligibleCount: num(root['eligible_count']),
    },
  };
}

export async function loadFeaturedCandidates(
  query: string | null,
  correlationId: string,
): Promise<CmsResult<readonly CmsFeaturedCandidate[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_cms_featured_profile_candidates', {
    p_query: query,
    p_limit: 30,
  });
  if (error) return fail(error, correlationId, 'list_cms_featured_profile_candidates');

  return {
    ok: true,
    data: asRows(data).map((row) => ({
      id: str(row['id']),
      displayName: str(row['display_name']),
      currentPosition: nstr(row['current_position']),
      organization: nstr(row['organization']),
      promotion: nstr(row['promotion']),
      lastFeaturedDate: nstr(row['last_featured_date']),
    })),
  };
}

/** Teaser public, tel que la landing le sert. Sert d'apercu a CMS-006. */
export async function loadPublicFeaturedTeaser(
  correlationId: string,
): Promise<CmsResult<Record<string, unknown> | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_landing_featured_profile', {});
  if (error) return fail(error, correlationId, 'get_landing_featured_profile');
  if (data === null || data === undefined) return { ok: true, data: null };
  return { ok: true, data: asRow(data) };
}

/* ------------------------------------------------------------------ */
/* CMS-007 — Partenaires                                              */
/* ------------------------------------------------------------------ */

const CAMPAIGN_COLUMNS =
  'id, organization_id, campaign_name, admin_contact_profile_id, placement, title, description,' +
  ' media_id, mobile_media_id, cta_label, target_entity_type, target_entity_id, target_url,' +
  ' sponsored_label, start_at, end_at, status, published_at, previous_published_snapshot, updated_at';

function toCampaign(row: Row, organizationNames: ReadonlyMap<string, string>): CmsPartnerCampaign {
  const organizationId = str(row['organization_id']);
  const publishedAt = nstr(row['published_at']);
  const status = oneOf(row['status'], STATUSES, 'draft');
  const startAt = str(row['start_at']);
  const endAt = str(row['end_at']);
  const now = Date.now();

  return {
    id: str(row['id']),
    organizationId,
    organizationName: organizationNames.get(organizationId) ?? null,
    campaignName: str(row['campaign_name']),
    placement: oneOf(row['placement'], PLACEMENTS, 'partners_band'),
    title: nstr(row['title']),
    description: nstr(row['description']),
    mediaId: nstr(row['media_id']),
    mobileMediaId: nstr(row['mobile_media_id']),
    ctaLabel: nstr(row['cta_label']),
    targetEntityType: optionalOneOf(row['target_entity_type'], ENTITY_TYPES),
    targetEntityId: nstr(row['target_entity_id']),
    targetUrl: nstr(row['target_url']),
    sponsoredLabel: str(row['sponsored_label']),
    startAt,
    endAt,
    status,
    publishedAt,
    hasPreviousSnapshot: row['previous_published_snapshot'] !== null,
    hasUnpublishedChanges: hasUnpublishedChanges(str(row['updated_at']), publishedAt),
    isLive: status === 'published' && Date.parse(startAt) <= now && Date.parse(endAt) > now,
  };
}

async function loadOrganizationNames(): Promise<ReadonlyMap<string, string>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('organizations').select('id, canonical_name');
  const index = new Map<string, string>();
  for (const row of asRows(data)) index.set(str(row['id']), str(row['canonical_name']));
  return index;
}

export async function loadPartnerCampaigns(
  query: string | null,
  correlationId: string,
): Promise<CmsResult<readonly CmsPartnerCampaign[]>> {
  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from('cms_partner_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .order('start_at', { ascending: false });
  if (query !== null && query.length > 0) request = request.ilike('campaign_name', `%${query}%`);

  const { data, error } = await request;
  if (error) return fail(error, correlationId, 'cms_partner_campaigns');

  const names = await loadOrganizationNames();
  return { ok: true, data: asRows(data).map((row) => toCampaign(row, names)) };
}

export async function loadPartnerCampaign(
  campaignId: string,
  correlationId: string,
): Promise<CmsResult<CmsPartnerCampaign | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cms_partner_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('id', campaignId)
    .maybeSingle();
  if (error) return fail(error, correlationId, 'cms_partner_campaign');
  if (data === null) return { ok: true, data: null };

  const names = await loadOrganizationNames();
  return { ok: true, data: toCampaign(asRow(data), names) };
}

/**
 * Mesures d'une campagne. `get_partner_campaign_metrics()` ne fabrique
 * aucun chiffre : sans impression, le CTR reste `null` (§51).
 */
export async function loadCampaignMetrics(
  campaignId: string,
  correlationId: string,
): Promise<CmsResult<CmsCampaignMetrics | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_partner_campaign_metrics', {
    p_campaign_id: campaignId,
  });
  if (error) return fail(error, correlationId, 'get_partner_campaign_metrics');

  const first = asRows(asRow(data)['campaigns'])[0];
  if (first === undefined) return { ok: true, data: null };
  const ctr = first['ctr'];
  return {
    ok: true,
    data: {
      impressions: num(first['impressions']),
      clicks: num(first['clicks']),
      ctr: typeof ctr === 'number' ? ctr : typeof ctr === 'string' ? Number(ctr) : null,
    },
  };
}

export async function loadOrganizations(
  correlationId: string,
): Promise<CmsResult<readonly CmsOrganizationOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, canonical_name, is_verified')
    .order('canonical_name', { ascending: true })
    .limit(500);
  if (error) return fail(error, correlationId, 'organizations');

  return {
    ok: true,
    data: asRows(data).map((row) => ({
      id: str(row['id']),
      name: str(row['canonical_name']),
      isVerified: bool(row['is_verified']),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* CMS-008 — Mediatheque                                              */
/* ------------------------------------------------------------------ */

const MEDIA_COLUMNS =
  'id, bucket_id, storage_path, filename, mime_type, width, height, size_bytes, alt_text, credit,' +
  ' variant_kind, source_media_id, created_at';

export async function loadMediaAssets(
  query: string | null,
  correlationId: string,
): Promise<CmsResult<readonly CmsMediaAsset[]>> {
  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from('cms_media_assets')
    .select(MEDIA_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (query !== null && query.length > 0) request = request.ilike('filename', `%${query}%`);

  const { data, error } = await request;
  if (error) return fail(error, correlationId, 'cms_media_assets');

  const rows = asRows(data);
  const originals = rows.filter((row) => str(row['variant_kind']) === 'original');

  // References d'usage (§38) : comptees, jamais estimees. `organizations`
  // (0146) compte les logos de la section « Ils nous font confiance »
  // (`cms_landing_organizations.media_id`, 0133) : avant ce compteur, un
  // logo activement affiche pouvait etre supprime sans avertissement, la
  // meme faille que §38 decrit deja pour le carrousel et les campagnes.
  const [carouselRefs, campaignRefs, organizationRefs] = await Promise.all([
    supabase.from('cms_carousel_items').select('media_id, mobile_media_id'),
    supabase.from('cms_partner_campaigns').select('media_id, mobile_media_id'),
    supabase.from('cms_landing_organizations').select('media_id'),
  ]);

  const countUsage = (payload: unknown, keys: readonly string[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const row of asRows(payload)) {
      for (const key of keys) {
        const id = nstr(row[key]);
        if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  };
  const carouselUsage = countUsage(carouselRefs.data, ['media_id', 'mobile_media_id']);
  const campaignUsage = countUsage(campaignRefs.data, ['media_id', 'mobile_media_id']);
  const organizationUsage = countUsage(organizationRefs.data, ['media_id']);

  const assets: CmsMediaAsset[] = originals.map((row) => {
    const id = str(row['id']);
    const variants = rows
      .filter((candidate) => nstr(candidate['source_media_id']) === id)
      .map((candidate) => ({
        id: str(candidate['id']),
        variantKind: oneOf(
          candidate['variant_kind'],
          ['desktop', 'mobile', 'thumbnail'] as const,
          'desktop',
        ),
        width: typeof candidate['width'] === 'number' ? candidate['width'] : null,
        height: typeof candidate['height'] === 'number' ? candidate['height'] : null,
        storagePath: str(candidate['storage_path']),
      }));

    return {
      id,
      bucketId: str(row['bucket_id']),
      storagePath: str(row['storage_path']),
      filename: str(row['filename']),
      mimeType: str(row['mime_type']),
      width: typeof row['width'] === 'number' ? row['width'] : null,
      height: typeof row['height'] === 'number' ? row['height'] : null,
      sizeBytes: typeof row['size_bytes'] === 'number' ? row['size_bytes'] : null,
      altText: str(row['alt_text']),
      credit: nstr(row['credit']),
      variantKind: 'original',
      sourceMediaId: null,
      createdAt: str(row['created_at']),
      variants,
      usage: {
        carousel: carouselUsage.get(id) ?? 0,
        campaigns: campaignUsage.get(id) ?? 0,
        organizations: organizationUsage.get(id) ?? 0,
      },
    };
  });

  return { ok: true, data: assets };
}

/** Liste allegee pour les listes deroulantes « choisir un visuel ». */
export async function loadMediaOptions(
  correlationId: string,
): Promise<CmsResult<readonly CmsMediaOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cms_media_assets')
    .select('id, filename, alt_text')
    .is('deleted_at', null)
    .eq('variant_kind', 'original')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return fail(error, correlationId, 'cms_media_options');

  return {
    ok: true,
    data: asRows(data).map((row) => ({
      id: str(row['id']),
      filename: str(row['filename']),
      altText: str(row['alt_text']),
    })),
  };
}

const PILLAR_KEYS = ['connecter', 'entraider', 'collaborer', 'impacter'] as const;
const PILLAR_LINK_TARGETS = ['search', 'calls', 'projects', 'opportunities', 'applications'] as const;

/** CMS-011 (0114) — les 4 piliers, toujours dans le meme ordre. */
export async function loadCmsPillars(
  correlationId: string,
): Promise<CmsResult<readonly CmsPillarRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_cms_pillars');
  if (error) return fail(error, correlationId, 'list_cms_pillars');

  return {
    ok: true,
    data: asRows(data).map((row) => ({
      pillarKey: oneOf(row['pillar_key'], PILLAR_KEYS, 'connecter'),
      // 0129 — `null` veut dire « valeur d'origine », pas « vide » : l'ecran
      // CMS affiche alors le texte d'usine dans le champ pre-rempli.
      title: nstr(row['title']),
      body: nstr(row['body']),
      mediaId: nstr(row['media_id']),
      caption: nstr(row['caption']),
      linkTarget: optionalOneOf(row['link_target'], PILLAR_LINK_TARGETS),
      updatedAt: str(row['updated_at']),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* CMS-009 — Programmation                                            */
/* ------------------------------------------------------------------ */

const SCHEDULE_COLUMNS =
  'id, entity_type, entity_id, publish_at, unpublish_at, status, applied_at, last_run_at,' +
  ' run_count, last_error, created_at';

export async function loadScheduleOrders(
  correlationId: string,
): Promise<CmsResult<readonly CmsScheduleOrder[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cms_publication_schedule')
    .select(SCHEDULE_COLUMNS)
    .order('publish_at', { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) return fail(error, correlationId, 'cms_publication_schedule');

  const rows = asRows(data);

  // Libelles des contenus vises, pour ne pas afficher des UUID nus.
  // Seuls les objets `cms_*` sont resolus ici : news et events le sont par
  // leurs propres fonctions, appelees par l'ecran quand il en a besoin.
  const [carousel, campaigns, sections] = await Promise.all([
    supabase.from('cms_carousel_items').select('id, title'),
    supabase.from('cms_partner_campaigns').select('id, campaign_name'),
    supabase.from('cms_sections').select('id, section_key, title'),
  ]);

  const labels = new Map<string, string>();
  for (const row of asRows(carousel.data)) labels.set(str(row['id']), str(row['title']));
  for (const row of asRows(campaigns.data)) labels.set(str(row['id']), str(row['campaign_name']));
  for (const row of asRows(sections.data)) {
    labels.set(str(row['id']), nstr(row['title']) ?? str(row['section_key']));
  }

  return {
    ok: true,
    data: rows.map((row) => ({
      id: str(row['id']),
      entityType: oneOf(row['entity_type'], SCHEDULE_ENTITY_TYPES, 'cms_carousel_item'),
      entityId: str(row['entity_id']),
      publishAt: nstr(row['publish_at']),
      unpublishAt: nstr(row['unpublish_at']),
      status: oneOf(row['status'], SCHEDULE_STATUSES, 'pending'),
      appliedAt: nstr(row['applied_at']),
      lastRunAt: nstr(row['last_run_at']),
      runCount: num(row['run_count']),
      lastError: nstr(row['last_error']),
      createdAt: str(row['created_at']),
      label: labels.get(str(row['entity_id'])) ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* CMS-010 — Apercu                                                   */
/* ------------------------------------------------------------------ */

export interface CmsPreviewData {
  sections: readonly CmsSection[];
  carousel: readonly CmsCarouselItem[];
  news: readonly CmsNewsRow[];
  events: readonly CmsEventRow[];
  featured: CmsFeaturedOverview['current'];
  partners: readonly CmsPartnerCampaign[];
}

/**
 * Donnees de l'apercu (§41).
 *
 * `source = 'draft'` lit les COLONNES VIVANTES des tables `cms_*` : c'est
 * le brouillon reel, et le lire ne le publie pas. `source = 'published'`
 * ne garde que ce qui porte un instantane publie — exactement ce que sert
 * la landing.
 *
 * Les contenus metier (actualites, evenements) sont les memes dans les
 * deux cas : ils ne sont pas versionnes par le CMS, seule leur EXPOSITION
 * l'est (D-128). L'apercu applique donc le filtre `landing_visibility`.
 */
export async function loadPreviewData(
  source: 'draft' | 'published',
  correlationId: string,
): Promise<CmsResult<CmsPreviewData>> {
  const [sections, carousel, news, events, featured, partners] = await Promise.all([
    loadSections(correlationId),
    loadCarouselItems(null, correlationId),
    loadCmsNews(null, correlationId, 12),
    loadCmsEvents(null, correlationId, 12),
    loadFeaturedOverview(correlationId),
    loadPartnerCampaigns(null, correlationId),
  ]);

  if (!sections.ok) return sections;
  if (!carousel.ok) return carousel;
  if (!news.ok) return news;
  if (!events.ok) return events;
  if (!featured.ok) return featured;
  if (!partners.ok) return partners;

  const keepPublished = source === 'published';
  const now = Date.now();
  const inPeriod = (start: string | null, end: string | null): boolean =>
    (start === null || Date.parse(start) <= now) && (end === null || Date.parse(end) > now);

  return {
    ok: true,
    data: {
      sections: sections.data.filter((section) =>
        keepPublished ? section.hasPublishedSnapshot && section.isEnabled : true,
      ),
      carousel: carousel.data.filter((item) =>
        keepPublished
          ? item.hasPublishedSnapshot &&
            item.status === 'published' &&
            inPeriod(item.startAt, item.endAt)
          : item.status !== 'archived',
      ),
      news: news.data.rows.filter((row) =>
        keepPublished ? row.landingVisibility === 'visible' : true,
      ),
      // 0137 — l'apercu « publie » montre exactement ce que la landing
      // affichera : on se fie au meme motif de blocage que la projection,
      // plutot que de re-deviner la regle ici.
      events: events.data.rows.filter((row) =>
        keepPublished ? row.landingBlockedReason === null : row.isUpcoming,
      ),
      featured: featured.data.current,
      partners: partners.data.filter((campaign) => (keepPublished ? campaign.isLive : true)),
    },
  };
}
