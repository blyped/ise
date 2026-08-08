import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import { ErrorIcon } from './icons';

export interface ErrorStateProps {
  /** Message metier en francais. Jamais de trace technique (D-102). */
  title?: string;
  description?: string;
  /**
   * Identifiant de correlation a communiquer a l'assistance.
   * Toujours affiche : c'est le seul element technique montre a l'utilisateur.
   */
  correlationId: string;
  /** Bouton « Réessayer » ou equivalent. */
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Impossible de charger cette section.',
  description,
  correlationId,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col items-center gap-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-6 py-8 text-center',
        className,
      )}
    >
      <span className="text-error" aria-hidden="true">
        <ErrorIcon width={22} height={22} />
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-body text-text-primary font-semibold">{title}</p>
        {description ? (
          <p className="text-body-sm text-text-secondary mx-auto max-w-[52ch]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
      <p className="text-caption text-text-muted">
        Référence à communiquer à l’assistance :{' '}
        <code className="bg-surface text-text-secondary rounded-sm px-2 py-1 font-mono">
          {correlationId}
        </code>
      </p>
    </div>
  );
}
