'use client';

import { useActionState, useMemo } from 'react';
import { Button, ErrorState } from '@ise/ui-web';
import { frCalls, tc } from '@/i18n/calls';
import type { CallCard, MyCallGroup } from '@/lib/calls-view';
import { CallCardView } from '@/components/calls/CallCardView';
import { loadMoreMyCallsAction, type LoadMoreCallsState } from '../actions';
import { initialLoadMoreCallsState } from '../states';

/** « Mes appels » — pagination par curseur (D-44). */
export function MyCallsList({
  initialRows,
  initialNextCursor,
  group,
}: {
  initialRows: readonly CallCard[];
  initialNextCursor: string | null;
  group: MyCallGroup;
}) {
  const seed: LoadMoreCallsState = useMemo(
    () => ({ ...initialLoadMoreCallsState, rows: [...initialRows], nextCursor: initialNextCursor }),
    [initialRows, initialNextCursor],
  );

  const [state, formAction, isPending] = useActionState(loadMoreMyCallsAction, seed);
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
            <CallCardView call={call} showManage />
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
          <input type="hidden" name="groupe" value={group} />
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
