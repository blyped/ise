import { EmptyState } from '@ise/ui-web';
import { fr, t } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { entityResourceType, entityRoute } from '@/lib/public/entity-routes';
import {
  LANDING_SECTION_KEYS,
  type LandingPartnerCampaign,
  type LandingSection,
} from '@/lib/public/landing-data';
import { LandingMediaImage } from '../LandingMediaImage';
import { ProtectedLink } from '../ProtectedLink';
import { ImpressionTracker } from '../analytics/ImpressionTracker';
import { PartnerExternalLink } from '../analytics/PartnerExternalLink';
import { LANDING_ANCHORS } from '../public-nav';
import { SectionShell } from './SectionShell';

/**
 * « Entreprises & partenaires » (ADDENDUM §25, §26, §50).
 *
 * Trois obligations tenues ici :
 *
 *  - **§26, transparence.** La mention (« Partenaire », « Sponsorise » ou
 *    « Contenu partenaire ») est rendue en texte, au-dessus du titre, associee
 *    au nom du partenaire. Elle n'est ni optionnelle, ni portee par une
 *    couleur (D-90). Le parseur garantit qu'elle n'est jamais vide : une
 *    campagne sans mention reconnue recoit la mention par defaut ;
 *
 *  - **periode de diffusion.** `get_landing_partners()` filtre deja sur
 *    `start_at <= now() < end_at`. Une campagne expiree ne remonte donc pas,
 *    et l'interface n'a rien a re-filtrer — mais elle n'a rien a rattraper non
 *    plus : la liste recue est la liste diffusable ;
 *
 *  - **§50, impressions honnetes.** L'impression est comptee par
 *    `ImpressionTracker`, c'est-a-dire quand le bloc entre reellement dans la
 *    fenetre, pas quand le HTML est produit.
 *
 * Responsive : la maquette Desktop pose le bouton a droite du bloc ; la
 * maquette Mobile le remplace par un lien sous le texte.
 */

const CTA =
  'inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-base bg-primary px-7 ' +
  'text-body-sm font-semibold text-primary-foreground transition-colors duration-150 ' +
  'hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-active-blue max-md:w-full';

export function PartnersSection({
  section,
  title,
}: {
  section: LandingSection<LandingPartnerCampaign>;
  title?: string | undefined;
}) {
  const unavailable = section.status === 'indisponible';

  if (section.items.length === 0) {
    return (
      <SectionShell id={LANDING_ANCHORS.partners}>
        <EmptyState
          title={unavailable ? frPublic.degraded.sectionUnavailable : fr.public.partners.emptyTitle}
          description={
            unavailable ? frPublic.degraded.sectionUnavailableBody : fr.public.partners.emptyBody
          }
        />
      </SectionShell>
    );
  }

  return (
    <SectionShell id={LANDING_ANCHORS.partners} title={title ?? frPublic.partners.title}>
      <ul className="flex flex-col gap-6">
        {section.items.map((campaign, index) => {
          const route = campaign.target === null ? null : entityRoute(campaign.target);
          const resourceType =
            campaign.target === null ? undefined : entityResourceType(campaign.target.entityType);

          return (
            <li key={campaign.id}>
              <ImpressionTracker
                eventType="public_partner_impression"
                entityType="organization"
                entityId={campaign.organizationId}
                placement={campaign.placement ?? undefined}
                sectionKey={LANDING_SECTION_KEYS.partners}
                position={index + 1}
              >
                <div className="border-border bg-surface flex items-center justify-between gap-8 rounded-lg border p-8 max-lg:flex-col max-lg:items-start max-lg:gap-5 max-md:p-5">
                  <div className="flex flex-col gap-3">
                    {/*
                      Logo du partenaire. Il vient de `organizations.logo_path`
                      resolu dans la mediatheque (0068) : un logo qui n'y est
                      pas enregistre avec son alternative textuelle ne parait
                      pas, et la carte reste entiere. La boite a une taille
                      FIXE et le logo est en `object-contain` : ni deformation,
                      ni decalage au chargement (§58).
                    */}
                    {campaign.logo === null ? null : (
                      <div className="relative h-[40px] w-[160px]">
                        <LandingMediaImage
                          media={campaign.logo}
                          sizes="160px"
                          className="object-contain object-left"
                        />
                      </div>
                    )}
                    {/* ADDENDUM §26 — mention obligatoire, en texte, toujours visible. */}
                    <p className="text-caption font-semibold text-[#8A6111]">
                      {t(frPublic.partners.transparency, {
                        label: campaign.sponsoredLabel,
                        partner: campaign.partnerName,
                      })}
                    </p>
                    <h3 className="text-h3 text-text-primary max-md:text-h4 font-bold">
                      {campaign.title}
                    </h3>
                    {campaign.body ? (
                      <p className="text-body-sm text-text-secondary max-w-[70ch]">
                        {campaign.body}
                      </p>
                    ) : null}
                  </div>

                  {campaign.ctaLabel === null ? null : route !== null ? (
                    <ProtectedLink
                      target={route}
                      resourceType={resourceType}
                      className={CTA}
                      event="public_partner_click"
                      entityType="organization"
                      entityId={campaign.organizationId}
                      sectionKey={LANDING_SECTION_KEYS.partners}
                      placement={campaign.placement ?? undefined}
                      position={index + 1}
                    >
                      {campaign.ctaLabel}
                    </ProtectedLink>
                  ) : campaign.externalUrl !== null ? (
                    /*
                     * Cible externe. Elle n'est jamais protegee (c'est le site
                     * du partenaire, pas une ressource membre) et n'est
                     * acceptee qu'en `https:` par le parseur. `rel="sponsored"`
                     * porte la meme information que la mention visible, pour
                     * les moteurs.
                     */
                    <PartnerExternalLink
                      href={campaign.externalUrl}
                      label={campaign.ctaLabel}
                      campaign={campaign}
                      position={index + 1}
                    />
                  ) : null}
                </div>
              </ImpressionTracker>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
