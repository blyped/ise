import type { ReactNode } from 'react';
import Link from 'next/link';
import { frSettings } from '@/i18n/settings';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { AppShell } from '@/components/layout/AppShell';

const ITEMS = [
  { href: SETTINGS_ROUTES.privacy, label: frSettings.sections.privacy },
  { href: SETTINGS_ROUTES.notifications, label: frSettings.sections.notifications },
  { href: SETTINGS_ROUTES.account, label: frSettings.sections.account },
  { href: SETTINGS_ROUTES.blocked, label: frSettings.sections.blocked },
  { href: SETTINGS_ROUTES.data, label: frSettings.sections.data },
] as const;

/**
 * ISE-099 — gabarit des parametres.
 *
 * RESPONSIVE : a 375 px la navigation secondaire est une liste de liens
 * empilee AU-DESSUS du contenu — la maquette mobile navigue par
 * sections, pas par une colonne laterale. A partir de 1024 px la meme
 * liste devient la colonne de gauche. Aucun element n'est supprime a
 * l'etroit : il change de place.
 */
export function SettingsShell({
  currentPath,
  displayName,
  contextLine,
  title,
  subtitle,
  children,
}: {
  currentPath: string;
  displayName: string;
  contextLine: string | undefined;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <AppShell
      currentPath={SETTINGS_ROUTES.overview}
      displayName={displayName}
      contextLine={contextLine}
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{title}</h1>
          {subtitle !== undefined ? (
            <p className="text-body text-text-secondary">{subtitle}</p>
          ) : null}
        </div>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,248px)_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Sections des paramètres" className="min-w-0">
            <ul className="border-border bg-surface flex flex-col gap-1 rounded-lg border p-3">
              {ITEMS.map((item) => {
                const isCurrent = item.href === currentPath;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={[
                        'rounded-base text-body-sm flex min-h-[44px] items-center px-4 font-medium transition-colors duration-150',
                        'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
                        isCurrent
                          ? 'text-primary-hover bg-[#EFF6FF]'
                          : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
                      ].join(' ')}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-7">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
