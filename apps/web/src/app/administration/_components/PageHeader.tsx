import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { adminStatusTone } from '@/lib/admin/format';

const PRIMARY_LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base bg-primary px-6 ' +
  'text-body-sm font-semibold text-white hover:bg-primary-hover ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: { href: string; label: string } | undefined;
  children?: ReactNode;
}

/** En-tete commun des ecrans SA : titre, sous-titre, action principale. */
export function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{title}</h1>
        <p className="text-body text-text-secondary max-w-[62ch]">{subtitle}</p>
      </div>
      {action !== undefined ? (
        <Link href={action.href} className={PRIMARY_LINK}>
          {action.label}
        </Link>
      ) : null}
      {children}
    </div>
  );
}

/** Pastille de statut : la couleur ne porte jamais seule l'information (D-90). */
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={adminStatusTone(status)}>{label}</Badge>;
}

/** Ligne cle / valeur des fiches. */
export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-text-muted font-medium">{label}</dt>
      <dd className="text-body-sm text-text-primary">{children}</dd>
    </div>
  );
}

/** Carte de section des fiches (SA-003, SA-006, SA-017, SA-020, SA-039). */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-surface flex flex-col gap-5 rounded-lg border p-6 max-md:p-4">
      <h2 className="text-h3 text-text-primary font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Pied de liste : nombre d'elements RENDUS et « Page suivante » (D-151 :
 * jamais de total global ni de pagination numerotee — le keyset D-44 ne
 * les connait pas).
 */
export function CursorPager({
  shownCount,
  nextHref,
}: {
  shownCount: number;
  nextHref: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-caption text-text-muted">{frAdmin.common.shown(shownCount)}</p>
      {nextHref !== null ? (
        <Link
          href={nextHref}
          className="text-body-sm text-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frAdmin.common.nextPage}
        </Link>
      ) : null}
    </div>
  );
}
