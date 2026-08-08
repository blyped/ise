'use client';

import { useId, type ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /**
   * Libelles d'etat. La couleur ne portant jamais seule l'information (D-90),
   * l'etat est aussi ecrit en toutes lettres a cote de l'interrupteur.
   */
  onLabel?: string;
  offLabel?: string;
  className?: string;
  name?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  onLabel = 'Activé',
  offLabel = 'Désactivé',
  className,
  name,
}: SwitchProps) {
  const base = useId();
  const labelId = `${base}-label`;
  const descriptionId = description ? `${base}-description` : undefined;

  return (
    <div className={cx('flex items-start justify-between gap-5', className)}>
      <span className="flex flex-col gap-1">
        <span id={labelId} className="text-body-sm text-text-primary font-medium">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="text-caption text-text-muted">
            {description}
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <span className="text-caption text-text-secondary" aria-hidden="true">
          {checked ? onLabel : offLabel}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          {...(descriptionId ? { 'aria-describedby': descriptionId } : {})}
          disabled={disabled}
          onClick={() => onCheckedChange(!checked)}
          className={cx(
            'relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full border transition-colors duration-150',
            'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            checked ? 'border-primary bg-primary' : 'bg-surface-muted border-[#CBD5E1]',
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              'bg-surface inline-block h-[18px] w-[18px] rounded-full shadow-sm transition-transform duration-150',
              checked ? 'translate-x-[23px]' : 'translate-x-[3px]',
            )}
          />
        </button>
        {name ? <input type="hidden" name={name} value={checked ? 'true' : 'false'} /> : null}
      </span>
    </div>
  );
}
