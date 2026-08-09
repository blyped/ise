import type { ReactNode } from 'react';
import { frAdmin } from '@/i18n/admin';
import type { AdminAccess } from '@/lib/admin/permissions';
import { visibleNavItems } from './nav';
import { AdminNav } from './AdminNav';

export interface AdminShellProps {
  access: AdminAccess;
  currentPath: string;
  /** Titre repris dans la barre superieure mobile. */
  screenTitle: string;
  children: ReactNode;
}

/**
 * Gabarit du back-office Superadmin (maquettes SA-0XX Desktop 1440 /
 * Mobile 375) — meme structure que `CmsShell` : rail de 248 px + contenu.
 *
 * La navigation est FILTREE par permission : masquer une entree n'est pas
 * la securite (chaque page et chaque fonction `admin_*` revalident), mais
 * une entree qui menerait a un ecran systematiquement refuse serait un
 * bouton decoratif (MASTER PROMPT §113).
 */
export function AdminShell({ access, currentPath, screenTitle, children }: AdminShellProps) {
  return (
    <div className="bg-background min-h-dvh lg:flex">
      <a className="skip-link" href="#contenu-admin">
        {frAdmin.brand.skipToContent}
      </a>

      <AdminNav
        currentPath={currentPath}
        screenTitle={screenTitle}
        items={visibleNavItems(access)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border bg-surface hidden h-[68px] shrink-0 items-center border-b px-7 lg:flex">
          <p className="text-body-sm text-text-secondary font-medium">{frAdmin.brand.breadcrumb}</p>
        </div>

        <main id="contenu-admin" className="flex-1 px-7 py-8 max-md:px-4 max-md:py-5">
          <div className="mx-auto w-full max-w-[1120px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
