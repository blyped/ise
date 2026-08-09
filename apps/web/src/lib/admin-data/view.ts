import { asArray, asObject, bool, num, str } from '@/lib/network-view';

/**
 * Projections du back-office « données » (SA-040 → SA-048) : conversion
 * défensive des charges renvoyées par les fonctions `admin_*` des
 * migrations 0080 → 0084 vers des types stricts. Un champ manquant
 * devient `null` ou une valeur sûre — jamais un `undefined` silencieux
 * (`exactOptionalPropertyTypes` actif).
 */

/* ------------------------------------------------------------------ */
/* SA-040 — Vue d'ensemble des imports                                  */
/* ------------------------------------------------------------------ */

export interface ImportsOverview {
  batches30d: number;
  batches30dReported: number;
  batchesInReview: number;
  pendingDuplicates: number;
  pendingDuplicatesProbable: number;
  openIssues: number;
  openIssuesErrors: number;
  pendingValueReviews: number;
  quality: {
    totalProfiles: number;
    identityComplete: number;
    withPosition: number;
    withCountry: number;
    emailValidOrAbsent: number;
  };
}

export function toImportsOverview(value: unknown): ImportsOverview {
  const raw = asObject(value);
  const quality = asObject(raw['quality']);
  return {
    batches30d: num(raw['batches_30d']) ?? 0,
    batches30dReported: num(raw['batches_30d_reported']) ?? 0,
    batchesInReview: num(raw['batches_in_review']) ?? 0,
    pendingDuplicates: num(raw['pending_duplicates']) ?? 0,
    pendingDuplicatesProbable: num(raw['pending_duplicates_probable']) ?? 0,
    openIssues: num(raw['open_issues']) ?? 0,
    openIssuesErrors: num(raw['open_issues_errors']) ?? 0,
    pendingValueReviews: num(raw['pending_value_reviews']) ?? 0,
    quality: {
      totalProfiles: num(quality['total_profiles']) ?? 0,
      identityComplete: num(quality['identity_complete']) ?? 0,
      withPosition: num(quality['with_position']) ?? 0,
      withCountry: num(quality['with_country']) ?? 0,
      emailValidOrAbsent: num(quality['email_valid_or_absent']) ?? 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Lots d'import (liste et détail)                                      */
/* ------------------------------------------------------------------ */

export interface ImportBatchRow {
  id: string;
  sourceName: string;
  sourceDate: string | null;
  originalFilename: string;
  fileFormat: string;
  status: string;
  isPilot: boolean;
  pilotLabel: string | null;
  totalRows: number;
  createdProfiles: number;
  updatedProfiles: number;
  ignoredRows: number;
  errorRows: number;
  reviewRows: number;
  stagedRows: number;
  validRows: number;
  invalidRows: number;
  needsReviewRows: number;
  importedRows: number;
  openIssues: number;
  pendingDuplicates: number;
  uploadedBy: string | null;
  createdAt: string | null;
  completedAt: string | null;
}

export function toImportBatchRow(value: unknown): ImportBatchRow | null {
  const raw = asObject(value);
  const id = str(raw['id']);
  if (id === null) return null;
  return {
    id,
    sourceName: str(raw['source_name']) ?? '',
    sourceDate: str(raw['source_date']),
    originalFilename: str(raw['original_filename']) ?? '',
    fileFormat: str(raw['file_format']) ?? 'csv',
    status: str(raw['status']) ?? 'uploaded',
    isPilot: bool(raw['is_pilot']),
    pilotLabel: str(raw['pilot_label']),
    totalRows: num(raw['total_rows']) ?? 0,
    createdProfiles: num(raw['created_profiles']) ?? 0,
    updatedProfiles: num(raw['updated_profiles']) ?? 0,
    ignoredRows: num(raw['ignored_rows']) ?? 0,
    errorRows: num(raw['error_rows']) ?? 0,
    reviewRows: num(raw['review_rows']) ?? 0,
    stagedRows: num(raw['staged_rows']) ?? 0,
    validRows: num(raw['valid_rows']) ?? 0,
    invalidRows: num(raw['invalid_rows']) ?? 0,
    needsReviewRows: num(raw['needs_review_rows']) ?? 0,
    importedRows: num(raw['imported_rows']) ?? 0,
    openIssues: num(raw['open_issues']) ?? 0,
    pendingDuplicates: num(raw['pending_duplicates']) ?? 0,
    uploadedBy: str(raw['uploaded_by']),
    createdAt: str(raw['created_at']),
    completedAt: str(raw['completed_at']),
  };
}

export interface ImportColumnMapping {
  sourceColumn: string;
  sourcePosition: number | null;
  targetField: string | null;
  transform: string;
  isIgnored: boolean;
}

export interface ImportStageEvent {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actor: string | null;
  createdAt: string | null;
}

export interface ImportReport {
  reportKind: string;
  totals: Record<string, unknown>;
  generatedAt: string | null;
}

export interface ImportBatchDetail {
  batch: {
    id: string;
    sourceName: string;
    sourceDate: string | null;
    originalFilename: string;
    fileFormat: string;
    storagePath: string | null;
    status: string;
    isPilot: boolean;
    pilotLabel: string | null;
    totalRows: number;
    createdProfiles: number;
    updatedProfiles: number;
    ignoredRows: number;
    errorRows: number;
    reviewRows: number;
    notes: string | null;
    createdAt: string | null;
    completedAt: string | null;
    uploadedBy: string | null;
  };
  sampleColumns: string[];
  sampleRows: Record<string, unknown>[];
  mappings: ImportColumnMapping[];
  stageEvents: ImportStageEvent[];
  reports: ImportReport[];
  duplicates: { pending: number; deferred: number; confirmed: number; dismissed: number };
  issueCounts: Record<string, number>;
}

export function toImportBatchDetail(value: unknown): ImportBatchDetail | null {
  const raw = asObject(value);
  const batchRaw = asObject(raw['batch']);
  const id = str(batchRaw['id']);
  if (id === null) return null;

  const duplicates = asObject(raw['duplicates']);
  const issueCountsRaw = asObject(raw['issue_counts']);
  const issueCounts: Record<string, number> = {};
  for (const [key, val] of Object.entries(issueCountsRaw)) {
    const n = num(val);
    if (n !== null) issueCounts[key] = n;
  }

  return {
    batch: {
      id,
      sourceName: str(batchRaw['source_name']) ?? '',
      sourceDate: str(batchRaw['source_date']),
      originalFilename: str(batchRaw['original_filename']) ?? '',
      fileFormat: str(batchRaw['file_format']) ?? 'csv',
      storagePath: str(batchRaw['storage_path']),
      status: str(batchRaw['status']) ?? 'uploaded',
      isPilot: bool(batchRaw['is_pilot']),
      pilotLabel: str(batchRaw['pilot_label']),
      totalRows: num(batchRaw['total_rows']) ?? 0,
      createdProfiles: num(batchRaw['created_profiles']) ?? 0,
      updatedProfiles: num(batchRaw['updated_profiles']) ?? 0,
      ignoredRows: num(batchRaw['ignored_rows']) ?? 0,
      errorRows: num(batchRaw['error_rows']) ?? 0,
      reviewRows: num(batchRaw['review_rows']) ?? 0,
      notes: str(batchRaw['notes']),
      createdAt: str(batchRaw['created_at']),
      completedAt: str(batchRaw['completed_at']),
      uploadedBy: str(batchRaw['uploaded_by']),
    },
    sampleColumns: asArray(raw['sample_columns']).flatMap((c) => {
      const s = str(c);
      return s === null ? [] : [s];
    }),
    sampleRows: asArray(raw['sample_rows']).map((r) => asObject(r)),
    mappings: asArray(raw['mappings']).flatMap((m) => {
      const item = asObject(m);
      const sourceColumn = str(item['source_column']);
      if (sourceColumn === null) return [];
      return [
        {
          sourceColumn,
          sourcePosition: num(item['source_position']),
          targetField: str(item['target_field']),
          transform: str(item['transform']) ?? 'none',
          isIgnored: bool(item['is_ignored']),
        },
      ];
    }),
    stageEvents: asArray(raw['stage_events']).flatMap((e) => {
      const item = asObject(e);
      const toStatus = str(item['to_status']);
      if (toStatus === null) return [];
      return [
        {
          fromStatus: str(item['from_status']),
          toStatus,
          note: str(item['note']),
          actor: str(item['actor']),
          createdAt: str(item['created_at']),
        },
      ];
    }),
    reports: asArray(raw['reports']).flatMap((r) => {
      const item = asObject(r);
      const reportKind = str(item['report_kind']);
      if (reportKind === null) return [];
      return [
        {
          reportKind,
          totals: asObject(item['totals']),
          generatedAt: str(item['generated_at']),
        },
      ];
    }),
    duplicates: {
      pending: num(duplicates['pending']) ?? 0,
      deferred: num(duplicates['deferred']) ?? 0,
      confirmed: num(duplicates['confirmed']) ?? 0,
      dismissed: num(duplicates['dismissed']) ?? 0,
    },
    issueCounts,
  };
}

/* ------------------------------------------------------------------ */
/* Lignes d'un lot                                                      */
/* ------------------------------------------------------------------ */

export interface ImportRowItem {
  id: number;
  rowNumber: number;
  sourceId: string | null;
  rawSourceData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  status: string;
  decision: string;
  decidedBy: string | null;
  decidedAt: string | null;
  matchedProfileId: string | null;
  matchScore: number | null;
  matchClass: string | null;
  resultingProfileId: string | null;
  errorCode: string | null;
  issues: { issueCode: string; severity: string; fieldName: string | null }[];
}

export function toImportRowItem(value: unknown): ImportRowItem | null {
  const raw = asObject(value);
  const id = num(raw['id']);
  const rowNumber = num(raw['row_number']);
  if (id === null || rowNumber === null) return null;
  return {
    id,
    rowNumber,
    sourceId: str(raw['source_id']),
    rawSourceData: asObject(raw['raw_source_data']),
    normalizedData: asObject(raw['normalized_data']),
    status: str(raw['status']) ?? 'staged',
    decision: str(raw['decision']) ?? 'pending',
    decidedBy: str(raw['decided_by']),
    decidedAt: str(raw['decided_at']),
    matchedProfileId: str(raw['matched_profile_id']),
    matchScore: num(raw['match_score']),
    matchClass: str(raw['match_class']),
    resultingProfileId: str(raw['resulting_profile_id']),
    errorCode: str(raw['error_code']),
    issues: asArray(raw['issues']).flatMap((i) => {
      const item = asObject(i);
      const issueCode = str(item['issue_code']);
      if (issueCode === null) return [];
      return [
        {
          issueCode,
          severity: str(item['severity']) ?? 'info',
          fieldName: str(item['field_name']),
        },
      ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* SA-042 — Candidats doublons                                          */
/* ------------------------------------------------------------------ */

export interface DuplicateExistingProfile {
  id: string;
  displayName: string;
  promotionYear: number | null;
  organization: string | null;
  position: string | null;
  city: string | null;
  countryCode: string | null;
  claimStatus: string;
  profileStatus: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

export interface DuplicateCandidateItem {
  id: string;
  importRowId: number;
  rowNumber: number;
  score: number;
  signals: string[];
  matchClass: string;
  status: string;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rowData: Record<string, unknown>;
  rowDecision: string;
  existingProfile: DuplicateExistingProfile | null;
}

export function toDuplicateCandidateItem(value: unknown): DuplicateCandidateItem | null {
  const raw = asObject(value);
  const id = str(raw['id']);
  const importRowId = num(raw['import_row_id']);
  if (id === null || importRowId === null) return null;

  const profileRaw = asObject(raw['existing_profile']);
  const profileId = str(profileRaw['id']);

  const signalsRaw = asObject(raw['signals']);
  const signals = Object.entries(signalsRaw)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  return {
    id,
    importRowId,
    rowNumber: num(raw['row_number']) ?? 0,
    score: num(raw['score']) ?? 0,
    signals,
    matchClass: str(raw['match_class']) ?? 'new',
    status: str(raw['status']) ?? 'pending',
    reviewNote: str(raw['review_note']),
    reviewedBy: str(raw['reviewed_by']),
    reviewedAt: str(raw['reviewed_at']),
    rowData: asObject(raw['row_data']),
    rowDecision: str(raw['row_decision']) ?? 'pending',
    existingProfile:
      profileId === null
        ? null
        : {
            id: profileId,
            displayName: str(profileRaw['display_name']) ?? '',
            promotionYear: num(profileRaw['promotion_year']),
            organization: str(profileRaw['organization']),
            position: str(profileRaw['position']),
            city: str(profileRaw['city']),
            countryCode: str(profileRaw['country_code']),
            claimStatus: str(profileRaw['claim_status']) ?? 'unclaimed',
            profileStatus: str(profileRaw['profile_status']) ?? 'referenced',
            email: str(profileRaw['email']),
            phone: str(profileRaw['phone']),
            linkedinUrl: str(profileRaw['linkedin_url']),
          },
  };
}

/* ------------------------------------------------------------------ */
/* Anomalies de qualité                                                 */
/* ------------------------------------------------------------------ */

export interface DataQualityIssueItem {
  id: number;
  batchId: string | null;
  importRowId: number | null;
  rowNumber: number | null;
  profileId: string | null;
  profileName: string | null;
  issueCode: string;
  severity: string;
  fieldName: string | null;
  recommendedAction: string | null;
  status: string;
  createdAt: string | null;
}

export function toDataQualityIssueItem(value: unknown): DataQualityIssueItem | null {
  const raw = asObject(value);
  const id = num(raw['id']);
  const issueCode = str(raw['issue_code']);
  if (id === null || issueCode === null) return null;
  return {
    id,
    batchId: str(raw['batch_id']),
    importRowId: num(raw['import_row_id']),
    rowNumber: num(raw['row_number']),
    profileId: str(raw['profile_id']),
    profileName: str(raw['profile_name']),
    issueCode,
    severity: str(raw['severity']) ?? 'info',
    fieldName: str(raw['field_name']),
    recommendedAction: str(raw['recommended_action']),
    status: str(raw['status']) ?? 'open',
    createdAt: str(raw['created_at']),
  };
}

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
