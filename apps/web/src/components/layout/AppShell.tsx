import type { ReactNode } from 'react';
import { newCorrelationId } from '@/lib/correlation';
import { loadMaintenanceState, scopeMatchesPath } from '@/lib/queries/maintenance';
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

      <div className="border-border bg-surface shrink-0 border-b lg:h-dvh lg:w-[var(--layout-sidebar)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-[var(--layout-topbar)] items-center px-6">
          <BrandLogo />
        </div>
        <SidebarNav currentPath={currentPath} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar displayName={displayName} contextLine={contextLine} />
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
