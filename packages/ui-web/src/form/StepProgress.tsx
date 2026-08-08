import { cx } from '../utils/cx';

export interface StepProgressProps {
  /** Numero de l'etape en cours, a partir de 1. */
  current: number;
  total: number;
  /** Texte affiche au-dessus de la barre, deja traduit. */
  label: string;
  /** Nom accessible de la barre de progression. */
  progressLabel: string;
  className?: string;
}

/**
 * Compteur d'etape + barre de progression (maquettes ISE-008 -> ISE-014).
 *
 * La barre est un `progressbar` correctement borne : la couleur ne porte
 * jamais seule l'information (D-90), le compteur textuel est toujours la.
 */
export function StepProgress({
  current,
  total,
  label,
  progressLabel,
  className,
}: StepProgressProps) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(1, current), safeTotal);
  const percent = Math.round((safeCurrent / safeTotal) * 100);

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <p className="text-caption text-text-secondary font-medium">{label}</p>
      <div
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCurrent}
        aria-valuetext={label}
        className="bg-surface-muted h-[6px] w-full overflow-hidden rounded-full"
      >
        <span className="bg-primary block h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
