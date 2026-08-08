import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, CardHeader, CardTitle, EmptyState } from '@ise/ui-web';
import { frSupport } from '@/i18n/support';
import { ROUTES } from '@/lib/routes';
import { SUPPORT_ROUTES } from '@/lib/routes/support';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyReports, loadReportReasons } from '@/lib/queries/support';
import { formatDate } from '@/lib/messaging-view';
import { AppShell } from '@/components/layout/AppShell';
import { ReportForm } from '@/components/support/ReportForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSupport.report.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const TARGET_TYPES = [
  'profile',
  'conversation',
  'message',
  'network_call',
  'opportunity',
  'project',
  'news_post',
  'event',
  'community',
  'comment',
] as const;

/**
 * ISE-100 — signalement.
 *
 * L'objet signale est TOUJOURS designe par l'URL (`?type=&objet=`) : on
 * signale un element precis, depuis l'element lui-meme. Il n'y a pas de
 * formulaire ou l'on choisirait librement une cible — un signalement
 * sans objet identifie ne serait pas examinable.
 *
 * D-66 — les motifs proposes sont ceux de `report_reasons` applicables
 * au type d'objet. Le referentiel est unique, le filtrage contextuel.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const params = await searchParams;
  const rawType = params['type'];
  const rawTarget = params['objet'];
  const targetType =
    typeof rawType === 'string' && (TARGET_TYPES as readonly string[]).includes(rawType)
      ? rawType
      : null;
  const targetId = typeof rawTarget === 'string' && rawTarget.length > 0 ? rawTarget : null;

  const correlationId = newCorrelationId();
  const [viewer, reasons, reports] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    targetType === null ? Promise.resolve([]) : loadReportReasons(targetType),
    loadMyReports(correlationId),
  ]);

  return (
    <AppShell
      currentPath={SUPPORT_ROUTES.help}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frSupport.report.title}</h1>
          <p className="text-body text-text-secondary">{frSupport.report.subtitle}</p>
        </div>

        {targetType === null || targetId === null ? (
          <EmptyState
            title={frSupport.report.missingTarget}
            description="Ouvrez le profil, la conversation ou le contenu concerné et utilisez son action « Signaler » : le contexte est ainsi conservé automatiquement."
            action={
              <Link href={SUPPORT_ROUTES.help} className={LINK}>
                {frSupport.title}
              </Link>
            }
          />
        ) : (
          <Card>
            <ReportForm
              targetType={targetType}
              targetId={targetId}
              targetLabel={targetId}
              reasons={reasons}
            />
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle as="h2">{frSupport.report.myReportsTitle}</CardTitle>
          </CardHeader>
          {!reports.ok || reports.data.length === 0 ? (
            <p className="text-body-sm text-text-muted">{frSupport.report.myReportsEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {reports.data.map((row) => (
                <li
                  key={row.reportId}
                  className="border-border flex flex-wrap items-center gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <Badge tone="neutral">
                    {frSupport.report.targetType[row.targetType] ?? row.targetType}
                  </Badge>
                  <span className="text-body-sm text-text-secondary">
                    {row.reasonName ?? row.reasonCode}
                  </span>
                  <Badge tone={row.status === 'resolved' ? 'success' : 'info'}>
                    {frSupport.report.status[row.status] ?? row.status}
                  </Badge>
                  <span className="text-caption text-text-muted">{formatDate(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
