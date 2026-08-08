import type { ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface MetaItem {
  label: string;
  value: ReactNode;
}

export interface MetaListProps {
  items: readonly MetaItem[];
  className?: string;
}

/**
 * Liste de définitions pour les panneaux « Informations ».
 *
 * Une entrée dont la valeur est `null` ou `undefined` est SUPPRIMÉE :
 * un champ non renseigné ne doit pas afficher un tiret qui laisserait
 * croire à une valeur vide plutôt qu'à une absence de donnée
 * (MASTER PROMPT §98).
 */
export function MetaList({ items, className }: MetaListProps) {
  const shown = items.filter((item) => item.value !== null && item.value !== undefined);
  if (shown.length === 0) return null;

  return (
    <dl className={cx('flex flex-col gap-3', className)}>
      {shown.map((item) => (
        <div
          key={item.label}
          className="border-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2 last:border-b-0 last:pb-0"
        >
          <dt className="text-caption text-text-muted">{item.label}</dt>
          <dd className="text-body-sm text-text-primary font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
