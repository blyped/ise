import Link from 'next/link';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import {
  loadReceivedRecommendations,
  loadRecommendationRequests,
  type RecommendationRow,
} from '@/lib/queries/profile-extras';
import { ProfilePage } from '@/components/profile/ProfilePage';
import {
  AcceptRequestForm,
  DeclineRequestButton,
  ModerationButtons,
  WithdrawRequestButton,
} from './RecommendationActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.recommendations.title };

const t = frProfile.recommendations;

const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

type Filter = 'toutes' | 'visibles' | 'a-valider' | 'masquees';

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: 'toutes', label: t.filters.all },
  { key: 'visibles', label: t.filters.visible },
  { key: 'a-valider', label: t.filters.toValidate },
  { key: 'masquees', label: t.filters.hidden },
];

function matchesFilter(row: RecommendationRow, filter: Filter): boolean {
  if (filter === 'visibles') return row.status === 'published';
  if (filter === 'a-valider') return row.status === 'draft';
  if (filter === 'masquees') return row.status === 'hidden';
  return true;
}

function statusTone(status: RecommendationRow['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'warning';
  return 'neutral';
}

function frenchDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(iso));
}

/**
 * ISE-028 — Mes recommandations.
 * Le sujet controle la visibilite (valider / masquer), jamais le texte :
 * la reecriture est refusee par la base (trigger 0085).
 */
export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawFilter = typeof params['filtre'] === 'string' ? params['filtre'] : 'toutes';
  const filter: Filter = (['toutes', 'visibles', 'a-valider', 'masquees'] as const).includes(
    rawFilter as Filter,
  )
    ? (rawFilter as Filter)
    : 'toutes';

  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadReceivedRecommendations(context.profile.id, context.correlationId),
        loadRecommendationRequests(context.profile.id, 'received', context.correlationId),
        loadRecommendationRequests(context.profile.id, 'sent', context.correlationId),
      ])
    : null;

  const recommendations = data !== null && data[0].ok ? data[0].data : [];
  const filtered = recommendations.filter((row) => matchesFilter(row, filter));
  const pendingReceived =
    data !== null && data[1].ok ? data[1].data.filter((row) => row.status === 'pending') : [];
  const sent = data !== null && data[2].ok ? data[2].data : [];

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.recommendations}
      title={t.title}
      subtitle={t.subtitle}
      action={
        <Link href={PROFILE_ROUTES.requestRecommendation} className={PRIMARY_LINK}>
          {t.request}
        </Link>
      }
    >
      {data === null ? null : !data[0].ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={data[0].error.userMessage}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-6">
            <p className="text-body-sm text-text-secondary">
              {t.receivedCount.replace('{count}', String(recommendations.length))}
            </p>

            <nav aria-label={t.filterLabel}>
              <ul className="flex flex-wrap gap-3">
                {FILTERS.map((entry) => (
                  <li key={entry.key}>
                    <Link
                      href={
                        entry.key === 'toutes'
                          ? PROFILE_ROUTES.recommendations
                          : `${PROFILE_ROUTES.recommendations}?filtre=${entry.key}`
                      }
                      aria-current={filter === entry.key ? 'page' : undefined}
                      className={
                        filter === entry.key
                          ? 'text-primary rounded-full bg-[#EFF6FF] px-5 py-2 text-[13px] font-semibold'
                          : 'border-border text-text-secondary hover:text-text-primary rounded-full border px-5 py-2 text-[13px] font-medium'
                      }
                    >
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {filtered.length === 0 ? (
              <EmptyState
                title={filter === 'toutes' ? t.emptyTitle : t.emptyFilterTitle}
                description={t.emptyBody}
                action={
                  <Link href={PROFILE_ROUTES.requestRecommendation} className={PRIMARY_LINK}>
                    {t.request}
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-5">
                {filtered.map((row) => (
                  <Card as="li" key={row.id}>
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="flex min-w-0 items-start gap-4">
                        <Avatar name={row.authorName} size={48} decorative />
                        <div className="min-w-0">
                          <h2 className="text-body text-text-primary font-semibold">
                            {row.authorName}
                          </h2>
                          {row.authorHeadline ? (
                            <p className="text-caption text-text-secondary mt-1">
                              {row.authorHeadline}
                            </p>
                          ) : null}
                          <p className="text-caption text-text-muted mt-1">
                            {row.relationshipContext}
                            {row.engagementContext ? ` · ${row.engagementContext}` : ''} ·{' '}
                            {frenchDate(row.createdAt)}
                          </p>
                          {row.skillName ? (
                            <p className="mt-3">
                              <Chip selected>{row.skillName}</Chip>
                            </p>
                          ) : null}
                          <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
                            {row.body}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-3">
                        <Badge tone={statusTone(row.status)}>
                          {row.status === 'published'
                            ? t.status.published
                            : row.status === 'draft'
                              ? t.status.draft
                              : t.status.hidden}
                        </Badge>
                        {row.status !== 'removed' ? (
                          <ModerationButtons recommendationId={row.id} status={row.status} />
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </ul>
            )}

            <p className="text-caption text-text-muted">{t.moderationHint}</p>

            {/* ------------- Demandes recues ------------- */}
            <Card>
              <CardHeader>
                <CardTitle as="h2">{t.receivedRequestsTitle}</CardTitle>
              </CardHeader>
              {pendingReceived.length === 0 ? (
                <p className="text-body-sm text-text-secondary">{t.receivedRequestsEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-5">
                  {pendingReceived.map((request) => (
                    <li
                      key={request.id}
                      className="border-border rounded-base flex flex-col gap-4 border p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-body-sm text-text-primary font-semibold">
                            {request.otherName}
                          </p>
                          {request.otherHeadline ? (
                            <p className="text-caption text-text-secondary mt-1">
                              {request.otherHeadline}
                            </p>
                          ) : null}
                          {request.context ? (
                            <p className="text-caption text-text-muted mt-1">
                              {t.contextLabel} {request.context}
                            </p>
                          ) : null}
                          {request.message ? (
                            <p className="text-body-sm text-text-secondary mt-3 whitespace-pre-line">
                              {request.message}
                            </p>
                          ) : null}
                        </div>
                        <Badge tone="warning">{t.requestStatus.pending}</Badge>
                      </div>
                      <div className="flex flex-wrap items-start gap-3">
                        <AcceptRequestForm
                          requestId={request.id}
                          requesterName={request.otherName}
                          defaultSkillId={request.skillId}
                          skillName={request.skillName}
                          requestContext={request.context}
                        />
                        <DeclineRequestButton requestId={request.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-caption text-text-muted mt-4">{t.freeToRespond}</p>
            </Card>

            {/* ------------- Demandes envoyees ------------- */}
            <Card>
              <CardHeader>
                <CardTitle as="h2">{t.sentRequestsTitle}</CardTitle>
              </CardHeader>
              {sent.length === 0 ? (
                <p className="text-body-sm text-text-secondary">{t.sentRequestsEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {sent.map((request) => (
                    <li
                      key={request.id}
                      className="border-border rounded-base flex flex-wrap items-center justify-between gap-4 border px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="text-body-sm text-text-primary font-semibold">
                          {request.otherName}
                        </p>
                        <p className="text-caption text-text-muted mt-1">
                          {frenchDate(request.createdAt)}
                          {request.skillName ? ` · ${request.skillName}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge
                          tone={
                            request.status === 'accepted'
                              ? 'success'
                              : request.status === 'pending'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {t.requestStatus[request.status]}
                        </Badge>
                        {request.status === 'pending' ? (
                          <WithdrawRequestButton requestId={request.id} />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <aside className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle as="h2">{t.qualityTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{t.qualityBody}</p>
            </Card>
          </aside>
        </div>
      )}
    </ProfilePage>
  );
}
