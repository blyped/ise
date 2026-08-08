'use server';

import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { parseCriteriaFromQueryString, resolveSearchMode } from '@/lib/search-criteria';
import { runDirectorySearch, runRelevanceSearch, type SearchResultRow } from '@/lib/queries/search';
import { frSearch } from '@/i18n/search';

/**
 * ISE-035 — page suivante.
 *
 * ETAT ENVOYE AU NAVIGATEUR : `rows` seulement. `SearchResultRow` ne
 * comporte ni score, ni pourcentage, ni rang (MASTER PROMPT §15).
 * `nextCursor` est le curseur SCELLE : le curseur brut de
 * `match_profiles()` contient le score en base64 lisible, il ne quitte
 * jamais le serveur (voir `src/lib/opaque-cursor.ts`).
 */
export interface LoadMoreState {
  rows: SearchResultRow[];
  nextCursor: string | null;
  status: 'idle' | 'loaded' | 'error';
  message: string | null;
  correlationId: string | null;
  /** Nombre de lignes ajoutees au dernier chargement, pour l'annonce vocale. */
  addedCount: number;
}

export const initialLoadMoreState: LoadMoreState = {
  rows: [],
  nextCursor: null,
  status: 'idle',
  message: null,
  correlationId: null,
  addedCount: 0,
};

/**
 * Les criteres reviennent du navigateur : ils sont REVALIDES par le
 * meme `searchCriteriaSchema` (MASTER PROMPT §62). Une URL forgee ne
 * passe pas plus ici qu'au premier rendu.
 */
export async function loadMoreResultsAction(
  previous: LoadMoreState,
  formData: FormData,
): Promise<LoadMoreState> {
  const correlationId = newCorrelationId();

  const queryString = String(formData.get('criteres') ?? '');
  const sealed = String(formData.get('curseur') ?? '');

  const parsed = parseCriteriaFromQueryString(queryString);
  if (!parsed.ok) {
    return {
      ...previous,
      status: 'error',
      message: frSearch.find.validationFailed,
      correlationId,
      addedCount: 0,
    };
  }

  const rawCursor = unsealCursor(sealed);
  if (rawCursor === null) {
    // Cle de scellement changee (redemarrage, autre instance) ou jeton
    // falsifie. On le dit, on ne devine pas une position de pagination.
    return {
      ...previous,
      status: 'error',
      message: frSearch.results.cursorExpired,
      correlationId,
      nextCursor: null,
      addedCount: 0,
    };
  }

  const mode = resolveSearchMode(parsed.criteria);
  const result =
    mode === 'relevance'
      ? await runRelevanceSearch(parsed.criteria, rawCursor, correlationId)
      : await runDirectorySearch(parsed.criteria, rawCursor, correlationId);

  if (!result.ok) {
    return {
      ...previous,
      status: 'error',
      message: result.error.userMessage,
      correlationId,
      addedCount: 0,
    };
  }

  // Deduplication defensive : deux pages ne doivent jamais afficher deux
  // fois le meme profil, meme si l'annuaire bouge entre deux appels.
  const seen = new Set(previous.rows.map((row) => row.profileId));
  const fresh = result.data.rows.filter((row) => !seen.has(row.profileId));

  return {
    rows: [...previous.rows, ...fresh],
    nextCursor: result.data.nextCursor,
    status: 'loaded',
    message: null,
    correlationId: null,
    addedCount: fresh.length,
  };
}
