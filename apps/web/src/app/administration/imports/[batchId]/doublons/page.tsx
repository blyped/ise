import { Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminDataAccess } from '@/lib/admin-data/permissions';
import { loadDuplicateCandidates } from '@/lib/admin-data/queries';
import { importDetailRoute } from '@/lib/routes/admin-data';
import type { DuplicateCandidateItem } from '@/lib/admin-data/view';
import { AdminPageHeader } from '../../_components/AdminPageHeader';
import { CandidateReviewForm, RowDecisionForm } from './ReviewForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.imports.duplicates.title };

const t = frAdminData.imports.duplicates;

function rowField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  const norm = row['_norm'];
  if (typeof norm === 'object' && norm !== null) {
    for (const key of keys) {
      const value = (norm as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim() !== '') return value;
      if (typeof value === 'number') return String(value);
    }
  }
  return null;
}

function ComparisonRow({
  label,
  existing,
  incoming,
}: {
  label: string;
  existing: string | null;
  incoming: string | null;
}) {
  return (
    <tr className="border-border border-b last:border-0">
      <th scope="row" className="text-caption text-text-muted py-2 pr-3 text-left font-normal">
        {label}
      </th>
      <td className="text-body-sm text-text-primary py-2 pr-3">
        {existing ?? frAdminData.common.none}
      </td>
      <td className="text-body-sm text-text-primary py-2">{incoming ?? frAdminData.common.none}</td>
    </tr>
  );
}

function CandidateCard({
  batchId,
  candidate,
  canReview,
}: {
  batchId: string;
  candidate: DuplicateCandidateItem;
  canReview: boolean;
}) {
  const profile = candidate.existingProfile;
  const row = candidate.rowData;
  const decided =
    candidate.status === 'confirmed_duplicate' || candidate.status === 'not_duplicate';

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">
          {t.score} {candidate.score} — {t.matchClass[candidate.matchClass] ?? candidate.matchClass}
        </CardTitle>
      </CardHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge
          tone={
            candidate.status === 'confirmed_duplicate'
              ? 'success'
              : candidate.status === 'not_duplicate'
                ? 'neutral'
                : candidate.status === 'deferred'
                  ? 'info'
                  : 'warning'
          }
        >
          {t.statusLabel[candidate.status] ?? candidate.status}
        </Badge>
        {candidate.signals.map((signal) => (
          <Badge key={signal} tone="info">
            {t.signals[signal] ?? signal}
          </Badge>
        ))}
        {candidate.reviewedBy !== null ? (
          <span className="text-caption text-text-muted">{t.reviewedBy(candidate.reviewedBy)}</span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="text-caption text-text-muted border-border border-b text-left">
              <th scope="col" className="py-2 pr-3" aria-hidden="true"></th>
              <th scope="col" className="py-2 pr-3">
                {t.existing}
                {profile !== null ? ` — ${profile.displayName}` : ''}
              </th>
              <th scope="col" className="py-2">
                {t.incoming} (n° {candidate.rowNumber})
              </th>
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label={t.fieldPromotion}
              existing={
                profile?.promotionYear !== null && profile !== null
                  ? String(profile.promotionYear)
                  : null
              }
              incoming={rowField(row, ['promotion_year'])}
            />
            <ComparisonRow
              label={t.fieldEmail}
              existing={profile?.email ?? null}
              incoming={rowField(row, ['email'])}
            />
            <ComparisonRow
              label={t.fieldPhone}
              existing={profile?.phone ?? null}
              incoming={rowField(row, ['phone', 'phone_e164'])}
            />
            <ComparisonRow
              label={t.fieldOrganization}
              existing={profile?.organization ?? null}
              incoming={rowField(row, ['organization'])}
            />
            <ComparisonRow
              label={t.fieldPosition}
              existing={profile?.position ?? null}
              incoming={rowField(row, ['current_position'])}
            />
            <ComparisonRow
              label={t.fieldCity}
              existing={profile?.city ?? null}
              incoming={rowField(row, ['city'])}
            />
            <ComparisonRow
              label={t.fieldClaim}
              existing={
                profile !== null
                  ? profile.claimStatus === 'claimed'
                    ? t.claimed
                    : t.unclaimed
                  : null
              }
              incoming={frAdminData.common.none}
            />
          </tbody>
        </table>
      </div>

      {candidate.reviewNote !== null ? (
        <p className="text-caption text-text-muted mt-2">{candidate.reviewNote}</p>
      ) : null}

      {canReview && !decided ? (
        <div className="border-border mt-4 border-t pt-4">
          <CandidateReviewForm batchId={batchId} candidateId={candidate.id} disabled={false} />
        </div>
      ) : null}

      {canReview && candidate.rowDecision === 'pending' ? (
        <div className="border-border mt-4 border-t pt-4">
          <RowDecisionForm
            batchId={batchId}
            rowId={candidate.importRowId}
            matchedProfileId={profile?.id ?? null}
            mergeEnabled={candidate.status === 'confirmed_duplicate'}
          />
        </div>
      ) : null}
    </Card>
  );
}

/**
 * SA-042 — Comparaison côte à côte et revue humaine. Rien n'est fusionné
 * automatiquement : chaque candidat exige une décision, et la fusion
 * n'est proposée qu'après confirmation du doublon (0017, 0080).
 */
export default async function ImportDuplicatesPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const access = await readAdminDataAccess();
  const canReview = access?.can('imports.review') === true;
  const correlationId = newCorrelationId();

  const candidates = await loadDuplicateCandidates(batchId, correlationId);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        backHref={importDetailRoute(batchId)}
        backLabel={frAdminData.imports.detail.title}
      />

      {!candidates.ok ? (
        <ErrorState
          title={frAdminData.common.loadError}
          description={candidates.error.userMessage}
          correlationId={correlationId}
        />
      ) : candidates.data.length === 0 ? (
        <EmptyState title={t.empty} description={frAdminData.common.emptyGeneric} />
      ) : (
        <div className="flex flex-col gap-6">
          {candidates.data.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              batchId={batchId}
              candidate={candidate}
              canReview={canReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
