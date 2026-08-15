import Link from 'next/link';
import { cx } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { NOTIFICATION_ROUTES } from '@/lib/routes/notifications';

/** Au-dela, le chiffre exact n'aide plus et deforme la pastille (meme regle que AdminNav/CmsNav). */
function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export interface NotificationBellProps {
  /**
   * Nombre de notifications non lues, ou `undefined` si la lecture a
   * echoue ou n'a pas ete tentee. Convention Sec.47 : un compteur absent
   * n'affiche aucune pastille — jamais de page cassee pour ce confort.
   */
  unreadCount?: number | undefined;
  className?: string;
}

/**
 * Icone de notifications (cloche) + pastille de non-lus, partagee entre
 * la Topbar de l'espace membre (`AppShell`) et l'en-tete public quand le
 * visiteur est connecte (`PublicHeader`, via `PublicViewerProvider`).
 *
 * Simple lien vers le centre de notifications deja livre (ISE-098,
 * `/notifications`) : ce composant n'invente aucune donnee, il se
 * contente d'afficher le compteur deja calcule par
 * `my_notification_summary()` en base.
 */
export function NotificationBell({ unreadCount, className }: NotificationBellProps) {
  const hasUnread = typeof unreadCount === 'number' && unreadCount > 0;
  const label = hasUnread
    ? `${fr.nav.notifications} — ${unreadCount} ${fr.nav.notificationsUnreadSuffix}`
    : fr.nav.notifications;

  return (
    <Link
      href={NOTIFICATION_ROUTES.center}
      aria-label={label}
      className={cx(
        'relative inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full',
        'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
        'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path
          d="M10 2.5c-2.2 0-4 1.8-4 4v2.1c0 .5-.2 1-.5 1.4L4 11.7c-.6.7-.1 1.8.8 1.8h10.4c.9 0 1.4-1.1.8-1.8l-1.5-1.7c-.3-.4-.5-.9-.5-1.4V6.5c0-2.2-1.8-4-4-4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8.2 15.3a1.8 1.8 0 0 0 3.6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {hasUnread ? (
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground absolute right-0.5 top-0.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
        >
          {badgeText(unreadCount)}
        </span>
      ) : null}
    </Link>
  );
}
