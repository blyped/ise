'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

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
  unreadNotifications: undefined,
};

const PublicViewerContext = createContext<PublicViewerState>(ANONYMOUS);

export function PublicViewerProvider({
  authenticated,
  displayName,
  avatarUrl,
  unreadNotifications,
  children,
}: {
  authenticated: boolean;
  displayName: string | null;
  avatarUrl: string | undefined;
  unreadNotifications: number | undefined;
  children: ReactNode;
}) {
  const value = useMemo<PublicViewerState>(
    () => ({ authenticated, displayName, avatarUrl, unreadNotifications }),
    [authenticated, displayName, avatarUrl, unreadNotifications],
  );
  return <PublicViewerContext.Provider value={value}>{children}</PublicViewerContext.Provider>;
}

export function usePublicViewer(): PublicViewerState {
  return useContext(PublicViewerContext);
}
