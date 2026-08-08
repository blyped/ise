import { asArray, asObject, num, str } from '@/lib/network-view';
import { sealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { callRpc, type QueryResult } from '@/lib/queries/rpc';
import {
  toReportRows,
  toTicketDetail,
  toTicketRow,
  type CursorPage,
  type ReportReason,
  type ReportRow,
  type SupportCategory,
  type TicketDetail,
  type TicketRow,
} from '@/lib/messaging-view';

/**
 * Lectures de l'AIDE & SUPPORT (ISE-100).
 *
 * `support_categories` (16 lignes) et `report_reasons` (9 lignes) sont
 * des referentiels lisibles par tout membre authentifie : ils se lisent
 * directement, colonnes ENUMEREES. Rien n'est code en dur cote
 * application — ni la liste des categories, ni celle des motifs.
 *
 * D-85 : aucune de ces lectures ne rapporte de delai cible, parce que la
 * base n'en stocke aucun.
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

export async function loadTicket(
  ticketId: string,
  correlationId: string,
): Promise<QueryResult<TicketDetail | null>> {
  return callRpc('get_support_ticket', { p_ticket_id: ticketId }, correlationId, (payload) =>
    toTicketDetail(payload),
  );
}

export async function loadMyReports(correlationId: string): Promise<QueryResult<ReportRow[]>> {
  return callRpc('list_my_reports', { p_limit: 20 }, correlationId, (payload) =>
    toReportRows(payload),
  );
}
