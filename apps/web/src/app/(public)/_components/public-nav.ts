import { ROUTES } from '@/lib/routes';
import { fr } from '@/i18n/fr';

/**
 * ADDENDUM §7 — Entrees de l'en-tete public, dans l'ordre de la maquette.
 *
 * Arbitrage assume : `A la une`, `Le reseau`, `Expertises` et `Partenaires`
 * pointent vers des **sections de PUB-001**, pas vers des ecrans publics
 * dedies. L'ADDENDUM ne definit qu'un seul ecran public (PUB-001) ; les
 * ecrans membres correspondants (ISE-092 a ISE-096) ne sont pas developpes.
 * Fabriquer `/actualites` produirait une page 404 apres connexion. Chaque
 * ancre correspond a une section reellement rendue, y compris lorsqu'elle
 * est vide.
 *
 * Menu resserre (2026-08-12, demande du porteur) : `A la une` remplace les
 * trois anciennes entrees `Actualites` / `Evenements` / `Opportunites` — elle
 * pointe sur `LANDING_ANCHORS.highlights`, l'ancre de toute la section « A la
 * une du reseau », pas sur une carte en particulier. Les ancres individuelles
 * (`news`, `featuredProfile`, `events`, `opportunites`) restent posees sur
 * chaque carte pour d'eventuels liens directs, mais ne sont plus des entrees
 * de menu a elles seules. `Expertises` est une entree nouvelle, absente du
 * menu jusqu'ici bien que la section soit deja rendue (`ExpertisesSection`).
 * `Accueil` recoit un comportement special cote `PublicHeader` : un clic doit
 * ramener en haut de page meme quand on y est deja (un `<Link href="/">` seul
 * ne fait rien dans ce cas, l'URL ne changeant pas).
 */

/** Identifiants d'ancre, partages par l'en-tete et par les sections. */
export const LANDING_ANCHORS = {
  carousel: 'a-la-une-carrousel',
  highlights: 'a-la-une',
  news: 'actualites',
  featuredProfile: 'ise-du-jour',
  events: 'evenements',
  opportunities: 'opportunites',
  network: 'le-reseau',
  stats: 'chiffres',
  expertises: 'expertises',
  partners: 'partenaires',
} as const;

export interface PublicNavItem {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

export const PUBLIC_NAV_ITEMS: readonly PublicNavItem[] = [
  { key: 'home', label: fr.public.nav.home, href: ROUTES.home },
  { key: 'highlights', label: fr.public.nav.highlights, href: `/#${LANDING_ANCHORS.highlights}` },
  { key: 'network', label: fr.public.nav.network, href: `/#${LANDING_ANCHORS.network}` },
  { key: 'expertises', label: fr.public.nav.expertises, href: `/#${LANDING_ANCHORS.expertises}` },
  { key: 'partners', label: fr.public.nav.partners, href: `/#${LANDING_ANCHORS.partners}` },
];
