'use client';

import { useActionState, useMemo } from 'react';
import { Button, ErrorState } from '@ise/ui-web';
import { frCalls, tc } from '@/i18n/calls';
import type { CallCard, CallScope } from '@/lib/calls-view';
import { CallCardView } from '@/components/calls/CallCardView';
import { initialLoadMoreCallsState, loadMoreCallsAction, type LoadMoreCallsState } from './actions';

export interface CallsListProps {
  initialRows: readonly CallCard[];
  initialNextCursor: string | null;
  scope: CallScope;
  filters: Record<string, string>;
}

/**
 * ISE-047 — liste paginee PAR CURSEUR (D-44), jamais par offset.
 *
 * Un curseur falsifie ou perime rend `null` cote base : la liste repart
 * du debut plutot que d'afficher une erreur ou une position devinee.
 */
export function CallsList({ initialRows, initialNextCursor, scope, filters }: CallsListProps) {
  const seed: LoadMoreCallsState = useMemo(
    () => ({ ...initialLoadMoreCallsState, rows: [...initialRows], nextCursor: initialNextCursor }),
    [initialRows, initialNextCursor],
  );

  const [state, formAction, isPending] = useActionState(loadMoreCallsAction, seed);
  const rows = state.status === 'idle' ? initialRows : state.rows;
  const nextCursor = state.status === 'idle' ? initialNextCursor : state.nextCursor;

  return (
    <div className="flex flex-col gap-5">
      <p aria-live="polite" aria-atomic="true" aria-busy={isPending} className="sr-only">
        {isPending
          ? frCalls.common.loadMorePending
          : tc(frCalls.list.announce, { count: rows.length })}
      </p>

      <ul className="flex flex-col gap-5">
        {rows.map((call) => (
          <li key={call.callId}>
            <CallCardView call={call} />
          </li>
        ))}
      </ul>

      {state.status === 'error' && state.message !== null ? (
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          description={state.message}
          correlationId={state.correlationId ?? '—'}
        />
      ) : null}

      {nextCursor !== null ? (
        <form action={formAction} className="flex justify-center">
          <input type="hidden" name="curseur" value={nextCursor} />
          <input type="hidden" name="scope" value={scope} />
          {Object.entries(filters).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <Button
            type="submit"
            variant="secondary"
            loading={isPending}
            loadingLabel={frCalls.common.loadMorePending}
          >
            {frCalls.common.loadMore}
          </Button>
        </form>
      ) : (
        <p className="text-caption text-text-muted text-center">{frCalls.common.endOfList}</p>
      )}
    </div>
  );
}
