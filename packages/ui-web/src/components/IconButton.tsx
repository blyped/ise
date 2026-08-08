'use client';

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../utils/cx';
import { Spinner } from './Spinner';

export type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Obligatoire : un bouton icone doit toujours avoir un nom accessible. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
}

const SIZES: Record<IconButtonSize, string> = {
  sm: 'h-[32px] w-[32px]',
  md: 'h-[40px] w-[40px]',
  lg: 'h-[48px] w-[48px]',
};

const VARIANTS: Record<IconButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground border border-transparent hover:bg-primary-hover',
  secondary:
    'bg-surface text-text-primary border border-[#CBD5E1] hover:bg-surface-muted hover:border-primary',
  ghost:
    'bg-transparent text-text-secondary border border-transparent hover:bg-surface-muted hover:text-text-primary',
  danger: 'bg-error text-text-inverse border border-transparent hover:bg-[#991B1B]',
};

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  className,
  disabled,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const isDisabled = disabled === true || loading;
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        'rounded-base inline-flex items-center justify-center transition-colors duration-150',
        'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
        'max-md:min-h-[44px] max-md:min-w-[44px]',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner size="sm" /> : <span aria-hidden="true">{icon}</span>}
    </button>
  );
}
