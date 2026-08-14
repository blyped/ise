import type { ReactNode } from 'react';
import { frCms } from '@/i18n/cms';
import { ROUTES } from '@/lib/routes';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { readAdminAccess } from '@/lib/admin/permissions';
import { CMS_NAV } from './nav';
import { CmsNav } from './CmsNav';

export interface CmsShellProps {
  currentPath: string;
  /** Titre repris dans la barre supérieure mobile. */
  screenTitle: string;
  children: ReactNode;
}

/**
 * Gabarit du back-office CMS (maquettes Desktop 1440 et Mobile 375).
 *
 * Desktop : rail de 248 px + zone de contenu, comme les maquettes.
 * Mobile  : la barre supérieure porte le bouton de menu et le fil
 *           d'Ariane ; le rail devient un panneau depliable. La navigation
 *           reste ATTEIGNABLE — un CMS mobile sans navigation ne permet ni
 *           de consulter, ni d'activer, ni de valider (§54).
 *
 * Aucun composant existant de `packages/ui-web` n'est modifie : ce gabarit
 * vit dans l'arborescence du CMS.
 *
 * Lien croisé vers l'administration (§30, D-171) : meme raisonnement que
 * `AdminShell` cote CMS -> Admin. N'apparait que si le compte a au moins
 * une permission d'administration (meme critere que `requireAdminAccess`).
 *
 * Retour vers l'espace membre (§30, D-171) : meme manque que cote Admin — une
 * fois dans le CMS, aucun chemin de retour vers le tableau de bord membre.
 * Aucune condition de permission : toute personne qui atteint le CMS a par
 * construction une session membre.
 */
export async function CmsShell({ currentPath, screenTitle, children }: CmsShellProps) {
  const adminAccess = await readAdminAccess();
  const adminLink =
    adminAccess !== null && adminAccess.permissions.size > 0
      ? { href: ADMIN_ROUTES.root, label: frCms.nav.backToAdmin }
      : undefined;
  const memberLink = { href: ROUTES.dashboard, label: frCms.nav.backToMember };

  return (
    <div className="bg-background min-h-dvh lg:flex">
      <a className="skip-link" href="#contenu-cms">
        {frCms.brand.skipToContent}
      </a>

      <CmsNav
        currentPath={currentPath}
        screenTitle={screenTitle}
        items={CMS_NAV}
        {...(adminLink ? { adminLink } : {})}
        {...(memberLink ? { memberLink } : {})}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border bg-surface hidden h-[68px] shrink-0 items-center border-b px-7 lg:flex">
          <p className="text-body-sm text-text-secondary font-medium">{frCms.brand.breadcrumb}</p>
        </div>

        <main id="contenu-cms" className="flex-1 px-7 py-8 max-md:px-4 max-md:py-5">
          <div className="mx-auto w-full max-w-[1120px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
