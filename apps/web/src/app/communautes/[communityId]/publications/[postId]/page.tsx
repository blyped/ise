import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frCommunities } from '@/i18n/communities';
import { ROUTES } from '@/lib/routes';
import { COMMUNITY_ROUTES, communityRoute } from '@/lib/routes/communities';
import { composeRoute } from '@/lib/routes/messaging';
import { memberProfileRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCommunityPost, loadCommunityPostTracking } from '@/lib/queries/communities';
import { formatDay } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import { CommentForm } from '@/components/collab/CommentForm';
import { HelpfulToggleForm } from '@/components/collab/HelpfulToggleForm';
import { ResolvePostForm } from '@/components/collab/ResolvePostForm';
import { ACTION_LINK, CHIP } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCommunities.tracking.title };

/**
 * ISE-087 — Suivi de ma publication.
 *
 * Trois compteurs seulement : réponses, réponses marquées utiles,
 * contributeurs. La maquette en montre un quatrième, « ressources » ;
 * aucune table ne porte de pièce jointe de publication, et un compteur
 * toujours à zéro serait un faux indicateur (MASTER PROMPT §98).
 *
 * « Remercier les contributeurs » n'envoie aucun message automatique :
 * l'écran ouvre une conversation, et c'est la personne qui écrit
 * (MASTER PROMPT §27).
 *
 * Un lecteur qui n'est pas l'auteur voit la même publication et le même
 * fil de réponses, sans les panneaux de suivi.
 */
export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ communityId: string; postId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { communityId, postId } = await params;
  const correlationId = newCorrelationId();

  const [viewer, post] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadCommunityPost(postId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={COMMUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!post.ok) {
    return shell(
      <ErrorState
        title={frCommunities.common.loadErrorTitle}
        description={post.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const detail = post.data;
  if (detail === null) {
    return shell(
      <EmptyState
        title={frCommunities.common.notFoundTitle}
        description={frCommunities.common.notFoundBody}
        action={
          <Link href={communityRoute(communityId)} className={ACTION_LINK}>
            {frCommunities.common.breadcrumb}
          </Link>
        }
      />,
    );
  }

  const tracking = detail.isAuthor ? await loadCommunityPostTracking(postId, correlationId) : null;
  const trackingData = tracking !== null && tracking.ok ? tracking.data : null;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <Link href={COMMUNITY_ROUTES.list} className="text-primary hover:underline">
          {frCommunities.common.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span>{' '}
        <Link href={communityRoute(communityId)} className="text-primary hover:underline">
          {detail.communityName}
        </Link>{' '}
        <span aria-hidden="true">›</span>{' '}
        <span>{detail.isAuthor ? frCommunities.tracking.title : detail.postType}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          {detail.isAuthor ? frCommunities.tracking.title : detail.title}
        </h1>
        {detail.isAuthor ? (
          <p className="text-body text-text-secondary">{frCommunities.tracking.subtitle}</p>
        ) : null}
      </div>

      <article className="rounded-base bg-[#0F172A] p-7 text-white max-md:p-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-white/70">
          {frCommunities.postType[detail.postType as keyof typeof frCommunities.postType] ??
            detail.postType}
        </p>
        <h2 className="text-h2 mt-3 font-bold">{detail.title}</h2>
        {detail.body === null ? null : (
          <p className="text-body-sm mt-3 whitespace-pre-line text-white/90">{detail.body}</p>
        )}
        <p className="text-caption mt-5 text-white/70">
          {detail.publishedAt === null ? '' : `Publiée le ${formatDay(detail.publishedAt) ?? ''}`} ·{' '}
          {detail.communityName} · {detail.replyCount} {frCommunities.detail.replies}
        </p>
        {detail.skills.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {detail.skills.map((skill) => (
              <li
                key={skill}
                className="text-caption rounded-full border border-white/25 px-3 py-[3px] text-white/85"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      {detail.isAuthor && trackingData !== null ? (
        <ul className="grid gap-4 sm:grid-cols-3">
          {[
            [trackingData.counters.replies, frCommunities.tracking.counterReplies],
            [trackingData.counters.helpful, frCommunities.tracking.counterHelpful],
            [trackingData.counters.contributors, frCommunities.tracking.counterContributors],
          ].map(([value, label]) => (
            <li key={String(label)}>
              <Card>
                <p className="text-h1 text-primary font-bold">{value}</p>
                <p className="text-caption text-text-secondary">{label}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section
          aria-label={frCommunities.tracking.repliesTitle}
          className="flex min-w-0 flex-col gap-5"
        >
          <h2 className="text-h3 text-text-primary font-semibold">
            {frCommunities.tracking.repliesTitle}
          </h2>

          {detail.comments.length === 0 ? (
            <EmptyState
              title="Aucune réponse pour le moment."
              description="Les réponses apparaîtront ici. Une réponse utile décrit ce que la personne a réellement constaté."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {detail.comments.map((comment) => (
                <li key={comment.commentId}>
                  <Card className={comment.isHelpful ? 'border-primary' : ''}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={comment.author?.displayName ?? '—'} size={32} />
                        <div>
                          <p className="text-body-sm text-text-primary font-medium">
                            {comment.author?.displayName ?? '—'}
                          </p>
                          <p className="text-caption text-text-muted">
                            {[comment.author?.currentPosition, comment.author?.promotionLabel]
                              .filter((value) => value !== null && value !== undefined)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                      {comment.isHelpful ? <Badge tone="success">Réponse utile</Badge> : null}
                    </div>

                    <p className="text-body-sm text-text-secondary mt-3 whitespace-pre-line">
                      {comment.body}
                    </p>

                    <div className="border-border mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
                      <span className="text-caption text-text-muted">
                        {formatDay(comment.createdAt) ?? ''}
                      </span>
                      {comment.author === null ? null : (
                        <Link
                          href={memberProfileRoute(comment.author.profileId)}
                          className="text-caption text-primary hover:underline"
                        >
                          Voir le profil
                        </Link>
                      )}
                      {detail.isAuthor ? (
                        <span className="ml-auto">
                          <HelpfulToggleForm
                            communityId={communityId}
                            postId={postId}
                            commentId={comment.commentId}
                            isHelpful={comment.isHelpful}
                          />
                        </span>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {detail.isLocked ? (
            <Alert variant="warning" title={frCommunities.tracking.replyLocked} />
          ) : detail.canReply ? (
            <Card>
              <CardHeader>
                <CardTitle as="h3">{frCommunities.tracking.replyLabel}</CardTitle>
              </CardHeader>
              <CommentForm communityId={communityId} postId={postId} />
            </Card>
          ) : (
            <Alert variant="info" title={frCommunities.detail.joinToPublish} />
          )}
        </section>

        <aside className="flex flex-col gap-7">
          {detail.resolutionSummary === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frCommunities.tracking.resolvedTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary whitespace-pre-line">
                {detail.resolutionSummary}
              </p>
              <p className="text-caption text-text-muted mt-3">
                {detail.resolvedAt === null ? '' : formatDay(detail.resolvedAt)}
              </p>
            </Card>
          )}

          {detail.isAuthor && trackingData !== null ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{frCommunities.tracking.helpfulTitle}</CardTitle>
                </CardHeader>
                {trackingData.helpfulReplies.length === 0 ? (
                  <p className="text-body-sm text-text-secondary">
                    {frCommunities.tracking.helpfulEmpty}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {trackingData.helpfulReplies.map((reply) => (
                      <li key={reply.commentId}>
                        <p className="text-body-sm text-text-primary font-medium">
                          {reply.author?.displayName ?? '—'}
                        </p>
                        <p className="text-caption text-text-secondary">{reply.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h2">{frCommunities.tracking.contributorsTitle}</CardTitle>
                </CardHeader>
                <p className="text-body-sm text-text-secondary mb-4">
                  {frCommunities.tracking.contributorsBody}
                </p>
                {trackingData.contributors.length === 0 ? (
                  <p className="text-caption text-text-muted">Aucun contributeur pour le moment.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {trackingData.contributors.map((contributor) => (
                      <li key={contributor.profileId} className="flex items-center gap-3">
                        <Avatar name={contributor.displayName} size={32} />
                        <span className="text-body-sm text-text-primary min-w-0 flex-1 truncate">
                          {contributor.displayName}
                        </span>
                        <Link
                          href={composeRoute(contributor.profileId)}
                          className="text-caption text-primary hover:underline"
                        >
                          {frCommunities.tracking.thank}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {detail.isResolved ? null : (
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">{frCommunities.tracking.resolveTitle}</CardTitle>
                  </CardHeader>
                  <p className="text-body-sm text-text-secondary mb-4">
                    {frCommunities.tracking.resolveBody}
                  </p>
                  <ResolvePostForm communityId={communityId} postId={postId} />
                </Card>
              )}
            </>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{detail.communityName}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              Cette publication appartient à la communauté ; elle n’est pas rediffusée ailleurs.
            </p>
            <p className="mt-4 flex flex-wrap gap-2">
              <span className={CHIP}>
                {frCommunities.postType[detail.postType as keyof typeof frCommunities.postType] ??
                  detail.postType}
              </span>
              <span className={CHIP}>
                {detail.visibility === 'network'
                  ? frCommunities.publish.visibilityNetwork
                  : frCommunities.publish.visibilityCommunity}
              </span>
            </p>
            <p className="mt-5">
              <Link href={communityRoute(communityId)} className={ACTION_LINK}>
                Retour à la communauté
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
