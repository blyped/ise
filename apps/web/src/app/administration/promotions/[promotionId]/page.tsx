import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminCampaigns } from '@/i18n/admin-campaigns';
import { ADMIN_ROUTES, adminCampaignsRoute, adminPromotionInvitationsRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminPromotion } from '@/lib/admin/queries';
import { formatDate } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ActionButton } from '../../_components/ActionButton';
import { ReasonAction } from '../../_components/ReasonAction';
import { PromotionForm } from '../PromotionForm';
import {
  revealContactHintAction,
  reviewMissingMemberAction,
  setPromotionManagerAction,
  upsertPromotionAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.promotions.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

const MANAGER_ROLES = ['delegate', 'co_delegate', 'referent'] as const;

/**
 * SA-009 — Detail d'une promotion : decomptes reels, edition, delegues
 * (le role `promotion_manager` est synchronise par la base), invitations
 * (decomptes reels — aucune campagne fictive) avec liens vers le suivi
 * detaille (SA-011) et les campagnes d'invitation (SA-012->015), membres
 * manquants signales (ISE-069) avec indice de contact lisible UNIQUEMENT
 * ici, lecture journalisee (`admin_get_missing_member_contact_hint`, 0077).
 */
export default async function AdminPromotionDetailPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const access = await requireAdminPermission('promotions.manage');
  const { promotionId: rawId } = await params;
  const promotionId = Number.parseInt(rawId, 10);
  const correlationId = newCorrelationId();

  const detail = Number.isNaN(promotionId)
    ? null
    : await loadAdminPromotion(promotionId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdmin.promotions.title}
    >
      {children}
    </AdminShell>
  );

  if (detail === null || !detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdmin.promotions.title} subtitle={frAdmin.promotions.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail !== null && !detail.ok ? { description: detail.error.userMessage } : {})}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.promotions} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const promotion = detail.data;
  const pendingMissing = promotion.missingMembers.filter(
    (entry) => entry.status === 'submitted' || entry.status === 'reviewing',
  );
  const decidedMissing = promotion.missingMembers.filter(
    (entry) => entry.status !== 'submitted' && entry.status !== 'reviewing',
  );

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.promotions} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={promotion.name}
          subtitle={promotion.description ?? frAdmin.promotions.subtitle}
        >
          <StatusBadge
            status={promotion.status}
            label={frAdmin.promotions.status[promotion.status] ?? promotion.status}
          />
        </PageHeader>
      </div>

      <SectionCard title={frAdmin.promotions.detail.counts}>
        <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <KeyValue label={frAdmin.promotions.detail.totalProfiles}>
            {promotion.counts.totalProfiles}
          </KeyValue>
          <KeyValue label={frAdmin.promotions.detail.activeMembers}>
            {promotion.counts.activeMembers}
          </KeyValue>
          <KeyValue label={frAdmin.promotions.detail.unclaimed}>
            {promotion.counts.unclaimedProfiles}
          </KeyValue>
          <KeyValue label={frAdmin.promotions.detail.verified}>
            {promotion.counts.verifiedProfiles}
          </KeyValue>
        </dl>
        <Link
          href={`${ADMIN_ROUTES.members}?promotion=${promotion.promotionId}`}
          className={BACK_LINK}
        >
          {frAdmin.members.title} →
        </Link>
      </SectionCard>

      <SectionCard title={frAdmin.promotions.form.editTitle}>
        <PromotionForm
          action={upsertPromotionAction}
          defaults={{
            promotionId: promotion.promotionId,
            name: promotion.name,
            graduationYear: promotion.graduationYear,
            description: promotion.description ?? '',
            estimatedSize: promotion.estimatedSize,
            status: promotion.status,
          }}
        />
      </SectionCard>

      <SectionCard title={frAdmin.promotions.detail.managersTitle}>
        {promotion.managers.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.promotions.detail.noManagers}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={frAdmin.promotions.detail.managersTitle}>
            {promotion.managers.map((manager) => (
              <li
                key={manager.managerId}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-body-sm text-text-primary font-semibold">
                    {manager.displayName}
                  </p>
                  <p className="text-caption text-text-muted">
                    {frAdmin.promotions.detail.managerRole[manager.managerRole] ??
                      manager.managerRole}{' '}
                    ·{' '}
                    {manager.active
                      ? frAdmin.promotions.detail.managerActive
                      : frAdmin.promotions.detail.managerInactive}
                  </p>
                </div>
                {manager.active ? (
                  <ReasonAction
                    action={setPromotionManagerAction}
                    fields={{
                      promotionId: String(promotion.promotionId),
                      profileId: manager.profileId,
                      managerRole: manager.managerRole,
                      active: 'false',
                    }}
                    triggerLabel={frAdmin.promotions.detail.removeManager}
                    title={frAdmin.promotions.detail.removeManagerTitle}
                    description={frAdmin.promotions.detail.removeManagerBody}
                    confirmLabel={frAdmin.promotions.detail.removeManager}
                    withReason={false}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <ReasonAction
          action={setPromotionManagerAction}
          fields={{ promotionId: String(promotion.promotionId), active: 'true' }}
          triggerLabel={frAdmin.promotions.detail.addManager}
          title={frAdmin.promotions.detail.addManager}
          description={frAdmin.promotions.detail.addManagerBody}
          confirmLabel={frAdmin.promotions.detail.addManager}
          withReason={false}
          destructive={false}
          input={{
            name: 'profileId',
            label: frAdmin.promotions.detail.addManagerProfileId,
            hint: frAdmin.promotions.detail.addManagerProfileHelp,
          }}
          select={{
            name: 'managerRole',
            label: frAdmin.promotions.detail.addManagerRole,
            options: MANAGER_ROLES.map((value) => ({
              value,
              label: frAdmin.promotions.detail.managerRole[value] ?? value,
            })),
          }}
        />
      </SectionCard>

      <SectionCard title={frAdmin.promotions.detail.invitationsTitle}>
        {promotion.invitations.length === 0 ? (
          <p className="text-body-sm text-text-secondary">
            {frAdmin.promotions.detail.noInvitations}
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-5 md:grid-cols-5">
            {promotion.invitations.map((entry) => (
              <KeyValue
                key={entry.key}
                label={frAdmin.promotions.detail.invitations[entry.key] ?? entry.key}
              >
                {entry.value}
              </KeyValue>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap gap-5">
          <Link href={adminPromotionInvitationsRoute(promotion.promotionId)} className={BACK_LINK}>
            {frAdminCampaigns.nav.invitations} →
          </Link>
          <Link href={adminCampaignsRoute(promotion.promotionId)} className={BACK_LINK}>
            {frAdminCampaigns.nav.campaigns} →
          </Link>
        </div>
      </SectionCard>

      <SectionCard title={frAdmin.promotions.detail.missingTitle}>
        {promotion.missingMembers.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.promotions.detail.noMissing}</p>
        ) : (
          <>
            <Alert variant="info" title={frAdmin.contactHint.body} />
            <ul className="flex flex-col gap-3" aria-label={frAdmin.promotions.detail.missingTitle}>
              {[...pendingMissing, ...decidedMissing].map((entry) => (
                <li key={entry.suggestionId} className="border-border rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-body-sm text-text-primary font-semibold">
                        {entry.firstName} {entry.lastName}
                      </p>
                      <p className="text-caption text-text-muted">
                        {frAdmin.promotions.detail.missingBy}{' '}
                        {entry.submittedBy ?? frAdmin.common.none} — {formatDate(entry.createdAt)}
                      </p>
                    </div>
                    <StatusBadge
                      status={entry.status}
                      label={frAdmin.promotions.detail.missingStatus[entry.status] ?? entry.status}
                    />
                  </div>

                  {entry.status === 'submitted' || entry.status === 'reviewing' ? (
                    <div className="mt-4 flex flex-wrap items-start gap-3">
                      {entry.status === 'submitted' ? (
                        <ActionButton
                          action={reviewMissingMemberAction}
                          fields={{
                            suggestionId: entry.suggestionId,
                            decision: 'reviewing',
                            promotionId: String(promotion.promotionId),
                          }}
                          label={frAdmin.promotions.detail.startMissingReview}
                        />
                      ) : null}
                      <ReasonAction
                        action={reviewMissingMemberAction}
                        fields={{
                          suggestionId: entry.suggestionId,
                          decision: 'matched',
                          promotionId: String(promotion.promotionId),
                        }}
                        triggerLabel={frAdmin.promotions.detail.matchMissing}
                        title={frAdmin.promotions.detail.matchMissing}
                        description={frAdmin.promotions.detail.matchMissingBody}
                        confirmLabel={frAdmin.promotions.detail.matchMissing}
                        withReason={false}
                        destructive={false}
                        input={{
                          name: 'matchedProfileId',
                          label: frAdmin.promotions.detail.matchProfileId,
                          hint: frAdmin.promotions.detail.addManagerProfileHelp,
                        }}
                      />
                      <ReasonAction
                        action={reviewMissingMemberAction}
                        fields={{
                          suggestionId: entry.suggestionId,
                          decision: 'dismissed',
                          promotionId: String(promotion.promotionId),
                        }}
                        triggerLabel={frAdmin.promotions.detail.dismissMissing}
                        title={frAdmin.promotions.detail.dismissMissing}
                        description={frAdmin.promotions.detail.dismissMissingBody}
                        confirmLabel={frAdmin.promotions.detail.dismissMissing}
                        withReason={false}
                      />
                      <ReasonAction
                        action={revealContactHintAction}
                        fields={{ suggestionId: entry.suggestionId }}
                        triggerLabel={frAdmin.contactHint.reveal}
                        title={frAdmin.contactHint.title}
                        description={frAdmin.contactHint.body}
                        confirmLabel={frAdmin.contactHint.confirm}
                        withReason={false}
                        destructive={false}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>
    </div>,
  );
}
