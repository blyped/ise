import { frPublic } from '@/i18n/public';
import type { LandingOrganizationLogo, LandingSection } from '@/lib/public/landing-data';
import { LandingMediaImage } from '../LandingMediaImage';
import { LANDING_ANCHORS } from '../public-nav';
import { SectionShell } from './SectionShell';

/**
 * 0133, révisé (D-184) — « Ils nous font confiance ».
 *
 * Demande d'origine du porteur (migration 0133, D-138) : « uniquement les
 * logos, que l'admin seul mettra », sans une ligne de texte visible — le
 * titre n'était alors qu'un `<h2>` `sr-only`. Décision produit ultérieure,
 * documentée en D-184 : un titre et un sous-titre COURTS sont désormais
 * affichés au-dessus de la grille, pour qu'un visiteur qui atterrit sur la
 * section sache ce qu'il regarde sans avoir à deviner. Trois points de la
 * demande d'origine restent inchangés :
 *
 *  - **uniquement des logos, à côté du titre.** Toujours pas de nom affiché
 *    à côté d'un logo, pas de compteur d'ISE, pas de lien. Un logo est déjà
 *    un nom : l'écrire une seconde fois resterait la redite que le porteur
 *    refusait ;
 *
 *  - **l'admin seul.** La liste vient toujours de `cms_landing_organizations`,
 *    une table purement éditoriale. Rien n'y entre par calcul sur les
 *    profils — l'argumentaire complet est dans l'en-tête de la migration
 *    0133, et la seed de `organizations` (0142) alimente le référentiel,
 *    jamais la landing directement ;
 *
 *  - **BOÎTE À TAILLE FIXE (D-138).** Chaque logo vit dans un conteneur de
 *    dimensions connues, avec `object-contain` : les logos n'ont ni le même
 *    rapport ni la même densité, et une grille qui se recalcule au
 *    chargement des images serait un décalage de mise en page garanti.
 *
 * SECTION VIDE = PAS DE SECTION, inchangé. Sans logo publié et affichable,
 * le composant ne rend rien : ni cadre, ni titre, ni état vide. La
 * projection écarte déjà les lignes sans logo utilisable, le parseur les
 * refuse une seconde fois.
 */
export function OrganizationsSection({
  section,
}: {
  section: LandingSection<LandingOrganizationLogo>;
}) {
  if (section.items.length === 0) return null;

  return (
    <SectionShell id={LANDING_ANCHORS.organizations} title={frPublic.organizations.title}>
      <p className="text-body text-text-secondary -mt-4 mb-7 max-md:mb-5">
        {frPublic.organizations.subtitle}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-11 gap-y-8 max-md:gap-x-7 max-md:gap-y-6">
        {section.items.map((organization) => (
          <li
            key={organization.organizationId}
            className="relative h-[56px] w-[160px] max-md:h-[44px] max-md:w-[124px]"
          >
            <LandingMediaImage
              media={organization.logo}
              sizes="160px"
              className="object-contain"
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
