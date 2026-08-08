'use client';

import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import { CloseIcon } from './icons';

export interface ChipProps {
  children: ReactNode;
  /** Chip de filtre actif. */
  selected?: boolean;
  /** Rend le chip cliquable (bascule de filtre). */
  onToggle?: () => void;
  /** Affiche la croix de suppression. */
  onRemove?: () => void;
  /** Libelle du bouton de suppression, ex. « Retirer le filtre Économétrie ». */
  removeLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Chip({
  children,
  selected = false,
  onToggle,
  onRemove,
  removeLabel = 'Retirer',
  disabled = false,
  className,
}: ChipProps) {
  const shell = cx(
    'inline-flex items-center gap-2 rounded-full border px-4 py-1 text-caption transition-colors duration-150',
    selected
      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-primary-hover font-medium'
      : 'border-border bg-surface-muted text-text-secondary',
    disabled && 'opacity-60',
    className,
  );

  const content = (
    <>
      {selected ? <span className="sr-only">Filtre actif : </span> : null}
      <span>{children}</span>
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onToggle}
        className={cx(
          shell,
          'hover:border-primary cursor-pointer',
          'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:pointer-events-none disabled:cursor-not-allowed',
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={shell}>
      {content}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel}
          className={cx(
            'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full',
            'focus-visible:outline-active-blue hover:bg-[#DBEAFE] focus-visible:outline-2 focus-visible:outline-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <CloseIcon width={12} height={12} />
        </button>
      ) : null}
    </span>
  );
}
