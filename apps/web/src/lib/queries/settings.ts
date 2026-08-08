import { asObject } from '@/lib/network-view';
import { callRpc, type QueryResult } from '@/lib/queries/rpc';
import {
  toBlockedRows,
  toConsentRows,
  toFieldVisibilityRows,
  toMemberSettings,
  toNotificationPreferenceRows,
  toTermsRows,
  type BlockedProfileRow,
  type ConsentRow,
  type FieldVisibilityRow,
  type MemberSettings,
  type NotificationPreferenceRow,
  type TermsRow,
} from '@/lib/messaging-view';

/**
 * Lectures des PARAMETRES, de la CONFIDENTIALITE et des PREFERENCES
 * (ISE-099, SYS-009).
 *
 * `list_my_field_visibility()` renvoie, pour chaque champ, le niveau
 * courant, le defaut du referentiel `profile_visibility_defaults` ET la
 * liste `allowed_levels`. L'interface ne propose donc jamais un niveau
 * que la base refuserait : c'est le meme referentiel des deux cotes
 * (D-73, D-74).
 */

export async function loadMemberSettings(
  correlationId: string,
): Promise<QueryResult<MemberSettings>> {
  return callRpc('get_my_settings', {}, correlationId, (payload) => toMemberSettings(payload));
}

export async function loadFieldVisibility(
  correlationId: string,
): Promise<QueryResult<FieldVisibilityRow[]>> {
  return callRpc('list_my_field_visibility', {}, correlationId, (payload) =>
    toFieldVisibilityRows(payload),
  );
}

export async function loadNotificationPreferences(
  correlationId: string,
): Promise<QueryResult<NotificationPreferenceRow[]>> {
  return callRpc('list_my_notification_preferences', {}, correlationId, (payload) =>
    toNotificationPreferenceRows(payload),
  );
}

export interface ConsentView {
  consents: ConsentRow[];
  terms: TermsRow[];
}

export async function loadConsents(correlationId: string): Promise<QueryResult<ConsentView>> {
  return callRpc('list_my_consents', {}, correlationId, (payload) => {
    const raw = asObject(payload);
    return { consents: toConsentRows(raw['consents']), terms: toTermsRows(raw['terms']) };
  });
}

export async function loadBlockedProfiles(
  correlationId: string,
): Promise<QueryResult<BlockedProfileRow[]>> {
  return callRpc('list_my_blocked_profiles', {}, correlationId, (payload) =>
    toBlockedRows(payload),
  );
}
