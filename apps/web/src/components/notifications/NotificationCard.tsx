'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card } from '@ise/ui-web';
import { frNotifications } from '@/i18n/notifications';
import { initialFormState } from '@/lib/form-state';
import { formatDateTime, type NotificationRow } from '@/lib/messaging-view';
import { setNotificationReadAction } from '@/app/notifications/actions';

const PRIORITY_TONE: Record<string, 'error' | 'accent' | 'info' | 'neutral'> = {
  critical: 'error',
  action_required: 'accent',
  relevant: 'info',
  info: 'neutral',
  digest: 'neutral',
};

/**
 * ISE-098 — carte d'une notification.
 *
 * La CATEGORIE et la PRIORITE sont deux pastilles distinctes (D-81) :
 * « Action requise » n'est jamais presentee comme une categorie.
 *
 * L'action directe n'est rendue que si `action_path` existe REELLEMENT
 * en base. Une notification sans destination n'affiche aucun bouton :
 * un bouton qui ne mene nulle part est un bouton decoratif (§113).
 * Une notification expiree perd son action : elle ne doit plus pousser
 * vers une action devenue impossible [34 §77].
 */
export function NotificationCard({ row }: { row: NotificationRow }) {
  const [state, formAction, isPending] = useActionState(
    setNotificationReadAction,
    initialFormState,
  );

  const tone = PRIORITY_TONE[row.priority] ?? 'neutral';
  const showAction = row.actionPath !== null && !row.expired;

  return (
    <Card padding="sm" className={row.read ? '' : 'border-l-primary border-l-[3px]'}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{frNotifications.category[row.category] ?? row.category}</Badge>
          <Badge tone={tone}>{frNotifications.priority[row.priority] ?? row.priority}</Badge>
          {!row.read ? <Badge tone="info">{frNotifications.unreadDot}</Badge> : null}
          {row.expired ? <Badge tone="warning">{frNotifications.expired}</Badge> : null}
          {row.groupCount > 1 ? <Badge tone="neutral">{row.groupCount} événements</Badge> : null}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-body text-text-primary font-semibold">{row.title}</h3>
          {row.body !== null ? (
            <p className="text-body-sm text-text-secondary">{row.body}</p>
          ) : null}
          {/* CA-NOTIF-01 : la raison metier, quand la base en porte une. */}
          {row.reasonText !== null ? (
            <p className="text-caption text-text-muted">Pourquoi : {row.reasonText}</p>
          ) : null}
          <p className="text-caption text-text-muted">{formatDateTime(row.createdAt)}</p>
          {row.expired ? (
            <p className="text-caption text-text-muted">{frNotifications.expiredBody}</p>
          ) : null}
        </div>

        {state.status === 'error' && state.message !== null ? (
          <Alert variant="error" title={state.message}>
            Référence à communiquer à l’assistance : {state.correlationId}
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {showAction ? (
            <Link
              href={row.actionPath as string}
              className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {row.actionLabel ?? frNotifications.open}
            </Link>
          ) : null}

          <form action={formAction}>
            <input type="hidden" name="notificationId" value={row.notificationId} />
            <input type="hidden" name="read" value={row.read ? 'false' : 'true'} />
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              {row.read ? frNotifications.markUnread : frNotifications.markRead}
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
