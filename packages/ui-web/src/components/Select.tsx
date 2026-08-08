'use client';

import type { ComponentPropsWithRef } from 'react';
import { cx } from '../utils/cx';
import { ChevronDownIcon } from './icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'children'> {
  options: readonly SelectOption[];
  /** Option neutre affichee en tete de liste. */
  placeholder?: string;
}

export function Select({ options, placeholder, className, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={cx(
          'rounded-base border-border bg-surface h-[44px] w-full appearance-none border pl-4 pr-11',
          'text-body text-text-primary transition-colors duration-150',
          'focus:border-primary hover:border-[#CBD5E1]',
          'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed',
          'aria-[invalid=true]:border-error aria-[invalid=true]:bg-[#FEF2F2]',
          className,
        )}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled === true}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        className="text-text-muted pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
        width={18}
        height={18}
      />
    </div>
  );
}
