import type { ReactNode } from 'react';
import { fr } from '@/i18n/fr';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="border-border bg-surface flex flex-col gap-6 rounded-xl border p-8 shadow-sm max-md:p-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-h1 text-text-primary font-bold">{title}</h2>
        {subtitle ? <p className="text-body text-text-secondary">{subtitle}</p> : null}
      </header>

      {children}

      {footer}

      <p className="text-caption text-text-muted text-center">{fr.brand.privacyNote}</p>
    </section>
  );
}
