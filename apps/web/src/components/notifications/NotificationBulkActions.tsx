'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frNotifications } from '@/i18n/notifications';
import { initialFormState } from '@/lib/form-state';
import {
  archiveReadNotificationsAction,
  markAllNotificationsReadAction,
} from '@/app/notifications/actions';

/**
 * ISE-098 — actions globales.
 *
 * Les deux boutons ne sont rendus QUE s'ils ont quelque chose a faire :
 * « Tout marquer comme lu » disparait s'il n'y a aucun non-lu,
 * « Archiver les notifications lues » s'il n'y a rien de lu a archiver.
 * Un bouton qui n'agirait sur rien serait un bouton decoratif (§113).
 */
export function NotificationBulkActions({
  unread,
  readNotArchived,
}: {
  unread: number;
  readNotArchived: number;
}) {
  const [markState, markAction, markPending] = useActionState(
    markAllNotificationsReadAction,
    initialFormState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveReadNotificationsAction,
    initialFormState,
  );

  const state = markState.status !== 'idle' ? markState : archiveState;

  if (unread === 0 && readNotArchived === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {state.message ?? ''}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          Référence à communiquer à l’assistance : {state.correlationId}
        </Alert>
      ) : null}
      {state.status === 'success' && state.message !== null ? (
        <Alert variant="success" title={state.message} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {unread > 0 ? (
          <form action={markAction}>
            <Button type="submit" variant="secondary" loading={markPending}>
              {frNotifications.markAllRead}
            </Button>
          </form>
        ) : null}
        {readNotArchived > 0 ? (
          <form action={archiveAction}>
            <Button type="submit" variant="ghost" loading={archivePending}>
              {frNotifications.archiveRead}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
