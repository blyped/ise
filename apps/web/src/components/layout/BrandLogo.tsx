import { cx } from '@ise/ui-web';
import { fr } from '@/i18n/fr';

export interface BrandLogoProps {
  /** `light` sur fond navy, `dark` sur fond clair. */
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * Lockup de marque « logo + COMPÉTENCES ISE ».
 * Le losange est recree en SVG : aucune maquette PNG n'est utilisee comme
 * image de fond (MASTER PROMPT §95).
 */
export function BrandLogo({ tone = 'dark', className }: BrandLogoProps) {
  const isLight = tone === 'light';
  return (
    <span className={cx('inline-flex items-center gap-4', className)}>
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="shrink-0"
      >
        <path
          d="M17 3 31 17 17 31 3 17Z"
          stroke={isLight ? '#FFFFFF' : '#0B214A'}
          strokeWidth="1.5"
        />
        <circle cx="17" cy="3" r="2.6" fill={isLight ? '#FFFFFF' : '#0B214A'} />
        <circle cx="31" cy="17" r="2.6" fill={isLight ? '#FFFFFF' : '#0B214A'} />
        <circle cx="17" cy="31" r="2.6" fill={isLight ? '#FFFFFF' : '#0B214A'} />
        <circle cx="3" cy="17" r="2.6" fill={isLight ? '#FFFFFF' : '#0B214A'} />
        <circle cx="17" cy="17" r="3.4" fill={isLight ? '#D9A441' : '#2563EB'} />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={cx(
            'text-body-sm font-bold tracking-[0.06em]',
            isLight ? 'text-text-inverse' : 'text-deep-navy',
          )}
        >
          {fr.brand.nameLine1}
        </span>
        <span
          className={cx(
            'text-body-sm font-bold tracking-[0.06em]',
            isLight ? 'text-ise-gold' : 'text-primary',
          )}
        >
          {fr.brand.nameLine2}
        </span>
      </span>
      <span className="sr-only">{fr.brand.name}</span>
    </span>
  );
}
