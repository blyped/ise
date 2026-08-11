import { asArray, asObject, bool, num, str, strings } from '@/lib/network-view';

/**
 * Projections du back-office « données » (SA-043, SA-046 → SA-048) : conversion
 * défensive des charges renvoyées par les fonctions `admin_*` des
 * migrations 0080 → 0084 vers des types stricts. Un champ manquant
 * devient `null` ou une valeur sûre — jamais un `undefined` silencieux
 * (`exactOptionalPropertyTypes` actif).
 */

/* ------------------------------------------------------------------ */
/* SA-043 — Profils incomplets                                          */
/* ------------------------------------------------------------------ */

export interface IncompleteProfileItem {
  id: string;
  displayName: string;
  promotionYear: number | null;
  claimStatus: string;
  profileStatus: string;
  missingFields: string[];
  missingCount: number;
  hasContactEmail: boolean;
  createdAt: string | null;
}

export function toIncompleteProfileItem(value: unknown): IncompleteProfileItem | null {
  const raw = asObject(value);
  const id = str(raw['id']);
  if (id === null) return null;
  return {
    id,
    displayName: str(raw['display_name']) ?? '',
    promotionYear: num(raw['promotion_year']),
    claimStatus: str(raw['claim_status']) ?? 'unclaimed',
    profileStatus: str(raw['profile_status']) ?? 'referenced',
    missingFields: asArray(raw['missing_fields']).flatMap((f) => {
      const s = str(f);
      return s === null ? [] : [s];
    }),
    missingCount: num(raw['missing_count']) ?? 0,
    hasContactEmail: bool(raw['has_contact_email']),
    createdAt: str(raw['created_at']),
  };
}

/* ------------------------------------------------------------------ */
/* SA-046 — Analytics : catalogue d'indicateurs                         */
/* ------------------------------------------------------------------ */

export interface AnalyticsMetric {
  code: string;
  labelFr: string;
  definitionFr: string | null;
  unit: string | null;
  isComputable: boolean;
  sourceObjects: string[];
  /** `null` pour un indicateur non calculable : rien n'est inventé (§98). */
  value: number | null;
}

export interface AnalyticsEnrichment {
  totalProfiles: number;
  claimedProfiles: number;
  verifiedProfiles: number;
  enrichedProfiles: number;
}

export interface AnalyticsImpactYear {
  impactYear: number;
  impactType: string;
  attributionLevel: string;
  impactCount: number;
}

export interface AnalyticsOverview {
  generatedAt: string | null;
  metrics: AnalyticsMetric[];
  enrichment: AnalyticsEnrichment | null;
  impactByYear: AnalyticsImpactYear[];
}

export function toAnalyticsOverview(value: unknown): AnalyticsOverview {
  const raw = asObject(value);
  const enrichmentRaw = asObject(raw['enrichment']);
  const hasEnrichment = num(enrichmentRaw['total_profiles']) !== null;

  return {
    generatedAt: str(raw['generated_at']),
    metrics: asArray(raw['metrics']).flatMap((m) => {
      const item = asObject(m);
      const code = str(item['code']);
      if (code === null) return [];
      return [
        {
          code,
          labelFr: str(item['label_fr']) ?? code,
          definitionFr: str(item['definition_fr']),
          unit: str(item['unit']),
          isComputable: bool(item['is_computable']),
          sourceObjects: asArray(item['source_objects']).flatMap((s) => {
            const v = str(s);
            return v === null ? [] : [v];
          }),
          value: num(item['value']),
        },
      ];
    }),
    enrichment: hasEnrichment
      ? {
          totalProfiles: num(enrichmentRaw['total_profiles']) ?? 0,
          claimedProfiles: num(enrichmentRaw['claimed_profiles']) ?? 0,
          verifiedProfiles: num(enrichmentRaw['verified_profiles']) ?? 0,
          enrichedProfiles: num(enrichmentRaw['enriched_profiles']) ?? 0,
        }
      : null,
    impactByYear: asArray(raw['impact_by_year']).flatMap((y) => {
      const item = asObject(y);
      const impactYear = num(item['impact_year']);
      if (impactYear === null) return [];
      return [
        {
          impactYear,
          impactType: str(item['impact_type']) ?? '',
          attributionLevel: str(item['attribution_level']) ?? '',
          impactCount: num(item['impact_count']) ?? 0,
        },
      ];
    }),
  };
}

export interface SeriesPoint {
  metricDate: string;
  value: number;
}

export function toSeriesPoint(value: unknown): SeriesPoint | null {
  const raw = asObject(value);
  const metricDate = str(raw['metric_date']);
  const pointValue = num(raw['value']);
  if (metricDate === null || pointValue === null) return null;
  return { metricDate, value: pointValue };
}

/* ------------------------------------------------------------------ */
/* SA-047 — Segmentation                                                */
/* ------------------------------------------------------------------ */

export interface PromotionSegment {
  graduationYear: number;
  referencedCount: number;
  claimedCount: number;
  verifiedCount: number;
  activationRate: number | null;
  countryCount: number;
}

export interface CountrySegment {
  countryCode: string;
  countryName: string;
  profileCount: number;
  claimedCount: number;
}

export interface AnalyticsSegmentation {
  generatedAt: string | null;
  byPromotion: PromotionSegment[];
  byCountry: CountrySegment[];
  unlocatedCount: number;
  organizationCount: number;
}

export function toAnalyticsSegmentation(value: unknown): AnalyticsSegmentation {
  const raw = asObject(value);
  return {
    generatedAt: str(raw['generated_at']),
    byPromotion: asArray(raw['by_promotion']).flatMap((p) => {
      const item = asObject(p);
      const graduationYear = num(item['graduation_year']);
      if (graduationYear === null) return [];
      return [
        {
          graduationYear,
          referencedCount: num(item['referenced_count']) ?? 0,
          claimedCount: num(item['claimed_count']) ?? 0,
          verifiedCount: num(item['verified_count']) ?? 0,
          activationRate: num(item['activation_rate']),
          countryCount: num(item['country_count']) ?? 0,
        },
      ];
    }),
    byCountry: asArray(raw['by_country']).flatMap((c) => {
      const item = asObject(c);
      const countryCode = str(item['country_code']);
      if (countryCode === null) return [];
      return [
        {
          countryCode,
          countryName: str(item['country_name']) ?? countryCode,
          profileCount: num(item['profile_count']) ?? 0,
          claimedCount: num(item['claimed_count']) ?? 0,
        },
      ];
    }),
    unlocatedCount: num(raw['unlocated_count']) ?? 0,
    organizationCount: num(raw['organization_count']) ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* SA-048 — Paramètres, feature flags, maintenance, historique          */
/* ------------------------------------------------------------------ */

export interface PlatformSettingItem {
  key: string;
  value: unknown;
  valueKind: string;
  scope: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export function toPlatformSettingItem(value: unknown): PlatformSettingItem | null {
  const raw = asObject(value);
  const key = str(raw['key']);
  if (key === null) return null;
  return {
    key,
    value: raw['value'],
    valueKind: str(raw['value_kind']) ?? 'json',
    scope: str(raw['scope']) ?? 'admin',
    description: str(raw['description']),
    updatedBy: str(raw['updated_by']),
    updatedAt: str(raw['updated_at']),
  };
}

export interface FeatureFlagItem {
  code: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  rolloutStrategy: string;
  targetRoleCode: string | null;
  rolloutPercentage: number | null;
  overrideCount: number;
  updatedAt: string | null;
}

export function toFeatureFlagItem(value: unknown): FeatureFlagItem | null {
  const raw = asObject(value);
  const code = str(raw['code']);
  if (code === null) return null;
  return {
    code,
    name: str(raw['name']) ?? code,
    description: str(raw['description']),
    isEnabled: bool(raw['is_enabled']),
    rolloutStrategy: str(raw['rollout_strategy']) ?? 'off',
    targetRoleCode: str(raw['target_role_code']),
    rolloutPercentage: num(raw['rollout_percentage']),
    overrideCount: num(raw['override_count']) ?? 0,
    updatedAt: str(raw['updated_at']),
  };
}

export interface MaintenanceWindowItem {
  id: string;
  title: string;
  description: string | null;
  bannerMessage: string | null;
  affectedScope: string;
  isReadOnly: boolean;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  createdBy: string | null;
}

export function toMaintenanceWindowItem(value: unknown): MaintenanceWindowItem | null {
  const raw = asObject(value);
  const id = str(raw['id']);
  if (id === null) return null;
  return {
    id,
    title: str(raw['title']) ?? '',
    description: str(raw['description']),
    bannerMessage: str(raw['banner_message']),
    affectedScope: str(raw['affected_scope']) ?? 'all',
    isReadOnly: bool(raw['is_read_only']),
    status: str(raw['status']) ?? 'scheduled',
    startsAt: str(raw['starts_at']),
    endsAt: str(raw['ends_at']),
    actualStartedAt: str(raw['actual_started_at']),
    actualEndedAt: str(raw['actual_ended_at']),
    createdBy: str(raw['created_by']),
  };
}

export interface SettingsHistoryEntry {
  id: number;
  createdAt: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  actorName: string | null;
  result: string;
  context: Record<string, unknown>;
}

export function toSettingsHistoryEntry(value: unknown): SettingsHistoryEntry | null {
  const raw = asObject(value);
  const id = num(raw['id']);
  const action = str(raw['action']);
  if (id === null || action === null) return null;
  return {
    id,
    createdAt: str(raw['created_at']),
    action,
    objectType: str(raw['object_type']) ?? '',
    objectId: str(raw['object_id']),
    actorName: str(raw['actor_name']),
    result: str(raw['result']) ?? 'success',
    context: asObject(raw['context']),
  };
}

/* ------------------------------------------------------------------ */
/* SA-049 / SA-050 — Journal d'audit                                    */
/* ------------------------------------------------------------------ */

export interface AuditLogEntry {
  id: number;
  createdAt: string | null;
  actorKind: string;
  actorUserId: string | null;
  actorProfileId: string | null;
  actorName: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  result: string;
  errorCode: string | null;
  correlationId: string | null;
  requestIp: string | null;
  userAgent: string | null;
  context: Record<string, unknown>;
}

/**
 * `private.read_audit_log()` (0028, surchargee par 0083) renvoie les
 * MEMES colonnes pour `admin_read_audit_log` (liste) et
 * `admin_get_audit_entry` (detail, 0083) : un mapper unique suffit — la
 * fiche SA-050 n'ajoute aucune donnee que la ligne de liste SA-049 ne
 * porte deja (D-158, docs/decisions.md).
 */
export function toAuditLogEntry(value: unknown): AuditLogEntry | null {
  const raw = asObject(value);
  const id = num(raw['id']);
  const action = str(raw['action']);
  const objectType = str(raw['object_type']);
  if (id === null || action === null || objectType === null) return null;
  return {
    id,
    createdAt: str(raw['created_at']),
    actorKind: str(raw['actor_kind']) ?? 'system',
    actorUserId: str(raw['actor_user_id']),
    actorProfileId: str(raw['actor_profile_id']),
    actorName: str(raw['actor_name']),
    action,
    objectType,
    objectId: str(raw['object_id']),
    result: str(raw['result']) ?? 'success',
    errorCode: str(raw['error_code']),
    correlationId: str(raw['correlation_id']),
    requestIp: str(raw['request_ip']),
    userAgent: str(raw['user_agent']),
    context: asObject(raw['context']),
  };
}

export interface AuditActorOption {
  profileId: string;
  name: string;
}

export interface AuditOverview {
  actions7d: number;
  failures7d: number;
  distinctActors7d: number;
  totalEntries: number;
  /** Valeurs REELLEMENT presentes dans le journal — jamais un vocabulaire invente. */
  actions: string[];
  objectTypes: string[];
  actors: AuditActorOption[];
}

export function toAuditOverview(value: unknown): AuditOverview {
  const raw = asObject(value);
  return {
    actions7d: num(raw['actions_7d']) ?? 0,
    failures7d: num(raw['failures_7d']) ?? 0,
    distinctActors7d: num(raw['distinct_actors_7d']) ?? 0,
    totalEntries: num(raw['total_entries']) ?? 0,
    actions: strings(raw['actions']),
    objectTypes: strings(raw['object_types']),
    actors: asArray(raw['actors']).flatMap((entry) => {
      const item = asObject(entry);
      const profileId = str(item['profile_id']);
      const name = str(item['name']);
      if (profileId === null || name === null) return [];
      return [{ profileId, name }];
    }),
  };
}
