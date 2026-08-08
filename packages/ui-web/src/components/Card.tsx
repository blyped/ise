import type { ElementType, ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface CardProps {
  as?: ElementType;
  /** Ajoute l'elevation legere au survol (translation maximale : 1 px). */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

export function Card({
  as: Tag = 'div',
  interactive = false,
  padding = 'md',
  className,
  children,
}: CardProps) {
  return (
    <Tag
      className={cx(
        'border-border bg-surface rounded-lg border',
        padding === 'md' && 'p-6 max-md:p-5',
        padding === 'sm' && 'p-5 max-md:p-4',
        interactive &&
          'hover:border-primary transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-[1px] hover:shadow-sm',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('mb-5 flex flex-col gap-1', className)}>{children}</div>;
}

export function CardTitle({
  as: Tag = 'h3',
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cx('text-h4 text-text-primary font-semibold', className)}>{children}</Tag>;
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <p className={cx('text-body-sm text-text-secondary', className)}>{children}</p>;
}
