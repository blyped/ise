import type { ReactNode } from 'react';
import { fr } from '@/i18n/fr';
import type { PublicViewer } from '@/lib/public/protected-route.server';
import { PublicViewerProvider } from './PublicViewerProvider';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { LandingTrackerProvider, LandingViewTracker } from './analytics/LandingTracker';

/**
 * Gabarit du site public (ADDENDUM §7).
 *
 * L'etat de session est lu **une seule fois**, cote serveur, et diffuse par
 * contexte : ni l'en-tete ni les cartes ne relisent la session. Le collecteur
 * d'evenements (§50) enveloppe l'ensemble pour la meme raison : un seul
 * identifiant de correlation, une seule file d'envoi.
 */
export function PublicShell({ viewer, children }: { viewer: PublicViewer; children: ReactNode }) {
  return (
    <PublicViewerProvider
      authenticated={viewer.authenticated}
      displayName={viewer.displayName}
      avatarUrl={viewer.avatarUrl}
      avatarCrop={viewer.avatarCrop}
      unreadNotifications={viewer.unreadNotifications}
    >
      <LandingTrackerProvider>
        <div className="bg-background flex min-h-dvh flex-col">
          <a className="skip-link" href="#contenu-principal">
            {fr.public.skipToContent}
          </a>
          <PublicHeader />
          <main id="contenu-principal" className="flex-1">
            {children}
          </main>
          <PublicFooter />
        </div>
        <LandingViewTracker />
      </LandingTrackerProvider>
    </PublicViewerProvider>
  );
}
