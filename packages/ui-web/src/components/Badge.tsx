import type { ReactNode } from 'react';
import { cx } from '../utils/cx';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'accent';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Icone facultative. Elle complete le libelle, elle ne le remplace jamais. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary border-border',
  info: 'bg-[#EFF6FF] text-info border-[#BFDBFE]',
  success: 'bg-[#F0FDF4] text-success border-[#BBF7D0]',
  warning: 'bg-[#FFFBEB] text-warning border-[#FDE68A]',
  error: 'bg-[#FEF2F2] text-error border-[#FECACA]',
  accent: 'bg-[#FDF6E7] text-[#8A6111] border-[#EFD9A6]',
};

/**
 * Pastille de statut. Le libelle est toujours present : la couleur seule
 * ne porte jamais l'information (D-90).
 */
export function Badge({ tone = 'neutral', icon, className, children }: BadgeProps) {
  return (
    <span
      className={cx(
        'text-caption inline-flex items-center gap-2 rounded-full border px-4 py-1 font-medium',
        TONES[tone],
        className,
      )}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
