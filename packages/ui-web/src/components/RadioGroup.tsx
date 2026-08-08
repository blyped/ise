'use client';

import { useId, type ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface RadioGroupProps {
  legend: string;
  hint?: string;
  error?: string | undefined;
  className?: string;
  children: ReactNode;
}

/**
 * Regroupe des `Radio` dans un `fieldset` correctement etiquete.
 *
 * L'aide et l'erreur sont reliees au GROUPE par `aria-describedby` : un
 * message d'erreur porte sur le choix, pas sur l'un des boutons. Le
 * `fieldset` porte aussi `aria-invalid`, ce qui permet au formulaire de
 * retrouver le premier groupe en erreur pour lui rendre le focus.
 */
export function RadioGroup({ legend, hint, error, className, children }: RadioGroupProps) {
  const base = useId();
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;

  const described = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset
      className={cx('flex flex-col gap-3 border-0 p-0', className)}
      aria-invalid={error ? true : undefined}
      {...(described.length > 0 ? { 'aria-describedby': described } : {})}
    >
      <legend className="text-body-sm text-text-primary mb-2 font-medium">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
