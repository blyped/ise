'use server';

import { unsealCursor } from '@/lib/opaque-cursor';
import { newCorrelationId } from '@/lib/correlation';
import { loadConnections } from '@/lib/queries/network';
import type { ConnectionRow } from '@/lib/network-view';

export interface LoadMoreConnectionsState {
  status: 'idle' | 'error' | 'success';
  rows: ConnectionRow[];
  nextCursor: string | null;
  message: string | null;
  correlationId: string | null;
}

export const initialLoadMoreConnectionsState: LoadMoreConnectionsState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  message: null,
  correlationId: null,
};

/**
 * ISE-040 — page suivante de « Mes relations ».
 *
 * Pagination PAR CURSEUR (D-44) : jamais d'offset. Le curseur arrive
 * scelle du navigateur, il est dechiffre ici et ne repart scelle que si
 * une page suivante existe. Un curseur falsifie ou perime donne `null`,
 * donc un retour au debut de la liste — jamais une erreur, jamais une
 * position devinee.
 */
export async function loadMoreConnectionsAction(
  previous: LoadMoreConnectionsState,
  formData: FormData,
): Promise<LoadMoreConnectionsState> {
  const correlationId = newCorrelationId();

  const sealed = formData.get('curseur');
  const rawQuery = formData.get('recherche');
  const query = typeof rawQuery === 'string' && rawQuery.trim().length > 0 ? rawQuery.trim() : null;
  const cursor = unsealCursor(typeof sealed === 'string' ? sealed : null);

  const result = await loadConnections(query, cursor, correlationId);

  if (!result.ok) {
    return {
      status: 'error',
      rows: previous.rows,
      nextCursor: previous.nextCursor,
      message: result.error.userMessage,
      correlationId,
    };
  }

  return {
    status: 'success',
    rows: [...previous.rows, ...result.data.rows],
    nextCursor: result.data.nextCursor,
    message: null,
    correlationId: null,
  };
}
