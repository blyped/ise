import { asArray, asObject, num, str } from '@/lib/network-view';
import { sealCursor } from '@/lib/opaque-cursor';
import { callRpc, type QueryResult } from '@/lib/queries/rpc';
import {
  toConversationHeader,
  toConversationRow,
  toMessageRows,
  type ConversationHeader,
  type ConversationInbox,
  type ConversationRow,
  type CursorPage,
  type MessageRow,
} from '@/lib/messaging-view';

/**
 * Lectures de la tranche MESSAGERIE (ISE-097).
 *
 * TOUT passe par les fonctions de la migration 0052. Aucun `select`
 * direct : `ise_profiles` n'est plus lisible au niveau table depuis 0028,
 * et surtout la fiche de l'interlocuteur doit passer par la visibilite
 * par CHAMP — la composer ici reviendrait a « renvoyer puis masquer »,
 * que le MASTER PROMPT §47 interdit.
 *
 * Les curseurs keyset renvoyes par la base sont SCELLES avant de quitter
 * le serveur : le navigateur ne manipule qu'un jeton chiffre.
 */

function sealed(raw: unknown): string | null {
  const cursor = str(raw);
  return cursor === null ? null : sealCursor(cursor);
}

export type InboxScope = 'all' | 'unread' | 'archived';

export async function loadConversations(
  scope: InboxScope,
  query: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<ConversationInbox>> {
  return callRpc(
    'list_my_conversations',
    { p_scope: scope, p_query: query, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      return {
        rows: asArray(raw['rows']).flatMap((entry): ConversationRow[] => {
          const row = toConversationRow(entry);
          return row === null ? [] : [row];
        }),
        nextCursor: sealed(raw['next_cursor']),
        unreadTotal: num(raw['unread_total']) ?? 0,
        archivedTotal: num(raw['archived_total']) ?? 0,
      };
    },
  );
}

export async function loadConversation(
  conversationId: string,
  correlationId: string,
): Promise<QueryResult<ConversationHeader | null>> {
  return callRpc(
    'get_conversation',
    { p_conversation_id: conversationId },
    correlationId,
    (payload) => toConversationHeader(payload),
  );
}

export async function loadMessages(
  conversationId: string,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<CursorPage<MessageRow>>> {
  return callRpc(
    'list_conversation_messages',
    { p_conversation_id: conversationId, p_cursor: rawCursor, p_limit: 30 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      return {
        rows: toMessageRows(raw['rows']),
        nextCursor: sealed(raw['next_cursor']),
      };
    },
  );
}
