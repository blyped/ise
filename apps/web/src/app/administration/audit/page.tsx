import Link from 'next/link';
import { Alert, Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { ADMIN_DATA_ROUTES, auditEntryRoute } from '@/lib/routes/admin-data';
import { loadAuditLog, loadAuditOverview, type AuditLogFilters } from '@/lib/admin-data/queries';
import { isUuid } from '@/lib/network-view';
import { paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminPageHeader } from '../_components/AdminPageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.audit.title };

const t = frAdminData.audit;

const RESULTS = ['success', 'failure', 'denied'] as const;

function formatDateTime(iso: string | null): string {
  if (iso === null) return frAdminData.common.none;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return frAdminData.common.none;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function resultTone(result: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (result === 'success') return 'success';
  if (result === 'failure') return 'error';
  if (result === 'denied') return 'warning';
  return 'neutral';
}

function paramOneOf(params: SearchParams, key: string, allowed: readonly string[]): string | null {
  const value = paramValue(params, key);
  return value !== null && allowed.includes(value) ? value : null;
}

function buildFilterQuery(filters: {
  action: string | null;
  type: string | null;
  resultat: string | null;
  acteur: string | null;
  du: string | null;
  au: string | null;
}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value.length > 0) query.set(key, value);
  }
  const qs = query.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

/**
 * SA-049 — Journal d'audit : liste filtrable (acteur, action, type d'objet,
 * résultat, période), pagination par curseur composite (D-44). Lecture
 * seule absolue : `admin_read_audit_log` (0083, façade de
 * `private.read_audit_log`) ne fait qu'interroger `private.audit_log` —
 * aucune écriture hormis l'auto-journalisation de sa propre consultation
 * (§40). Les options des filtres « action » et « type d'objet » viennent
 * de `admin_audit_overview()` : uniquement des valeurs RÉELLEMENT
 * présentes dans le journal, jamais un vocabulaire inventé.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const action = paramValue(params, 'action');
  const objectType = paramValue(params, 'type');
  const result = paramOneOf(params, 'resultat', RESULTS);
  const actorRaw = paramValue(params, 'acteur');
  const actorProfileId = actorRaw !== null && isUuid(actorRaw) ? actorRaw : null;
  const du = paramValue(params, 'du');
  const au = paramValue(params, 'au');
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const filters: AuditLogFilters = {
    action,
    objectType,
    result,
    actorProfileId,
    from: du !== null ? `${du}T00:00:00.000Z` : null,
    to: au !== null ? `${au}T23:59:59.999Z` : null,
  };

  const [page, overview] = await Promise.all([
    loadAuditLog(filters, cursor, correlationId),
    loadAuditOverview(correlationId),
  ]);

  const filterQuery = buildFilterQuery({
    action,
    type: objectType,
    resultat: result,
    acteur: actorRaw,
    du,
    au,
  });

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      <Alert variant="info" title={t.title}>
        {t.readOnlyNote}
      </Alert>

      {overview.ok ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: t.kpiActions7d, value: overview.data.actions7d },
            { label: t.kpiFailures7d, value: overview.data.failures7d },
            { label: t.kpiActors7d, value: overview.data.distinctActors7d },
            { label: t.kpiTotal, value: overview.data.totalEntries },
          ].map((kpi) => (
            <Card key={kpi.label} className="flex flex-col gap-1 p-4">
              <p className="text-caption text-text-muted">{kpi.label}</p>
              <p className="text-h3 text-text-primary font-semibold tabular-nums">{kpi.value}</p>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <form method="get" action={ADMIN_DATA_ROUTES.audit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="filtre-action" className="text-caption text-text-muted font-medium">
              {t.filterAction}
            </label>
            <select
              id="filtre-action"
              name="action"
              defaultValue={action ?? ''}
              className="rounded-base border-border bg-surface text-body-sm text-text-primary h-[44px] min-w-[200px] border px-4"
            >
              <option value="">{t.allOption}</option>
              {(overview.ok ? overview.data.actions : []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filtre-type" className="text-caption text-text-muted font-medium">
              {t.filterObjectType}
            </label>
            <select
              id="filtre-type"
              name="type"
              defaultValue={objectType ?? ''}
              className="rounded-base border-border bg-surface text-body-sm text-text-primary h-[44px] min-w-[200px] border px-4"
            >
              <option value="">{t.allOption}</option>
              {(overview.ok ? overview.data.objectTypes : []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filtre-resultat" className="text-caption text-text-muted font-medium">
              {t.filterResult}
            </label>
            <select
              id="filtre-resultat"
              name="resultat"
              defaultValue={result ?? ''}
              className="rounded-base border-border bg-surface text-body-sm text-text-primary h-[44px] min-w-[160px] border px-4"
            >
              <option value="">{t.allOption}</option>
              {RESULTS.map((value) => (
                <option key={value} value={value}>
                  {t.result[value] ?? value}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-[220px] flex-col gap-1">
            <label htmlFor="filtre-acteur" className="text-caption text-text-muted font-medium">
              {t.filterActor}
            </label>
            <input
              id="filtre-acteur"
              name="acteur"
              type="text"
              defaultValue={actorRaw ?? ''}
              placeholder="UUID du profil"
              className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted h-[44px] border px-4 font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filtre-du" className="text-caption text-text-muted font-medium">
              {t.filterFrom}
            </label>
            <input
              id="filtre-du"
              name="du"
              type="date"
              defaultValue={du ?? ''}
              className="rounded-base border-border bg-surface text-body-sm text-text-primary h-[44px] border px-4"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filtre-au" className="text-caption text-text-muted font-medium">
              {t.filterTo}
            </label>
            <input
              id="filtre-au"
              name="au"
              type="date"
              defaultValue={au ?? ''}
              className="rounded-base border-border bg-surface text-body-sm text-text-primary h-[44px] border px-4"
            />
          </div>

          <button
            type="submit"
            className="rounded-base bg-primary hover:bg-primary-hover text-body-sm inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white"
          >
            {t.filterApply}
          </button>
          <Link
            href={ADMIN_DATA_ROUTES.audit}
            className="text-body-sm text-primary inline-flex h-[44px] items-center font-medium hover:underline"
          >
            {t.filterReset}
          </Link>
        </form>
      </Card>

      {!page.ok ? (
        <ErrorState
          title={frAdminData.common.loadError}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      ) : page.data.rows.length === 0 ? (
        <EmptyState title={t.empty} description={frAdminData.common.emptyGeneric} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  <th scope="col" className="py-2 pr-3">{t.colDate}</th>
                  <th scope="col" className="py-2 pr-3">{t.colActor}</th>
                  <th scope="col" className="py-2 pr-3">{t.colAction}</th>
                  <th scope="col" className="py-2 pr-3">{t.colObject}</th>
                  <th scope="col" className="py-2 pr-3">{t.colResult}</th>
                  <th scope="col" className="py-2">{t.colDetail}</th>
                </tr>
              </thead>
              <tbody>
                {page.data.rows.map((entry) => (
                  <tr key={entry.id} className="border-border border-b align-top last:border-0">
                    <td className="text-body-sm text-text-secondary py-3 pr-3 whitespace-nowrap tabular-nums">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="text-body-sm text-text-primary py-3 pr-3">
                      {entry.actorName ?? (t.actorKind[entry.actorKind] ?? entry.actorKind)}
                    </td>
                    <td className="text-body-sm text-text-primary py-3 pr-3 font-mono">
                      {entry.action}
                    </td>
                    <td className="text-body-sm text-text-secondary py-3 pr-3">
                      {entry.objectType}
                      {entry.objectId !== null ? (
                        <span className="text-text-muted"> · {entry.objectId}</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={resultTone(entry.result)}>{t.result[entry.result] ?? entry.result}</Badge>
                    </td>
                    <td className="py-3">
                      <Link
                        href={auditEntryRoute(entry.id)}
                        className="text-body-sm text-primary font-medium hover:underline"
                      >
                        {t.see}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-caption text-text-muted">{t.shownCount(page.data.rows.length)}</p>
            {page.data.nextCursor !== null ? (
              <Link
                href={`${ADMIN_DATA_ROUTES.audit}${filterQuery}${filterQuery.length > 0 ? '&' : '?'}curseur=${encodeURIComponent(page.data.nextCursor)}`}
                className="text-body-sm text-primary font-medium hover:underline"
              >
                {frAdminData.common.loadMore}
              </Link>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}
