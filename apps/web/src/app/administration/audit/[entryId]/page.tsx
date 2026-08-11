import Link from 'next/link';
import { Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { ADMIN_DATA_ROUTES } from '@/lib/routes/admin-data';
import { loadAuditEntry } from '@/lib/admin-data/queries';
import { AdminPageHeader } from '../../_components/AdminPageHeader';

export const dynamic = 'force-dynamic';

const t = frAdminData.audit;

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-text-muted font-medium">{label}</dt>
      <dd className="text-body-sm text-text-primary">{children}</dd>
    </div>
  );
}

/**
 * SA-050 — Détail d'une entrée du journal, à des fins de conformité.
 *
 * `admin_get_audit_entry` (0083) renvoie EXACTEMENT les mêmes colonnes que
 * chaque ligne de `admin_read_audit_log` (SA-049) : cette fiche n'ajoute
 * donc aucune donnée que la liste ne porte déjà. Ce qui la distingue est
 * comportemental, pas informationnel : la consulter journalise un
 * évènement `audit.entry_read` DÉDIÉ (distinct de `audit.read`, qui ne
 * marque qu'un parcours de liste) — la preuve, pour un contrôle de
 * conformité ultérieur, qu'un administrateur a explicitement REVU cette
 * entrée précise, et pas seulement fait défiler la liste (D-158,
 * docs/decisions.md).
 */
export default async function AdminAuditEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId: rawEntryId } = await params;
  const entryId = Number.parseInt(rawEntryId, 10);
  const correlationId = newCorrelationId();

  const shell = (children: React.ReactNode) => (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.entry.title}
        backHref={ADMIN_DATA_ROUTES.audit}
        backLabel={t.entry.backToJournal}
      />
      {children}
    </div>
  );

  if (!Number.isFinite(entryId) || !Number.isInteger(entryId)) {
    return shell(<EmptyState title={t.entry.notFound} description={frAdminData.common.emptyGeneric} />);
  }

  const entry = await loadAuditEntry(entryId, correlationId);

  if (!entry.ok) {
    if (entry.error.code === 'not_found') {
      return shell(
        <EmptyState title={t.entry.notFound} description={frAdminData.common.emptyGeneric} />,
      );
    }
    return shell(
      <ErrorState
        title={frAdminData.common.loadError}
        description={entry.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  if (entry.data === null) {
    return shell(<EmptyState title={t.entry.notFound} description={frAdminData.common.emptyGeneric} />);
  }

  const data = entry.data;

  return shell(
    <Card className="flex flex-col gap-6">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle as="h2">{data.action}</CardTitle>
          <Badge tone={resultTone(data.result)}>{t.result[data.result] ?? data.result}</Badge>
        </div>
      </CardHeader>

      <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Row label={t.colDate}>{formatDateTime(data.createdAt)}</Row>
        <Row label={t.entry.actor}>
          {data.actorName ?? (t.actorKind[data.actorKind] ?? data.actorKind)}
          {data.actorProfileId !== null ? (
            <span className="text-text-muted"> · {data.actorProfileId}</span>
          ) : null}
        </Row>
        <Row label={t.entry.action}>
          <span className="font-mono">{data.action}</span>
        </Row>
        <Row label={t.entry.object}>
          {data.objectType}
          {data.objectId !== null ? <span className="text-text-muted"> · {data.objectId}</span> : null}
        </Row>
        {data.errorCode !== null ? (
          <Row label={t.entry.errorCode}>
            <span className="font-mono">{data.errorCode}</span>
          </Row>
        ) : null}
        {data.correlationId !== null ? (
          <Row label={t.entry.correlation}>
            <span className="font-mono">{data.correlationId}</span>
          </Row>
        ) : null}
        {data.requestIp !== null ? <Row label={t.entry.ip}>{data.requestIp}</Row> : null}
        {data.userAgent !== null ? (
          <Row label={t.entry.userAgent}>
            <span className="break-all">{data.userAgent}</span>
          </Row>
        ) : null}
      </dl>

      <div className="flex flex-col gap-1">
        <p className="text-caption text-text-muted font-medium">{t.entry.context}</p>
        {Object.keys(data.context).length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdminData.common.none}</p>
        ) : (
          <pre className="border-border bg-surface-muted overflow-x-auto rounded-base border p-4 text-caption text-text-primary">
            {JSON.stringify(data.context, null, 2)}
          </pre>
        )}
      </div>

      <p className="text-caption text-text-muted">{t.readOnlyNote}</p>

      <div>
        <Link href={ADMIN_DATA_ROUTES.audit} className="text-body-sm text-primary font-medium hover:underline">
          {t.entry.backToJournal}
        </Link>
      </div>
    </Card>,
  );
}
