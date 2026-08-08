import Link from 'next/link';
import {
  Bell,
  Briefcase,
  CalendarDays,
  CircleHelp,
  Handshake,
  Home,
  Megaphone,
  MessageSquare,
  Newspaper,
  Settings,
  UserRound,
  Users,
  Waypoints,
} from 'lucide-react';
import { cx } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { NETWORK_ROUTES } from '@/lib/routes/network';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { COMMUNITY_ROUTES } from '@/lib/routes/communities';
import { CONTENT_ROUTES } from '@/lib/routes/content';
import { MESSAGING_ROUTES } from '@/lib/routes/messaging';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { SUPPORT_ROUTES } from '@/lib/routes/support';

interface NavItem {
  key: string;
  label: string;
  icon: typeof Home;
  /** `null` tant que l'ecran n'existe pas : aucun lien factice n'est rendu. */
  href: string | null;
}

/**
 * Ordre et libelles exacts du MASTER PROMPT §89 (D-95).
 * Les sections non encore livrees sont affichees sans lien et marquees
 * « À venir » : un item de navigation qui ne mene nulle part serait un
 * bouton decoratif (§113).
 */
const ITEMS: readonly NavItem[] = [
  { key: 'home', label: fr.nav.home, icon: Home, href: ROUTES.dashboard },
  // ISE-040 -> ISE-046 livres : la section « Réseau » a desormais une
  // destination reelle, « Mes relations ».
  { key: 'network', label: fr.nav.network, icon: Waypoints, href: NETWORK_ROUTES.connections },
  // ISE-047 -> ISE-054 livres : la section « Appels au réseau » a
  // desormais une destination reelle.
  { key: 'calls', label: fr.nav.networkCalls, icon: Megaphone, href: CALL_ROUTES.list },
  // ISE-055 -> ISE-066 livres.
  {
    key: 'opportunities',
    label: fr.nav.opportunities,
    icon: Briefcase,
    href: OPPORTUNITY_ROUTES.list,
  },
  // ISE-067 -> ISE-083 livres : « Collaborer » ouvre le hub qui reunit
  // la promotion, les stages et le mentorat.
  { key: 'collaborate', label: fr.nav.collaborate, icon: Handshake, href: PROMOTION_ROUTES.hub },
  // ISE-084 -> ISE-087 livres.
  { key: 'communities', label: fr.nav.communities, icon: Users, href: COMMUNITY_ROUTES.list },
  // ISE-092 / ISE-093 livres : le fil melange actualites et evenements.
  { key: 'news', label: fr.nav.news, icon: Newspaper, href: CONTENT_ROUTES.news },
  // ISE-094 -> ISE-096 livres.
  { key: 'events', label: fr.nav.events, icon: CalendarDays, href: CONTENT_ROUTES.events },
  // ISE-097 livre.
  { key: 'messages', label: fr.nav.messages, icon: MessageSquare, href: MESSAGING_ROUTES.inbox },
  { key: 'profile', label: fr.nav.myProfile, icon: UserRound, href: PROFILE_ROUTES.overview },
  { key: 'availability', label: fr.nav.myAvailability, icon: Bell, href: null },
  // ISE-099 livre.
  { key: 'settings', label: fr.nav.settings, icon: Settings, href: SETTINGS_ROUTES.overview },
  // ISE-100 livre.
  { key: 'help', label: fr.nav.help, icon: CircleHelp, href: SUPPORT_ROUTES.help },
];

const ROW = 'flex items-center gap-4 rounded-base px-5 py-3 text-body-sm';

export function SidebarNav({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label={fr.nav.sidebarLabel} className="px-4 py-5">
      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isCurrent = item.href !== null && item.href === currentPath;

          if (item.href === null) {
            return (
              <li key={item.key}>
                <span
                  className={cx(ROW, 'text-text-muted justify-between')}
                  title={fr.nav.comingSoonHint}
                >
                  <span className="flex items-center gap-4">
                    <Icon size={18} aria-hidden="true" className="shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  <span className="border-border bg-surface-muted rounded-full border px-3 py-[2px] text-[11px] font-medium">
                    {fr.common.comingSoon}
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cx(
                  ROW,
                  'font-medium transition-colors duration-150',
                  'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
                  isCurrent
                    ? 'border-primary text-primary-hover border-l-[3px] bg-[#EFF6FF] pl-4'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
                )}
              >
                <Icon size={18} aria-hidden="true" className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
