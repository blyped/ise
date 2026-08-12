import Link from 'next/link';
import { Avatar } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { SignOutButton } from './SignOutButton';

export interface TopbarProps {
  /** Nom reellement lu depuis `ise_profiles`, ou l'adresse e-mail du compte. */
  displayName: string;
  /** Ligne de contexte : promotion, ou rien si l'information n'existe pas. */
  contextLine?: string | undefined;
  /**
   * D-160 — `true` si le compte detient AU MOINS une permission
   * d'administration (lecture `readAdminAccess()` dans AppShell).
   * AFFICHAGE seulement : la garde reelle reste `requireAdminAccess()`
   * cote serveur + les verifications en base (masquer un menu ne protege
   * rien, le montrer n'ouvre rien).
   */
  showAdminLink?: boolean;
}

/** Barre superieure, hauteur 68 px (D-91). */
export function Topbar({ displayName, contextLine, showAdminLink = false }: TopbarProps) {
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
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size={32} decorative />
          <span className="flex flex-col leading-tight max-sm:hidden">
            <span className="text-body-sm text-text-primary font-semibold">{displayName}</span>
            {contextLine ? (
              <span className="text-caption text-text-muted">{contextLine}</span>
            ) : null}
          </span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
