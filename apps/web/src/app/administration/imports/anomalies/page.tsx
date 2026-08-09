import Link from 'next/link';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { loadDataQualityIssues } from '@/lib/admin-data/queries';
import { ADMIN_DATA_ROUTES, importDetailRoute } from '@/lib/routes/admin-data';
import { AdminPageHeader } from '../_components/AdminPageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.imports.issues.title };

const t = frAdminData.imports.issues;

/**
 * SA-040 (onglet Anomalies) — Toutes les anomalies de qualité ouvertes,
 * tous lots confondus. Chaque ligne porte son code machine (D-102) et
 * l'action recommandée ; rien n'est corrigé automatiquement.
 */
export default async function ImportIssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const rawSeverity = query['niveau'];
  const severity =
    typeof rawSeverity === 'string' && ['error', 'warning', 'info'].includes(rawSeverity)
      ? rawSeverity
      : null;

  const correlationId = newCorrelationId();
  const issues = await loadDataQualityIssues(correlationId, null, severity);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        backHref={ADMIN_DATA_ROUTES.imports}
        backLabel={frAdminData.imports.title}
      />

      <nav aria-label={t.colSeverity} className="flex flex-wrap gap-2">
        {[null, 'error', 'warning', 'info'].map((level) => {
          const active = severity === level;
          const href =
            level === null
              ? ADMIN_DATA_ROUTES.importIssues
              : `${ADMIN_DATA_ROUTES.importIssues}?niveau=${level}`;
          return (
            <Link
              key={level ?? 'all'}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                'text-caption inline-flex min-h-[36px] items-center rounded-full border px-3 ' +
                (active
                  ? 'border-active-blue text-active-blue font-medium'
                  : 'border-border text-text-secondary hover:underline')
              }
            >
              {level === null
                ? frAdminData.imports.detail.rowsFilterAll
                : (t.severity[level] ?? level)}
            </Link>
          );
        })}
      </nav>

      {!issues.ok ? (
        <ErrorState
          title={frAdminData.common.loadError}
          description={issues.error.userMessage}
          correlationId={correlationId}
        />
      ) : issues.data.length === 0 ? (
        <EmptyState title={t.empty} description={frAdminData.common.accessNote} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  <th scope="col" className="py-2 pr-3">
                    {t.colSeverity}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colIssue}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colRow}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.colProfile}
                  </th>
                  <th scope="col" className="py-2">
                    {t.colAction}
                  </th>
                </tr>
              </thead>
              <tbody>
                {issues.data.map((issue) => (
                  <tr key={issue.id} className="border-border border-b align-top last:border-0">
                    <td className="py-2 pr-3">
                      <Badge
                        tone={
                          issue.severity === 'error'
                            ? 'error'
                            : issue.severity === 'warning'
                              ? 'warning'
                              : 'info'
                        }
                      >
                        {t.severity[issue.severity] ?? issue.severity}
                      </Badge>
                    </td>
                    <td className="text-body-sm text-text-primary py-2 pr-3">
                      {t.code[issue.issueCode] ?? issue.issueCode}
                      {issue.fieldName !== null ? (
                        <span className="text-caption text-text-muted"> ({issue.fieldName})</span>
                      ) : null}
                    </td>
                    <td className="text-body-sm text-text-secondary py-2 pr-3 tabular-nums">
                      {issue.batchId !== null && issue.rowNumber !== null ? (
                        <Link
                          href={importDetailRoute(issue.batchId)}
                          className="text-primary hover:underline"
                        >
                          {issue.rowNumber}
                        </Link>
                      ) : (
                        frAdminData.common.none
                      )}
                    </td>
                    <td className="text-body-sm text-text-secondary py-2 pr-3">
                      {issue.profileName ?? frAdminData.common.none}
                    </td>
                    <td className="text-body-sm text-text-secondary py-2">
                      {issue.recommendedAction !== null
                        ? (t.action[issue.recommendedAction] ?? issue.recommendedAction)
                        : frAdminData.common.none}
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
