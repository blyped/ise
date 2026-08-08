'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../utils/cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Etat `loading` : le bouton reste focalisable mais n'est plus activable. */
  loading?: boolean;
  /** Texte annonce pendant le chargement. */
  loadingLabel?: string;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children: ReactNode;
}

/**
 * Base commune. Le focus visible est double d'un contour : la couleur ne porte
 * jamais seule l'information (D-90). Pas de rebond : motion sobre.
 */
const BASE =
  'relative inline-flex items-center justify-center gap-3 rounded-base font-medium ' +
  'transition-[background-color,border-color,color] duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none max-md:min-h-[44px]';

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-[32px] px-4 text-body-sm',
  md: 'h-[40px] px-5 text-body-sm',
  lg: 'h-[48px] px-7 text-body',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground border border-transparent ' +
    'hover:bg-primary-hover active:bg-primary-hover',
  secondary:
    'bg-surface text-text-primary border border-[#CBD5E1] ' +
    'hover:bg-surface-muted hover:border-primary ' +
    'active:bg-[#E2E8F0]',
  ghost:
    'bg-transparent text-primary border border-transparent ' +
    'hover:bg-surface-muted active:bg-[#E2E8F0]',
  danger:
    'bg-error text-text-inverse border border-transparent ' +
    'hover:bg-[#991B1B] active:bg-[#7F1D1D]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel = 'Traitement en cours…',
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;
  return (
    <button
      {...rest}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(BASE, SIZES[size], VARIANTS[variant], fullWidth && 'w-full', className)}
    >
      {loading ? (
        <>
          <Spinner size="sm" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
          <span>{children}</span>
          {trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
        </>
      )}
    </button>
  );
}
