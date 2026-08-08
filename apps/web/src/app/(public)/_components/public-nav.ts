import { ROUTES } from '@/lib/routes';
import { fr } from '@/i18n/fr';

/**
 * ADDENDUM §7 — Entrees de l'en-tete public, dans l'ordre de la maquette.
 *
 * Arbitrage assume : `Le reseau`, `Actualites`, `Evenements`, `Opportunites`
 * et `Partenaires` pointent vers des **sections de PUB-001**, pas vers des
 * ecrans publics dedies. L'ADDENDUM ne definit qu'un seul ecran public
 * (PUB-001) ; les ecrans membres correspondants (ISE-092 a ISE-096) ne sont
 * pas developpes. Fabriquer `/actualites` produirait une page 404 apres
 * connexion. Chaque ancre correspond a une section reellement rendue, y
 * compris lorsqu'elle est vide.
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
  { key: 'network', label: fr.public.nav.network, href: `/#${LANDING_ANCHORS.network}` },
  { key: 'news', label: fr.public.nav.news, href: `/#${LANDING_ANCHORS.news}` },
  { key: 'events', label: fr.public.nav.events, href: `/#${LANDING_ANCHORS.events}` },
  {
    key: 'opportunities',
    label: fr.public.nav.opportunities,
    href: `/#${LANDING_ANCHORS.opportunities}`,
  },
  { key: 'partners', label: fr.public.nav.partners, href: `/#${LANDING_ANCHORS.partners}` },
];
