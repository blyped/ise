'use client';

import { useActionState, useMemo } from 'react';
import Link from 'next/link';
import { Button, ErrorState } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import type { SearchResultRow } from '@/lib/queries/search';
import { ResultCard } from '@/components/search/ResultCard';
import { loadMoreResultsAction, type LoadMoreState } from './actions';
import { initialLoadMoreState } from './states';

/**
 * ISE-035 — liste des resultats et pagination PAR CURSEUR (D-44).
 *
 * Jamais d'offset : chaque page suivante est demandee avec le curseur
 * keyset de la derniere ligne affichee, scelle cote serveur.
 *
 * Ce composant ne recoit que des `SearchResultRow`. Ce type ne porte ni
 * score, ni pourcentage, ni rang : il n'y a donc rien a masquer, rien
 * qui puisse apparaitre dans le HTML rendu ni dans la charge utile de
 * Server Components serialisee au navigateur (MASTER PROMPT §15).
 */
export function ResultsList({
  initialRows,
  initialNextCursor,
  queryString,
}: {
  initialRows: readonly SearchResultRow[];
  initialNextCursor: string | null;
  queryString: string;
}) {
  const seed: LoadMoreState = useMemo(
    () => ({
      ...initialLoadMoreState,
      rows: [...initialRows],
      nextCursor: initialNextCursor,
    }),
    [initialRows, initialNextCursor],
  );

  const [state, formAction, isPending] = useActionState(loadMoreResultsAction, seed);

  const rows = state.rows.length > 0 ? state.rows : initialRows;
  const nextCursor = state.status === 'idle' ? initialNextCursor : state.nextCursor;

  return (
    <div className="flex flex-col gap-6">
      {/*
        Region d'annonce : le nombre de profils affiches est lu a voix
        haute a chaque changement, sans deplacer le focus. `aria-busy`
        signale le chargement en cours.
      */}
      <p aria-live="polite" aria-atomic="true" aria-busy={isPending} className="sr-only">
        {isPending
          ? frSearch.results.loadMorePending
          : frSearch.results.announce.replace('{count}', String(rows.length))}
      </p>

      <ul className="flex flex-col gap-5">
        {rows.map((row) => (
          <ResultCard key={row.profileId} row={row} />
        ))}
      </ul>

      {state.status === 'error' && state.message !== null ? (
        <ErrorState
          title={frSearch.results.errorTitle}
          description={state.message}
          correlationId={state.correlationId ?? '—'}
          action={
            <Link
              href={SEARCH_ROUTES.find}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frSearch.results.emptyAction}
            </Link>
          }
        />
      ) : null}

      {nextCursor !== null ? (
        <form action={formAction} className="flex flex-col items-center gap-3">
          <input type="hidden" name="criteres" value={queryString} />
          <input type="hidden" name="curseur" value={nextCursor} />
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            loading={isPending}
            loadingLabel={frSearch.results.loadMorePending}
          >
            {frSearch.results.loadMore}
          </Button>
          {/*
            Sans JavaScript, la Server Action ci-dessus s'execute quand
            meme mais ne peut pas empiler les pages : le lien suivant
            rend la page suivante entiere, cote serveur. Le curseur y est
            scelle, donc illisible.
          */}
          <noscript>
            <a
              href={`${SEARCH_ROUTES.results}?${queryString}${queryString.length > 0 ? '&' : ''}curseur=${encodeURIComponent(nextCursor)}`}
              className="text-body-sm text-primary font-semibold underline"
            >
              {frSearch.results.loadMore}
            </a>
          </noscript>
        </form>
      ) : (
        <p className="text-caption text-text-muted text-center">{frSearch.results.endOfResults}</p>
      )}
    </div>
  );
}
