'use client';

import { useId, type ReactNode } from 'react';
import { cx } from '../utils/cx';
import { AlertIcon } from './icons';

export interface FieldRenderProps {
  /** Identifiant a poser sur le controle. */
  id: string;
  /** Valeur prete a l'emploi pour `aria-describedby` (aide + erreur). */
  describedBy: string | undefined;
  /** `true` des qu'une erreur est presente. */
  invalid: boolean;
  /** A poser sur le controle : `aria-invalid`. */
  'aria-invalid': boolean;
}

export interface FieldProps {
  /** Toujours au-dessus du champ ; le placeholder ne remplace jamais le label. */
  label: string;
  /** Texte d'aide affiche sous le label. */
  hint?: string;
  /** Message d'erreur affiche sous le champ, lie par `aria-describedby`. */
  error?: string | undefined;
  required?: boolean;
  /** Element affiche a droite du label (ex. « Mot de passe oublié ? »). */
  labelAction?: ReactNode;
  className?: string;
  children: (props: FieldRenderProps) => ReactNode;
}

/**
 * Enveloppe accessible d'un champ de formulaire : label + aide + erreur,
 * relies au controle par `aria-describedby` et `aria-invalid`.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  labelAction,
  className,
  children,
}: FieldProps) {
  const base = useId();
  const id = `${base}-control`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;

  const described = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  const describedBy = described.length > 0 ? described : undefined;

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-body-sm text-text-primary font-medium">
          {label}
          {required ? (
            <span className="text-error ml-1" aria-hidden="true">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (obligatoire)</span> : null}
        </label>
        {labelAction}
      </div>

      {hint ? (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}

      {children({ id, describedBy, invalid: Boolean(error), 'aria-invalid': Boolean(error) })}

      {error ? (
        <p id={errorId} className="text-caption text-error flex items-start gap-2">
          <AlertIcon className="mt-[2px] shrink-0" width={14} height={14} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
