import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { loadIncompleteProfiles } from '@/lib/admin-data/queries';
import { AdminPageHeader } from '../_components/AdminPageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.incompleteProfiles.title };

const t = frAdminData.incompleteProfiles;

/**
 * SA-043 — Profils incomplets, priorisisés par NOMBRE de champs critiques
 * manquants. Le score de complétion individuel reste privé (D-72) : cet
 * écran liste des manques factuels, outil de qualité de données.
 */
export default async function IncompleteProfilesPage() {
  const correlationId = newCorrelationId();
  const profiles = await loadIncompleteProfiles(correlationId);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      {!profiles.ok ? (
        <ErrorState
          title={frAdminData.common.loadError}
          description={profiles.error.userMessage}
          correlationId={correlationId}
        />
      ) : profiles.data.length === 0 ? (
        <EmptyState title={t.empty} description={t.emptyNoProfiles} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  <th scope="col" className="py-2 pr-3">
                    {t.colProfile}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colPromotion}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colStatus}
                  </th>
                  <th scope="col" className="py-2">
                    {t.colMissing}
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.data.map((profile) => (
                  <tr key={profile.id} className="border-border border-b align-top last:border-0">
                    <td className="text-body-sm text-text-primary py-3 pr-3 font-medium">
                      {profile.displayName}
                    </td>
                    <td className="text-body-sm text-text-secondary py-3 pr-3 tabular-nums">
                      {profile.promotionYear ?? frAdminData.common.none}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={profile.claimStatus === 'claimed' ? 'success' : 'neutral'}>
                        {t.claim[profile.claimStatus] ?? profile.claimStatus}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {profile.missingFields.map((field) => (
                          <Badge key={field} tone="warning">
                            {t.missingLabel[field] ?? field}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
