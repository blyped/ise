'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { newCorrelationId } from '@/lib/correlation';
import { recordPublicLandingEvents } from '@/lib/public/landing-analytics';
import type {
  PublicLandingEvent,
  PublicLandingEventInput,
  PublicLandingMetadata,
} from '@/lib/public/landing-events';

/**
 * ADDENDUM §50 et §51 — Collecte des evenements de PUB-001.
 *
 * Trois choix, et leur raison :
 *
 *  - **une Server Action, pas un appel navigateur.** La fonction en base
 *    rattache l'evenement a `private.current_profile_id()`. Seul le client
 *    serveur porte les cookies de session : un appel direct depuis le
 *    navigateur ferait passer tous les membres connectes pour des anonymes ;
 *
 *  - **un envoi groupe et differe.** Next.js renvoie l'arbre RSC de la page a
 *    chaque Server Action. Emettre une requete par impression rendrait la
 *    landing sept fois. Les evenements non urgents sont donc accumules et
 *    envoyes en une fois ; un clic, lui, part immediatement, avant que la
 *    navigation ne commence ;
 *
 *  - **rien n'est invente (§51).** Le suivi n'emet que les sept types acceptes
 *    par `record_public_landing_event`, et seulement sur un fait observe :
 *    une page affichee, un bloc reellement visible, un clic reel.
 */

const FLUSH_DELAY_MS = 800;

export interface TrackOptions extends PublicLandingMetadata {
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  /** Vrai pour un clic : la navigation ne doit pas emporter l'evenement. */
  readonly immediate?: boolean;
}

export type TrackFunction = (eventType: PublicLandingEvent, options?: TrackOptions) => void;

const LandingTrackerContext = createContext<TrackFunction>(() => undefined);

/** Largeur de bascule du systeme de mise en page (D-96). */
function currentDevice(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  return window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
}

export function LandingTrackerProvider({ children }: { children: ReactNode }) {
  const correlationId = useRef<string | null>(null);
  const queue = useRef<PublicLandingEventInput[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (correlationId.current === null) correlationId.current = newCorrelationId();

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const batch = queue.current;
    if (batch.length === 0) return;
    queue.current = [];
    // Une metrique perdue ne casse pas une page : l'echec est absorbe.
    void recordPublicLandingEvents(batch).catch(() => undefined);
  }, []);

  const track = useCallback<TrackFunction>(
    (eventType, options) => {
      const { entityType, entityId, immediate, ...metadata } = options ?? {};
      queue.current.push({
        eventType,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        correlationId: correlationId.current,
        metadata: { device: currentDevice(), ...metadata },
      });

      if (immediate === true) {
        flush();
        return;
      }
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, FLUSH_DELAY_MS);
    },
    [flush],
  );

  // Une page quittee ne doit pas emporter les evenements en attente.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  return <LandingTrackerContext.Provider value={track}>{children}</LandingTrackerContext.Provider>;
}

export function useLandingTracker(): TrackFunction {
  return useContext(LandingTrackerContext);
}

/**
 * ADDENDUM §50 — `public_landing_view`.
 *
 * Emis une seule fois par montage, apres hydratation : c'est un affichage
 * reellement rendu au visiteur, pas une requete HTTP.
 */
export function LandingViewTracker() {
  const track = useLandingTracker();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    track('public_landing_view');
  }, [track]);

  return null;
}
