'use client';

import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface RadioProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'children'> {
  label: ReactNode;
  description?: ReactNode;
}

export function Radio({ label, description, className, id, ...rest }: RadioProps) {
  const generated = useId();
  const inputId = id ?? `${generated}-radio`;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className={cx('flex items-start gap-3', className)}>
      <span className="relative inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center">
        <input
          {...rest}
          id={inputId}
          type="radio"
          {...(descriptionId ? { 'aria-describedby': descriptionId } : {})}
          className={cx(
            'bg-surface peer h-[20px] w-[20px] cursor-pointer appearance-none rounded-full border-2 border-[#CBD5E1]',
            'hover:border-primary transition-colors duration-150',
            'checked:border-primary',
            'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
            'disabled:border-border disabled:bg-surface-muted disabled:cursor-not-allowed',
          )}
        />
        <span
          className="bg-primary pointer-events-none absolute hidden h-[10px] w-[10px] rounded-full peer-checked:block"
          aria-hidden="true"
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
  );
}
