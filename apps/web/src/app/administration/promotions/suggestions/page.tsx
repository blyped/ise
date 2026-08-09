import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminPromotionSuggestions } from '@/lib/admin/queries';
import { formatDate } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../../_components/PageHeader';
import { FilterBar } from '../../_components/FilterBar';
import { RowCard, RowList } from '../../_components/RowCard';
import { ActionButton } from '../../_components/ActionButton';
import { ReasonAction } from '../../_components/ReasonAction';
import { reviewPromotionSuggestionAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.promotions.suggestions.title };

const SUGGESTION_STATUSES = [
  'submitted',
  'under_review',
  'accepted',
  'rejected',
  'duplicate',
] as const;

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-010 — Signalements « ma promotion n'existe pas » (ISE-009, table
 * `promotion_suggestions`) : revue, rattachement au referentiel, rejet
 * motive. Permission `promotions.manage`.
 */
export default async function AdminPromotionSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('promotions.manage');
  const params = await searchParams;
  const status = paramOneOf(params, 'statut', SUGGESTION_STATUSES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminPromotionSuggestions(status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdmin.promotions.suggestions.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <Link href={ADMIN_ROUTES.promotions} className={BACK_LINK}>
        ← {frAdmin.common.back}
      </Link>
      <PageHeader
        title={frAdmin.promotions.suggestions.title}
        subtitle={frAdmin.promotions.suggestions.subtitle}
      />
    </div>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frAdmin.common.errorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const { rows, nextCursor } = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <FilterBar
        action={ADMIN_ROUTES.promotionSuggestions}
        selects={[
          {
            name: 'statut',
            label: frAdmin.promotions.filterStatus,
            value: status ?? '',
            options: SUGGESTION_STATUSES.map((value) => ({
              value,
              label: frAdmin.promotions.suggestions.status[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={frAdmin.promotions.suggestions.empty}
          description={frAdmin.promotions.suggestions.emptyBody}
        />
      ) : (
        <>
          <RowList label={frAdmin.promotions.suggestions.title}>
            {rows.map((row) => (
              <RowCard
                key={row.suggestionId}
                title={row.promotionLabel}
                meta={[
                  row.institution ?? frAdmin.common.none,
                  row.approximateYear !== null ? String(row.approximateYear) : frAdmin.common.none,
                  `${frAdmin.promotions.suggestions.columns.by} ${row.submittedBy ?? frAdmin.common.none}`,
                  formatDate(row.createdAt),
                ].join(' · ')}
                badges={
                  <StatusBadge
                    status={row.status}
                    label={frAdmin.promotions.suggestions.status[row.status] ?? row.status}
                  />
                }
                actions={
                  row.status === 'submitted' || row.status === 'under_review' ? (
                    <div className="flex flex-wrap items-start gap-2">
                      {row.status === 'submitted' ? (
                        <ActionButton
                          action={reviewPromotionSuggestionAction}
                          fields={{ suggestionId: row.suggestionId, decision: 'under_review' }}
                          label={frAdmin.promotions.suggestions.review}
                        />
                      ) : null}
                      <ReasonAction
                        action={reviewPromotionSuggestionAction}
                        fields={{ suggestionId: row.suggestionId, decision: 'accepted' }}
                        triggerLabel={frAdmin.promotions.suggestions.accept}
                        title={frAdmin.promotions.suggestions.accept}
                        description={frAdmin.promotions.suggestions.acceptBody}
                        confirmLabel={frAdmin.promotions.suggestions.accept}
                        withReason={false}
                        destructive={false}
                        input={{
                          name: 'matchedPromotionId',
                          label: frAdmin.promotions.suggestions.acceptPromotionId,
                        }}
                      />
                      <ReasonAction
                        action={reviewPromotionSuggestionAction}
                        fields={{ suggestionId: row.suggestionId, decision: 'rejected' }}
                        triggerLabel={frAdmin.promotions.suggestions.reject}
                        title={frAdmin.promotions.suggestions.reject}
                        description={frAdmin.promotions.suggestions.rejectBody}
                        confirmLabel={frAdmin.promotions.suggestions.reject}
                        reasonLabel={frAdmin.promotions.suggestions.rejectReasonLabel}
                      />
                    </div>
                  ) : undefined
                }
              >
                {row.comment !== null ? (
                  <p className="text-caption text-text-muted mt-3">{row.comment}</p>
                ) : null}
                {row.reviewNote !== null ? (
                  <p className="text-caption text-text-secondary mt-2">{row.reviewNote}</p>
                ) : null}
              </RowCard>
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              ADMIN_ROUTES.promotionSuggestions,
              { statut: status },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
