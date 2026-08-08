'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Avatar, cx } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { PUBLIC_NAV_ITEMS } from './public-nav';
import { TrackedLink } from './analytics/TrackedLink';
import { usePublicViewer } from './PublicViewerProvider';

const LINK_BASE =
  'rounded-sm text-body-sm text-text-secondary transition-colors duration-150 ' +
  'hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-active-blue';

const CTA_BASE =
  'inline-flex min-h-[40px] items-center justify-center gap-3 rounded-base px-6 ' +
  'text-body-sm font-semibold transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Barres du menu, dessinees plutot qu'importees : aucune dependance d'icone. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {open ? (
        <path d="M4 4 16 16M16 4 4 16" stroke="currentColor" strokeWidth="1.8" />
      ) : (
        <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" />
      )}
    </svg>
  );
}

/**
 * ADDENDUM §7 — En-tete public.
 *
 * Visiteur : logo + navigation + « Connexion ».
 * Membre connecte : « Connexion » devient avatar + « Mon espace ».
 *
 * Accessibilite : navigation au clavier de bout en bout, focus visible fourni
 * par les tokens, `aria-expanded` / `aria-controls` sur le declencheur mobile,
 * fermeture par `Echap` avec retour du focus sur le bouton.
 */
export function PublicHeader() {
  const viewer = usePublicViewer();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const memberEntry = viewer.authenticated ? (
    <Link
      href={ROUTES.dashboard}
      className={cx(
        CTA_BASE,
        'border-border bg-surface text-text-primary hover:bg-surface-muted border',
      )}
    >
      <Avatar name={viewer.displayName ?? fr.public.nav.memberSpace} size={24} decorative />
      <span>{fr.public.nav.memberSpace}</span>
    </Link>
  ) : (
    // ADDENDUM §50 — `public_login_click`. Le clic est mesure la ou il a lieu,
    // pas deduit d'une arrivee sur ISE-001.
    <TrackedLink
      href={ROUTES.signIn}
      event="public_login_click"
      sectionKey="header"
      className={cx(CTA_BASE, 'bg-primary text-primary-foreground hover:bg-primary-hover')}
    >
      {fr.public.nav.signIn}
    </TrackedLink>
  );

  return (
    <header className="border-border bg-surface sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-[var(--layout-topbar)] w-full max-w-[var(--layout-content-max)] items-center justify-between gap-5 px-7 max-md:px-5">
        <Link
          href={ROUTES.home}
          className="focus-visible:outline-active-blue rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <BrandLogo />
        </Link>

        <nav aria-label={fr.public.nav.label} className="max-lg:hidden">
          <ul className="flex items-center gap-9">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={LINK_BASE}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          <button
            ref={toggleRef}
            type="button"
            className={cx(
              'rounded-base inline-flex h-[40px] w-[40px] items-center justify-center',
              'border-border text-text-primary border lg:hidden',
              'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? fr.public.nav.closeMenu : fr.public.nav.openMenu}
            onClick={() => setOpen((value) => !value)}
          >
            <MenuIcon open={open} />
          </button>
          {memberEntry}
        </div>
      </div>

      {/*
        Le panneau reste dans le flux : il pousse le contenu au lieu de le
        recouvrir. Pas de piege a focus a gerer, pas de defilement bloque.
      */}
      <div
        id={menuId}
        hidden={!open}
        className="border-border bg-surface border-t px-5 py-5 lg:hidden"
      >
        <nav aria-label={fr.public.nav.menuLabel}>
          <ul className="flex flex-col gap-1">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cx(LINK_BASE, 'block min-h-[44px] px-3 py-4')}
                  onClick={close}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
