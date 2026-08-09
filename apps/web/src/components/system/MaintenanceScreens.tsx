import Link from 'next/link';
import { RotateCw, Wrench } from 'lucide-react';
import { Badge, Card } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { ReloadButton } from '@/components/system/ReloadButton';
import type { MaintenanceWindow } from '@/lib/queries/maintenance';

/**
 * SYS-003 — Service temporairement indisponible et SYS-004 — Maintenance
 * en cours.
 *
 * Ces ecrans ne s'affichent que lorsqu'une ligne de
 * `public.maintenance_windows` est REELLEMENT active (statut pose par
 * `admin_transition_maintenance_window`, ou periode declaree en cours).
 *
 * MASTER PROMPT §44 / §98 : la maquette SYS-004 montre une « progression
 * indicative 67 % » et un « retour estime » — deux informations que la
 * plateforme ne possede pas. Elles ne sont PAS affichees : seuls le titre,
 * la periode planifiee, le message et le perimetre declares le sont, et
 * l'ecran le dit explicitement.
 */

const FR_DATE = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatWindowPeriod(window: MaintenanceWindow): string {
  return `${fr.system.maintenance.fromTo
    .replace('{start}', FR_DATE.format(new Date(window.startsAt)))
    .replace('{end}', FR_DATE.format(new Date(window.endsAt)))} (UTC)`;
}

const SCOPE_LABELS: Record<string, string> = {
  all: fr.system.maintenance.scopeAll,
  web: fr.system.maintenance.scopeAll,
  messaging: fr.system.serviceUnavailable.services.messaging,
  search: fr.system.serviceUnavailable.services.search,
  notifications: fr.system.serviceUnavailable.services.notifications,
  imports: fr.system.serviceUnavailable.services.imports,
};

function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}

/** SYS-004 — remplace tout l'espace membre pendant une maintenance globale. */
export function MaintenanceScreen({ window }: { window: MaintenanceWindow }) {
  const m = fr.system.maintenance;
  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-surface flex h-[var(--layout-topbar)] items-center border-b px-7 max-md:px-5">
        <BrandLogo />
      </header>

      <main
        id="contenu-principal"
        className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 px-5 py-14 text-center"
      >
        <span
          className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-[#FEF9C3] text-[#A16207]"
          aria-hidden="true"
        >
          <Wrench size={28} aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-3">
          <h1 className="text-h1 text-text-primary font-bold">{m.title}</h1>
          <p className="text-body text-text-secondary">{m.body}</p>
          <p className="text-body-sm font-semibold text-[#15803D]">{m.reassurance}</p>
        </div>

        <Card className="w-full text-left">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-caption text-text-muted">{m.windowTitle}</p>
              <p className="text-body text-text-primary mt-1 font-semibold">{window.title}</p>
              <p className="text-body-sm text-text-secondary mt-1">{formatWindowPeriod(window)}</p>
            </div>
            <Badge tone={window.status === 'in_progress' ? 'warning' : 'info'}>
              {window.status === 'in_progress' ? m.statusInProgress : m.statusScheduled}
            </Badge>
          </div>

          {window.description ? (
            <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
              {window.description}
            </p>
          ) : null}
          {window.bannerMessage ? (
            <p className="text-body-sm text-text-primary mt-4 whitespace-pre-line font-medium">
              {window.bannerMessage}
            </p>
          ) : null}

          <dl className="text-body-sm mt-4 flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex gap-2">
              <dt className="text-text-muted">{m.scopeLabel}</dt>
              <dd className="text-text-primary font-medium">{scopeLabel(window.affectedScope)}</dd>
            </div>
          </dl>

          {window.isReadOnly ? (
            <p className="text-body-sm mt-4 font-medium text-[#A16207]">{m.readOnly}</p>
          ) : null}
        </Card>

        <ReloadButton label={m.retry} />

        <p className="text-caption text-text-muted">{m.honesty}</p>
      </main>
    </div>
  );
}

/**
 * SYS-003 — un service precis est indisponible, le reste fonctionne.
 * Rendu DANS le gabarit membre : la navigation vers les sections non
 * concernees reste reelle.
 */
export function ServiceUnavailableScreen({ window }: { window: MaintenanceWindow }) {
  const s = fr.system.serviceUnavailable;
  const serviceName = scopeLabel(window.affectedScope);

  const otherSections = [
    { label: fr.nav.network, href: '/reseau' },
    { label: fr.nav.networkCalls, href: '/appels' },
    { label: fr.nav.opportunities, href: '/opportunites' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 py-8 text-center">
      <span
        className="text-primary inline-flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-[#EFF6FF]"
        aria-hidden="true"
      >
        <RotateCw size={28} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-3">
        <h1 className="text-h1 text-text-primary font-bold">{s.title}</h1>
        <p className="text-body text-text-secondary">{s.body.replace('{service}', serviceName)}</p>
        <p className="text-body-sm text-text-primary font-semibold">{s.rest}</p>
      </div>

      <Card className="w-full text-left">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-caption text-text-muted">{s.serviceLabel}</p>
            <p className="text-body text-text-primary mt-1 font-semibold">{serviceName}</p>
            <p className="text-body-sm text-text-secondary mt-1">{s.restoring}</p>
            <p className="text-body-sm text-text-secondary mt-1">{formatWindowPeriod(window)}</p>
          </div>
          <Badge tone="warning">{s.unavailableBadge}</Badge>
        </div>
        {window.bannerMessage ? (
          <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
            {window.bannerMessage}
          </p>
        ) : null}
      </Card>

      <div className="flex flex-wrap justify-center gap-4">
        <ReloadButton label={s.retry} />
        <Link
          href={ROUTES.dashboard}
          className="rounded-base text-body-sm text-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[48px] items-center justify-center border border-[#BFDBFE] px-6 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {s.continueHome}
        </Link>
      </div>

      <section aria-label={s.othersTitle} className="w-full">
        <h2 className="text-body-sm text-text-primary font-semibold">{s.othersTitle}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {otherSections.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                className="rounded-base border-border bg-surface text-body-sm text-text-primary hover:bg-surface-muted focus-visible:outline-active-blue block border px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-caption rounded-base border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 font-medium text-[#15803D]">
        {s.noQueue}
      </p>
    </div>
  );
}

/** Banniere d'annonce d'une fenetre planifiee (non commencee). */
export function UpcomingMaintenanceBanner({ window }: { window: MaintenanceWindow }) {
  const m = fr.system.maintenance;
  return (
    <aside
      role="note"
      aria-label={m.upcomingTitle}
      className="rounded-base border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4"
    >
      <p className="text-body-sm font-semibold text-[#92400E]">
        {m.upcomingTitle} — {window.title}
      </p>
      <p className="text-body-sm mt-1 text-[#92400E]">{formatWindowPeriod(window)}</p>
      {window.bannerMessage ? (
        <p className="text-body-sm mt-1 text-[#92400E]">{window.bannerMessage}</p>
      ) : null}
    </aside>
  );
}
