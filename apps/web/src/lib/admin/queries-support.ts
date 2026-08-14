import { asArray, asObject, bool, num, str } from '@/lib/network-view';
import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { adminRpc, type AdminRpcResult } from './rpc';
import type { AdminCursorPage } from './view';
import {
  SUPPORT_ATTACHMENTS_BUCKET,
  supportObjectName,
  type SupportAttachment,
} from '@/lib/support-attachments';

/**
 * Lectures du COCKPIT DES REMONTEES (SA-038 / SA-039), volet
 * « Remonter une information » du module Communication.
 *
 * POURQUOI UN MODULE SEPARE de `lib/admin/queries.ts` : le cockpit a
 * gagne en 0131 sept filtres, cinq compteurs, deux referentiels de
 * filtres et les pieces jointes. Le sortir evite d'alourdir un module
 * partage par une vingtaine d'ecrans, et permet de le faire evoluer sans
 * risquer les autres files du back-office.
 *
 * CURSEURS : meme regle que `queries.ts` — le curseur brut de la base
 * (`created_at|id`) est SCELLE avant d'atteindre le navigateur, et
 * descelle au retour. Un curseur invalide vaut « premiere page » :
 * jamais d'erreur, jamais de page blanche (D-93).
 *
 * D-85 : aucune de ces lectures ne rapporte de delai cible. Aucun n'est
 * stocke.
 */

/* ------------------------------------------------------------------ */
/* Types de vue                                                        */
/* ------------------------------------------------------------------ */

export interface AdminSupportRow {
  ticketId: string;
  referenceCode: string;
  subject: string;
  categoryCode: string;
  categoryName: string | null;
  status: string;
  urgency: string;
  reopenedCount: number;
  requesterName: string | null;
  promotionName: string | null;
  assigneeName: string | null;
  messageCount: number;
  unanswered: boolean;
  createdAt: string | null;
}

export interface AdminSupportMessage {
  messageId: string;
  authorKind: string;
  authorName: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string | null;
  attachments: SupportAttachment[];
}

export interface AdminSupportDetail {
  ticketId: string;
  referenceCode: string;
  subject: string;
  description: string;
  categoryCode: string;
  categoryName: string | null;
  status: string;
  urgency: string;
  urgencySource: string;
  urgencySetBy: string | null;
  reopenedCount: number;
  correlationId: string | null;
  /** Paires cle/valeur deja filtrees par la liste blanche de 0131. */
  technicalContext: { key: string; value: string }[];
  requesterProfileId: string | null;
  requesterName: string | null;
  promotionName: string | null;
  assigneeProfileId: string | null;
  assigneeName: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: AdminSupportMessage[];
}

export interface AdminSupportOption {
  value: string;
  label: string;
  total: number;
}

export interface AdminSupportDashboard {
  newCount: number;
  inProgressCount: number;
  unansweredCount: number;
  criticalCount: number;
  resolvedCount: number;
  openTotal: number;
  total: number;
  categories: AdminSupportOption[];
  assignees: AdminSupportOption[];
  promotions: AdminSupportOption[];
}

export interface AdminSupportFilters {
  status: string | null;
  categoryCode: string | null;
  urgency: string | null;
  promotionId: string | null;
  assigneeProfileId: string | null;
  unanswered: boolean;
  from: string | null;
  to: string | null;
}

/* ------------------------------------------------------------------ */
/* Conversions                                                         */
/* ------------------------------------------------------------------ */

function toAttachments(value: unknown): SupportAttachment[] {
  return asArray(value).flatMap((entry): SupportAttachment[] => {
    const raw = asObject(entry);
    const attachmentId = str(raw['attachment_id']);
    const storagePath = str(raw['storage_path']);
    if (attachmentId === null || storagePath === null) return [];
    return [
      {
        attachmentId,
        fileName: str(raw['file_name']) ?? 'piece-jointe',
        mimeType: str(raw['mime_type']) ?? 'application/octet-stream',
        byteSize: num(raw['byte_size']) ?? 0,
        storagePath,
        href: null,
      },
    ];
  });
}

export function toAdminSupportRow(value: unknown): AdminSupportRow | null {
  const raw = asObject(value);
  const ticketId = str(raw['ticket_id']);
  if (ticketId === null) return null;
  return {
    ticketId,
    referenceCode: str(raw['reference_code']) ?? '',
    subject: str(raw['subject']) ?? '',
    categoryCode: str(raw['category_code']) ?? '',
    categoryName: str(raw['category_name']),
    status: str(raw['status']) ?? 'open',
    urgency: str(raw['urgency']) ?? 'standard',
    reopenedCount: num(raw['reopened_count']) ?? 0,
    requesterName: str(raw['requester_name']),
    promotionName: str(raw['promotion_name']),
    assigneeName: str(raw['assignee_name']),
    messageCount: num(raw['message_count']) ?? 0,
    unanswered: bool(raw['unanswered']),
    createdAt: str(raw['created_at']),
  };
}

/**
 * `technical_context` arrive deja filtre par
 * `private.sanitize_support_context()`. On le reduit ici a des paires
 * cle/valeur textuelles : l'ecran n'affiche que ce qu'il sait nommer, et
 * jamais un objet imbrique venu d'on ne sait ou.
 */
function toTechnicalContext(value: unknown): { key: string; value: string }[] {
  const raw = asObject(value);
  return Object.entries(raw).flatMap(([key, entry]) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      return [{ key, value: entry.trim().slice(0, 200) }];
    }
    return [];
  });
}

export function toAdminSupportDetail(value: unknown): AdminSupportDetail | null {
  const root = asObject(value);
  const raw = asObject(root['ticket']);
  const ticketId = str(raw['ticket_id']);
  if (ticketId === null) return null;

  return {
    ticketId,
    referenceCode: str(raw['reference_code']) ?? '',
    subject: str(raw['subject']) ?? '',
    description: str(raw['description']) ?? '',
    categoryCode: str(raw['category_code']) ?? '',
    categoryName: str(raw['category_name']),
    status: str(raw['status']) ?? 'open',
    urgency: str(raw['urgency']) ?? 'standard',
    urgencySource: str(raw['urgency_source']) ?? 'system',
    urgencySetBy: str(raw['urgency_set_by']),
    reopenedCount: num(raw['reopened_count']) ?? 0,
    correlationId: str(raw['correlation_id']),
    technicalContext: toTechnicalContext(raw['technical_context']),
    requesterProfileId: str(raw['requester_profile_id']),
    requesterName: str(raw['requester_name']),
    promotionName: str(raw['promotion_name']),
    assigneeProfileId: str(raw['assignee_profile_id']),
    assigneeName: str(raw['assignee_name']),
    createdAt: str(raw['created_at']),
    resolvedAt: str(raw['resolved_at']),
    closedAt: str(raw['closed_at']),
    messages: asArray(root['messages']).flatMap((entry): AdminSupportMessage[] => {
      const item = asObject(entry);
      const messageId = str(item['message_id']);
      const body = str(item['body']);
      if (messageId === null || body === null) return [];
      return [
        {
          messageId,
          authorKind: str(item['author_kind']) ?? 'system',
          authorName: str(item['author_name']),
          body,
          isInternalNote: bool(item['is_internal_note']),
          createdAt: str(item['created_at']),
          attachments: toAttachments(item['attachments']),
        },
      ];
    }),
  };
}

function toOptions(value: unknown, valueKey: string, labelKey: string): AdminSupportOption[] {
  return asArray(value).flatMap((entry): AdminSupportOption[] => {
    const raw = asObject(entry);
    const rawValue = raw[valueKey];
    const optionValue =
      typeof rawValue === 'string'
        ? rawValue
        : typeof rawValue === 'number'
          ? String(rawValue)
          : null;
    if (optionValue === null) return [];
    return [
      {
        value: optionValue,
        label: str(raw[labelKey]) ?? optionValue,
        total: num(raw['total']) ?? 0,
      },
    ];
  });
}

export function toAdminSupportDashboard(value: unknown): AdminSupportDashboard {
  const raw = asObject(value);
  return {
    newCount: num(raw['new_count']) ?? 0,
    inProgressCount: num(raw['in_progress_count']) ?? 0,
    unansweredCount: num(raw['unanswered_count']) ?? 0,
    criticalCount: num(raw['critical_count']) ?? 0,
    resolvedCount: num(raw['resolved_count']) ?? 0,
    openTotal: num(raw['open_total']) ?? 0,
    total: num(raw['total']) ?? 0,
    categories: toOptions(raw['by_category'], 'code', 'name'),
    assignees: toOptions(raw['assignees'], 'profile_id', 'name'),
    promotions: toOptions(raw['promotions'], 'promotion_id', 'name'),
  };
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

function toPage(value: unknown): AdminCursorPage<AdminSupportRow> {
  const raw = asObject(value);
  const rows = asArray(raw['rows']).flatMap((row) => {
    const mapped = toAdminSupportRow(row);
    return mapped === null ? [] : [mapped];
  });
  const nextRaw = raw['next_cursor'];
  return {
    rows,
    nextCursor: typeof nextRaw === 'string' && nextRaw.length > 0 ? sealCursor(nextRaw) : null,
  };
}

export function loadSupportDashboard(
  correlationId: string,
): Promise<AdminRpcResult<AdminSupportDashboard>> {
  return adminRpc('admin_support_dashboard', {}, correlationId, toAdminSupportDashboard);
}

export function loadSupportTickets(
  filters: AdminSupportFilters,
  sealedCursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminSupportRow>>> {
  const promotionId =
    filters.promotionId === null ? null : Number.parseInt(filters.promotionId, 10);

  return adminRpc(
    'admin_list_support_tickets',
    {
      p_status: filters.status,
      p_category_code: filters.categoryCode,
      p_urgency: filters.urgency,
      p_promotion_id: promotionId === null || Number.isNaN(promotionId) ? null : promotionId,
      p_assignee_profile_id: filters.assigneeProfileId,
      p_unanswered: filters.unanswered,
      p_from: filters.from,
      p_to: filters.to,
      p_cursor: sealedCursor === null ? null : unsealCursor(sealedCursor),
      p_limit: 25,
    },
    correlationId,
    toPage,
  );
}

/**
 * URL signee de courte duree pour chaque piece jointe du fil.
 *
 * Le bucket est PRIVE et la signature est demandee avec la session de
 * l'administrateur : les politiques Storage de 0027 s'appliquent. Une
 * signature qui echoue laisse `href` a `null` — le fichier s'affiche
 * sans lien plutot qu'avec un lien mort.
 */
async function signAdminAttachments(
  messages: readonly AdminSupportMessage[],
): Promise<AdminSupportMessage[]> {
  const paths = messages.flatMap((message) =>
    message.attachments.map((attachment) => attachment.storagePath),
  );
  if (paths.length === 0) return messages as AdminSupportMessage[];

  const supabase = await createSupabaseServerClient();
  const hrefByPath = new Map<string, string>();

  await Promise.all(
    paths.map(async (path) => {
      const { data } = await supabase.storage
        .from(SUPPORT_ATTACHMENTS_BUCKET)
        .createSignedUrl(supportObjectName(path), 300);
      if (data?.signedUrl) hrefByPath.set(path, data.signedUrl);
    }),
  );

  return messages.map((message) => ({
    ...message,
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      href: hrefByPath.get(attachment.storagePath) ?? null,
    })),
  }));
}

export async function loadSupportTicket(
  ticketId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminSupportDetail | null>> {
  const result = await adminRpc(
    'admin_get_support_ticket',
    { p_ticket_id: ticketId },
    correlationId,
    toAdminSupportDetail,
  );
  if (!result.ok || result.data === null) return result;

  const messages = await signAdminAttachments(result.data.messages);
  return { ok: true, data: { ...result.data, messages } };
}
