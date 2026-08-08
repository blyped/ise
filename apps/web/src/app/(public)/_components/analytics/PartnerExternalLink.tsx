'use client';

import { LANDING_SECTION_KEYS, type LandingPartnerCampaign } from '@/lib/public/landing-data';
import { useLandingTracker } from './LandingTracker';
import { frPublic } from '@/i18n/public';

const CTA =
  'inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-base bg-primary px-7 ' +
  'text-body-sm font-semibold text-primary-foreground transition-colors duration-150 ' +
  'hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-active-blue max-md:w-full';

/**
 * ADDENDUM §25, §26, §50 — sortie vers le site d'un partenaire.
 *
 * Ce n'est pas une ressource membre : la primitive de routage protege ne
 * s'applique pas, et `redirectTo` n'aurait aucun sens. En revanche :
 *  - l'URL a deja ete validee en `https:` par le parseur ;
 *  - `rel="noopener noreferrer sponsored"` : pas d'acces a `window.opener`,
 *    pas de referent transmis, et la nature commerciale du lien est declaree
 *    aux moteurs comme elle l'est au visiteur ;
 *  - l'ouverture dans un nouvel onglet est annoncee, jamais silencieuse.
 */
export function PartnerExternalLink({
  href,
  label,
  campaign,
  position,
}: {
  href: string;
  label: string;
  campaign: LandingPartnerCampaign;
  position: number;
}) {
  const track = useLandingTracker();

  return (
    <a
      href={href}
      className={CTA}
      target="_blank"
      rel="noopener noreferrer sponsored"
      title={frPublic.partners.externalHint}
      onClick={() =>
        track('public_partner_click', {
          immediate: true,
          entityType: 'organization',
          entityId: campaign.organizationId,
          section_key: LANDING_SECTION_KEYS.partners,
          ...(campaign.placement === null ? {} : { placement: campaign.placement }),
          position,
        })
      }
    >
      {label}
      <span className="sr-only"> ({frPublic.partners.externalHint})</span>
    </a>
  );
}
