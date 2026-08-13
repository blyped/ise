import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminCampaigns } from '@/i18n/admin-campaigns';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import {
  loadAdminAuthLinkEvents,
  type AdminAuthLinkEventSummaryRow,
} from '@/lib/admin/queries-auth-link-events';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../_components/PageHeader';
import { RowCard, RowList } from '../../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCampaigns.authLinks.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

interface AuthLinkTypeRow {
  linkType: string;
  success: number;
  error: number;
  distinctUsers: number;
}

/**
 * Regroupe les lignes (link_type, outcome) renvoyees par
 * `admin_list_auth_link_events` en une ligne par type de lien, avec ses
 * deux compteurs (succes/echec) — plus simple a lire qu'une liste plate
 * de couples (type, resultat).
 */
function groupByLinkType(
  rows: readonly AdminAuthLinkEventSummaryRow[],
): readonly AuthLinkTypeRow[] {
  const byType = new Map<string, AuthLinkTypeRow>();
  for (const row of rows) {
    const existing = byType.get(row.linkType) ?? {
      linkType: row.linkType,
      success: 0,
      error: 0,
      distinctUsers: 0,
    };
    if (row.outcome === 'success') {
      existing.success += row.eventCount;
      existing.distinctUsers += row.distinctUsers;
    } else {
      existing.error += row.eventCount;
    }
    byType.set(row.linkType, existing);
  }
  return Array.from(byType.values()).sort((a, b) => a.linkType.localeCompare(b.linkType));
}

/**
 * Suivi des clics sur les liens d'e-mail Supabase (D-173, tache #140) :
 * confirmation de compte (ISE-002), reinitialisation de mot de passe
 * (ISE-003), activation des comptes pre-crees (D-161). Comble un trou
 * reel : sans ce suivi, un lien jamais clique et un lien clique mais
 * invalide/expire etaient indistinguables (tous deux
 * `invited_and_signed_in = false` dans `auth.users`).
 *
 * PLACEMENT — ecran DEDIE plutot qu'integre a la fiche campagne
 * existante (`/administration/promotions/[promotionId]/campagnes/
 * [campaignId]`) : ces evenements sont une vue GLOBALE de la plateforme
 * (tous types de liens, toutes promotions, campagnes ou invitations
 * individuelles ISE-070 confondues), alors que la fiche campagne exige
 * un `campaignId` precis. Y greffer un resume global aurait ete
 * artificiel (le lecteur associerait a tort les chiffres a CETTE
 * campagne). Route sous `/administration/promotions/liens` : rattachee
 * a la section Promotions (meme permission `promotions.manage`, meme
 * theme fonctionnel) sans pretendre etre le detail d'un objet precis.
 * Pas d'entree dans la navigation principale (comme `campagnes` et
 * `invitations`, deja des sous-ecrans de Promotions) : un lien depuis
 * la liste des promotions (SA-008) suffit a l'atteindre.
 */
export default async function AdminAuthLinkEventsPage() {
  const access = await requireAdminPermission('promotions.manage');
  const correlationId = newCorrelationId();
  const summary = await loadAdminAuthLinkEvents(correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdminCampaigns.authLinks.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <Link href={ADMIN_ROUTES.promotions} className={BACK_LINK}>
        ← {frAdmin.common.back}
      </Link>
      <PageHeader
        title={frAdminCampaigns.authLinks.title}
        subtitle={frAdminCampaigns.authLinks.subtitle}
      />
    </div>
  );

  if (!summary.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frAdmin.common.errorTitle}
          description={summary.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = groupByLinkType(summary.data);

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      {rows.length === 0 ? (
        <EmptyState
          title={frAdminCampaigns.authLinks.empty}
          description={frAdminCampaigns.authLinks.emptyBody}
        />
      ) : (
        <SectionCard title={frAdminCampaigns.authLinks.title}>
          <RowList label={frAdminCampaigns.authLinks.title}>
            {rows.map((row) => (
              <RowCard
                key={row.linkType}
                title={frAdminCampaigns.authLinks.linkType[row.linkType] ?? row.linkType}
                meta={[
                  `${frAdminCampaigns.authLinks.columns.success} : ${row.success}`,
                  `${frAdminCampaigns.authLinks.columns.error} : ${row.error}`,
                  `${frAdminCampaigns.authLinks.columns.distinctUsers} : ${row.distinctUsers}`,
                ].join(' · ')}
              />
            ))}
          </RowList>
        </SectionCard>
      )}

      <p className="text-caption text-text-muted max-w-[68ch]">
        {frAdminCampaigns.authLinks.limitNote}
      </p>
    </div>,
  );
}
