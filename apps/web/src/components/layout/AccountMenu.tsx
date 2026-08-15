'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Avatar, cx, type AvatarSize } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { SignOutButton } from './SignOutButton';

export interface AccountMenuProps {
  /** Nom affiche : sert de source aux initiales de repli de l'avatar. */
  displayName: string;
  /** URL signee de la photo de profil. `undefined` : repli sur les initiales, jamais d'erreur. */
  avatarUrl?: string | undefined;
  avatarSize?: AvatarSize;
  /** Ligne secondaire (promotion) affichee sous le libelle, si fournie. */
  contextLine?: string | undefined;
  /** Libelle affiche a cote de l'avatar dans le declencheur. */
  label: string;
  /** Libelle de la premiere entree du menu (ex. « Mon profil », « Mon espace »). */
  profileLabel: string;
  /** Cible de la premiere entree du menu. */
  profileHref: string;
  /** `true` : le libelle du declencheur se masque sous 640px (Topbar membre). */
  hideLabelOnMobile?: boolean;
  className?: string;
  triggerClassName?: string;
}

/**
 * Menu de compte accessible : avatar + libelle, ouvre un panneau avec un
 * lien de profil et la deconnexion.
 *
 * Aucune nouvelle dependance : etat React local, meme convention de
 * fermeture (Echap + clic exterieur, focus rendu au declencheur) que le
 * panneau mobile de `PublicHeader`. Aucun pattern de menu deroulant
 * n'existait ailleurs dans le repo (administration/CMS n'en ont pas) : ce
 * composant sert desormais de reference pour l'encart profil, partage entre
 * `Topbar` (espace membre) et `PublicHeader` (site public).
 *
 * La deconnexion reutilise `SignOutButton` tel quel : aucune action n'est
 * reimplementee ici.
 */
export function AccountMenu({
  displayName,
  avatarUrl,
  avatarSize = 32,
  contextLine,
  label,
  profileLabel,
  profileHref,
  hideLabelOnMobile = false,
  className,
  triggerClassName,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRefocus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, close, closeAndRefocus]);

  return (
    <div ref={containerRef} className={cx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'focus-visible:outline-active-blue rounded-base focus-visible:outline-2 focus-visible:outline-offset-2',
          triggerClassName,
        )}
      >
        <Avatar name={displayName} src={avatarUrl} size={avatarSize} decorative />
        <span
          className={cx(
            'flex flex-col text-left leading-tight',
            hideLabelOnMobile ? 'max-sm:hidden' : undefined,
          )}
        >
          <span className="text-body-sm text-text-primary font-semibold">{label}</span>
          {contextLine ? <span className="text-caption text-text-muted">{contextLine}</span> : null}
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={fr.nav.accountMenuLabel}
          className={cx(
            'border-border bg-surface absolute right-0 top-[calc(100%+8px)] z-40',
            'flex w-56 flex-col gap-1 rounded-xl border p-2 shadow-lg',
          )}
        >
          <Link
            href={profileHref}
            role="menuitem"
            onClick={close}
            className={cx(
              'text-body-sm text-text-primary hover:bg-surface-muted rounded-base block px-3 py-2',
              'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            {profileLabel}
          </Link>
          <div className="px-1">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
