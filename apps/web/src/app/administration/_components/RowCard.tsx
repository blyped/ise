import type { ReactNode } from 'react';

/**
 * Ligne de liste des ecrans SA (SA-002, SA-006, SA-008, SA-016, SA-019,
 * SA-038) : titre, meta, pastilles, actions. Sur mobile la ligne
 * s'empile ; chaque cible interactive fait au moins 44 px.
 */
export function RowCard({
  title,
  meta,
  badges,
  actions,
  children,
}: {
  title: ReactNode;
  meta: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="border-border bg-surface rounded-lg border p-5 max-md:p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:w-[44%]">
          <p className="text-body-sm text-text-primary font-semibold">{title}</p>
          <p className="text-caption text-text-muted">{meta}</p>
        </div>

        {badges !== undefined ? (
          <div className="flex flex-wrap items-center gap-2 lg:w-[30%]">{badges}</div>
        ) : null}

        {actions !== undefined ? (
          <div className="flex flex-wrap items-center gap-2 lg:w-[24%] lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </li>
  );
}

export function RowList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-4">
      {children}
    </ul>
  );
}
