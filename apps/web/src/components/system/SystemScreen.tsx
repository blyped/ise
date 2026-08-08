import type { ReactNode } from 'react';
import { fr } from '@/i18n/fr';
import { BrandLogo } from '@/components/layout/BrandLogo';

export interface SystemScreenProps {
  /** Code affiche en grand (404, 500). Facultatif. */
  code?: string;
  title: string;
  body: string;
  /** Blocs d'explication complementaires. */
  details?: ReactNode;
  actions?: ReactNode;
  /**
   * Toujours affiche : c'est la seule information technique montree a
   * l'utilisateur (D-102). Aucune trace, aucun SQL, aucun nom de table.
   */
  correlationId: string;
  icon?: ReactNode;
}

export function SystemScreen({
  code,
  title,
  body,
  details,
  actions,
  correlationId,
  icon,
}: SystemScreenProps) {
  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-surface flex h-[var(--layout-topbar)] items-center border-b px-7 max-md:px-5">
        <BrandLogo />
      </header>

      <main
        id="contenu-principal"
        className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 px-5 py-14 text-center"
      >
        {icon ? (
          <span
            className="text-primary inline-flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-[#EFF6FF]"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}

        {code ? (
          <p className="text-deep-navy text-[64px] font-bold leading-none" aria-hidden="true">
            {code}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <h1 className="text-h1 text-text-primary font-bold">
            {code ? <span className="sr-only">{`Erreur ${code}. `}</span> : null}
            {title}
          </h1>
          <p className="text-body text-text-secondary">{body}</p>
        </div>

        {details}

        {actions ? <div className="flex flex-wrap justify-center gap-4">{actions}</div> : null}

        <p className="text-caption text-text-muted">
          {fr.common.correlationLabel} :{' '}
          <code className="bg-surface text-text-secondary rounded-sm px-2 py-1 font-mono">
            {correlationId}
          </code>
        </p>
      </main>
    </div>
  );
}
