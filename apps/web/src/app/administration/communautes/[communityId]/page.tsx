import Link from 'next/link';
import { ErrorState, EmptyState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminCommunities } from '@/i18n/admin-communities';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminCommunity, loadAdminCommunityPosts } from '@/lib/admin/queries-communities';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../../_components/AdminShell';
import { ActionButton } from '../../_components/ActionButton';
import { CursorPager, KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ReasonAction } from '../../_components/ReasonAction';
import { RowCard, RowList } from '../../_components/RowCard';
import { CommunityEditForm } from './CommunityEditForm';
import { mergeCommunityAction, moderatePostAction, setCommunityStatusAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCommunities.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** Cibles de statut atteignables depuis chaque statut courant (0011/0099). */
const STATUS_TARGETS: Record<string, readonly string[]> = {
  draft: ['active'],
  active: ['inactive', 'archived'],
  inactive: ['active', 'archived'],
  archived: ['active'],
  merged: ['active'],
};

const POST_STATUSES = ['draft', 'pending_review', 'published', 'flagged', 'hidden', 'removed', 'archived'] as const;

/** Actions de moderation valides selon l'etat courant d'une publication (0099). */
function moderationOptionsFor(status: string, isLocked: boolean): readonly string[] {
  const options: string[] = [];
  if (status === 'published') options.push('hide');
  if (status === 'hidden' || status === 'removed' || status === 'flagged') options.push('restore');
  if (status !== 'removed') options.push('remove');
  options.push(isLocked ? 'unlock' : 'lock');
  return options;
}

/**
 * SA-028/029 — Fiche communaute, statut adaptatif : un seul ecran
 * couvre l'edition du contenu (SA-028), le cycle de vie (SA-028) et la
 * moderation des publications (SA-029) — meme principe que la fiche
 * projet SA-024/025/026 : le detail d'une ressource n'a pas besoin
 * d'etre fragmente en routes distinctes quand son cycle de vie tient
 * sur un seul ecran. La moderation des COMMENTAIRES existe cote base
 * (`admin_moderate_community_comment`, 0099, meme journalisation) mais
 * n'a pas d'ecran dedie : SA-029 designe specifiquement la moderation
 * des PUBLICATIONS (« Moderation Publication Communaute »), pas des
 * commentaires — voir docs/decisions.md.
 */
export default async function AdminCommunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('communities.manage');
  const { communityId } = await params;
  const search = await searchParams;
  const postStatus = paramOneOf(search, 'estatut', POST_STATUSES);
  const postCursor = paramValue(search, 'curseur');
  const correlationId = newCorrelationId();

  const detail = await loadAdminCommunity(communityId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.communities} screenTitle={frAdminCommunities.detail.title}>
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdminCommunities.detail.title} subtitle={frAdminCommunities.list.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.communities} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const community = detail.data;
  const posts = await loadAdminCommunityPosts(communityId, postStatus, postCursor, correlationId);
  const postRows = posts.ok ? posts.data.rows : [];
  const statusTargets = STATUS_TARGETS[community.status] ?? [];

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.communities} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader title={community.name} subtitle={community.description}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={community.status} label={frAdminCommunities.status[community.status] ?? community.status} />
            <StatusBadge
              status={community.communityType}
              label={frAdminCommunities.communityType[community.communityType] ?? community.communityType}
            />
            <StatusBadge
              status={community.visibility}
              label={frAdminCommunities.visibility[community.visibility] ?? community.visibility}
            />
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdminCommunities.detail.infoTitle}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdminCommunities.detail.membersCount}>{community.stats.members}</KeyValue>
          <KeyValue label={frAdminCommunities.form.joinPolicy}>
            {frAdminCommunities.joinPolicy[community.joinPolicy] ?? community.joinPolicy}
          </KeyValue>
          <KeyValue label={frAdminCommunities.form.postModerationMode}>
            {frAdminCommunities.postModerationMode[community.postModerationMode] ?? community.postModerationMode}
          </KeyValue>
          <KeyValue label={frAdminCommunities.detail.openQuestions}>{community.openQuestionCount}</KeyValue>
          <KeyValue label={frAdminCommunities.detail.lastActivityAt}>
            {community.lastActivityAt !== null ? formatDateTime(community.lastActivityAt) : frAdmin.common.none}
          </KeyValue>
        </dl>
      </SectionCard>

      {statusTargets.length > 0 || community.status !== 'merged' ? (
        <SectionCard title={frAdminCommunities.detail.lifecycleTitle}>
          <p className="text-caption text-text-muted">{frAdminCommunities.detail.lifecycleHint}</p>
          <div className="flex flex-wrap gap-3">
            {statusTargets.map((target) => (
              <ActionButton
                key={target}
                action={setCommunityStatusAction}
                fields={{ communityId, status: target }}
                label={`${frAdminCommunities.detail.setStatus} : ${frAdminCommunities.status[target]}`}
                variant="secondary"
              />
            ))}
            {community.status !== 'merged' ? (
              <ReasonAction
                action={mergeCommunityAction}
                fields={{ communityId }}
                triggerLabel={frAdminCommunities.detail.mergeTrigger}
                title={frAdminCommunities.detail.mergeTitle}
                description={frAdminCommunities.detail.mergeBody}
                confirmLabel={frAdminCommunities.detail.mergeTrigger}
                withReason={false}
                destructive={true}
                input={{
                  name: 'mergedIntoCommunityId',
                  label: frAdminCommunities.detail.mergeInputLabel,
                  hint: frAdminCommunities.detail.mergeInputHelp,
                }}
              />
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={frAdminCommunities.form.editTitle}>
        <CommunityEditForm community={community} />
      </SectionCard>

      <SectionCard title={frAdminCommunities.detail.postsTitle}>
        <p className="text-caption text-text-muted">{frAdminCommunities.detail.postsSubtitle}</p>
        {postRows.length === 0 ? (
          <EmptyState title={frAdminCommunities.detail.noPosts} description={frAdminCommunities.detail.postsSubtitle} />
        ) : (
          <>
            <RowList label={frAdminCommunities.detail.postsTitle}>
              {postRows.map((row) => (
                <RowCard
                  key={row.postId}
                  title={row.title}
                  meta={[
                    `${frAdminCommunities.detail.postsColumns.type} : ${frAdminCommunities.postType[row.postType] ?? row.postType}`,
                    `${frAdminCommunities.detail.postsColumns.author} : ${row.author?.displayName ?? frAdmin.common.none}`,
                    `${frAdminCommunities.detail.postsColumns.created} : ${row.publishedAt !== null ? formatDate(row.publishedAt) : frAdmin.common.none}`,
                    row.isLocked ? frAdminCommunities.detail.postLocked : '',
                  ]
                    .filter((part) => part.length > 0)
                    .join(' · ')}
                  badges={
                    <StatusBadge status={row.status} label={frAdminCommunities.postStatus[row.status] ?? row.status} />
                  }
                  actions={
                    <ReasonAction
                      action={moderatePostAction}
                      fields={{ postId: row.postId, communityId }}
                      triggerLabel={frAdminCommunities.detail.moderate}
                      title={frAdminCommunities.detail.moderateTitle}
                      description={frAdminCommunities.detail.moderateBody}
                      confirmLabel={frAdminCommunities.detail.moderate}
                      reasonLabel={frAdminCommunities.detail.moderateReasonLabel}
                      reasonPlaceholder={frAdminCommunities.detail.moderateReasonPlaceholder}
                      select={{
                        name: 'action',
                        label: frAdminCommunities.detail.moderateSelectLabel,
                        options: moderationOptionsFor(row.status, row.isLocked).map((value) => ({
                          value,
                          label: frAdminCommunities.moderationAction[value] ?? value,
                        })),
                      }}
                    />
                  }
                />
              ))}
            </RowList>

            <CursorPager
              shownCount={postRows.length}
              nextHref={nextPageHref(
                `${ADMIN_ROUTES.communities}/${encodeURIComponent(communityId)}`,
                { estatut: postStatus },
                posts.ok ? posts.data.nextCursor : null,
              )}
            />
          </>
        )}
      </SectionCard>
    </div>,
  );
}
