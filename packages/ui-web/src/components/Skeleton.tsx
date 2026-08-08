import { cx } from '../utils/cx';

export interface SkeletonProps {
  className?: string;
  /** Forme du bloc : ligne de texte, bloc ou cercle. */
  shape?: 'line' | 'block' | 'circle';
}

/**
 * Bloc de chargement calque sur la mise en page reelle (D-93).
 * Toujours masque aux lecteurs d'ecran : l'attente est annoncee par le
 * conteneur (`aria-busy`), pas par chaque forme grise.
 */
export function Skeleton({ className, shape = 'block' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'bg-surface-muted block animate-pulse',
        shape === 'line' && 'h-[12px] rounded-full',
        shape === 'block' && 'rounded-base',
        shape === 'circle' && 'rounded-full',
        className,
      )}
    />
  );
}
