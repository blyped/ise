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
}

const ANONYMOUS: PublicViewerState = { authenticated: false, displayName: null };

const PublicViewerContext = createContext<PublicViewerState>(ANONYMOUS);

export function PublicViewerProvider({
  authenticated,
  displayName,
  children,
}: {
  authenticated: boolean;
  displayName: string | null;
  children: ReactNode;
}) {
  const value = useMemo<PublicViewerState>(
    () => ({ authenticated, displayName }),
    [authenticated, displayName],
  );
  return <PublicViewerContext.Provider value={value}>{children}</PublicViewerContext.Provider>;
}

export function usePublicViewer(): PublicViewerState {
  return useContext(PublicViewerContext);
}
