'use client';

import { useActionState, useMemo } from 'react';
import { Button, ErrorState } from '@ise/ui-web';
import { frOpportunities, to } from '@/i18n/opportunities';
import type { MyOpportunityGroup, OpportunityCard } from '@/lib/opportunities-view';
import { OpportunityCardView } from '@/components/opportunities/OpportunityCardView';
import {
  initialLoadMoreOpportunitiesState,
  loadMoreMyOpportunitiesAction,
  type LoadMoreOpportunitiesState,
} from '../actions';

/** « Mes offres » — pagination par curseur (D-44). */
export function MyOpportunitiesList({
  initialRows,
  initialNextCursor,
  group,
}: {
  initialRows: readonly OpportunityCard[];
  initialNextCursor: string | null;
  group: MyOpportunityGroup;
}) {
  const seed: LoadMoreOpportunitiesState = useMemo(
    () => ({
      ...initialLoadMoreOpportunitiesState,
      rows: [...initialRows],
      nextCursor: initialNextCursor,
    }),
    [initialRows, initialNextCursor],
  );

  const [state, formAction, isPending] = useActionState(loadMoreMyOpportunitiesAction, seed);
  const rows = state.status === 'idle' ? initialRows : state.rows;
  const nextCursor = state.status === 'idle' ? initialNextCursor : state.nextCursor;

  return (
    <div className="flex flex-col gap-5">
      <p aria-live="polite" aria-atomic="true" aria-busy={isPending} className="sr-only">
        {isPending
          ? frOpportunities.common.loadMorePending
          : to(frOpportunities.list.announce, { count: rows.length })}
      </p>

      <ul className="flex flex-col gap-5">
        {rows.map((opportunity) => (
          <li key={opportunity.opportunityId}>
            <OpportunityCardView opportunity={opportunity} showManage />
          </li>
        ))}
      </ul>

      {state.status === 'error' && state.message !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
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
            loadingLabel={frOpportunities.common.loadMorePending}
          >
            {frOpportunities.common.loadMore}
          </Button>
        </form>
      ) : (
        <p className="text-caption text-text-muted text-center">
          {frOpportunities.common.endOfList}
        </p>
      )}
    </div>
  );
}
