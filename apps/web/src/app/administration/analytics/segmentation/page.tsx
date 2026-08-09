import { Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { loadAnalyticsSegmentation } from '@/lib/admin-data/queries';
import { ADMIN_DATA_ROUTES } from '@/lib/routes/admin-data';
import { AdminPageHeader } from '../../_components/AdminPageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.analytics.segmentation.title };

const t = frAdminData.analytics.segmentation;

/**
 * SA-047 — Segmentation du réseau : ventilation par promotion et par
 * pays. AGRÉGATS UNIQUEMENT (MASTER PROMPT §42) : la maille la plus fine
 * est la promotion ou le pays, jamais l'individu.
 */
export default async function AnalyticsSegmentationPage() {
  const correlationId = newCorrelationId();
  const segmentation = await loadAnalyticsSegmentation(correlationId);

  if (!segmentation.ok) {
    return (
      <div className="flex flex-col gap-8">
        <AdminPageHeader
          title={t.title}
          subtitle={t.subtitle}
          backHref={ADMIN_DATA_ROUTES.analytics}
          backLabel={frAdminData.analytics.title}
        />
        <ErrorState
          title={frAdminData.common.loadError}
          description={segmentation.error.userMessage}
          correlationId={correlationId}
        />
      </div>
    );
  }

  const data = segmentation.data;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        backHref={ADMIN_DATA_ROUTES.analytics}
        backLabel={frAdminData.analytics.title}
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.byPromotion}</CardTitle>
        </CardHeader>
        {data.byPromotion.length === 0 ? (
          <EmptyState title={t.emptyPromotions} description={frAdminData.common.emptyGeneric} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  <th scope="col" className="py-2 pr-3">
                    {t.colPromotion}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colReferenced}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colClaimed}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colVerified}
                  </th>
                  <th scope="col" className="py-2">
                    {t.colActivation}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byPromotion.map((segment) => (
                  <tr key={segment.graduationYear} className="border-border border-b last:border-0">
                    <th
                      scope="row"
                      className="text-body-sm text-text-primary py-2 pr-3 text-left font-medium"
                    >
                      {segment.graduationYear}
                    </th>
                    <td className="text-body-sm text-text-secondary py-2 pr-3 tabular-nums">
                      {segment.referencedCount}
                    </td>
                    <td className="text-body-sm text-text-secondary py-2 pr-3 tabular-nums">
                      {segment.claimedCount}
                    </td>
                    <td className="text-body-sm text-text-secondary py-2 pr-3 tabular-nums">
                      {segment.verifiedCount}
                    </td>
                    <td className="text-body-sm text-text-secondary py-2 tabular-nums">
                      {segment.activationRate !== null
                        ? `${Math.round(segment.activationRate * 100)} %`
                        : frAdminData.common.none}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.byCountry}</CardTitle>
        </CardHeader>
        {data.byCountry.length === 0 ? (
          <EmptyState title={t.emptyCountries} description={frAdminData.common.emptyGeneric} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left">
                <thead>
                  <tr className="text-caption text-text-muted border-border border-b">
                    <th scope="col" className="py-2 pr-3">
                      {t.colCountry}
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      {t.colProfiles}
                    </th>
                    <th scope="col" className="py-2">
                      {t.colClaimed}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCountry.map((segment) => (
                    <tr key={segment.countryCode} className="border-border border-b last:border-0">
                      <th
                        scope="row"
                        className="text-body-sm text-text-primary py-2 pr-3 text-left font-medium"
                      >
                        {segment.countryName}
                      </th>
                      <td className="text-body-sm text-text-secondary py-2 pr-3 tabular-nums">
                        {segment.profileCount}
                      </td>
                      <td className="text-body-sm text-text-secondary py-2 tabular-nums">
                        {segment.claimedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-caption text-text-muted mt-3">{t.unlocated(data.unlocatedCount)}</p>
          </>
        )}
      </Card>
    </div>
  );
}
