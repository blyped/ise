import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminDataAccess } from '@/lib/admin-data/permissions';
import {
  loadDataQualityIssues,
  loadImportBatchDetail,
  loadImportRows,
} from '@/lib/admin-data/queries';
import {
  ADMIN_DATA_ROUTES,
  importDetailRoute,
  importDuplicatesRoute,
} from '@/lib/routes/admin-data';
import {
  ADMIN_INPUT_CLASS,
  AdminActionButton,
  AdminField,
  AdminForm,
} from '../_components/AdminForm';
import { AdminPageHeader } from '../_components/AdminPageHeader';
import { MappingForm } from './MappingForm';
import {
  cancelBatchAction,
  executeImportAction,
  runDuplicateDetectionAction,
  runNormalizationAction,
  runValidationAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.imports.detail.title };

const t = frAdminData.imports;
const td = t.detail;

const WORKFLOW_STEPS = [
  'uploaded',
  'staged',
  'mapping',
  'validation',
  'normalization',
  'duplicate_detection',
  'human_review',
  'importing',
  'reported',
] as const;

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'reported') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'cancelled') return 'neutral';
  if (status === 'human_review') return 'warning';
  return 'info';
}

function rowPreview(row: {
  normalizedData: Record<string, unknown>;
  rawSourceData: Record<string, unknown>;
}): string {
  const source =
    Object.keys(row.normalizedData).length > 0 ? row.normalizedData : row.rawSourceData;
  const parts = Object.entries(source)
    .filter(([key, value]) => key !== '_norm' && typeof value === 'string' && value.trim() !== '')
    .slice(0, 4)
    .map(([, value]) => String(value));
  return parts.join(' · ');
}

/**
 * SA-041 — Détail d'un lot : le protocole §37 étape par étape, avec les
 * données réelles du lot. Chaque bouton déclenche la fonction SQL de
 * l'étape ; l'écran ne peut pas sauter une étape que la base refuserait.
 */
export default async function ImportBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { batchId } = await params;
  const query = await searchParams;
  const rawFilter = query['statut'];
  const rowFilter = typeof rawFilter === 'string' && rawFilter !== '' ? rawFilter : null;

  const access = await readAdminDataAccess();
  const canExecute = access?.can('imports.execute') === true;
  const correlationId = newCorrelationId();

  const detailResult = await loadImportBatchDetail(batchId, correlationId);
  if (!detailResult.ok) {
    return (
      <div className="flex flex-col gap-8">
        <AdminPageHeader
          title={td.title}
          backHref={ADMIN_DATA_ROUTES.imports}
          backLabel={t.title}
        />
        <ErrorState
          title={frAdminData.common.loadError}
          description={detailResult.error.userMessage}
          correlationId={correlationId}
        />
      </div>
    );
  }
  if (detailResult.data === null) notFound();
  const detail = detailResult.data;
  const batch = detail.batch;

  const [issuesResult, rowsResult] = await Promise.all([
    loadDataQualityIssues(correlationId, batchId),
    loadImportRows(batchId, correlationId, rowFilter),
  ]);

  const currentStepIndex = WORKFLOW_STEPS.indexOf(batch.status as (typeof WORKFLOW_STEPS)[number]);
  const terminal = batch.status === 'cancelled' || batch.status === 'failed';
  const mappingEditable = canExecute && (batch.status === 'staged' || batch.status === 'mapping');
  const reviewBlocked = detail.duplicates.pending + detail.duplicates.deferred > 0;

  const summaryReport = detail.reports.find((report) => report.reportKind === 'summary');

  const columns =
    detail.sampleColumns.length > 0
      ? detail.sampleColumns
      : detail.mappings.map((mapping) => mapping.sourceColumn);

  const rowStatusFilters = [
    null,
    'staged',
    'valid',
    'invalid',
    'normalized',
    'needs_review',
    'imported',
    'ignored',
    'skipped',
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={`${td.title} — ${batch.sourceName}`}
        subtitle={td.fileInfo(batch.fileFormat, batch.totalRows)}
        backHref={ADMIN_DATA_ROUTES.imports}
        backLabel={t.title}
        actions={
          <Badge tone={statusTone(batch.status)}>{t.status[batch.status] ?? batch.status}</Badge>
        }
      />

      {/* Étapes du protocole (§37) : position réelle du lot. */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{td.stepper}</CardTitle>
        </CardHeader>
        <ol className="flex flex-wrap gap-2">
          {WORKFLOW_STEPS.map((step, index) => {
            const state =
              terminal || currentStepIndex < 0
                ? 'muted'
                : index < currentStepIndex
                  ? 'done'
                  : index === currentStepIndex
                    ? 'current'
                    : 'todo';
            return (
              <li key={step}>
                <span
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={
                    'text-caption inline-flex items-center gap-1 rounded-full border px-3 py-1 ' +
                    (state === 'done'
                      ? 'text-success border-[#BBF7D0] bg-[#F0FDF4]'
                      : state === 'current'
                        ? 'border-active-blue text-active-blue font-medium'
                        : 'border-border text-text-muted')
                  }
                >
                  {index + 1}. {t.status[step] ?? step}
                </span>
              </li>
            );
          })}
        </ol>
        {terminal ? (
          <p className="text-caption text-text-muted mt-3">
            {t.status[batch.status]}
            {batch.completedAt !== null ? ` · ${batch.completedAt}` : ''}
          </p>
        ) : null}
      </Card>

      {/* Rapport final (SA-043 volet rapport) */}
      {batch.status === 'reported' ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{td.reportTitle}</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: td.reportCreated, value: batch.createdProfiles },
              { label: td.reportMerged, value: batch.updatedProfiles },
              { label: td.reportIgnored, value: batch.ignoredRows },
              { label: td.reportErrors, value: batch.errorRows },
              { label: td.reportDeferred, value: batch.reviewRows },
              {
                label: td.reportDuplicates,
                value: detail.duplicates.confirmed + detail.duplicates.dismissed,
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-caption text-text-muted">{item.label}</dt>
                <dd className="text-h3 text-text-primary tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
          {summaryReport?.generatedAt !== null && summaryReport !== undefined ? (
            <p className="text-caption text-text-muted mt-3">{summaryReport.generatedAt}</p>
          ) : null}
        </Card>
      ) : null}

      {/* 1. Mapping */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{td.mappingTitle}</CardTitle>
        </CardHeader>
        <p className="text-body-sm text-text-secondary mb-4">{td.mappingHint}</p>
        {columns.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdminData.common.emptyGeneric}</p>
        ) : (
          <MappingForm
            batchId={batch.id}
            columns={columns}
            existing={detail.mappings}
            locked={!mappingEditable}
          />
        )}
      </Card>

      {/* Aperçu des premières lignes brutes */}
      {detail.sampleRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{td.sampleTitle}</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  {columns.map((column) => (
                    <th key={column} scope="col" className="py-2 pr-3">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.sampleRows.map((row, index) => (
                  <tr key={index} className="border-border border-b last:border-0">
                    {columns.map((column) => (
                      <td key={column} className="text-body-sm text-text-secondary py-2 pr-3">
                        {typeof row[column] === 'string' && row[column] !== ''
                          ? String(row[column])
                          : frAdminData.common.none}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Actions d'étape */}
      {canExecute && !terminal && batch.status !== 'reported' ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{td.stepper}</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap items-start gap-4">
            {batch.status === 'mapping' && detail.mappings.length > 0 ? (
              <AdminActionButton
                action={runValidationAction}
                label={td.runValidation}
                hidden={{ batchId: batch.id }}
                variant="primary"
              />
            ) : null}
            {batch.status === 'validation' ? (
              <AdminActionButton
                action={runNormalizationAction}
                label={td.runNormalization}
                hidden={{ batchId: batch.id }}
                variant="primary"
              />
            ) : null}
            {batch.status === 'normalization' ? (
              <AdminActionButton
                action={runDuplicateDetectionAction}
                label={td.runDuplicates}
                hidden={{ batchId: batch.id }}
                variant="primary"
              />
            ) : null}
            {batch.status === 'human_review' ? (
              <>
                <Link
                  href={importDuplicatesRoute(batch.id)}
                  className="border-border text-body-sm text-text-primary inline-flex min-h-[44px] items-center rounded-lg border px-4 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {td.reviewDuplicates} ({detail.duplicates.pending + detail.duplicates.deferred})
                </Link>
                <AdminActionButton
                  action={executeImportAction}
                  label={td.runImport}
                  hidden={{ batchId: batch.id }}
                  variant="primary"
                  note={reviewBlocked ? td.importBlocked : td.runImportConfirm}
                />
              </>
            ) : null}
          </div>
          <div className="border-border mt-6 border-t pt-4">
            <AdminForm action={cancelBatchAction} submitLabel={td.cancelBatch} variant="danger">
              {(errors) => (
                <>
                  <input type="hidden" name="batchId" value={batch.id} />
                  <AdminField
                    name="reason"
                    label={td.cancelReason}
                    required
                    error={errors['reason']}
                  >
                    {(props) => (
                      <input {...props} type="text" maxLength={300} className={ADMIN_INPUT_CLASS} />
                    )}
                  </AdminField>
                </>
              )}
            </AdminForm>
          </div>
        </Card>
      ) : null}

      {/* 2. Anomalies du lot */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{td.anomaliesTitle}</CardTitle>
        </CardHeader>
        {!issuesResult.ok ? (
          <ErrorState
            title={frAdminData.common.loadError}
            description={issuesResult.error.userMessage}
            correlationId={correlationId}
          />
        ) : issuesResult.data.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{t.issues.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {issuesResult.data.map((issue) => (
              <li
                key={issue.id}
                className="border-border flex flex-wrap items-center gap-3 border-b pb-2 last:border-0"
              >
                <Badge
                  tone={
                    issue.severity === 'error'
                      ? 'error'
                      : issue.severity === 'warning'
                        ? 'warning'
                        : 'info'
                  }
                >
                  {t.issues.severity[issue.severity] ?? issue.severity}
                </Badge>
                <span className="text-body-sm text-text-primary">
                  {issue.rowNumber !== null ? `${t.issues.colRow} ${issue.rowNumber} — ` : ''}
                  {t.issues.code[issue.issueCode] ?? issue.issueCode}
                  {issue.fieldName !== null ? ` (${issue.fieldName})` : ''}
                </span>
                {issue.recommendedAction !== null ? (
                  <span className="text-caption text-text-muted">
                    {t.issues.action[issue.recommendedAction] ?? issue.recommendedAction}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 3. Lignes du lot */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{td.rowsTitle}</CardTitle>
        </CardHeader>
        <nav aria-label={td.rowsTitle} className="mb-4 flex flex-wrap gap-2">
          {rowStatusFilters.map((filter) => {
            const active = rowFilter === filter || (filter === null && rowFilter === null);
            const href =
              filter === null
                ? importDetailRoute(batch.id)
                : `${importDetailRoute(batch.id)}?statut=${filter}`;
            return (
              <Link
                key={filter ?? 'all'}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={
                  'text-caption inline-flex min-h-[36px] items-center rounded-full border px-3 ' +
                  (active
                    ? 'border-active-blue text-active-blue font-medium'
                    : 'border-border text-text-secondary hover:underline')
                }
              >
                {filter === null ? td.rowsFilterAll : (td.rowStatus[filter] ?? filter)}
              </Link>
            );
          })}
        </nav>
        {!rowsResult.ok ? (
          <ErrorState
            title={frAdminData.common.loadError}
            description={rowsResult.error.userMessage}
            correlationId={correlationId}
          />
        ) : rowsResult.data.length === 0 ? (
          <EmptyState title={frAdminData.common.emptyGeneric} description={t.issues.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  <th scope="col" className="py-2 pr-3">
                    N°
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.tableImport}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.tableStatus}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {td.decision['pending']}
                  </th>
                  <th scope="col" className="py-2">
                    {t.duplicates.score}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowsResult.data.map((row) => (
                  <tr key={row.id} className="border-border border-b align-top last:border-0">
                    <td className="text-body-sm text-text-secondary py-2 pr-3 tabular-nums">
                      {row.rowNumber}
                    </td>
                    <td className="text-body-sm text-text-primary py-2 pr-3">
                      {rowPreview(row) || frAdminData.common.none}
                      {row.errorCode !== null ? (
                        <p className="text-caption text-error">
                          {t.issues.code[row.errorCode] ?? row.errorCode}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        tone={
                          row.status === 'invalid'
                            ? 'error'
                            : row.status === 'needs_review'
                              ? 'warning'
                              : row.status === 'imported'
                                ? 'success'
                                : 'neutral'
                        }
                      >
                        {td.rowStatus[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td className="text-body-sm text-text-secondary py-2 pr-3">
                      {td.decision[row.decision] ?? row.decision}
                      {row.decidedBy !== null ? (
                        <p className="text-caption text-text-muted">{row.decidedBy}</p>
                      ) : null}
                    </td>
                    <td className="text-body-sm text-text-secondary py-2 tabular-nums">
                      {row.matchScore !== null
                        ? `${row.matchScore} — ${t.duplicates.matchClass[row.matchClass ?? ''] ?? ''}`
                        : frAdminData.common.none}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Historique des franchissements d'étape */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{td.historyTitle}</CardTitle>
        </CardHeader>
        {detail.stageEvents.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdminData.common.emptyGeneric}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {detail.stageEvents.map((event, index) => (
              <li key={index} className="text-body-sm text-text-secondary">
                <span className="text-text-primary font-medium">
                  {t.status[event.toStatus] ?? event.toStatus}
                </span>
                {event.actor !== null ? ` — ${event.actor}` : ''}
                {event.createdAt !== null ? ` · ${event.createdAt}` : ''}
                {event.note !== null ? (
                  <p className="text-caption text-text-muted">{event.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {batch.status === 'human_review' && reviewBlocked ? (
        <Alert variant="warning" title={td.reviewDuplicates}>
          {td.importBlocked}
        </Alert>
      ) : null}
    </div>
  );
}
