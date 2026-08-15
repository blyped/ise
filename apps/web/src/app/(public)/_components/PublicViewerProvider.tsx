'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PhotoCrop } from '@ise/ui-web';

/**
 * ADDENDUM §4 — Etat de session partage par tout le site public.
 *
 * `ProtectedLink` en depend, ce qui evite de passer un drapeau
 * `authenticated` a chaque carte : la primitive de routage protege reste
 * unique et personne n'a a la reimplementer.
 */
export interface PublicViewerState {
  readonly authenticated: boolean;
  readonly displayName: string | null;
  /** URL signee de la photo de profil du membre connecte, ou `undefined`. */
  readonly avatarUrl: string | undefined;
  /** Cadrage (position + zoom) de l'avatar ci-dessus — D-206, 0147. */
  readonly avatarCrop: PhotoCrop | undefined;
  /**
   * D-194 — nombre de notifications non lues du membre connecte, ou
   * `undefined` si non authentifie ou si la lecture a echoue.
   * `PublicHeader` n'affiche alors aucune pastille (§47).
   */
  readonly unreadNotifications: number | undefined;
}

const ANONYMOUS: PublicViewerState = {
  authenticated: false,
  displayName: null,
  avatarUrl: undefined,
  avatarCrop: undefined,
  unreadNotifications: undefined,
};

const PublicViewerContext = createContext<PublicViewerState>(ANONYMOUS);

export function PublicViewerProvider({
  authenticated,
  displayName,
  avatarUrl,
  avatarCrop,
  unreadNotifications,
  children,
}: {
  authenticated: boolean;
  displayName: string | null;
  avatarUrl: string | undefined;
  avatarCrop: PhotoCrop | undefined;
  unreadNotifications: number | undefined;
  children: ReactNode;
}) {
  const value = useMemo<PublicViewerState>(
    () => ({ authenticated, displayName, avatarUrl, avatarCrop, unreadNotifications }),
    [authenticated, displayName, avatarUrl, avatarCrop, unreadNotifications],
  );
  return <PublicViewerContext.Provider value={value}>{children}</PublicViewerContext.Provider>;
}

export function usePublicViewer(): PublicViewerState {
  return useContext(PublicViewerContext);
}
