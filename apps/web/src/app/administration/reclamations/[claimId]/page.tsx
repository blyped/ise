import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminClaim } from '@/lib/admin/queries';
import { formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ActionButton } from '../../_components/ActionButton';
import { ReasonAction } from '../../_components/ReasonAction';
import { approveClaimAction, rejectClaimAction, startClaimReviewAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.claims.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** Libelles francais des cles usuelles de `declared_details` (ISE-006). */
const DECLARED_LABELS: Record<string, string> = {
  declared_promotion: 'Promotion déclarée',
  declared_graduation_year: 'Année de sortie déclarée',
  declared_organization: 'Organisation déclarée',
  declared_position: 'Poste déclaré',
  declared_country: 'Pays déclaré',
  declared_city: 'Ville déclarée',
  comment: 'Commentaire du demandeur',
};

function declaredLabel(key: string): string {
  return DECLARED_LABELS[key] ?? key.replaceAll('_', ' ');
}

/**
 * SA-006 — Detail d'une reclamation : elements declares par la personne,
 * elements de CONCORDANCE calcules en base (l'adresse historique ne sort
 * jamais en clair, D-107), decision motivee par les fonctions atomiques
 * `approve_profile_claim` / `reject_profile_claim`.
 */
export default async function AdminClaimDetailPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const access = await requireAdminPermission('profiles.verify');
  const { claimId } = await params;
  const correlationId = newCorrelationId();
  const detail = await loadAdminClaim(claimId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.claims}
      screenTitle={frAdmin.claims.detail.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdmin.claims.detail.title} subtitle={frAdmin.claims.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.claims} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const claim = detail.data;
  const declaredEntries = Object.entries(claim.declaredDetails).filter(
    ([, value]) => typeof value === 'string' || typeof value === 'number',
  );
  const isPending = claim.status === 'submitted' || claim.status === 'under_review';

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.claims} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={`${frAdmin.claims.detail.title} — ${claim.profile.displayName}`}
          subtitle={frAdmin.claims.subtitle}
        >
          <StatusBadge
            status={claim.status}
            label={frAdmin.claims.status[claim.status] ?? claim.status}
          />
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title={frAdmin.claims.detail.claimant}>
          <dl className="flex flex-col gap-5">
            <KeyValue label={frAdmin.claims.detail.accountEmail}>
              {claim.claimant.accountEmail ?? frAdmin.common.none}
            </KeyValue>
            <KeyValue label={frAdmin.claims.columns.method}>
              {frAdmin.claims.method[claim.claimMethod] ?? claim.claimMethod}
            </KeyValue>
            <KeyValue label={frAdmin.claims.columns.submitted}>
              {formatDateTime(claim.submittedAt)}
            </KeyValue>
          </dl>
          <Alert
            variant={claim.claimant.accountEmailConfirmed ? 'success' : 'warning'}
            title={
              claim.claimant.accountEmailConfirmed
                ? frAdmin.claims.detail.accountConfirmed
                : frAdmin.claims.detail.accountNotConfirmed
            }
          />
        </SectionCard>

        <SectionCard title={frAdmin.claims.detail.profile}>
          <dl className="flex flex-col gap-5">
            <KeyValue label={frAdmin.members.detail.identity}>{claim.profile.displayName}</KeyValue>
            <KeyValue label={frAdmin.members.detail.promotion}>
              {claim.profile.promotionName ?? frAdmin.common.none}
            </KeyValue>
            <KeyValue label={frAdmin.members.detail.organization}>
              {claim.profile.organization ?? frAdmin.common.none}
            </KeyValue>
            <KeyValue label={frAdmin.members.detail.location}>
              {[claim.profile.currentCity, claim.profile.country].filter(Boolean).join(', ') ||
                frAdmin.common.none}
            </KeyValue>
            <KeyValue label={frAdmin.claims.detail.emailHint}>
              {claim.profile.hasHistoricalEmail
                ? (claim.profile.emailHint ?? frAdmin.common.none)
                : frAdmin.claims.detail.noHistoricalEmail}
            </KeyValue>
          </dl>
        </SectionCard>
      </div>

      <SectionCard title={frAdmin.claims.detail.declared}>
        {declaredEntries.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.claims.detail.noDeclared}</p>
        ) : (
          <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {declaredEntries.map(([key, value]) => (
              <KeyValue key={key} label={declaredLabel(key)}>
                {String(value)}
              </KeyValue>
            ))}
          </dl>
        )}
      </SectionCard>

      <SectionCard title={frAdmin.claims.detail.concordance}>
        <Alert
          variant={claim.concordance.emailsMatch ? 'success' : 'warning'}
          title={
            claim.concordance.emailsMatch
              ? frAdmin.claims.detail.emailsMatch
              : frAdmin.claims.detail.emailsNoMatch
          }
        />
        <p className="text-body-sm text-text-secondary">
          {claim.concordance.otherPendingClaims > 0
            ? frAdmin.claims.detail.otherPending(claim.concordance.otherPendingClaims)
            : frAdmin.claims.detail.noOtherPending}
        </p>
      </SectionCard>

      <SectionCard title={frAdmin.claims.detail.decision}>
        {isPending ? (
          <div className="flex flex-wrap items-start gap-4">
            {claim.status === 'submitted' ? (
              <ActionButton
                action={startClaimReviewAction}
                fields={{ claimId: claim.claimId }}
                label={frAdmin.claims.detail.startReview}
                variant="secondary"
              />
            ) : null}
            <ReasonAction
              action={approveClaimAction}
              fields={{ claimId: claim.claimId }}
              triggerLabel={frAdmin.claims.detail.approve}
              title={frAdmin.claims.detail.approveTitle}
              description={frAdmin.claims.detail.approveBody}
              confirmLabel={frAdmin.claims.detail.approve}
              withReason={false}
              destructive={false}
            />
            <ReasonAction
              action={rejectClaimAction}
              fields={{ claimId: claim.claimId }}
              triggerLabel={frAdmin.claims.detail.reject}
              title={frAdmin.claims.detail.rejectTitle}
              description={frAdmin.claims.detail.rejectBody}
              confirmLabel={frAdmin.claims.detail.reject}
              reasonLabel={frAdmin.claims.detail.rejectReasonLabel}
              reasonPlaceholder={frAdmin.claims.detail.rejectReasonPlaceholder}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Alert variant="info" title={frAdmin.claims.detail.alreadyDecided} />
            <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {claim.reviewedBy !== null ? (
                <KeyValue label={frAdmin.claims.detail.reviewedBy}>{claim.reviewedBy}</KeyValue>
              ) : null}
              {claim.reviewedAt !== null ? (
                <KeyValue label={frAdmin.claims.columns.status}>
                  {formatDateTime(claim.reviewedAt)}
                </KeyValue>
              ) : null}
              {claim.reason !== null ? (
                <KeyValue label={frAdmin.claims.detail.reason}>{claim.reason}</KeyValue>
              ) : null}
            </dl>
          </div>
        )}
      </SectionCard>
    </div>,
  );
}
