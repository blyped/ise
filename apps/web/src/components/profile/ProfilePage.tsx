import type { ReactNode } from 'react';
import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { ROUTES } from '@/lib/routes';
import { AppShell } from '@/components/layout/AppShell';
import type { ProfileContext } from '@/lib/profile-guard';

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface ProfilePageProps {
  context: ProfileContext;
  currentPath: string;
  title: string;
  subtitle?: string;
  /** Action principale a droite du titre (ex. « Ajouter une expérience »). */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Enveloppe commune aux ecrans de profil : gabarit membre, titre, et les
 * deux sorties d'erreur reelles — compte sans profil, ou lecture en
 * echec avec `correlation_id` (D-93, D-102).
 */
export function ProfilePage({
  context,
  currentPath,
  title,
  subtitle,
  action,
  children,
}: ProfilePageProps) {
  if (!context.ok) {
    return (
      <AppShell currentPath={currentPath} displayName={title}>
        {context.noProfile ? (
          <Alert
            variant="info"
            title={frProfile.overview.noProfileTitle}
            action={
              <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
                {frProfile.overview.noProfileAction}
              </Link>
            }
          >
            {frProfile.overview.noProfileBody}
          </Alert>
        ) : (
          <ErrorState
            title={frProfile.common.loadErrorTitle}
            description={context.message}
            correlationId={context.correlationId}
          />
        )}
      </AppShell>
    );
  }

  const displayName =
    context.profile.displayName ??
    `${context.profile.firstName} ${context.profile.lastName}`.trim();

  return (
    <AppShell currentPath={currentPath} displayName={displayName}>
      <div className="flex flex-col gap-7">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-h1 text-text-primary font-bold">{title}</h1>
            {subtitle ? <p className="text-body text-text-secondary">{subtitle}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </div>
    </AppShell>
  );
}
