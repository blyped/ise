import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import { InboxIcon } from './icons';

export interface EmptyStateProps {
  /** Titre honnete : ce qui n'existe pas encore, sans euphemisme. */
  title: string;
  /** Phrase explicative. */
  description: string;
  /** Action de sortie. Un etat vide doit toujours proposer une suite. */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'border-border bg-surface flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <span
        className="bg-surface-muted text-text-muted inline-flex h-[44px] w-[44px] items-center justify-center rounded-full"
        aria-hidden="true"
      >
        {icon ?? <InboxIcon width={20} height={20} />}
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-body text-text-primary font-semibold">{title}</p>
        <p className="text-body-sm text-text-secondary mx-auto max-w-[46ch]">{description}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
