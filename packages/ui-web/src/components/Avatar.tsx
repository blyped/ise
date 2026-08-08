import { cx } from '../utils/cx';

export type AvatarSize = 24 | 32 | 40 | 48 | 64 | 96 | 120;

export interface AvatarProps {
  /** Nom affiche : sert d'alternative textuelle et de source pour les initiales. */
  name: string;
  src?: string | undefined;
  size?: AvatarSize;
  className?: string;
  /**
   * `true` lorsque l'avatar est purement decoratif (le nom est deja ecrit
   * juste a cote) : il est alors masque aux lecteurs d'ecran.
   */
  decorative?: boolean;
}

const TEXT: Record<AvatarSize, string> = {
  24: 'text-[10px]',
  32: 'text-caption',
  40: 'text-body-sm',
  48: 'text-body',
  64: 'text-h4',
  96: 'text-h2',
  120: 'text-h1',
};

/** Initiales : au plus deux lettres, sur fond neutre controle. */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = 40, className, decorative = false }: AvatarProps) {
  const style = { width: `${size}px`, height: `${size}px` };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={decorative ? '' : name}
        width={size}
        height={size}
        style={style}
        className={cx('border-border shrink-0 rounded-full border object-cover', className)}
        {...(decorative ? { 'aria-hidden': true } : {})}
      />
    );
  }

  return (
    <span
      style={style}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full',
        'text-deep-navy bg-[#E2E8F0] font-semibold',
        TEXT[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
