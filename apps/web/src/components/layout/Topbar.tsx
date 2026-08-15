import Link from 'next/link';
import type { PhotoCrop } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { AccountMenu } from './AccountMenu';
import { NotificationBell } from './NotificationBell';

export interface TopbarProps {
  /** Nom reellement lu depuis `ise_profiles`, ou l'adresse e-mail du compte. */
  displayName: string;
  /** Ligne de contexte : promotion, ou rien si l'information n'existe pas. */
  contextLine?: string | undefined;
  /**
   * URL signee (courte duree de vie) de la photo de profil, ou `undefined`
   * si le membre n'en a pas depose une ou si la signature a echoue.
   * `AccountMenu` retombe alors sur les initiales : jamais d'erreur visible.
   */
  avatarUrl?: string | undefined;
  /** Cadrage (position + zoom) de `avatarUrl` — D-205, 0147. */
  avatarCrop?: PhotoCrop | undefined;
  /**
   * D-160 — `true` si le compte detient AU MOINS une permission
   * d'administration (lecture `readAdminAccess()` dans AppShell).
   * AFFICHAGE seulement : la garde reelle reste `requireAdminAccess()`
   * cote serveur + les verifications en base (masquer un menu ne protege
   * rien, le montrer n'ouvre rien).
   */
  showAdminLink?: boolean;
  /**
   * Nombre de notifications non lues (D-194). `undefined` si la lecture
   * a echoue : `NotificationBell` n'affiche alors aucune pastille, comme
   * `avatarUrl` retombe silencieusement sur les initiales.
   */
  unreadNotifications?: number | undefined;
}

/** Barre superieure, hauteur 68 px (D-91). */
export function Topbar({
  displayName,
  contextLine,
  avatarUrl,
  avatarCrop,
  showAdminLink = false,
  unreadNotifications,
}: TopbarProps) {
  return (
    <header className="border-border bg-surface sticky top-0 z-20 flex h-[var(--layout-topbar)] shrink-0 items-center justify-between gap-5 border-b px-7 max-md:px-5">
      <p className="text-body-sm text-text-secondary truncate">{fr.brand.name}</p>

      <div className="flex items-center gap-5">
        {showAdminLink ? (
          <Link
            href="/administration"
            className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue rounded-base inline-flex min-h-[32px] items-center font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.nav.adminArea}
          </Link>
        ) : null}
        <NotificationBell unreadCount={unreadNotifications} />
        <AccountMenu
          displayName={displayName}
          avatarUrl={avatarUrl}
          avatarCrop={avatarCrop}
          avatarSize={32}
          contextLine={contextLine}
          label={displayName}
          profileLabel={fr.nav.myProfile}
          profileHref={PROFILE_ROUTES.overview}
          hideLabelOnMobile
          triggerClassName="inline-flex items-center gap-4"
        />
      </div>
    </header>
  );
}
