'use client';

import { useId, type ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface OptionCardItem {
  value: string;
  label: string;
  description?: string;
  /** Precision affichee en bas de carte (ex. cadence declaree). */
  footnote?: string;
  disabled?: boolean;
}

export interface OptionCardGroupProps {
  /** `checkbox` = plusieurs choix (ISE-013) · `radio` = un seul (ISE-021). */
  type: 'checkbox' | 'radio';
  name: string;
  legend: string;
  hint?: string;
  items: readonly OptionCardItem[];
  defaultValues?: readonly string[];
  error?: string | undefined;
  /** Contenu additionnel place sous les cartes (compteur, rappel…). */
  children?: ReactNode;
  columns?: 1 | 2 | 3;
}

/**
 * Cartes selectionnables, utilisables au clavier comme a la souris.
 *
 * Le controle est un VRAI `input`, visible et natif : l'etat coche est
 * porte par le navigateur, poste avec le formulaire et annonce tel quel
 * par les lecteurs d'ecran. La carte n'est que l'etiquette du controle,
 * jamais un bouton decoratif (MASTER PROMPT §113). L'etat selectionne est
 * signale par la case cochee ET par le cadre, jamais par la couleur seule
 * (D-90).
 */
export function OptionCardGroup({
  type,
  name,
  legend,
  hint,
  items,
  defaultValues = [],
  error,
  children,
  columns = 2,
}: OptionCardGroupProps) {
  const base = useId();
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const described = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset
      className="flex flex-col gap-4 border-0 p-0"
      aria-invalid={error ? true : undefined}
      {...(described.length > 0 ? { 'aria-describedby': described } : {})}
    >
      <legend className="text-body-sm text-text-primary mb-1 font-medium">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}

      <div
        className={cx(
          'grid gap-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {items.map((item) => (
          <label
            key={item.value}
            className={cx(
              'rounded-base border-border bg-surface flex min-h-[44px] cursor-pointer flex-col gap-3 border p-5',
              'hover:border-primary hover:bg-surface-muted transition-colors duration-150',
              'has-[:checked]:border-primary has-[:checked]:bg-[#EFF6FF]',
              'has-[:focus-visible]:outline-active-blue has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
            )}
          >
            <span className="flex items-start gap-3">
              <input
                type={type}
                name={name}
                value={item.value}
                defaultChecked={defaultValues.includes(item.value)}
                disabled={item.disabled === true}
                className={cx(
                  'mt-[2px] h-[20px] w-[20px] shrink-0 cursor-pointer accent-[#2563EB]',
                  'disabled:cursor-not-allowed',
                )}
              />
              <span className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-semibold">{item.label}</span>
                {item.description ? (
                  <span className="text-caption text-text-secondary">{item.description}</span>
                ) : null}
              </span>
            </span>
            {item.footnote ? (
              <span className="text-caption text-text-muted">{item.footnote}</span>
            ) : null}
          </label>
        ))}
      </div>

      {children}

      {error ? (
        <p id={errorId} className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
