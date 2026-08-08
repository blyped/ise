import type { ReactNode } from 'react';
import { Badge } from '@ise/ui-web';
import { statusLabel, statusTone } from '@/lib/cms/format';

export interface RowCardProps {
  title: ReactNode;
  meta: ReactNode;
  /** Pastille de statut. Le libelle est toujours ecrit (D-90). */
  status?: string | undefined;
  statusText?: string | undefined;
  period?: ReactNode;
  /** Actions de la ligne. Sur mobile elles passent sous le titre. */
  actions?: ReactNode;
  /** Signal « brouillon non publie » (§48). */
  notice?: ReactNode;
  /** Contenu deplie sous la ligne : formulaire d'edition, details. */
  children?: ReactNode;
}

/**
 * Ligne de liste des maquettes CMS-002, CMS-003, CMS-005, CMS-007, CMS-009 :
 * titre, meta, pastille de statut, periode, actions.
 *
 * Sur mobile la ligne s'empile ; les actions restent visibles et
 * atteignables au doigt (44 px minimum).
 */
export function RowCard({
  title,
  meta,
  status,
  statusText,
  period,
  actions,
  notice,
  children,
}: RowCardProps) {
  return (
    <li className="border-border bg-surface rounded-lg border p-5 max-md:p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:w-[42%]">
          <p className="text-body-sm text-text-primary font-semibold">{title}</p>
          <p className="text-caption text-text-muted">{meta}</p>
          {notice}
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:w-[28%]">
          {status !== undefined ? (
            <Badge tone={statusTone(status)}>{statusText ?? statusLabel(status)}</Badge>
          ) : null}
          {period !== undefined ? (
            <span className="text-caption text-text-secondary">{period}</span>
          ) : null}
        </div>

        {actions !== undefined ? (
          <div className="flex flex-wrap items-center gap-2 lg:w-[30%] lg:justify-end">
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
