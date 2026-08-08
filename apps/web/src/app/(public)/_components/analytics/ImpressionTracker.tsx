'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useLandingTracker } from './LandingTracker';
import type { PublicLandingEvent } from '@/lib/public/landing-events';

/**
 * ADDENDUM §50 — comptage d'une impression **effective**.
 *
 * Le HTML d'une campagne partenaire est produit pour tout le monde, y compris
 * pour un visiteur qui ne descendra jamais jusqu'a elle. Compter au rendu
 * gonflerait mecaniquement les impressions facturables : ce serait une
 * metrique fausse (§51). L'evenement n'est donc emis que lorsque le bloc est
 * reellement entre dans la fenetre, a moitie au moins, et y est reste une
 * seconde. Il n'est emis qu'une fois par montage.
 *
 * Sans `IntersectionObserver` (navigateur ancien, JavaScript coupe), aucune
 * impression n'est comptee. C'est le bon defaut : mieux vaut sous-compter que
 * facturer une impression qui n'a pas eu lieu.
 */

const VISIBLE_RATIO = 0.5;
const DWELL_MS = 1000;

export function ImpressionTracker({
  eventType,
  entityType,
  entityId,
  placement,
  sectionKey,
  position,
  className,
  children,
}: {
  eventType: PublicLandingEvent;
  entityType?: string | null;
  entityId?: string | null;
  placement?: string | undefined;
  sectionKey?: string | undefined;
  position?: number | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const track = useLandingTracker();
  const host = useRef<HTMLDivElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const node = host.current;
    if (node === null) return undefined;
    if (typeof IntersectionObserver !== 'function') return undefined;

    let dwell: ReturnType<typeof setTimeout> | null = null;

    const cancel = () => {
      if (dwell !== null) {
        clearTimeout(dwell);
        dwell = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (counted.current) return;
          if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
            if (dwell !== null) continue;
            dwell = setTimeout(() => {
              if (counted.current) return;
              counted.current = true;
              track(eventType, {
                entityType: entityType ?? null,
                entityId: entityId ?? null,
                ...(placement === undefined ? {} : { placement }),
                ...(sectionKey === undefined ? {} : { section_key: sectionKey }),
                ...(position === undefined ? {} : { position }),
              });
              observer.disconnect();
            }, DWELL_MS);
          } else {
            cancel();
          }
        }
      },
      { threshold: [VISIBLE_RATIO] },
    );

    observer.observe(node);
    return () => {
      cancel();
      observer.disconnect();
    };
  }, [track, eventType, entityType, entityId, placement, sectionKey, position]);

  return (
    <div ref={host} className={className}>
      {children}
    </div>
  );
}
