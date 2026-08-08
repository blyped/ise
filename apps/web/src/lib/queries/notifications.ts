import { asArray, asObject, str } from '@/lib/network-view';
import { sealCursor } from '@/lib/opaque-cursor';
import { callRpc, type QueryResult } from '@/lib/queries/rpc';
import {
  toNotificationRow,
  toNotificationSummary,
  type CursorPage,
  type NotificationRow,
  type NotificationSummary,
} from '@/lib/messaging-view';

/**
 * Lectures du CENTRE DE NOTIFICATIONS (ISE-098).
 *
 * Les compteurs viennent tous de `public.notifications` via
 * `my_notification_summary()`. Aucun n'est estime, aucun n'est arrondi,
 * aucun n'est plafonne a « 99+ » : le chiffre affiche est le chiffre en
 * base (MASTER PROMPT §98).
 *
 * D-81 : `scope` filtre une PRIORITE (« Action requise »), `category`
 * filtre une CATEGORIE. Les deux ne se confondent jamais — la base
 * refuse d'ailleurs `action_required` comme categorie.
 */

export type NotificationScope = 'all' | 'action_required' | 'unread' | 'archived';

export async function loadNotifications(
  scope: NotificationScope,
  category: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<CursorPage<NotificationRow>>> {
  return callRpc(
    'list_my_notifications',
    { p_scope: scope, p_category: category, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      const nextCursor = str(raw['next_cursor']);
      return {
        rows: asArray(raw['rows']).flatMap((entry): NotificationRow[] => {
          const row = toNotificationRow(entry);
          return row === null ? [] : [row];
        }),
        nextCursor: nextCursor === null ? null : sealCursor(nextCursor),
      };
    },
  );
}

export async function loadNotificationSummary(
  correlationId: string,
): Promise<QueryResult<NotificationSummary>> {
  return callRpc('my_notification_summary', {}, correlationId, (payload) =>
    toNotificationSummary(payload),
  );
}
