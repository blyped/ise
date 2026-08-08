'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PublicLandingEvent } from '@/lib/public/landing-events';
import { useLandingTracker } from './LandingTracker';

/**
 * Lien **non protege** porteur d'un evenement (ADDENDUM §50).
 *
 * Sert aux appels a l'action qui ne visent pas une ressource membre :
 * « Connexion » (`public_login_click`) au premier chef. Un lien vers une
 * ressource protegee passe, lui, par `ProtectedLink`, qui emet en plus
 * `public_to_login` pour un visiteur anonyme.
 */
export function TrackedLink({
  href,
  event,
  sectionKey,
  className,
  children,
}: {
  href: string;
  event: PublicLandingEvent;
  sectionKey?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const track = useLandingTracker();

  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        track(event, {
          immediate: true,
          ...(sectionKey === undefined ? {} : { section_key: sectionKey }),
        })
      }
    >
      {children}
    </Link>
  );
}
