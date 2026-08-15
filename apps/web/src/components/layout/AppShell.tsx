import type { ReactNode } from 'react';
import Link from 'next/link';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { isDonationModuleAvailable } from '@/lib/donations/config';
import { loadMaintenanceState, scopeMatchesPath } from '@/lib/queries/maintenance';
import { loadViewerAvatar } from '@/lib/queries/viewer';
import { loadNotificationSummary } from '@/lib/queries/notifications';
import { ROUTES } from '@/lib/routes';
import {
  MaintenanceScreen,
  ServiceUnavailableScreen,
  UpcomingMaintenanceBanner,
} from '@/components/system/MaintenanceScreens';
import { BrandLogo } from './BrandLogo';
import { SidebarNav } from './SidebarNav';
import { Topbar } from './Topbar';

export interface AppShellProps {
  currentPath: string;
  displayName: string;
  contextLine?: string | undefined;
  children: ReactNode;
}

/**
 * Gabarit membre : sidebar 248 px (D-96) + topbar 68 px (D-91).
 * Sous 1024 px la sidebar passe au-dessus du contenu, en flux normal :
 * la navigation mobile a 5 destinations (D-94) releve de l'application mobile.
 *
 * SYS-003 / SYS-004 : le gabarit interroge `maintenance_windows` (RLS de
 * 0050 : fenetres `scheduled` / `in_progress` seulement) et rend l'ecran
 * de maintenance quand une fenetre est REELLEMENT active :
 *   · perimetre `all` / `web`  -> SYS-004 plein ecran ;
 *   · perimetre de service     -> SYS-003 sur les routes de ce service ;
 *   · fenetre annoncee a venir -> banniere informative.
 * L'espace `/administration` n'est jamais bloque : c'est par lui que la
 * fenetre se termine. Une lecture en echec n'invente rien et ne bloque
 * rien : l'ecran normal s'affiche.
 */
export async function AppShell({ currentPath, displayName, contextLine, children }: AppShellProps) {
  let content = children;
  let banner: ReactNode = null;

  // D-160 — point d'entree du back-office dans l'en-tete, AFFICHE seulement
  // si le compte detient au moins une permission d'administration
  // (`get_my_admin_permissions`, meme source que la garde serveur). La
  // sidebar membre (§89, D-95) reste inchangee : les deux navigations
  // demeurent distinctes, seul un lien d'en-tete est ajoute. Une lecture en
  // echec n'affiche rien — le lien est un confort, jamais un droit.
  //
  // La photo de profil (avatar) de l'en-tete suit la meme discipline
  // d'AFFICHAGE seulement : `loadViewerAvatar()` est une lecture
  // INDEPENDANTE de `displayName`/`contextLine` (fournis par l'appelant),
  // exactement comme `readAdminAccess()` — un affichage d'en-tete ne doit
  // pas dependre du calendrier d'une autre tranche, et un echec retombe
  // silencieusement sur les initiales (jamais de page cassee pour une photo).
  // D-194 — meme discipline que l'avatar juste au-dessus : lecture
  // INDEPENDANTE (`my_notification_summary()`), qui degrade en silence
  // (`unreadNotifications === undefined`) si la RPC echoue. `NotificationBell`
  // n'affiche alors aucune pastille — jamais de page cassee pour ce confort.
  const [adminAccess, viewerAvatar, notificationSummary] = await Promise.all([
    readAdminAccess(),
    loadViewerAvatar(),
    loadNotificationSummary(newCorrelationId()),
  ]);
  const showAdminLink = adminAccess !== null && adminAccess.permissions.size > 0;
  const unreadNotifications = notificationSummary.ok ? notificationSummary.data.unread : undefined;

  // 0134 — l'entree « Faire un don » n'existe que si une voie de paiement
  // est reellement configuree. Le calcul reste ICI, dans un composant
  // serveur : la sidebar ne recoit qu'un booleen, jamais un secret.
  const donationsAvailable = isDonationModuleAvailable();

  if (!currentPath.startsWith('/administration')) {
    const maintenance = await loadMaintenanceState(newCorrelationId());
    if (maintenance.ok) {
      const { fullOutage, serviceOutages, upcoming } = maintenance.data;

      if (fullOutage !== null) {
        return <MaintenanceScreen window={fullOutage} />;
      }

      const serviceOutage = serviceOutages.find((window) =>
        scopeMatchesPath(window.affectedScope, currentPath),
      );
      if (serviceOutage !== undefined) {
        content = <ServiceUnavailableScreen window={serviceOutage} />;
      }

      if (upcoming !== null) {
        banner = <UpcomingMaintenanceBanner window={upcoming} />;
      }
    }
  }

  return (
    <div className="bg-background min-h-dvh lg:flex">
      <a className="skip-link" href="#contenu-principal">
        Aller au contenu principal
      </a>

      <div className="border-border bg-surface shrink-0 border-b lg:min-h-dvh lg:w-[var(--layout-sidebar)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-[var(--layout-topbar)] items-center px-6">
          {/* Le logo ramene a la landing publique (racine), pas au tableau de bord. */}
          <Link
            href={ROUTES.home}
            className="focus-visible:outline-active-blue rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <BrandLogo />
          </Link>
        </div>
        <SidebarNav currentPath={currentPath} donationsAvailable={donationsAvailable} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          displayName={displayName}
          contextLine={contextLine}
          avatarUrl={viewerAvatar?.url}
          avatarCrop={viewerAvatar?.crop}
          showAdminLink={showAdminLink}
          unreadNotifications={unreadNotifications}
        />
        <main id="contenu-principal" className="flex-1 px-7 py-8 max-md:px-5 max-md:py-6">
          <div className="mx-auto flex w-full max-w-[var(--layout-content-max)] flex-col gap-6">
            {banner}
            {content}
          </div>
        </main>
      </div>
    </div>
  );
}
