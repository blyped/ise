import { adminRpc, type AdminRpcResult } from './rpc';
import {
  toAnalyticsOverview,
  toAnalyticsSegmentation,
  toDataQualityIssueItem,
  toDuplicateCandidateItem,
  toFeatureFlagItem,
  toImportBatchDetail,
  toImportBatchRow,
  toImportRowItem,
  toImportsOverview,
  toIncompleteProfileItem,
  toMaintenanceWindowItem,
  toPlatformSettingItem,
  toSeriesPoint,
  toSettingsHistoryEntry,
  type AnalyticsOverview,
  type AnalyticsSegmentation,
  type DataQualityIssueItem,
  type DuplicateCandidateItem,
  type FeatureFlagItem,
  type ImportBatchDetail,
  type ImportBatchRow,
  type ImportRowItem,
  type ImportsOverview,
  type IncompleteProfileItem,
  type MaintenanceWindowItem,
  type PlatformSettingItem,
  type SeriesPoint,
  type SettingsHistoryEntry,
} from './view';

/**
 * Lectures serveur du back-office « données ». Chaque loader appelle une
 * fonction `admin_*` (0080 → 0084) qui revérifie la permission en base :
 * ces wrappers ne décident rien, ils typent (D-102 pour les erreurs).
 */

function mapRows<T>(mapper: (value: unknown) => T | null): (payload: unknown) => T[] {
  return (payload) => (Array.isArray(payload) ? payload.flatMap((row) => mapper(row) ?? []) : []);
}

/* ----------------------------- Imports ---------------------------- */

export function loadImportsOverview(
  correlationId: string,
): Promise<AdminRpcResult<ImportsOverview>> {
  return adminRpc('admin_imports_overview', {}, correlationId, toImportsOverview);
}

export function loadImportBatches(
  correlationId: string,
  status: string | null = null,
  limit = 50,
): Promise<AdminRpcResult<ImportBatchRow[]>> {
  return adminRpc(
    'admin_list_import_batches',
    { p_limit: limit, p_status: status },
    correlationId,
    mapRows(toImportBatchRow),
  );
}

export function loadImportBatchDetail(
  batchId: string,
  correlationId: string,
): Promise<AdminRpcResult<ImportBatchDetail | null>> {
  return adminRpc('admin_get_import_batch', { p_batch_id: batchId }, correlationId, (payload) =>
    toImportBatchDetail(payload),
  );
}

export function loadImportRows(
  batchId: string,
  correlationId: string,
  status: string | null = null,
  limit = 200,
): Promise<AdminRpcResult<ImportRowItem[]>> {
  return adminRpc(
    'admin_list_import_rows',
    { p_batch_id: batchId, p_status: status, p_limit: limit },
    correlationId,
    mapRows(toImportRowItem),
  );
}

export function loadDuplicateCandidates(
  batchId: string,
  correlationId: string,
  status: string | null = null,
  limit = 100,
): Promise<AdminRpcResult<DuplicateCandidateItem[]>> {
  return adminRpc(
    'admin_list_duplicate_candidates',
    { p_batch_id: batchId, p_status: status, p_limit: limit },
    correlationId,
    mapRows(toDuplicateCandidateItem),
  );
}

export function loadDataQualityIssues(
  correlationId: string,
  batchId: string | null = null,
  severity: string | null = null,
  limit = 200,
): Promise<AdminRpcResult<DataQualityIssueItem[]>> {
  return adminRpc(
    'admin_list_data_quality_issues',
    { p_batch_id: batchId, p_severity: severity, p_status: 'open', p_limit: limit },
    correlationId,
    mapRows(toDataQualityIssueItem),
  );
}

export function loadIncompleteProfiles(
  correlationId: string,
  limit = 100,
): Promise<AdminRpcResult<IncompleteProfileItem[]>> {
  return adminRpc(
    'admin_list_incomplete_profiles',
    { p_limit: limit },
    correlationId,
    mapRows(toIncompleteProfileItem),
  );
}

/* ---------------------------- Analytics --------------------------- */

export function loadAnalyticsOverview(
  correlationId: string,
): Promise<AdminRpcResult<AnalyticsOverview>> {
  return adminRpc('admin_analytics_overview', {}, correlationId, toAnalyticsOverview);
}

export function loadAnalyticsSeries(
  metricCode: string,
  correlationId: string,
  days = 30,
): Promise<AdminRpcResult<SeriesPoint[]>> {
  return adminRpc(
    'admin_analytics_series',
    { p_metric_code: metricCode, p_days: days },
    correlationId,
    mapRows(toSeriesPoint),
  );
}

export function loadAnalyticsSegmentation(
  correlationId: string,
): Promise<AdminRpcResult<AnalyticsSegmentation>> {
  return adminRpc('admin_analytics_segmentation', {}, correlationId, toAnalyticsSegmentation);
}

/* ---------------------------- Paramètres -------------------------- */

export function loadPlatformSettings(
  correlationId: string,
): Promise<AdminRpcResult<PlatformSettingItem[]>> {
  return adminRpc(
    'admin_list_platform_settings',
    {},
    correlationId,
    mapRows(toPlatformSettingItem),
  );
}

export function loadFeatureFlags(
  correlationId: string,
): Promise<AdminRpcResult<FeatureFlagItem[]>> {
  return adminRpc('admin_list_feature_flags', {}, correlationId, mapRows(toFeatureFlagItem));
}

export function loadMaintenanceWindows(
  correlationId: string,
): Promise<AdminRpcResult<MaintenanceWindowItem[]>> {
  return adminRpc(
    'admin_list_maintenance_windows',
    { p_limit: 50 },
    correlationId,
    mapRows(toMaintenanceWindowItem),
  );
}

export function loadSettingsHistory(
  correlationId: string,
  limit = 50,
): Promise<AdminRpcResult<SettingsHistoryEntry[]>> {
  return adminRpc(
    'admin_settings_history',
    { p_limit: limit },
    correlationId,
    mapRows(toSettingsHistoryEntry),
  );
}
