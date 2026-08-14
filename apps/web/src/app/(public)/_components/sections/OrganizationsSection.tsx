import { frPublic } from '@/i18n/public';
import type { LandingOrganizationLogo, LandingSection } from '@/lib/public/landing-data';
import { LandingMediaImage } from '../LandingMediaImage';
import { LANDING_ANCHORS } from '../public-nav';
import { SectionShell } from './SectionShell';

/**
 * 0133 — « LES ORGANISATIONS OU TRAVAILLENT LES ISE ».
 *
 * Demande du porteur : « uniquement les logos, que l'admin seul mettra ».
 * Les deux moities de la phrase sont tenues ici et dans la migration :
 *
 *  - **uniquement les logos.** Pas de nom affiche, pas de compteur d'ISE, pas
 *    de titre de section visible, pas de lien. Le seul texte du bloc est un
 *    titre pour lecteurs d'ecran et l'alternative textuelle de chaque logo,
 *    saisie dans la mediatheque. Un logo est deja un nom : l'ecrire a cote
 *    serait la redite que le porteur refuse ;
 *
 *  - **l'admin seul.** La liste vient de `cms_landing_organizations`, une
 *    table purement editoriale. Rien n'y entre par calcul sur les profils —
 *    l'argumentaire complet est dans l'en-tete de la migration 0133.
 *
 * BOITE A TAILLE FIXE (D-138). Chaque logo vit dans un conteneur de
 * dimensions connues, avec `object-contain` : les logos n'ont ni le meme
 * rapport ni la meme densite, et une grille qui se recalcule au chargement
 * des images serait un decalage de mise en page garanti. Aucun n'est etire
 * ni rogne.
 *
 * SECTION VIDE = PAS DE SECTION. Sans logo publie et affichable, le composant
 * ne rend rien : ni cadre, ni etat vide. La projection ecarte deja les lignes
 * sans logo utilisable, le parseur les refuse une seconde fois.
 */
export function OrganizationsSection({
  section,
}: {
  section: LandingSection<LandingOrganizationLogo>;
}) {
  if (section.items.length === 0) return null;

  return (
    <SectionShell id={LANDING_ANCHORS.organizations}>
      <h2 className="sr-only">{frPublic.organizations.label}</h2>
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
