'use client';

import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cx } from '../utils/cx';
import { CheckIcon } from './icons';

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'children'> {
  label: ReactNode;
  /** Precision affichee sous le libelle. */
  description?: ReactNode;
  error?: string | undefined;
}

export function Checkbox({ label, description, error, className, id, ...rest }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? `${generated}-checkbox`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ');

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-start gap-3">
        <span className="relative inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center">
          <input
            {...rest}
            id={inputId}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            className={cx(
              'bg-surface peer h-[20px] w-[20px] cursor-pointer appearance-none rounded-sm border-2 border-[#CBD5E1]',
              'hover:border-primary transition-colors duration-150',
              'checked:border-primary checked:bg-primary',
              'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
              'disabled:border-border disabled:bg-surface-muted disabled:cursor-not-allowed',
              'aria-[invalid=true]:border-error',
            )}
          />
          <CheckIcon
            className="text-primary-foreground pointer-events-none absolute hidden peer-checked:block"
            width={14}
            height={14}
          />
        </span>
        <span className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-body-sm text-text-primary cursor-pointer">
            {label}
          </label>
          {description ? (
            <span id={descriptionId} className="text-caption text-text-muted">
              {description}
            </span>
          ) : null}
        </span>
      </div>
      {error ? (
        <p id={errorId} className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
