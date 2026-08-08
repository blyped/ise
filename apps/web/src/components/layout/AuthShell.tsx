import type { ReactNode } from 'react';
import { fr } from '@/i18n/fr';
import { BrandLogo } from './BrandLogo';

export interface AuthShellProps {
  children: ReactNode;
  /** Titre du panneau de gauche. Par defaut : la promesse de marque. */
  panelTitle?: string;
  /** Corps du panneau de gauche. */
  panelBody?: string;
  /** Trois arguments numerotes. Par defaut : les piliers de la marque. */
  panelPillars?: readonly string[];
  /** Largeur maximale de la colonne de droite. */
  contentWidth?: 'default' | 'wide';
}

/**
 * Gabarit des ecrans d'authentification et de reclamation (ISE-001 a ISE-007) :
 * panneau de marque a gauche sur desktop, carte de formulaire a droite.
 * Sous 1024 px, le panneau se replie en bandeau compact.
 *
 * Le contenu du panneau est parametrable : les maquettes ISE-005 et ISE-006
 * portent leur propre accroche. Les valeurs par defaut reproduisent a
 * l'identique ce qu'affichaient ISE-001 a ISE-004.
 */
export function AuthShell({
  children,
  panelTitle,
  panelBody,
  panelPillars,
  contentWidth = 'default',
}: AuthShellProps) {
  const title = panelTitle ?? fr.brand.promise;
  const body = panelBody ?? fr.brand.pitch;
  const pillars = panelPillars ?? fr.brand.pillars;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-deep-navy relative overflow-hidden px-7 py-8 lg:flex lg:flex-col lg:justify-between lg:px-11 lg:py-11">
        <div
          aria-hidden="true"
          className="bg-dark-navy/70 pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full blur-3xl"
        />
        <div className="relative">
          <BrandLogo tone="light" />
        </div>

        <div className="relative mt-9 hidden max-w-[520px] lg:block">
          <h1 className="text-display text-text-inverse font-bold">{title}</h1>
          <p className="text-body mt-6 text-[#C7D2E5]">{body}</p>

          <ul className="mt-9 flex flex-col gap-4">
            {pillars.map((pillar, index) => (
              <li
                key={pillar}
                className="rounded-base flex items-center gap-5 bg-[#12315F] px-5 py-4"
              >
                <span className="text-caption text-ise-gold font-semibold" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-body-sm text-text-inverse font-semibold">{pillar}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-body-sm relative mt-8 hidden font-semibold text-[#8FA6C8] lg:block">
          {fr.brand.signature}
        </p>
      </aside>

      <main
        id="contenu-principal"
        className="flex min-h-dvh flex-col items-center justify-center gap-7 px-5 py-10 lg:px-11"
      >
        <div className={contentWidth === 'wide' ? 'w-full max-w-[640px]' : 'w-full max-w-[520px]'}>
          {children}
        </div>
        <nav aria-label="Liens légaux" className="text-caption text-text-muted">
          <ul className="flex items-center gap-4">
            <li>{fr.footer.privacy}</li>
            <li aria-hidden="true">·</li>
            <li>{fr.footer.terms}</li>
            <li aria-hidden="true">·</li>
            <li>{fr.footer.help}</li>
          </ul>
        </nav>
      </main>
    </div>
  );
}
