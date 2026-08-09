import { adminRpc, type AdminRpcResult } from './rpc';
import {
  toAnalyticsOverview,
  toAnalyticsSegmentation,
  toFeatureFlagItem,
  toIncompleteProfileItem,
  toMaintenanceWindowItem,
  toPlatformSettingItem,
  toSeriesPoint,
  toSettingsHistoryEntry,
  type AnalyticsOverview,
  type AnalyticsSegmentation,
  type FeatureFlagItem,
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

/* ------------------------- Profils incomplets ---------------------- */

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
