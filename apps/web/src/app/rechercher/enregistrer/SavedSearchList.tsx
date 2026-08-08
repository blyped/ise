'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, EmptyState } from '@ise/ui-web';
import { initialFormState } from '@/lib/form-state';
import { frSearch } from '@/i18n/search';
import { searchResultsRoute } from '@/lib/routes/search';
import type { SavedSearchView } from '@/lib/queries/saved-search';
import { deleteSavedSearchAction, toggleAlertAction } from './actions';

const FREQUENCY_LABEL: Record<string, string> = {
  daily: frSearch.save.frequencyDaily,
  weekly: frSearch.save.frequencyWeekly,
  monthly: frSearch.save.frequencyMonthly,
};

const CHANNEL_LABEL: Record<string, string> = {
  in_app: frSearch.save.channelInApp,
  email: frSearch.save.channelEmail,
  both: frSearch.save.channelBoth,
};

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function alertSummary(row: SavedSearchView): string {
  if (!row.alertEnabled) return frSearch.save.listAlertNone;
  const frequency = FREQUENCY_LABEL[row.alertFrequency ?? 'weekly'] ?? '';
  const channel = CHANNEL_LABEL[row.alertChannel ?? 'in_app'] ?? '';
  const template =
    row.alertStatus === 'paused' ? frSearch.save.listAlertPaused : frSearch.save.listAlertActive;
  return template.replace('{frequency}', frequency.toLowerCase()).replace('{channel}', channel);
}

/**
 * ISE-036 — gestion des recherches enregistrees : suspendre, reactiver,
 * supprimer. Chaque action est une Server Action distincte, donc
 * fonctionnelle sans JavaScript.
 *
 * La suppression demande une confirmation : elle est definitive et
 * emporte l'alerte (cascade en base).
 */
export function SavedSearchList({ rows }: { rows: readonly SavedSearchView[] }) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleAlertAction,
    initialFormState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSavedSearchAction,
    initialFormState,
  );

  const failure =
    toggleState.status === 'error'
      ? toggleState
      : deleteState.status === 'error'
        ? deleteState
        : null;

  if (rows.length === 0) {
    return <EmptyState title={frSearch.save.listEmpty} description={frSearch.save.listEmptyHint} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {failure !== null && failure.message !== null ? (
        <Alert variant="error" title={failure.message}>
          {failure.correlationId !== null ? (
            <span className="text-caption text-text-muted">
              {frSearch.common.correlationLabel} :{' '}
              <code className="font-mono">{failure.correlationId}</code>
            </span>
          ) : null}
        </Alert>
      ) : null}

      <ul className="flex flex-col gap-5">
        {rows.map((row) => (
          <li
            key={row.savedSearchId}
            className="border-border flex flex-col gap-3 border-b pb-5 last:border-b-0 last:pb-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-body text-text-primary font-semibold">{row.name}</p>
              <Badge tone={row.alertStatus === 'active' ? 'info' : 'neutral'}>
                {alertSummary(row)}
              </Badge>
            </div>

            <p className="text-caption text-text-muted">
              {frSearch.save.listCreatedAt.replace(
                '{date}',
                new Date(row.createdAt).toLocaleDateString('fr-FR'),
              )}
              {row.alertEnabled && row.lastNotifiedAt === null
                ? ` · ${frSearch.save.listNeverNotified}`
                : ''}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {row.criteria !== null ? (
                <Link href={searchResultsRoute(row.queryString)} className={LINK_CLASS}>
                  {frSearch.save.listRelaunch}
                </Link>
              ) : null}

              {row.alertEnabled ? (
                <form action={toggleAction}>
                  <input type="hidden" name="savedSearchId" value={row.savedSearchId} />
                  <input
                    type="hidden"
                    name="status"
                    value={row.alertStatus === 'paused' ? 'active' : 'paused'}
                  />
                  <Button type="submit" variant="ghost" size="sm" loading={togglePending}>
                    {row.alertStatus === 'paused'
                      ? frSearch.save.listResume
                      : frSearch.save.listPause}
                  </Button>
                </form>
              ) : null}

              <form
                action={deleteAction}
                onSubmit={(event) => {
                  if (!window.confirm(frSearch.save.listDeleteConfirm)) event.preventDefault();
                }}
              >
                <input type="hidden" name="savedSearchId" value={row.savedSearchId} />
                <Button type="submit" variant="danger" size="sm" loading={deletePending}>
                  {frSearch.save.listDelete}
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
