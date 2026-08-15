import { getSupabaseClient } from '../supabase/client';

/**
 * D-194 — lectures/ecritures du CENTRE DE NOTIFICATIONS (ISE-098) cote
 * mobile.
 *
 * Portage direct des RPC deja utilisees par
 * `apps/web/src/lib/queries/notifications.ts` : `my_notification_summary()`
 * (pastille de non-lus) et `list_my_notifications()` (liste minimale,
 * D-194). Meme discipline que `lib/queries/network.ts` : aucune colonne
 * n'est recomposee cote client, tout vient de la RPC telle quelle.
 *
 * Perimetre volontairement reduit par rapport au centre de notifications
 * web : pas de filtre par categorie/priorite, pas de pagination avancee —
 * une simple liste des notifications les plus recentes (20), triable par
 * lu/non lu par l'utilisateur en tapant dessus. Voir le rapport de
 * livraison pour la justification (aucun ecran de notifications n'existait
 * encore cote mobile).
 */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const bool = (value: unknown): boolean => value === true;

export interface NotificationSummary {
  readonly unread: number;
  readonly total: number;
}

export interface NotificationRow {
  readonly notificationId: string;
  readonly category: string;
  readonly title: string;
  readonly body: string | null;
  readonly actionPath: string | null;
  readonly read: boolean;
  readonly createdAt: string | null;
}

export interface NotificationSummaryResult {
  readonly summary: NotificationSummary | null;
  readonly failed: boolean;
}

export async function loadNotificationSummary(): Promise<NotificationSummaryResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('my_notification_summary');

  if (error) {
    return { summary: null, failed: true };
  }

  const raw = asObject(data);
  return {
    summary: { unread: num(raw['unread']) ?? 0, total: num(raw['total']) ?? 0 },
    failed: false,
  };
}

export interface NotificationsResult {
  readonly rows: readonly NotificationRow[];
  readonly failed: boolean;
}

/** Les 20 notifications les plus recentes, tout scope confondu (D-194, pas de filtre mobile). */
export async function loadRecentNotifications(): Promise<NotificationsResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_my_notifications', {
    p_scope: 'all',
    p_category: null,
    p_cursor: null,
    p_limit: 20,
  });

  if (error) {
    return { rows: [], failed: true };
  }

  const raw = asObject(data);
  const rows: NotificationRow[] = asArray(raw['rows']).flatMap((entry) => {
    const item = asObject(entry);
    const notificationId = str(item['notification_id']);
    const title = str(item['title']);
    if (notificationId === null || title === null) return [];
    return [
      {
        notificationId,
        category: str(item['category']) ?? 'system',
        title,
        body: str(item['body']),
        actionPath: str(item['action_path']),
        read: bool(item['read']),
        createdAt: str(item['created_at']),
      },
    ];
  });

  return { rows, failed: false };
}

/** Bascule lu/non lu d'une notification (`set_notification_read`, meme RPC que le web). */
export async function setNotificationRead(notificationId: string, read: boolean): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('set_notification_read', {
    p_notification_id: notificationId,
    p_read: read,
  });
  return !error;
}
