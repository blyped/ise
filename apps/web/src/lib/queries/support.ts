import { asArray, asObject, bool, num, str } from '@/lib/network-view';
import { sealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { callRpc, type QueryResult } from '@/lib/queries/rpc';
import {
  SUPPORT_ATTACHMENTS_BUCKET,
  supportObjectName,
  type SupportAttachment,
  type SupportThreadMessage,
  type SupportTicketView,
} from '@/lib/support-attachments';
import {
  toReportRows,
  toTicketRow,
  type CursorPage,
  type ReportReason,
  type ReportRow,
  type SupportCategory,
  type TicketRow,
} from '@/lib/messaging-view';

/**
 * Lectures de l'AIDE & SUPPORT (ISE-100), volet « Remonter une
 * information » du module Communication.
 *
 * `support_categories` (8 natures actives depuis 0131) et
 * `report_reasons` (9 motifs) sont des referentiels lisibles par tout
 * membre authentifie : ils se lisent directement, colonnes ENUMEREES.
 * Rien n'est code en dur cote application — ni la liste des natures, ni
 * celle des motifs.
 *
 * D-85 : aucune de ces lectures ne rapporte de delai cible, parce que la
 * base n'en stocke aucun. Aucune ne rapporte non plus la priorite au
 * demandeur : elle ne le concerne pas, il ne la choisit pas.
 */

export interface SupportTicketsPage extends CursorPage<TicketRow> {
  openTotal: number;
}

export async function loadSupportCategories(): Promise<SupportCategory[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('support_categories')
    .select('code, name, description, routes_to_moderation, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data) return [];
  return asArray(data).flatMap((entry): SupportCategory[] => {
    const raw = asObject(entry);
    const code = str(raw['code']);
    const name = str(raw['name']);
    if (code === null || name === null) return [];
    return [
      {
        code,
        name,
        description: str(raw['description']),
        routesToModeration: raw['routes_to_moderation'] === true,
      },
    ];
  });
}

/**
 * D-66 — referentiel UNIQUE de motifs, filtre a l'affichage selon le
 * type d'objet signale. Le filtrage est fait ici pour l'affichage, et
 * REFAIT en base par `public.create_report()` : l'interface ne propose
 * pas un motif que la base refuserait, et la base ne fait pas confiance
 * a l'interface.
 */
export async function loadReportReasons(targetType: string | null): Promise<ReportReason[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('report_reasons')
    .select('code, name, description, applies_to, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data) return [];
  return asArray(data)
    .flatMap((entry): ReportReason[] => {
      const raw = asObject(entry);
      const code = str(raw['code']);
      const name = str(raw['name']);
      if (code === null || name === null) return [];
      return [
        {
          code,
          name,
          description: str(raw['description']),
          appliesTo: asArray(raw['applies_to']).filter(
            (value): value is string => typeof value === 'string',
          ),
        },
      ];
    })
    .filter((reason) => targetType === null || reason.appliesTo.includes(targetType));
}

export async function loadMyTickets(
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<SupportTicketsPage>> {
  return callRpc(
    'list_my_support_tickets',
    { p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      const nextCursor = str(raw['next_cursor']);
      return {
        rows: asArray(raw['rows']).flatMap((entry): TicketRow[] => {
          const row = toTicketRow(entry);
          return row === null ? [] : [row];
        }),
        nextCursor: nextCursor === null ? null : sealCursor(nextCursor),
        openTotal: num(raw['open_total']) ?? 0,
      };
    },
  );
}

/* ------------------------------------------------------------------ */
/* Fil d'une remontee, pieces jointes comprises (migration 0131)        */
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

function toSupportTicketView(value: unknown): SupportTicketView | null {
  const raw = asObject(value);
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
    createdAt: str(raw['created_at']),
    updatedAt: str(raw['updated_at']),
    reopenedCount: num(raw['reopened_count']) ?? 0,
    canReply: bool(raw['can_reply']),
    canClose: bool(raw['can_close']),
    canReopen: bool(raw['can_reopen']),
    messages: asArray(raw['messages']).flatMap((entry): SupportThreadMessage[] => {
      const item = asObject(entry);
      const messageId = str(item['message_id']);
      const body = str(item['body']);
      if (messageId === null || body === null) return [];
      return [
        {
          messageId,
          authorKind: str(item['author_kind']) ?? 'system',
          fromMe: bool(item['from_me']),
          body,
          createdAt: str(item['created_at']),
          attachments: toAttachments(item['attachments']),
        },
      ];
    }),
  };
}

/**
 * URL signee de courte duree pour chaque piece jointe.
 *
 * Le bucket `support-attachments` est PRIVE : sans signature, aucun lien
 * n'est ouvrable. La signature est demandee avec la session de
 * l'utilisateur, donc les politiques Storage de 0027 s'appliquent — un
 * membre qui n'a pas acces au ticket n'obtient rien. Une signature qui
 * echoue laisse `href` a `null` : l'ecran affiche alors le fichier sans
 * lien plutot qu'un lien mort.
 */
export async function signSupportAttachments(
  messages: readonly SupportThreadMessage[],
): Promise<SupportThreadMessage[]> {
  const paths = messages.flatMap((message) =>
    message.attachments.map((attachment) => attachment.storagePath),
  );
  if (paths.length === 0) return messages as SupportThreadMessage[];

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

export async function loadTicket(
  ticketId: string,
  correlationId: string,
): Promise<QueryResult<SupportTicketView | null>> {
  const result = await callRpc(
    'get_support_ticket',
    { p_ticket_id: ticketId },
    correlationId,
    (payload) => toSupportTicketView(payload),
  );
  if (!result.ok || result.data === null) return result;

  const messages = await signSupportAttachments(result.data.messages);
  return { ok: true, data: { ...result.data, messages } };
}

export async function loadMyReports(correlationId: string): Promise<QueryResult<ReportRow[]>> {
  return callRpc('list_my_reports', { p_limit: 20 }, correlationId, (payload) =>
    toReportRows(payload),
  );
}
