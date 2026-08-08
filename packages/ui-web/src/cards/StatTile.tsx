import { cx } from '../utils/cx';

export interface StatTileProps {
  value: number;
  label: string;
  /** Précision facultative, par exemple « sur 47 profils ciblés ». */
  hint?: string;
  className?: string;
}

/**
 * Compteur d'un tableau de suivi.
 *
 * Le composant n'accepte que des ENTIERS déjà calculés en base : aucune
 * estimation, aucun arrondi, aucun pourcentage (MASTER PROMPT §98).
 */
export function StatTile({ value, label, hint, className }: StatTileProps) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <span className="text-h2 text-text-primary font-bold">{value}</span>
      <span className="text-body-sm text-text-secondary font-medium">{label}</span>
      {hint ? <span className="text-caption text-text-muted">{hint}</span> : null}
    </div>
  );
}
