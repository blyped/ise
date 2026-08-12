'use client';

import { useActionState, useMemo } from 'react';
import Link from 'next/link';
import { Button, Card, ErrorState } from '@ise/ui-web';
import { frNetwork, tn } from '@/i18n/network';
import { memberProfileRoute } from '@/lib/routes/search';
import { introductionPathRoute, NETWORK_ROUTES } from '@/lib/routes/network';
import { formatDate, type ConnectionRow } from '@/lib/network-view';
import { ProfileSummary } from '@/components/network/ProfileSummary';
import { loadMoreConnectionsAction, type LoadMoreConnectionsState } from './actions';
import { initialLoadMoreConnectionsState } from './states';

/**
 * ISE-040 — liste de mes relations, pagination PAR CURSEUR (D-44).
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : la maquette affiche un total
 * (« 48 relations ») a cote de la liste et un tri « pertinence ». Le
 * total EXISTE ici — il vient de `my_network_summary()`, calcule en base
 * — mais il est affiche dans le bandeau, pas au-dessus de la liste : la
 * liste, elle, annonce le nombre de relations REELLEMENT chargees. Le
 * tri par pertinence n'est pas propose : il supposerait un score, que le
 * MASTER PROMPT §15 interdit d'exposer. L'ordre est chronologique
 * (relation la plus recente d'abord) et l'ecran le dit.
 */
export function ConnectionsList({
  initialRows,
  initialNextCursor,
  query,
}: {
  initialRows: readonly ConnectionRow[];
  initialNextCursor: string | null;
  query: string;
}) {
  const seed: LoadMoreConnectionsState = useMemo(
    () => ({
      ...initialLoadMoreConnectionsState,
      rows: [...initialRows],
      nextCursor: initialNextCursor,
    }),
    [initialRows, initialNextCursor],
  );

  const [state, formAction, isPending] = useActionState(loadMoreConnectionsAction, seed);

  const rows = state.rows.length > 0 ? state.rows : initialRows;
  const nextCursor = state.status === 'idle' ? initialNextCursor : state.nextCursor;

  return (
    <div className="flex flex-col gap-5">
      {/* La liste change sans rechargement : son volume est annonce. */}
      <p aria-live="polite" aria-atomic="true" aria-busy={isPending} className="sr-only">
        {isPending
          ? frNetwork.common.loadMorePending
          : tn(frNetwork.connections.announce, { count: rows.length })}
      </p>

      <ul className="flex flex-col gap-5">
        {rows.map((row) => (
          <li key={row.profile.profileId}>
            <Card padding="sm">
              <ProfileSummary
                card={row.profile}
                size={48}
                compact
                trailing={
                  <div className="flex flex-col gap-2 md:items-end">
                    <Link
                      href={memberProfileRoute(row.profile.profileId)}
                      className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {frNetwork.common.seeProfile}
                    </Link>
                  </div>
                }
              />

              {/* Contexte de la relation : le code stocke lors de
                  l'acceptation, jamais une phrase inventee. */}
              <div className="border-border text-caption text-text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4">
                {row.context !== null ? (
                  <span>
                    {frNetwork.connections.relationLabel} :{' '}
                    <span className="text-text-secondary">
                      {frNetwork.context[row.context] ?? row.context}
                    </span>
                  </span>
                ) : null}
                {row.connectedAt !== null ? (
                  <span>
                    {tn(frNetwork.connections.relationSince, {
                      date: formatDate(row.connectedAt),
                    })}
                  </span>
                ) : null}
                <Link
                  href={introductionPathRoute(row.profile.profileId)}
                  className="text-primary hover:text-primary-hover focus-visible:outline-active-blue ml-auto font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 max-md:ml-0"
                >
                  {frNetwork.connections.mobiliseTitle} →
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {state.status === 'error' && state.message !== null ? (
        <ErrorState
          title={frNetwork.connections.errorTitle}
          description={state.message}
          correlationId={state.correlationId ?? '—'}
          action={
            <Link
              href={NETWORK_ROUTES.connections}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frNetwork.common.retry}
            </Link>
          }
        />
      ) : null}

      {nextCursor !== null ? (
        <form action={formAction} className="flex flex-col items-center gap-3">
          <input type="hidden" name="recherche" value={query} />
          <input type="hidden" name="curseur" value={nextCursor} />
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            loading={isPending}
            loadingLabel={frNetwork.common.loadMorePending}
          >
            {frNetwork.common.loadMore}
          </Button>
          {/* Sans JavaScript, la page suivante est rendue cote serveur.
              Le curseur y est scelle, donc illisible. */}
          <noscript>
            <a
              href={`${NETWORK_ROUTES.connections}?${query.length > 0 ? `recherche=${encodeURIComponent(query)}&` : ''}curseur=${encodeURIComponent(nextCursor)}`}
              className="text-body-sm text-primary font-semibold underline"
            >
              {frNetwork.common.loadMore}
            </a>
          </noscript>
        </form>
      ) : (
        <p className="text-caption text-text-muted text-center">{frNetwork.common.endOfList}</p>
      )}
    </div>
  );
}
