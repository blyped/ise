import { EmptyState } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { expertiseRoute } from '@/lib/public/entity-routes';
import {
  LANDING_SECTION_KEYS,
  type LandingExpertise,
  type LandingSection,
} from '@/lib/public/landing-data';
import { ProtectedLink } from '../ProtectedLink';
import { LANDING_ANCHORS } from '../public-nav';
import { SectionShell } from './SectionShell';

const PILL =
  'flex min-h-[44px] items-center justify-center rounded-full border border-border ' +
  'bg-surface px-6 text-body-sm text-text-secondary transition-colors duration-150 ' +
  'hover:border-primary hover:text-text-primary ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * « Explorer les expertises » (ADDENDUM §24).
 *
 * La liste vient de `get_landing_expertises()`, c'est-a-dire de la taxonomie
 * reelle des domaines (`expertise_areas`, 14 entrees). Le clic suit la regle
 * commune : direct pour un membre, `/connexion?redirectTo=...` sinon.
 *
 * ECART ASSUME (ADDENDUM §10). `expertise_areas` et `skills` sont deux
 * taxonomies distinctes, et ISE-035 ne filtre que sur la seconde : router une
 * pastille sur `?competence=<id de domaine>` produirait un filtre vide et
 * silencieux. La pastille route donc sur la recherche plein texte, avec le nom
 * du domaine — un critere que l'ecran lit reellement.
 *
 * `profile_count` vaut zero pour les quatorze domaines tant que l'annuaire
 * n'est pas importe : le compte n'est affiche que s'il est non nul (§23).
 *
 * Responsive : la maquette Desktop 1440 aligne les pastilles sur une ligne
 * qui se replie ; la maquette Mobile 375 les empile en pleine largeur. Ce
 * n'est pas la meme mise en page reduite, c'est une bascule.
 */
export function ExpertisesSection({
  section,
  title,
}: {
  section: LandingSection<LandingExpertise>;
  title?: string | undefined;
}) {
  const unavailable = section.status === 'indisponible';

  return (
    <SectionShell id={LANDING_ANCHORS.expertises} title={title ?? fr.public.expertises.title}>
      {section.items.length === 0 ? (
        <EmptyState
          title={
            unavailable ? frPublic.degraded.sectionUnavailable : fr.public.expertises.emptyTitle
          }
          description={
            unavailable ? frPublic.degraded.sectionUnavailableBody : fr.public.expertises.emptyBody
          }
        />
      ) : (
        <ul className="flex flex-wrap gap-5 max-md:flex-col max-md:gap-4">
          {section.items.map((expertise, index) => {
            const route = expertiseRoute(expertise.name);
            return (
              <li key={expertise.id} className="max-md:w-full">
                {route === null ? (
                  <span className={PILL}>{expertise.name}</span>
                ) : (
                  <ProtectedLink
                    target={route}
                    resourceType="expertise"
                    className={PILL}
                    event="public_content_click"
                    entityType="expertise_area"
                    entityId={expertise.id}
                    sectionKey={LANDING_SECTION_KEYS.expertises}
                    contentType="expertise_area"
                    position={index + 1}
                  >
                    {expertise.name}
                  </ProtectedLink>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}
