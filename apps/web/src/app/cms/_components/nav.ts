import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { CmsNavCounterKey } from '@/lib/cms/nav-counters';
import type { CmsPermission } from '@/lib/cms/permissions';

/**
 * Destinations du back-office (maquettes CMS-001 -> CMS-010).
 *
 * `requires` sert a MASQUER une entree inutile, pas a proteger la route :
 * chaque page revalide cote serveur, et la base refuse de toute facon.
 * `cms.read` suffit a voir un ecran ; l'ecriture est verifiee au moment
 * de l'action.
 *
 * `counter` designe l'ECART D'EXPOSITION que l'entree donne a corriger
 * (migration 0139). Le CMS ne juge pas un contenu, il decide de sa
 * parution sur la vitrine : ce qu'on compte ici, c'est la distance entre
 * ce que le CMS croit avoir expose et ce que la page d'accueil montre.
 *
 * MEME REGLE « rien de decoratif » (§113) qu'en administration : une
 * entree sans ecart possible n'a pas de `counter`, parce qu'un compteur
 * toujours nul est du bruit. Sont donc sans compteur, verification faite :
 *   * le tableau de bord et l'apercu — des lectures ;
 *   * le carrousel — ses deux seules anomalies (fenetre echue, slide
 *     sponsorisee sans campagne en cours) sont refermees toutes les dix
 *     minutes par l'ordonnanceur `cms_expire_content` ;
 *   * les sections d'accueil — les neuf lignes sont en brouillon PAR
 *     CONCEPTION, la vitrine retombe sur les titres de `fr.public` (voir
 *     `app/page.tsx`) : la pastille afficherait 9 en permanence ;
 *   * les partenaires — une campagne terminee est clôturee par le meme
 *     ordonnanceur, et une campagne qui tourne encore n'attend personne ;
 *   * la mediatheque — `cms_media_assets.alt_text` est NOT NULL avec un
 *     CHECK d'au moins trois caracteres : un media sans alternative
 *     textuelle ne peut pas exister, et les variantes ne sont jamais
 *     deposees a la main (le rendu d'image produit les tailles) ;
 *   * la file « A la une » — `apply_landing_queue()` force l'exposition a
 *     l'entree en passage : un passage en cours dont la cible ne parait
 *     pas est DEJA compte sous son type de contenu, et un passage a venir
 *     n'attend rien.
 */
export interface CmsNavItem {
  href: string;
  label: string;
  requires: CmsPermission;
  /** Ecart d'exposition compte par `cms_nav_counters()`, s'il y en a un. */
  counter?: CmsNavCounterKey;
}

export const CMS_NAV: readonly CmsNavItem[] = [
  { href: CMS_ROUTES.dashboard, label: frCms.nav.dashboard, requires: 'cms.read' },
  { href: CMS_ROUTES.carousel, label: frCms.nav.carousel, requires: 'cms.read' },
  { href: CMS_ROUTES.sections, label: frCms.nav.sections, requires: 'cms.read' },
  {
    href: CMS_ROUTES.pillars,
    label: frCms.nav.pillars,
    requires: 'cms.read',
    counter: 'pillars',
  },
  {
    href: CMS_ROUTES.news,
    label: frCms.nav.news,
    requires: 'cms.read',
    counter: 'news',
  },
  {
    href: CMS_ROUTES.events,
    label: frCms.nav.events,
    requires: 'cms.read',
    counter: 'events',
  },
  {
    href: CMS_ROUTES.opportunities,
    label: frCms.nav.opportunities,
    requires: 'cms.read',
    counter: 'opportunities',
  },
  {
    href: CMS_ROUTES.featuredProfile,
    label: frCms.nav.featuredProfile,
    requires: 'cms.read',
    counter: 'featured_profile',
  },
  { href: CMS_ROUTES.partners, label: frCms.nav.partners, requires: 'cms.read' },
  // CMS-013 (0133) — logos des organisations ou travaillent les ISE.
  {
    href: CMS_ROUTES.landingOrganizations,
    label: frCms.nav.landingOrganizations,
    requires: 'cms.read',
    counter: 'organizations',
  },
  { href: CMS_ROUTES.media, label: frCms.nav.media, requires: 'cms.read' },
  {
    href: CMS_ROUTES.schedule,
    label: frCms.nav.schedule,
    requires: 'cms.read',
    counter: 'schedule',
  },
  // CMS-012 (0121) — file de passage des encarts « À la une du réseau ».
  { href: CMS_ROUTES.landingQueue, label: frCms.nav.landingQueue, requires: 'cms.read' },
  { href: CMS_ROUTES.preview, label: frCms.nav.preview, requires: 'cms.read' },
];

/** `true` si `pathname` designe cette destination ou l'une de ses filles. */
export function isCurrentNavItem(pathname: string, href: string): boolean {
  if (href === CMS_ROUTES.dashboard) return pathname === CMS_ROUTES.dashboard;
  return pathname === href || pathname.startsWith(`${href}/`);
}
