import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import { AlertIcon, CheckIcon, ErrorIcon, InfoIcon } from './icons';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'action';

export interface AlertProps {
  variant?: AlertVariant;
  title: string;
  children?: ReactNode;
  /** Action de sortie (bouton ou lien). */
  action?: ReactNode;
  className?: string;
}

const STYLES: Record<AlertVariant, { box: string; icon: string; prefix: string }> = {
  info: { box: 'border-[#BFDBFE] bg-[#EFF6FF]', icon: 'text-info', prefix: 'Information' },
  success: { box: 'border-[#BBF7D0] bg-[#F0FDF4]', icon: 'text-success', prefix: 'Succès' },
  warning: { box: 'border-[#FDE68A] bg-[#FFFBEB]', icon: 'text-warning', prefix: 'Attention' },
  error: { box: 'border-[#FECACA] bg-[#FEF2F2]', icon: 'text-error', prefix: 'Erreur' },
  action: { box: 'border-[#BFDBFE] bg-[#EFF6FF]', icon: 'text-primary', prefix: 'Action requise' },
};

function iconFor(variant: AlertVariant) {
  if (variant === 'success') return <CheckIcon width={18} height={18} />;
  if (variant === 'warning') return <AlertIcon width={18} height={18} />;
  if (variant === 'error') return <ErrorIcon width={18} height={18} />;
  return <InfoIcon width={18} height={18} />;
}

/**
 * Banniere d'etat. Le prefixe textuel (« Erreur », « Attention »…) est lu par
 * les lecteurs d'ecran : la couleur ne suffit jamais (D-90).
 */
export function Alert({ variant = 'info', title, children, action, className }: AlertProps) {
  const style = STYLES[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cx('rounded-base flex gap-4 border p-5', style.box, className)}
    >
      <span className={cx('mt-[2px] shrink-0', style.icon)}>{iconFor(variant)}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-body-sm text-text-primary font-semibold">
          <span className="sr-only">{style.prefix} : </span>
          {title}
        </p>
        {children ? <div className="text-body-sm text-text-secondary">{children}</div> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}
