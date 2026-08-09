import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { INTERNSHIP_ROUTES, internshipApplicationRoute } from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyInternshipApplications } from '@/lib/queries/internships';
import { formatDate } from '@/lib/collaborate-view';
import { internshipStatusLabel } from '@/lib/collaborate-status';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  LINK_BUTTON,
  LoadMoreLink,
  PRIMARY_BUTTON,
  PageHeader,
  TabLinks,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.tracking.listTitle };

const GROUPS = ['in_progress', 'to_prepare', 'closed', 'all'] as const;
type Group = (typeof GROUPS)[number];

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  to_prepare: 'neutral',
  submitted: 'info',
  reviewed: 'info',
  interview: 'warning',
  offered: 'success',
  accepted: 'success',
  declined: 'error',
  withdrawn: 'neutral',
};

/**
 * ISE-076 — Mes candidatures de stage.
 *
 * Un carnet de bord STRICTEMENT personnel (rls.md §10.3) : chaque ligne
 * n'existe que parce que l'élève l'a déclarée. Aucun statut ne vient
 * d'une organisation extérieure.
 */
export default async function InternshipApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const query = await searchParams;
  const feedback = readFeedback(query);
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const rawGroup = one(query['onglet']) ?? 'in_progress';
  const group: Group = (GROUPS as readonly string[]).includes(rawGroup)
    ? (rawGroup as Group)
    : 'in_progress';
  const cursor = unsealCursor(one(query['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, page] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMyInternshipApplications(group, cursor, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const crumbs = (
    <Breadcrumb
      label={frInternships.common.breadcrumb}
      items={[
        { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
        { label: frPromotions.hub.internshipsTitle, href: INTERNSHIP_ROUTES.home },
        { label: frInternships.tracking.listTitle, href: null },
      ]}
    />
  );

  if (!page.ok && page.error.code === 'not_authorized') {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frInternships.common.studentsOnlyTitle}
          description={frInternships.common.studentsOnlyBody}
          action={
            <Link href={INTERNSHIP_ROUTES.alumni} className={PRIMARY_BUTTON}>
              {frInternships.common.studentsOnlyAction}
            </Link>
          }
        />
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frInternships.tracking.listTitle}
        subtitle={frInternships.tracking.listSubtitle}
      />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} />

      <TabLinks
        label={frInternships.tracking.listTitle}
        current={group}
        items={[
          {
            id: 'in_progress',
            label: frInternships.tracking.tabInProgress,
            href: INTERNSHIP_ROUTES.applications,
          },
          {
            id: 'to_prepare',
            label: frInternships.tracking.tabToPrepare,
            href: `${INTERNSHIP_ROUTES.applications}?onglet=to_prepare`,
          },
          {
            id: 'closed',
            label: frInternships.tracking.tabClosed,
            href: `${INTERNSHIP_ROUTES.applications}?onglet=closed`,
          },
          {
            id: 'all',
            label: frInternships.tracking.tabAll,
            href: `${INTERNSHIP_ROUTES.applications}?onglet=all`,
          },
        ]}
      />

      {!page.ok ? (
        <ErrorState
          title={frInternships.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      ) : page.data.rows.length === 0 ? (
        <EmptyState
          title={frInternships.tracking.listEmptyTitle}
          description={frInternships.tracking.listEmptyBody}
          action={
            <Link href={INTERNSHIP_ROUTES.home} className={LINK_BUTTON}>
              {frInternships.home.tabAll}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-5">
          {page.data.rows.map((row) => (
            <li key={row.applicationId}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <p className="text-body text-text-primary font-semibold">{row.positionTitle}</p>
                    {row.organization === null ? null : (
                      <p className="text-caption text-text-secondary">{row.organization}</p>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                    {internshipStatusLabel(row.status)}
                  </Badge>
                </div>

                {row.submittedOn === null ? null : (
                  <p className="text-caption text-text-secondary">
                    {frInternships.status.submitted} · {formatDate(row.submittedOn)}
                  </p>
                )}

                {row.nextAction === null ? null : (
                  <p className="text-body-sm text-text-secondary">
                    <span className="font-medium">{frInternships.tracking.nextTitle} :</span>{' '}
                    {row.nextAction}
                    {row.nextActionDueOn === null
                      ? ''
                      : ` — ${formatDate(row.nextActionDueOn) ?? ''}`}
                  </p>
                )}

                <p className="pt-1">
                  <Link
                    href={internshipApplicationRoute(row.applicationId)}
                    className={LINK_BUTTON}
                  >
                    {frInternships.offer.seeApplication}
                  </Link>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <LoadMoreLink
        href={`${INTERNSHIP_ROUTES.applications}?onglet=${group}`}
        label={frInternships.tracking.loadMore}
        nextCursor={page.ok ? page.data.nextCursor : null}
      />
    </div>,
  );
}
