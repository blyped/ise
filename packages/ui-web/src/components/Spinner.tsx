import { cx } from '../utils/cx';

export interface SpinnerProps {
  /** 16 · 20 · 24 px. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Libelle annonce aux lecteurs d'ecran. Si absent, le spinner est purement
   * decoratif : le contexte doit alors porter lui-meme l'information d'attente.
   */
  label?: string;
  className?: string;
}

const SIZES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-[16px] w-[16px]',
  md: 'h-[20px] w-[20px]',
  lg: 'h-[24px] w-[24px]',
};

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span
      className={cx('inline-flex items-center', className)}
      {...(label ? { role: 'status' } : {})}
    >
      <svg
        className={cx('animate-spin', SIZES[size])}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
