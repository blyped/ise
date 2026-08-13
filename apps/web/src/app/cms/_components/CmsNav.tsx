'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftRight, Menu, X } from 'lucide-react';
import { frCms } from '@/i18n/cms';
import { isCurrentNavItem, type CmsNavItem } from './nav';

export interface CmsNavProps {
  currentPath: string;
  screenTitle: string;
  items: readonly CmsNavItem[];
  /**
   * Lien croisé vers l'administration (§30, D-171), affiché uniquement
   * quand le compte courant a au moins une permission d'administration —
   * sinon ce serait un bouton decoratif menant systematiquement a SYS-006
   * (MASTER PROMPT §113). `undefined` masque l'entree.
   */
  adminLink?: { href: string; label: string };
}

const LINK_BASE =
  'flex min-h-[44px] items-center rounded-base px-4 text-body-sm transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Navigation du CMS. Client uniquement pour le repli mobile : sur Desktop
 * elle est un simple `<nav>` rendu en dur, sans etat.
 *
 * ACCESSIBILITE
 *   * le bouton porte `aria-expanded` et `aria-controls` ;
 *   * `Echap` referme le panneau et rend le focus au bouton ;
 *   * la destination courante porte `aria-current="page"` — la couleur ne
 *     porte jamais seule l'information (D-90) ;
 *   * chaque cible fait au moins 44 px de haut.
 */
export function CmsNav({ currentPath, screenTitle, items, adminLink }: CmsNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Un changement de route referme le panneau : sinon il masque l'ecran
  // que l'on vient d'ouvrir.
  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const list = (
    <ul className="flex flex-col gap-1 px-3 pb-6">
      {items.map((item) => {
        const isCurrent = isCurrentNavItem(currentPath, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={`${LINK_BASE} ${
                isCurrent
                  ? 'text-primary bg-[#EFF6FF] font-semibold'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Barre superieure mobile : menu + fil d'Ariane. */}
      <div className="border-border bg-surface flex h-[56px] items-center gap-3 border-b px-4 lg:hidden">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="focus-visible:outline-active-blue text-text-primary rounded-base inline-flex h-[44px] w-[44px] items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="sr-only">{open ? frCms.brand.closeMenu : frCms.brand.openMenu}</span>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <p className="text-body-sm text-text-primary min-w-0 truncate font-semibold">
          CMS · {screenTitle}
        </p>
      </div>

      <div
        id={panelId}
        className={`border-border bg-surface shrink-0 border-b lg:h-dvh lg:w-[248px] lg:overflow-y-auto lg:border-b-0 lg:border-r ${
          open ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex flex-col gap-0 px-6 py-5 max-lg:hidden">
          <p className="text-body text-text-primary font-bold tracking-wide">
            {frCms.brand.title.toUpperCase()}
          </p>
          <p className="text-body text-primary font-bold">{frCms.brand.subtitle}</p>
        </div>
        <nav aria-label={frCms.brand.nav} className="pt-2 lg:pt-0">
          {list}
        </nav>

        {adminLink ? (
          <div className="border-border mx-3 mb-4 border-t pt-3">
            <Link
              href={adminLink.href}
              className={`${LINK_BASE} text-text-secondary hover:bg-surface-muted hover:text-text-primary gap-2`}
            >
              <ArrowLeftRight size={16} aria-hidden="true" />
              {adminLink.label}
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
