import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { criteriaToQueryString, parseCriteria, type SearchCriteria } from '@/lib/search-criteria';
import {
  ALERT_CHANNELS,
  ALERT_FREQUENCIES,
  type AlertChannel,
  type AlertFrequency,
  type AlertStatus,
} from '@/lib/alert-preferences';

/**
 * ISE-036 — recherches enregistrees et alertes.
 *
 * Ecritures via les fonctions atomiques de la migration 0035 :
 * `save_search_with_alert`, `set_search_alert_status`,
 * `delete_saved_search`. Aucune ne prend de `profile_id` : le
 * proprietaire est toujours `private.current_profile_id()`. Un appelant
 * ne peut donc pas atteindre la recherche d'un tiers, meme en forgeant
 * la requete (MASTER PROMPT §10, D-72).
 *
 * Les valeurs de `frequency`, `channel` et `status` sont celles que la
 * base accepte reellement (contraintes CHECK de la migration 0005) :
 * l'interface ne propose rien que la base refuserait.
 */

export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export type { AlertChannel, AlertFrequency, AlertStatus } from '@/lib/alert-preferences';

export interface SavedSearchView {
  savedSearchId: string;
  name: string;
  /** Criteres revalides : une ligne corrompue ne casse pas l'ecran. */
  criteria: SearchCriteria | null;
  queryString: string;
  createdAt: string;
  updatedAt: string;
  alertEnabled: boolean;
  alertFrequency: AlertFrequency | null;
  alertChannel: AlertChannel | null;
  alertStatus: AlertStatus | null;
  lastNotifiedAt: string | null;
}

interface RawSavedSearch {
  saved_search_id: string;
  name: string;
  criteria: unknown;
  created_at: string;
  updated_at: string;
  alert_enabled: boolean | null;
  alert_frequency: string | null;
  alert_channel: string | null;
  alert_status: string | null;
  last_notified_at: string | null;
}

const asFrequency = (value: unknown): AlertFrequency | null =>
  typeof value === 'string' && (ALERT_FREQUENCIES as readonly string[]).includes(value)
    ? (value as AlertFrequency)
    : null;

const asChannel = (value: unknown): AlertChannel | null =>
  typeof value === 'string' && (ALERT_CHANNELS as readonly string[]).includes(value)
    ? (value as AlertChannel)
    : null;

const asStatus = (value: unknown): AlertStatus | null =>
  value === 'active' || value === 'paused' ? value : null;

export async function listSavedSearches(
  correlationId: string,
): Promise<QueryResult<SavedSearchView[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_saved_searches');

  if (error) {
    console.error('[ISE] lecture des recherches enregistrees en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as RawSavedSearch[];
  return {
    ok: true,
    data: rows.map((row) => {
      const parsed = parseCriteria(row.criteria);
      const criteria = parsed.ok ? parsed.criteria : null;
      return {
        savedSearchId: row.saved_search_id,
        name: row.name,
        criteria,
        queryString: criteria ? criteriaToQueryString(criteria) : '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        alertEnabled: row.alert_enabled === true,
        alertFrequency: asFrequency(row.alert_frequency),
        alertChannel: asChannel(row.alert_channel),
        alertStatus: asStatus(row.alert_status),
        lastNotifiedAt: row.last_notified_at,
      };
    }),
  };
}

export interface SaveSearchArgs {
  name: string;
  criteria: SearchCriteria;
  alertEnabled: boolean;
  frequency: AlertFrequency;
  channel: AlertChannel;
  savedSearchId: string | null;
}

export async function saveSearchWithAlert(
  args: SaveSearchArgs,
  correlationId: string,
): Promise<QueryResult<string>> {
  const supabase = await createSupabaseServerClient();

  // Les criteres sont stockes sous la forme validee, pas sous la forme
  // saisie : une recherche relancee dans six mois doit repasser le meme
  // schema. `cursor` et `pageSize` ne sont pas des criteres : ils ne sont
  // pas enregistres.
  const { cursor: _cursor, pageSize: _pageSize, ...persisted } = args.criteria;

  const { data, error } = await supabase.rpc('save_search_with_alert', {
    p_name: args.name,
    p_criteria: persisted,
    p_alert_enabled: args.alertEnabled,
    p_frequency: args.frequency,
    p_channel: args.channel,
    p_saved_search_id: args.savedSearchId,
  });

  if (error) {
    console.error('[ISE] enregistrement de recherche en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  return { ok: true, data: typeof data === 'string' ? data : '' };
}

export async function setAlertStatus(
  savedSearchId: string,
  status: AlertStatus,
  correlationId: string,
): Promise<QueryResult<AlertStatus>> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_search_alert_status', {
    p_saved_search_id: savedSearchId,
    p_status: status,
  });

  if (error) {
    console.error('[ISE] changement de statut d alerte en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: status };
}

export async function deleteSavedSearch(
  savedSearchId: string,
  correlationId: string,
): Promise<QueryResult<true>> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('delete_saved_search', {
    p_saved_search_id: savedSearchId,
  });

  if (error) {
    console.error('[ISE] suppression de recherche enregistree en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: true };
}
