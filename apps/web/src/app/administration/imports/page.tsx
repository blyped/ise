import Link from 'next/link';
import { Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminDataAccess } from '@/lib/admin-data/permissions';
import { loadImportBatches, loadImportsOverview } from '@/lib/admin-data/queries';
import { ADMIN_DATA_ROUTES, importDetailRoute } from '@/lib/routes/admin-data';
import { AdminPageHeader } from './_components/AdminPageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.imports.title };

const t = frAdminData.imports;

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'reported') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'cancelled') return 'neutral';
  if (status === 'human_review') return 'warning';
  return 'info';
}

/**
 * SA-040 — Tableau de contrôle des imports & de la qualité des données.
 *
 * Tous les compteurs viennent d'`admin_imports_overview()` (0080) : des
 * COUNT réels, jamais des estimations (§98). Un annuaire vide affiche des
 * zéros et le dit — c'est la réponse exacte.
 */
export default async function AdminImportsPage() {
  const access = await readAdminDataAccess();
  const canExecute = access?.can('imports.execute') === true;
  const correlationId = newCorrelationId();

  const [overview, batches] = await Promise.all([
    loadImportsOverview(correlationId),
    loadImportBatches(correlationId),
  ]);

  if (!overview.ok || !batches.ok) {
    const error = !overview.ok ? overview.error : batches.ok ? null : batches.error;
    return (
      <div className="flex flex-col gap-8">
        <AdminPageHeader title={t.title} subtitle={t.subtitle} />
        <ErrorState
          title={frAdminData.common.loadError}
          description={error?.userMessage ?? frAdminData.common.loadError}
          correlationId={correlationId}
        />
      </div>
    );
  }

  const data = overview.data;
  const rows = batches.data;

  const kpis = [
    {
      label: t.kpiBatches30d,
      value: data.batches30d,
      hint: t.kpiBatches30dHint(data.batches30dReported),
    },
    { label: t.kpiInReview, value: data.batchesInReview, hint: null },
    {
      label: t.kpiPendingDuplicates,
      value: data.pendingDuplicates,
      hint: t.kpiPendingDuplicatesHint(data.pendingDuplicatesProbable),
    },
    {
      label: t.kpiOpenIssues,
      value: data.openIssues,
      hint: t.kpiOpenIssuesHint(data.openIssuesErrors),
    },
  ];

  const total = data.quality.totalProfiles;
  const qualityRows = [
    { label: t.qualityIdentity, count: data.quality.identityComplete },
    { label: t.qualityPosition, count: data.quality.withPosition },
    { label: t.qualityCountry, count: data.quality.withCountry },
    { label: t.qualityEmail, count: data.quality.emailValidOrAbsent },
  ];

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={
          canExecute ? (
            <Link
              href={ADMIN_DATA_ROUTES.importNew}
              className="bg-primary text-on-primary text-body-sm inline-flex min-h-[44px] items-center rounded-lg px-4 font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t.newImport}
            </Link>
          ) : undefined
        }
      />

      <nav aria-label={t.title} className="flex flex-wrap gap-2">
        {[
          { href: ADMIN_DATA_ROUTES.importIssues, label: t.tabs.issues },
          { href: ADMIN_DATA_ROUTES.incompleteProfiles, label: t.tabs.incomplete },
          { href: ADMIN_DATA_ROUTES.completenessCampaigns, label: t.tabs.campaigns },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="border-border text-body-sm text-text-secondary inline-flex min-h-[40px] items-center rounded-full border px-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section aria-label={t.title} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-h2 text-text-primary tabular-nums">{kpi.value}</p>
            <p className="text-body-sm text-text-secondary">{kpi.label}</p>
            {kpi.hint !== null ? <p className="text-caption text-text-muted">{kpi.hint}</p> : null}
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.qualityTitle}</CardTitle>
        </CardHeader>
        {total === 0 ? (
          <p className="text-body-sm text-text-secondary">{t.qualityEmpty}</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {qualityRows.map((row) => (
              <div key={row.label} className="flex items-baseline gap-2">
                <dt className="text-body-sm text-text-secondary">{row.label}</dt>
                <dd className="text-body-sm text-text-primary font-medium tabular-nums">
                  {row.count} / {total}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-caption text-text-muted mt-3">{t.qualityNote}</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.tabs.batches}</CardTitle>
        </CardHeader>
        {rows.length === 0 ? (
          <EmptyState
            title={t.emptyBatches}
            description={frAdminData.common.emptyGeneric}
            action={
              canExecute ? (
                <Link
                  href={ADMIN_DATA_ROUTES.importNew}
                  className="text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {t.emptyBatchesAction}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  <th scope="col" className="py-2 pr-3">
                    {t.tableImport}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.tableSource}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.tableRows}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.tableValid}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.tableIssues}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.tableStatus}
                  </th>
                  <th scope="col" className="py-2">
                    {t.tableAction}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((batch) => (
                  <tr key={batch.id} className="border-border border-b align-top last:border-0">
                    <td className="py-3 pr-3">
                      <p className="text-body-sm text-text-primary font-medium">
                        {batch.originalFilename}
                      </p>
                      <p className="text-caption text-text-muted">
                        {batch.uploadedBy !== null
                          ? `${t.uploadedBy} ${batch.uploadedBy}`
                          : frAdminData.common.none}
                        {batch.isPilot && batch.pilotLabel !== null ? ` · ${batch.pilotLabel}` : ''}
                      </p>
                    </td>
                    <td className="text-body-sm text-text-secondary py-3 pr-3">
                      {batch.sourceName}
                    </td>
                    <td className="text-body-sm text-text-secondary py-3 pr-3 tabular-nums">
                      {batch.stagedRows > 0 ? batch.stagedRows : batch.totalRows}
                    </td>
                    <td className="text-body-sm text-text-secondary py-3 pr-3 tabular-nums">
                      {batch.status === 'reported'
                        ? batch.importedRows
                        : batch.validRows + batch.needsReviewRows}
                    </td>
                    <td className="text-body-sm text-text-secondary py-3 pr-3 tabular-nums">
                      {batch.openIssues}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={statusTone(batch.status)}>
                        {t.status[batch.status] ?? batch.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Link
                        href={importDetailRoute(batch.id)}
                        className="text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {t.open}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
