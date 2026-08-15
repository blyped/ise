import type { ReactNode } from 'react';
import { frAdmin } from '@/i18n/admin';
import type { AdminAccess } from '@/lib/admin/permissions';
import { loadAdminNavCounters } from '@/lib/admin/queries-nav-counters';
import { ROUTES } from '@/lib/routes';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { readCmsAccess } from '@/lib/cms/permissions';
import { visibleNavItems } from './nav';
import { AdminNav } from './AdminNav';

export interface AdminShellProps {
  access: AdminAccess;
  currentPath: string;
  /** Titre repris dans la barre superieure mobile. */
  screenTitle: string;
  children: ReactNode;
}

/**
 * Gabarit du back-office Superadmin (maquettes SA-0XX Desktop 1440 /
 * Mobile 375) — meme structure que `CmsShell` : rail de 248 px + contenu.
 *
 * La navigation est FILTREE par permission : masquer une entree n'est pas
 * la securite (chaque page et chaque fonction `admin_*` revalident), mais
 * une entree qui menerait a un ecran systematiquement refuse serait un
 * bouton decoratif (MASTER PROMPT §113).
 *
 * Lien croisé vers le CMS (§30, D-171) : les deux back-offices n'avaient
 * aucune navigation croisée, obligeant à taper l'URL à la main. Le lien
 * n'apparaît que si le compte a réellement `cms.read` — même règle « rien
 * de décoratif » que le reste de cette navigation.
 *
 * Retour vers l'espace membre (§30, D-171) : le back-office n'offrait aucune
 * sortie vers le tableau de bord membre — « d'administration, je ne sais
 * pas comment retourner à mon profil ». Le lien est construit sur le meme
 * patron que `cmsLink`, sans condition de permission : toute personne qui
 * atteint l'administration a par construction une session membre, donc la
 * destination n'est jamais un écran refusé.
 *
 * Pastilles de comptage (0138) : la lecture est SERVEUR et descend en
 * props — `AdminNav` est un composant client, il ne parle pas a la base.
 * Un seul aller-retour par rendu, mene en parallele de la lecture des
 * permissions CMS. Le filtrage par permission est fait EN BASE : une file
 * hors permission n'est pas renvoyee, donc jamais affichable.
 */
export async function AdminShell({ access, currentPath, screenTitle, children }: AdminShellProps) {
  const [cmsAccess, navCounters] = await Promise.all([readCmsAccess(), loadAdminNavCounters()]);
  const cmsLink = cmsAccess?.can('cms.read')
    ? { href: CMS_ROUTES.dashboard, label: frAdmin.nav.openCms }
    : undefined;
  const memberLink = { href: ROUTES.dashboard, label: frAdmin.nav.backToMember };

  return (
    <div className="bg-background min-h-dvh lg:flex">
      <a className="skip-link" href="#contenu-admin">
        {frAdmin.brand.skipToContent}
      </a>

      <AdminNav
        currentPath={currentPath}
        screenTitle={screenTitle}
        items={visibleNavItems(access)}
        counters={navCounters}
        {...(cmsLink ? { cmsLink } : {})}
        {...(memberLink ? { memberLink } : {})}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border bg-surface hidden h-[68px] shrink-0 items-center border-b px-7 lg:flex">
          <p className="text-body-sm text-text-secondary font-medium">{frAdmin.brand.breadcrumb}</p>
        </div>

        <main id="contenu-admin" className="flex-1 px-7 py-8 max-md:px-4 max-md:py-5">
          <div className="mx-auto w-full max-w-[1120px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
