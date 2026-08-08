import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import { CheckIcon } from '../components/icons';

export interface RelevanceReason {
  criterion: string;
  label: string;
  evidence?: readonly string[];
}

export interface RelevanceNoteProps {
  /** Titre du bloc, par exemple « Pourquoi cet appel vous est proposé ». */
  title: string;
  /**
   * Libellé QUALITATIF de la pertinence (« Très pertinent pour votre
   * profil »). Le composant n'accepte volontairement AUCUN nombre :
   * MASTER PROMPT §15 interdit d'exposer un score, et un composant qui
   * saurait en afficher un finirait par en afficher un.
   */
  label?: string | undefined;
  reasons: readonly RelevanceReason[];
  /** Rendu quand aucune raison n'est disponible : jamais une case vide. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * Bloc « pourquoi ce rapprochement », commun aux appels au réseau et aux
 * opportunités.
 *
 * D-43 : une recommandation sans raison affichable n'existe pas. Si la
 * liste est vide, le composant rend `fallback` — il ne rend jamais un
 * encadré décoratif sans contenu.
 */
export function RelevanceNote({ title, label, reasons, fallback, className }: RelevanceNoteProps) {
  if (reasons.length === 0) {
    return fallback === undefined ? null : <>{fallback}</>;
  }

  return (
    <section
      aria-label={title}
      className={cx('rounded-base border border-[#BBF7D0] bg-[#F0FDF4] p-5', className)}
    >
      <h2 className="text-body-sm text-text-primary font-semibold">{title}</h2>

      <ul className="mt-3 flex flex-col gap-2">
        {reasons.map((reason) => (
          <li
            key={reason.criterion}
            className="text-body-sm text-text-secondary flex items-start gap-2"
          >
            <CheckIcon className="text-success mt-[3px] shrink-0" aria-hidden="true" />
            <span>
              {reason.label}
              {reason.evidence && reason.evidence.length > 0 ? (
                <span className="text-text-muted"> · {reason.evidence.join(' · ')}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {label ? (
        <p className="rounded-base bg-surface text-body-sm text-text-primary mt-4 border border-[#BBF7D0] px-4 py-2 text-center font-semibold">
          {label}
        </p>
      ) : null}
    </section>
  );
}
