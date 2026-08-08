'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface InputProps extends ComponentPropsWithRef<'input'> {
  /** Element decoratif place a gauche (icone de recherche, etc.). */
  leading?: ReactNode;
  /** Element interactif place a droite (ex. bouton « afficher le mot de passe »). */
  trailing?: ReactNode;
}

export const INPUT_BASE =
  'h-[44px] w-full rounded-base border border-border bg-surface px-4 text-body text-text-primary ' +
  'placeholder:text-text-muted transition-colors duration-150 ' +
  'hover:border-[#CBD5E1] focus:border-primary ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted ' +
  'aria-[invalid=true]:border-error aria-[invalid=true]:bg-[#FEF2F2]';

export function Input({ leading, trailing, className, ...rest }: InputProps) {
  const input = (
    <input
      {...rest}
      className={cx(INPUT_BASE, leading && 'pl-11', trailing && 'pr-11', className)}
    />
  );

  if (!leading && !trailing) return input;

  return (
    <div className="relative">
      {leading ? (
        <span
          className="text-text-muted pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          {leading}
        </span>
      ) : null}
      {input}
      {trailing ? (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>
      ) : null}
    </div>
  );
}
