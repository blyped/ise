import type { ReactNode } from 'react';
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
 */
export function AppShell({ currentPath, displayName, contextLine, children }: AppShellProps) {
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
          <div className="mx-auto w-full max-w-[var(--layout-content-max)]">{children}</div>
        </main>
      </div>
    </div>
  );
}
