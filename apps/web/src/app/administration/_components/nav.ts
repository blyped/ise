import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import type { AdminAccess, AdminPermission } from '@/lib/admin/permissions';

/**
 * Destinations du back-office Superadmin.
 *
 * `requires` sert a MASQUER une entree que la base refuserait de remplir,
 * pas a proteger la route : chaque page revalide sa permission cote
 * serveur, et chaque fonction `admin_*` la revalide en base.
 *
 * REGLE « rien de decoratif » (MASTER PROMPT §113) : seules les sections
 * LIVREES apparaissent. Les entrees du lot livre en parallele (imports /
 * analytics / parametres / audit, SA-040 -> SA-050) sont declarees dans
 * `DATA_LOT_NAV` et n'apparaissent que si `DATA_LOT_DELIVERED` est vrai —
 * a basculer a la reunion des deux lots.
 */
export interface AdminNavItem {
  href: string;
  label: string;
  requires: readonly AdminPermission[];
}

const CORE_NAV: readonly AdminNavItem[] = [
  { href: ADMIN_ROUTES.root, label: frAdmin.nav.dashboard, requires: [] },
  { href: ADMIN_ROUTES.members, label: frAdmin.nav.members, requires: ['profiles.read'] },
  { href: ADMIN_ROUTES.claims, label: frAdmin.nav.claims, requires: ['profiles.verify'] },
  { href: ADMIN_ROUTES.promotions, label: frAdmin.nav.promotions, requires: ['promotions.manage'] },
  { href: ADMIN_ROUTES.calls, label: frAdmin.nav.calls, requires: ['calls.moderate'] },
  {
    href: ADMIN_ROUTES.opportunities,
    label: frAdmin.nav.opportunities,
    requires: ['opportunities.manage'],
  },
  { href: ADMIN_ROUTES.moderation, label: frAdmin.nav.moderation, requires: ['profiles.moderate'] },
  { href: ADMIN_ROUTES.support, label: frAdmin.nav.support, requires: ['support.manage'] },
];

/**
 * Lot « donnees » livre en parallele (SA-040 -> SA-050) : une entree
 * n'apparait que lorsque sa section est REELLEMENT livree sous
 * `app/administration/**` — un lien vers un ecran absent serait un
 * bouton decoratif (MASTER PROMPT §113). Basculer le drapeau de la
 * section a sa livraison.
 */
const DATA_LOT_DELIVERED = {
  imports: true,
  analytics: true,
  settings: true,
  audit: false, // SA-049/SA-050 : en cours de livraison par le lot « donnees ».
} as const;

const DATA_LOT_NAV: readonly AdminNavItem[] = [
  ...(DATA_LOT_DELIVERED.imports
    ? [
        {
          href: ADMIN_ROUTES.imports,
          label: frAdmin.nav.imports,
          requires: ['imports.execute', 'imports.review'],
        } satisfies AdminNavItem,
      ]
    : []),
  ...(DATA_LOT_DELIVERED.analytics
    ? [
        {
          href: ADMIN_ROUTES.analytics,
          label: frAdmin.nav.analytics,
          requires: ['analytics.read'],
        } satisfies AdminNavItem,
      ]
    : []),
  ...(DATA_LOT_DELIVERED.settings
    ? [
        {
          href: ADMIN_ROUTES.settings,
          label: frAdmin.nav.settings,
          requires: ['settings.manage'],
        } satisfies AdminNavItem,
      ]
    : []),
  ...(DATA_LOT_DELIVERED.audit
    ? [
        {
          href: ADMIN_ROUTES.audit,
          label: frAdmin.nav.audit,
          requires: ['audit.read'],
        } satisfies AdminNavItem,
      ]
    : []),
];

export const ADMIN_NAV: readonly AdminNavItem[] = [...CORE_NAV, ...DATA_LOT_NAV];

/** Entrees visibles pour l'acces courant. Le tableau de bord est toujours la. */
export function visibleNavItems(access: AdminAccess): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.requires.length === 0 || access.canAny(item.requires));
}

/** `true` si `pathname` designe cette destination ou l'une de ses filles. */
export function isCurrentNavItem(pathname: string, href: string): boolean {
  if (href === ADMIN_ROUTES.root) return pathname === ADMIN_ROUTES.root;
  return pathname === href || pathname.startsWith(`${href}/`);
}
