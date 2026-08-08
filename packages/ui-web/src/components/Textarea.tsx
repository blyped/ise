'use client';

import type { ComponentPropsWithRef } from 'react';
import { cx } from '../utils/cx';

export type TextareaProps = ComponentPropsWithRef<'textarea'>;

export function Textarea({ className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      rows={rows}
      className={cx(
        'rounded-base border-border bg-surface text-body text-text-primary w-full border px-4 py-4',
        'placeholder:text-text-muted resize-y transition-colors duration-150',
        'focus:border-primary hover:border-[#CBD5E1]',
        'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed',
        'aria-[invalid=true]:border-error aria-[invalid=true]:bg-[#FEF2F2]',
        className,
      )}
    />
  );
}
