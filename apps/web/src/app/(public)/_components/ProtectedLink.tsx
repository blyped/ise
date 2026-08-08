'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { protectedHref, type ResourceType } from '@/lib/public/protected-route';
import type { PublicLandingEvent } from '@/lib/public/landing-events';
import { usePublicViewer } from './PublicViewerProvider';
import { useLandingTracker } from './analytics/LandingTracker';

export interface ProtectedLinkProps {
  /** Route interne de la ressource visee, deja calculee par `entityRoute`. */
  target: string;
  /** Nature de la ressource, annoncee par ISE-001 au visiteur. */
  resourceType?: ResourceType | undefined;
  className?: string;
  /** Libelle accessible si le contenu visible ne suffit pas. */
  label?: string | undefined;
  /** ADDENDUM §50 — evenement emis au clic, s'il y a lieu. */
  event?: PublicLandingEvent | undefined;
  entityType?: string | null | undefined;
  entityId?: string | null | undefined;
  sectionKey?: string | undefined;
  contentType?: string | undefined;
  placement?: string | undefined;
  position?: number | undefined;
  children: ReactNode;
}

/**
 * ADDENDUM §4 — Application uniforme de la primitive de routage protege.
 *
 * Le lien est un vrai `<a href>` : la cible est calculee au rendu serveur,
 * pas au clic. Un visiteur sans JavaScript, un clic-milieu ou un « ouvrir
 * dans un nouvel onglet » suivent donc exactement le meme chemin, ce qu'un
 * `onClick` + `router.push` ne permettrait pas.
 *
 * ADDENDUM §50 — c'est aussi le seul endroit ou `public_to_login` est emis :
 * le fait « un visiteur anonyme a ete envoye vers ISE-001 » est justement ce
 * que cette primitive decide. Le mesurer ailleurs serait le deduire.
 */
export function ProtectedLink({
  target,
  resourceType,
  className,
  label,
  event,
  entityType,
  entityId,
  sectionKey,
  contentType,
  placement,
  position,
  children,
}: ProtectedLinkProps) {
  const viewer = usePublicViewer();
  const track = useLandingTracker();
  const href = protectedHref(target, {
    authenticated: viewer.authenticated,
    resourceType,
  });

  const onClick = () => {
    const context = {
      immediate: true as const,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      ...(sectionKey === undefined ? {} : { section_key: sectionKey }),
      ...(contentType === undefined ? {} : { content_type: contentType }),
      ...(placement === undefined ? {} : { placement }),
      ...(position === undefined ? {} : { position }),
    };
    if (event !== undefined) track(event, context);
    if (!viewer.authenticated) track('public_to_login', context);
  };

  return (
    <Link
      href={href}
      className={className}
      data-protected-target={target}
      onClick={onClick}
      {...(label ? { 'aria-label': label } : {})}
    >
      {children}
    </Link>
  );
}
