import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import { adminRpc, type AdminRpcResult } from './rpc';
import {
  toAnalyticsOverview,
  toAnalyticsSegmentation,
  toAuditLogEntry,
  toAuditOverview,
  toFeatureFlagItem,
  toIncompleteProfileItem,
  toMaintenanceWindowItem,
  toPlatformSettingItem,
  toSeriesPoint,
  toSettingsHistoryEntry,
  type AnalyticsOverview,
  type AnalyticsSegmentation,
  type AuditLogEntry,
  type AuditOverview,
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

/* ------------------------- Journal d'audit (SA-049 / SA-050) ------- */

/**
 * `public.admin_read_audit_log` (0083, façade de `private.read_audit_log`,
 * 0028/0083) renvoie un `TABLE(...)`, pas un `jsonb` : PostgREST le sérialise
 * en tableau de lignes directement — pas d'enveloppe `{rows, next_cursor}`
 * comme `admin_list_events`/`admin_list_communities`. La pagination par
 * curseur composite (`created_at`, `id` — D-44) est donc reconstruite ICI,
 * côté serveur Next, à partir de la dernière ligne reçue, puis scellée
 * (`lib/opaque-cursor.ts`) avant de quitter le serveur.
 */
const AUDIT_PAGE_SIZE = 25;

export interface AuditLogFilters {
  action: string | null;
  objectType: string | null;
  result: string | null;
  actorProfileId: string | null;
  /** Bornes ISO 8601, déjà résolues côté page (début/fin de journée). */
  from: string | null;
  to: string | null;
}

export interface AuditLogPage {
  rows: AuditLogEntry[];
  nextCursor: string | null;
}

function decodeAuditCursor(sealed: string | null): { createdAt: string | null; id: number | null } {
  const raw = unsealCursor(sealed);
  if (raw === null) return { createdAt: null, id: null };
  const sep = raw.lastIndexOf('|');
  if (sep < 0) return { createdAt: null, id: null };
  const createdAt = raw.slice(0, sep);
  const id = Number.parseInt(raw.slice(sep + 1), 10);
  return { createdAt, id: Number.isNaN(id) ? null : id };
}

function encodeAuditCursor(createdAt: string, id: number): string {
  return sealCursor(`${createdAt}|${id}`);
}

export function loadAuditLog(
  filters: AuditLogFilters,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AuditLogPage>> {
  const { createdAt, id } = decodeAuditCursor(cursor);
  return adminRpc(
    'admin_read_audit_log',
    {
      p_limit: AUDIT_PAGE_SIZE,
      p_before_created: createdAt,
      p_before_id: id,
      p_actor_profile_id: filters.actorProfileId,
      p_action: filters.action,
      p_object_type: filters.objectType,
      p_result: filters.result,
      p_from: filters.from,
      p_to: filters.to,
    },
    correlationId,
    (payload) => {
      const rows = Array.isArray(payload)
        ? payload.flatMap((row) => {
            const mapped = toAuditLogEntry(row);
            return mapped === null ? [] : [mapped];
          })
        : [];
      const last = rows[rows.length - 1];
      const nextCursor =
        rows.length === AUDIT_PAGE_SIZE && last !== undefined && last.createdAt !== null
          ? encodeAuditCursor(last.createdAt, last.id)
          : null;
      return { rows, nextCursor };
    },
  );
}

/** SA-050 — Détail d'une entrée (`admin_get_audit_entry`, 0083) : journalise sa propre consultation. */
export function loadAuditEntry(
  entryId: number,
  correlationId: string,
): Promise<AdminRpcResult<AuditLogEntry | null>> {
  return adminRpc('admin_get_audit_entry', { p_entry_id: entryId }, correlationId, toAuditLogEntry);
}

/** SA-049 — Compteurs 7 jours + facettes réelles (actions, types d'objet) pour les filtres. */
export function loadAuditOverview(correlationId: string): Promise<AdminRpcResult<AuditOverview>> {
  return adminRpc('admin_audit_overview', {}, correlationId, toAuditOverview);
}
