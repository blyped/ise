import { asArray, asObject, str } from '@/lib/network-view';
import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes administratives des annonces du tableau de bord membre (0145,
 * tache #188). Permission `communication.announcements.manage`, verifiee
 * EN BASE par chaque fonction `admin_*` — ce module ne fait que projeter
 * les charges `jsonb` vers des types stricts (meme principe que
 * `lib/admin/queries-news.ts`).
 */

export type AnnouncementSeverity = 'normal' | 'urgent';
export type AnnouncementStatus = 'draft' | 'published' | 'expired';

export interface AdminAnnouncementRow {
  id: string;
  body: string;
  severity: AnnouncementSeverity;
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  status: AnnouncementStatus;
}

function toSeverity(raw: unknown): AnnouncementSeverity {
  return raw === 'urgent' ? 'urgent' : 'normal';
}

function toStatus(raw: unknown): AnnouncementStatus {
  return raw === 'published' || raw === 'expired' ? raw : 'draft';
}

function toAnnouncementRow(raw: unknown): AdminAnnouncementRow | null {
  const row = asObject(raw);
  const id = str(row['id']);
  const body = str(row['body']);
  if (id === null || body === null) return null;
  return {
    id,
    body,
    severity: toSeverity(row['severity']),
    startsAt: str(row['starts_at']),
    endsAt: str(row['ends_at']),
    publishedAt: str(row['published_at']),
    createdAt: str(row['created_at']),
    status: toStatus(row['status']),
  };
}

export function loadAdminAnnouncements(
  correlationId: string,
): Promise<AdminRpcResult<AdminAnnouncementRow[]>> {
  return adminRpc('admin_list_dashboard_announcements', {}, correlationId, (payload) =>
    asArray(payload).flatMap((entry) => {
      const mapped = toAnnouncementRow(entry);
      return mapped === null ? [] : [mapped];
    }),
  );
}

export function loadAdminAnnouncementDetail(
  announcementId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminAnnouncementRow | null>> {
  return adminRpc(
    'admin_get_dashboard_announcement',
    { p_id: announcementId },
    correlationId,
    toAnnouncementRow,
  );
}
