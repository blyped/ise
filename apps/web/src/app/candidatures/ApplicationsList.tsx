'use client';

import { useActionState, useMemo } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, ErrorState } from '@ise/ui-web';
import { frOpportunities, to } from '@/i18n/opportunities';
import { applicationRoute } from '@/lib/routes/opportunities';
import { formatDate } from '@/lib/network-view';
import type { ApplicationRow, MyApplicationGroup } from '@/lib/opportunities-view';
import {
  initialLoadMoreApplicationsState,
  loadMoreApplicationsAction,
  type LoadMoreApplicationsState,
} from '@/app/opportunites/actions';

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-063 — mes candidatures, paginées par curseur (D-44).
 *
 * Chaque carte porte le CANAL (MASTER PROMPT §27, D-55) :
 *   « Via Compétences ISE »  → la plateforme a constaté le dépôt ;
 *   « Déclarée par vous »    → vous seul en êtes la source.
 * La date affichée suit la même règle : envoyée / déclarée.
 */
export function ApplicationsList({
  initialRows,
  initialNextCursor,
  group,
}: {
  initialRows: readonly ApplicationRow[];
  initialNextCursor: string | null;
  group: MyApplicationGroup;
}) {
  const seed: LoadMoreApplicationsState = useMemo(
    () => ({
      ...initialLoadMoreApplicationsState,
      rows: [...initialRows],
      nextCursor: initialNextCursor,
    }),
    [initialRows, initialNextCursor],
  );

  const [state, formAction, isPending] = useActionState(loadMoreApplicationsAction, seed);
  const rows = state.status === 'idle' ? initialRows : state.rows;
  const nextCursor = state.status === 'idle' ? initialNextCursor : state.nextCursor;

  return (
    <div className="flex flex-col gap-5">
      <p aria-live="polite" aria-atomic="true" aria-busy={isPending} className="sr-only">
        {isPending
          ? frOpportunities.common.loadMorePending
          : to(frOpportunities.mine.applications, { count: rows.length })}
      </p>

      <ul className="flex flex-col gap-5">
        {rows.map((application) => (
          <li key={application.applicationId}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={application.isSelfDeclared ? 'neutral' : 'info'}>
                  {application.isSelfDeclared
                    ? frOpportunities.applications.channelExternal
                    : frOpportunities.applications.channelPlatform}
                </Badge>
                <Badge tone="neutral">
                  {frOpportunities.applicationStatus[application.status] ?? application.status}
                </Badge>
              </div>

              <h3 className="text-h3 text-text-primary mt-2 font-semibold">
                <Link
                  href={applicationRoute(application.applicationId)}
                  className="hover:text-primary focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {application.opportunity?.title ?? '—'}
                </Link>
              </h3>

              <p className="text-body-sm text-text-secondary mt-1">
                {[
                  application.opportunity?.organization,
                  application.opportunity?.city,
                  application.opportunity?.country,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              {application.isSelfDeclared ? (
                <p className="text-caption text-text-muted mt-2">
                  {frOpportunities.applications.channelExternalHint}
                </p>
              ) : null}

              <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                <span className="text-caption text-text-muted">
                  {application.isSelfDeclared && application.declaredAt !== null
                    ? to(frOpportunities.applications.declaredOn, {
                        date: formatDate(application.declaredAt),
                      })
                    : application.submittedAt !== null
                      ? to(frOpportunities.applications.sentOn, {
                          date: formatDate(application.submittedAt),
                        })
                      : ''}
                </span>
                <Link
                  href={applicationRoute(application.applicationId)}
                  className={`ml-auto max-md:ml-0 ${LINK}`}
                >
                  {frOpportunities.applications.see}
                </Link>
              </div>
            </Card>
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
