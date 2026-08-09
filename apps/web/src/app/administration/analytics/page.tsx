import Link from 'next/link';
import { Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { loadAnalyticsOverview, loadAnalyticsSeries } from '@/lib/admin-data/queries';
import { ADMIN_DATA_ROUTES } from '@/lib/routes/admin-data';
import type { SeriesPoint } from '@/lib/admin-data/view';
import { AdminPageHeader } from '../imports/_components/AdminPageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.analytics.title };

const t = frAdminData.analytics;

/** Courbe minimaliste en SVG — uniquement des points réels. */
function Sparkline({ points }: { points: SeriesPoint[] }) {
  if (points.length < 2) return null;
  const width = 280;
  const height = 48;
  const max = Math.max(...points.map((p) => p.value), 1);
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (point.value / max) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t.seriesTitle}
      className="text-active-blue h-12 w-full max-w-[280px]"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * SA-046 — Valeur du réseau. Le catalogue vient de
 * `analytics.metric_definitions` (0019) via `admin_analytics_overview()`
 * (0081) : chaque indicateur calculable porte un COUNT réel sur sa source
 * déclarée ; un indicateur non calculable est affiché comme tel, jamais
 * comme un zéro déguisé (MASTER PROMPT §42, §98). Agrégats uniquement.
 */
export default async function AnalyticsPage() {
  const correlationId = newCorrelationId();
  const overview = await loadAnalyticsOverview(correlationId);

  if (!overview.ok) {
    return (
      <div className="flex flex-col gap-8">
        <AdminPageHeader title={t.title} subtitle={t.subtitle} />
        <ErrorState
          title={frAdminData.common.loadError}
          description={overview.error.userMessage}
          correlationId={correlationId}
        />
      </div>
    );
  }

  const data = overview.data;
  const byCode = new Map(data.metrics.map((metric) => [metric.code, metric]));

  const kpiCodes = [
    { code: 'connections_accepted', label: t.kpiConnections },
    { code: 'introductions_completed', label: t.kpiIntroductions },
    { code: 'network_calls_helped', label: t.kpiCallsHelped },
    { code: 'impact_events_recorded', label: t.kpiImpact },
  ];

  const claimedSeries = await loadAnalyticsSeries('profiles_claimed', correlationId);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link
            href={ADMIN_DATA_ROUTES.analyticsSegmentation}
            className="border-border text-body-sm text-text-primary inline-flex min-h-[44px] items-center rounded-lg border px-4 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t.segmentationLink}
          </Link>
        }
      />

      <section aria-label={t.title} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCodes.map(({ code, label }) => {
          const metric = byCode.get(code);
          return (
            <Card key={code}>
              {metric?.isComputable === true && metric.value !== null ? (
                <p className="text-h2 text-text-primary tabular-nums">{metric.value}</p>
              ) : (
                <p className="text-body-sm text-text-muted">{t.notComputable}</p>
              )}
              <p className="text-body-sm text-text-secondary">{label}</p>
            </Card>
          );
        })}
      </section>

      {data.enrichment !== null ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t.enrichmentTitle}</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t.enrichmentTotal, value: data.enrichment.totalProfiles },
              { label: t.enrichmentClaimed, value: data.enrichment.claimedProfiles },
              { label: t.enrichmentVerified, value: data.enrichment.verifiedProfiles },
              { label: t.enrichmentEnriched, value: data.enrichment.enrichedProfiles },
            ].map((item) => (
              <div key={item.label}>
                <dd className="text-h3 text-text-primary tabular-nums">{item.value}</dd>
                <dt className="text-caption text-text-muted">{item.label}</dt>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.seriesTitle}</CardTitle>
        </CardHeader>
        {claimedSeries.ok && claimedSeries.data.length >= 2 ? (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-text-secondary">
              {byCode.get('profiles_claimed')?.labelFr ?? 'profiles_claimed'}
            </p>
            <Sparkline points={claimedSeries.data} />
          </div>
        ) : (
          <p className="text-body-sm text-text-secondary">{t.seriesEmpty}</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.metricsTitle}</CardTitle>
        </CardHeader>
        <p className="text-caption text-text-muted mb-4">{t.metricsNote}</p>
        <ul className="flex flex-col gap-4">
          {data.metrics.map((metric) => (
            <li
              key={metric.code}
              className="border-border flex flex-wrap items-start justify-between gap-3 border-b pb-4 last:border-0"
            >
              <div className="max-w-2xl">
                <p className="text-body text-text-primary font-medium">{metric.labelFr}</p>
                {metric.definitionFr !== null ? (
                  <p className="text-body-sm text-text-secondary">{metric.definitionFr}</p>
                ) : null}
                <p className="text-caption text-text-muted">
                  {t.sourceLabel} : {metric.sourceObjects.join(', ') || frAdminData.common.none}
                </p>
              </div>
              <div className="text-right">
                {metric.isComputable && metric.value !== null ? (
                  <p className="text-h3 text-text-primary tabular-nums">{metric.value}</p>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone="neutral">{t.notComputable}</Badge>
                    <p className="text-caption text-text-muted max-w-[32ch]">
                      {t.notComputableReason(metric.sourceObjects.join(', '))}
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
