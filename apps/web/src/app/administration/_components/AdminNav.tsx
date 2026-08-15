'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Menu, X } from 'lucide-react';
import { frAdmin } from '@/i18n/admin';
import { totalPendingCount, type AdminNavCounters } from '@/lib/admin/nav-counters';
import { isCurrentNavItem, type AdminNavItem } from './nav';

export interface AdminNavProps {
  currentPath: string;
  screenTitle: string;
  items: readonly AdminNavItem[];
  /**
   * Compteurs des files en attente (0138), lus cote serveur par
   * `AdminShell`. Toujours DEFINI — objet vide quand il n'y a rien a
   * traiter ou quand la lecture a echoue. Prop obligatoire justement
   * pour ne pas rejouer le piege des props optionnelles de ce fichier.
   */
  counters: AdminNavCounters;
  /**
   * Lien croisé vers le CMS (§30, D-171), affiché uniquement quand le
   * compte courant a effectivement `cms.read` — sinon ce serait un bouton
   * decoratif menant systematiquement a SYS-006 (MASTER PROMPT §113).
   * `undefined` masque l'entree.
   */
  cmsLink?: { href: string; label: string };
  /**
   * Retour vers l'espace membre (§30, D-171), meme patron que `cmsLink` : le
   * back-office etait un cul-de-sac, on n'en sortait qu'en retapant l'URL.
   * Tout compte qui atteint l'administration a une session membre, donc
   * l'entree n'est pas conditionnee par une permission — `undefined` la
   * masque tout de meme, pour rester alignee sur `cmsLink`.
   */
  memberLink?: { href: string; label: string };
}

const LINK_BASE =
  'flex min-h-[44px] items-center rounded-base px-4 text-body-sm transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const BADGE_BASE =
  'bg-primary text-primary-foreground text-caption inline-flex h-[22px] min-w-[22px] shrink-0 ' +
  'items-center justify-center rounded-full px-2 font-semibold tabular-nums';

/** Conteneur du total sur la barre mobile. */
const MOBILE_BADGE_WRAP = 'ml-auto flex items-center';

/** Au-dela, le chiffre exact n'aide plus et deforme le rail. */
function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/**
 * Navigation du back-office Superadmin — meme gabarit que `CmsNav`,
 * DISTINCTE de la sidebar membre (MASTER PROMPT §89) : aucun module
 * membre n'y figure, aucun module admin ne figure dans la sidebar membre.
 *
 * Client uniquement pour le repli mobile. `aria-current="page"` sur la
 * destination courante : la couleur ne porte jamais seule l'information
 * (D-90). Chaque cible fait au moins 44 px.
 *
 * PASTILLES (0138) : une entree ne porte un chiffre que si sa file
 * contient quelque chose — jamais de « 0 » affiche. Le chiffre est
 * double d'un texte lu par les lecteurs d'ecran (« Actualites, 3 en
 * attente ») : ni la couleur, ni le nombre nu ne portent seuls
 * l'information (D-90).
 */
export function AdminNav({
  currentPath,
  screenTitle,
  items,
  counters,
  cmsLink,
  memberLink,
}: AdminNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const totalPending = totalPendingCount(counters);

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
        const counterKey = item.counter;
        const pending = counterKey === undefined ? 0 : (counters[counterKey] ?? 0);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={`${LINK_BASE} justify-between gap-3 ${
                isCurrent
                  ? 'text-primary bg-[#EFF6FF] font-semibold'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
              }`}
            >
              <span className="min-w-0 truncate">{item.label}</span>
              {pending > 0 ? (
                <>
                  <span className="sr-only">{frAdmin.nav.pendingCount(pending)}</span>
                  <span aria-hidden="true" className={BADGE_BASE}>
                    {badgeText(pending)}
                  </span>
                </>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div className="border-border bg-surface flex h-[56px] items-center gap-3 border-b px-4 lg:hidden">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="focus-visible:outline-active-blue text-text-primary rounded-base inline-flex h-[44px] w-[44px] items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="sr-only">{open ? frAdmin.brand.closeMenu : frAdmin.brand.openMenu}</span>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <p className="text-body-sm text-text-primary min-w-0 truncate font-semibold">
          {frAdmin.brand.breadcrumb} · {screenTitle}
        </p>
        {/* Menu replie : sans ce total, les pastilles seraient invisibles
            sur mobile tant qu'on n'ouvre pas le panneau. */}
        {totalPending > 0 && !open ? (
          <span className={MOBILE_BADGE_WRAP}>
            <span className="sr-only">{frAdmin.nav.pendingTotal(totalPending)}</span>
            <span aria-hidden="true" className={BADGE_BASE}>
              {badgeText(totalPending)}
            </span>
          </span>
        ) : null}
      </div>

      <div
        id={panelId}
        className={`border-border bg-surface shrink-0 border-b lg:h-dvh lg:w-[248px] lg:overflow-y-auto lg:border-b-0 lg:border-r ${
          open ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex flex-col gap-0 px-6 py-5 max-lg:hidden">
          <p className="text-body text-text-primary font-bold tracking-wide">
            {frAdmin.brand.title.toUpperCase()}
          </p>
          <p className="text-body text-primary font-bold">{frAdmin.brand.subtitle}</p>
        </div>
        <nav aria-label={frAdmin.brand.nav} className="pt-2 lg:pt-0">
          {list}
        </nav>

        {cmsLink || memberLink ? (
          <div className="border-border mx-3 mb-4 flex flex-col gap-1 border-t pt-3">
            {cmsLink ? (
              <Link
                href={cmsLink.href}
                className={`${LINK_BASE} text-text-secondary hover:bg-surface-muted hover:text-text-primary gap-2`}
              >
                <ArrowLeftRight size={16} aria-hidden="true" />
                {cmsLink.label}
              </Link>
            ) : null}
            {memberLink ? (
              <Link
                href={memberLink.href}
                className={`${LINK_BASE} text-text-secondary hover:bg-surface-muted hover:text-text-primary gap-2`}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {memberLink.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
