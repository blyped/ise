import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { CmsPermission } from '@/lib/cms/permissions';

/**
 * Destinations du back-office (maquettes CMS-001 -> CMS-010).
 *
 * `requires` sert a MASQUER une entree inutile, pas a proteger la route :
 * chaque page revalide cote serveur, et la base refuse de toute facon.
 * `cms.read` suffit a voir un ecran ; l'ecriture est verifiee au moment
 * de l'action.
 */
export interface CmsNavItem {
  href: string;
  label: string;
  requires: CmsPermission;
}

export const CMS_NAV: readonly CmsNavItem[] = [
  { href: CMS_ROUTES.dashboard, label: frCms.nav.dashboard, requires: 'cms.read' },
  { href: CMS_ROUTES.carousel, label: frCms.nav.carousel, requires: 'cms.read' },
  { href: CMS_ROUTES.sections, label: frCms.nav.sections, requires: 'cms.read' },
  { href: CMS_ROUTES.news, label: frCms.nav.news, requires: 'cms.read' },
  { href: CMS_ROUTES.events, label: frCms.nav.events, requires: 'cms.read' },
  { href: CMS_ROUTES.opportunities, label: frCms.nav.opportunities, requires: 'cms.read' },
  { href: CMS_ROUTES.featuredProfile, label: frCms.nav.featuredProfile, requires: 'cms.read' },
  { href: CMS_ROUTES.partners, label: frCms.nav.partners, requires: 'cms.read' },
  { href: CMS_ROUTES.media, label: frCms.nav.media, requires: 'cms.read' },
  { href: CMS_ROUTES.schedule, label: frCms.nav.schedule, requires: 'cms.read' },
  { href: CMS_ROUTES.preview, label: frCms.nav.preview, requires: 'cms.read' },
];

/** `true` si `pathname` designe cette destination ou l'une de ses filles. */
export function isCurrentNavItem(pathname: string, href: string): boolean {
  if (href === CMS_ROUTES.dashboard) return pathname === CMS_ROUTES.dashboard;
  return pathname === href || pathname.startsWith(`${href}/`);
}
