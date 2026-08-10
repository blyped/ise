import Link from 'next/link';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminOpportunities } from '@/i18n/admin-opportunities';
import {
  ADMIN_ROUTES,
  adminMemberRoute,
  adminOpportunityCandidatesRoute,
  adminOpportunityClosureRoute,
} from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminOpportunity } from '@/lib/admin/queries';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ReasonAction } from '../../_components/ReasonAction';
import { moderateOpportunityAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.opportunities.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-020 — Detail d'une opportunite pour validation : contenu, source
 * (URL verifiable), historique des decisions, approbation / rejet motive
 * via `moderate_opportunity`. Donne aussi acces au suivi des
 * candidatures (SA-021) et a la cloture / bilan d'impact (SA-022).
 */
export default async function AdminOpportunityDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const access = await requireAdminPermission('opportunities.manage');
  const { opportunityId } = await params;
  const correlationId = newCorrelationId();

  const detail = await loadAdminOpportunity(opportunityId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.opportunities}
      screenTitle={frAdmin.opportunities.detail.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader
          title={frAdmin.opportunities.detail.title}
          subtitle={frAdmin.opportunities.subtitle}
        />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.opportunities} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const opportunity = detail.data;
  const isPending = opportunity.moderationStatus === 'pending';

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.opportunities} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={opportunity.title}
          subtitle={opportunity.summary ?? frAdmin.opportunities.subtitle}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={opportunity.moderationStatus}
              label={
                frAdmin.opportunities.moderation[opportunity.moderationStatus] ??
                opportunity.moderationStatus
              }
            />
            <StatusBadge
              status={opportunity.status}
              label={frAdmin.opportunities.status[opportunity.status] ?? opportunity.status}
            />
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdminOpportunities.detail.manageTitle}>
        <div className="flex flex-wrap gap-5">
          <Link href={adminOpportunityCandidatesRoute(opportunity.opportunityId)} className={BACK_LINK}>
            {frAdminOpportunities.nav.candidates} →
          </Link>
          {opportunity.status === 'active' ||
          opportunity.status === 'paused' ||
          opportunity.status === 'expired' ? (
            <Link href={adminOpportunityClosureRoute(opportunity.opportunityId)} className={BACK_LINK}>
              {frAdminOpportunities.nav.closure} →
            </Link>
          ) : null}
        </div>
      </SectionCard>

      {opportunity.openReports > 0 ? (
        <Alert
          variant="warning"
          title={frAdmin.opportunities.detail.openReports(opportunity.openReports)}
        />
      ) : null}

      <SectionCard title={frAdmin.opportunities.detail.content}>
        <p className="text-body-sm text-text-primary whitespace-pre-wrap">
          {opportunity.description}
        </p>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdmin.opportunities.detail.organization}>
            {opportunity.organization ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.opportunities.detail.author}>
            {opportunity.authorProfileId !== null && opportunity.authorName !== null ? (
              <Link href={adminMemberRoute(opportunity.authorProfileId)} className={BACK_LINK}>
                {opportunity.authorName}
              </Link>
            ) : (
              (opportunity.authorName ?? frAdmin.common.none)
            )}
          </KeyValue>
          <KeyValue label={frAdmin.opportunities.detail.source}>
            {frAdmin.opportunities.sourceType[opportunity.sourceType ?? ''] ??
              opportunity.sourceType ??
              frAdmin.common.none}
          </KeyValue>
          {opportunity.sourceUrl !== null ? (
            <KeyValue label={frAdmin.opportunities.detail.sourceUrl}>
              <a
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={BACK_LINK}
              >
                {opportunity.sourceUrl}
              </a>
            </KeyValue>
          ) : null}
          <KeyValue label={frAdmin.opportunities.detail.sector}>
            {opportunity.sector ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.opportunities.detail.location}>
            {[opportunity.city, opportunity.country].filter(Boolean).join(', ') ||
              frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.opportunities.detail.deadline}>
            {formatDate(opportunity.deadline)}
          </KeyValue>
          <KeyValue label={frAdmin.opportunities.detail.positions}>
            {opportunity.positionsCount ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.opportunities.detail.applicationMode}>
            {frAdmin.opportunities.detail.applicationModes[opportunity.applicationMode] ??
              opportunity.applicationMode}
          </KeyValue>
        </dl>
      </SectionCard>

      <SectionCard title={frAdmin.opportunities.detail.historyTitle}>
        {opportunity.moderationHistory.length === 0 ? (
          <p className="text-body-sm text-text-secondary">
            {frAdmin.opportunities.detail.noHistory}
          </p>
        ) : (
          <ul
            className="flex flex-col gap-3"
            aria-label={frAdmin.opportunities.detail.historyTitle}
          >
            {opportunity.moderationHistory.map((entry, index) => (
              <li key={index} className="border-border rounded-lg border p-4">
                <p className="text-body-sm text-text-primary font-semibold">
                  {frAdmin.opportunities.moderation[entry.decision ?? ''] ??
                    entry.decision ??
                    frAdmin.common.none}
                </p>
                {entry.note !== null ? (
                  <p className="text-body-sm text-text-secondary mt-1">{entry.note}</p>
                ) : null}
                <p className="text-caption text-text-muted mt-2">
                  {entry.actorName ?? frAdmin.common.none} — {formatDateTime(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={frAdmin.opportunities.detail.decisionTitle}>
        <div className="flex flex-wrap items-start gap-4">
          {isPending || opportunity.moderationStatus === 'rejected' ? (
            <ReasonAction
              action={moderateOpportunityAction}
              fields={{ opportunityId: opportunity.opportunityId, decision: 'approved' }}
              triggerLabel={frAdmin.opportunities.detail.approve}
              title={frAdmin.opportunities.detail.approveTitle}
              description={frAdmin.opportunities.detail.approveBody}
              confirmLabel={frAdmin.opportunities.detail.approve}
              withReason={false}
              destructive={false}
            />
          ) : null}
          {isPending || opportunity.moderationStatus === 'approved' ? (
            <ReasonAction
              action={moderateOpportunityAction}
              fields={{ opportunityId: opportunity.opportunityId, decision: 'rejected' }}
              triggerLabel={frAdmin.opportunities.detail.reject}
              title={frAdmin.opportunities.detail.rejectTitle}
              description={frAdmin.opportunities.detail.rejectBody}
              confirmLabel={frAdmin.opportunities.detail.reject}
              reasonLabel={frAdmin.opportunities.detail.reasonLabel}
              reasonPlaceholder={frAdmin.opportunities.detail.reasonPlaceholder}
            />
          ) : null}
        </div>
      </SectionCard>
    </div>,
  );
}
