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
import {
  COMMUNITY_ROUTES,
  communityPostRoute,
  communityPublishRoute,
  communityRoute,
} from '@/lib/routes/communities';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCommunity, loadCommunityMembers, loadCommunityPosts } from '@/lib/queries/communities';
import { formatDay } from '@/lib/communities-view';
import { memberProfileRoute } from '@/lib/routes/search';
import { AppShell } from '@/components/layout/AppShell';
import { JoinCommunityForm } from '@/components/collab/JoinCommunityForm';
import { CommunityNotificationForm } from '@/components/collab/CommunityNotificationForm';
import { LeaveCommunityForm } from '@/components/collab/LeaveCommunityForm';
import {
  ACTION_LINK,
  CHIP,
  FIELD,
  PRIMARY_LINK,
  TAB_BASE,
  TAB_CURRENT,
  TAB_IDLE,
} from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCommunities.common.breadcrumb };

type Tab = 'fil' | 'questions' | 'membres' | 'a-propos';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'fil', label: frCommunities.detail.tabFeed },
  { id: 'questions', label: frCommunities.detail.tabQuestions },
  { id: 'membres', label: frCommunities.detail.tabMembers },
  { id: 'a-propos', label: frCommunities.detail.tabAbout },
];

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

function toTab(raw: string | null): Tab {
  return raw === 'questions' || raw === 'membres' || raw === 'a-propos' ? raw : 'fil';
}

/**
 * ISE-085 — Page d'une communauté.
 *
 * Quatre onglets, conformes au MVP de la spécification : le fil, les
 * questions encore ouvertes, les membres et la présentation.
 *
 * L'onglet « Membres » n'est chargé que pour les membres : une
 * communauté ouverte au réseau expose sa fiche, pas son annuaire
 * (docs/rls.md §10.5). L'écran le dit plutôt que d'afficher une liste
 * vide.
 *
 * ÉCART ASSUMÉ : les blocs « Ressources populaires » et « Experts de la
 * communauté » de la maquette ne sont pas rendus. Le premier suppose un
 * classement d'usage, le second un palmarès de personnes ; l'un et
 * l'autre sont explicitement interdits (MASTER PROMPT §1, U 67-68). Les
 * expertises réellement présentes dans les publications les remplacent,
 * sans ordre de mérite entre les membres.
 */
export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { communityId } = await params;
  const query = await searchParams;
  const tab = toTab(one(query['onglet']));
  const search = one(query['recherche']);
  const cursor = unsealCursor(one(query['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, community] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadCommunity(communityId, correlationId),
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

  if (!community.ok) {
    return shell(
      <ErrorState
        title={frCommunities.common.loadErrorTitle}
        description={`${frCommunities.common.loadErrorBody} ${community.error.userMessage}`}
        correlationId={correlationId}
        action={
          <Link href={COMMUNITY_ROUTES.list} className={ACTION_LINK}>
            {frCommunities.common.breadcrumb}
          </Link>
        }
      />,
    );
  }

  const detail = community.data;
  if (detail === null) {
    return shell(
      <EmptyState
        title={frCommunities.common.notFoundTitle}
        description={frCommunities.common.notFoundBody}
        action={
          <Link href={COMMUNITY_ROUTES.list} className={ACTION_LINK}>
            {frCommunities.common.breadcrumb}
          </Link>
        }
      />,
    );
  }

  const isMember = detail.isMember;
  const isPending = detail.membership?.status === 'pending';

  const posts =
    tab === 'fil' || tab === 'questions'
      ? await loadCommunityPosts(
          communityId,
          tab === 'questions' ? 'question' : null,
          search,
          cursor,
          correlationId,
        )
      : null;

  const members =
    tab === 'membres' && isMember
      ? await loadCommunityMembers(communityId, search, cursor, correlationId)
      : null;

  const tabHref = (id: Tab): string => `${communityRoute(communityId)}?onglet=${id}`;

  const nextHref = (nextCursor: string | null): string | null =>
    nextCursor === null
      ? null
      : `${communityRoute(communityId)}?${new URLSearchParams({
          onglet: tab,
          ...(search === null ? {} : { recherche: search }),
          curseur: nextCursor,
        }).toString()}`;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <Link href={COMMUNITY_ROUTES.list} className="text-primary hover:underline">
          {frCommunities.common.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span> <span>{detail.name}</span>
      </nav>

      <header className="rounded-base flex flex-col gap-4 bg-[#0F172A] p-7 text-white max-md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-h1 font-bold">{detail.name}</h1>
            <p className="text-body-sm mt-1 text-white/80">
              {detail.memberCount} {frCommunities.common.members} ·{' '}
              {frCommunities.type[detail.communityType as 'country'] ?? detail.communityType}
              {detail.typeLabel === null ? '' : ` · ${detail.typeLabel}`}
            </p>
            <p className="text-body-sm mt-3 max-w-[70ch] text-white/90">{detail.description}</p>
          </div>
          {isMember ? <Badge tone="success">{frCommunities.common.memberBadge}</Badge> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isMember ? (
            <>
              <Link
                href={communityPublishRoute(communityId)}
                className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                + {frCommunities.detail.publish}
              </Link>
              <LeaveCommunityForm communityId={communityId} />
            </>
          ) : isPending ? (
            <p className="text-body-sm text-white/90">{frCommunities.detail.pendingNotice}</p>
          ) : (
            <div className="rounded-base bg-white/10 p-1">
              <JoinCommunityForm communityId={communityId} joinPolicy={detail.joinPolicy} />
            </div>
          )}
        </div>
      </header>

      <nav aria-label={detail.name} className="border-border overflow-x-auto border-b">
        <ul className="flex min-w-max gap-2">
          {TABS.map((item) => (
            <li key={item.id}>
              <Link
                href={tabHref(item.id)}
                aria-current={item.id === tab ? 'page' : undefined}
                className={`${TAB_BASE} ${item.id === tab ? TAB_CURRENT : TAB_IDLE}`}
              >
                {item.label}
                {item.id === 'membres' ? ` ${detail.memberCount}` : ''}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={TABS.find((item) => item.id === tab)?.label} className="min-w-0">
          {tab === 'a-propos' ? (
            <div className="flex flex-col gap-6">
              {detail.purpose === null ? null : (
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">{frCommunities.detail.purposeTitle}</CardTitle>
                  </CardHeader>
                  <p className="text-body-sm text-text-secondary whitespace-pre-line">
                    {detail.purpose}
                  </p>
                </Card>
              )}
              {detail.charterText === null ? null : (
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">{frCommunities.detail.charterTitle}</CardTitle>
                  </CardHeader>
                  <p className="text-body-sm text-text-secondary whitespace-pre-line">
                    {detail.charterText}
                  </p>
                </Card>
              )}
              {detail.expertise.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">{frCommunities.detail.expertiseTitle}</CardTitle>
                  </CardHeader>
                  <ul className="flex flex-wrap gap-2">
                    {detail.expertise.map((name) => (
                      <li key={name} className={CHIP}>
                        {name}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
              {isMember ? (
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">{frCommunities.detail.notifications}</CardTitle>
                  </CardHeader>
                  <p className="text-body-sm text-text-secondary mb-4">
                    {frCommunities.detail.notificationHelp}
                  </p>
                  <CommunityNotificationForm
                    communityId={communityId}
                    level={detail.membership?.notificationLevel ?? 'important'}
                    digest={detail.membership?.digestFrequency ?? 'weekly'}
                  />
                </Card>
              ) : null}
            </div>
          ) : null}

          {tab === 'membres' ? (
            !isMember ? (
              <EmptyState
                title={frCommunities.detail.membersReservedTitle}
                description={frCommunities.detail.membersReservedBody}
                action={
                  <JoinCommunityForm communityId={communityId} joinPolicy={detail.joinPolicy} />
                }
              />
            ) : members === null || !members.ok ? (
              <ErrorState
                title={frCommunities.common.loadErrorTitle}
                description={frCommunities.common.loadErrorBody}
                correlationId={correlationId}
              />
            ) : (
              <div className="flex flex-col gap-5">
                <form method="get" action={communityRoute(communityId)} className="flex gap-3">
                  <input type="hidden" name="onglet" value="membres" />
                  <label htmlFor="recherche-membres" className="sr-only">
                    {frCommunities.detail.membersSearchLabel}
                  </label>
                  <input
                    id="recherche-membres"
                    name="recherche"
                    type="search"
                    defaultValue={search ?? ''}
                    placeholder={frCommunities.detail.membersSearchPlaceholder}
                    className={`${FIELD} flex-1`}
                  />
                  <button type="submit" className={PRIMARY_LINK}>
                    {frCommunities.list.searchSubmit}
                  </button>
                </form>

                {members.data.rows.length === 0 ? (
                  <EmptyState
                    title={frCommunities.detail.emptyMembersTitle}
                    description={frCommunities.detail.emptyMembersBody}
                  />
                ) : (
                  <ul className="grid gap-4 lg:grid-cols-2">
                    {members.data.rows.map((member) => (
                      <li key={member.profileId}>
                        <Card className="h-full">
                          <div className="flex items-start gap-4">
                            <Avatar name={member.displayName} size={48} />
                            <div className="min-w-0">
                              <p className="text-body-sm text-text-primary font-semibold">
                                {member.displayName}
                              </p>
                              <p className="text-caption text-text-secondary">
                                {[
                                  member.promotionLabel,
                                  member.currentPosition,
                                  member.currentOrganization,
                                ]
                                  .filter((value) => value !== null && value.length > 0)
                                  .join(' · ')}
                              </p>
                              {member.communityRole === 'member' ? null : (
                                <p className="text-caption text-primary mt-1">
                                  {frCommunities.common.moderatorBadge}
                                </p>
                              )}
                              <p className="mt-3">
                                <Link
                                  href={memberProfileRoute(member.profileId)}
                                  className={ACTION_LINK}
                                >
                                  Voir le profil
                                </Link>
                              </p>
                            </div>
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}

                {nextHref(members.data.nextCursor) === null ? null : (
                  <Link
                    href={nextHref(members.data.nextCursor) ?? '#'}
                    className={`${ACTION_LINK} self-start`}
                  >
                    {frCommunities.common.loadMore}
                  </Link>
                )}
              </div>
            )
          ) : null}

          {tab === 'fil' || tab === 'questions' ? (
            posts === null || !posts.ok ? (
              <ErrorState
                title={frCommunities.common.loadErrorTitle}
                description={frCommunities.common.loadErrorBody}
                correlationId={correlationId}
              />
            ) : posts.data.rows.length === 0 ? (
              <EmptyState
                title={frCommunities.detail.emptyFeedTitle}
                description={
                  isMember ? frCommunities.detail.emptyFeedBody : frCommunities.detail.joinToPublish
                }
                action={
                  isMember ? (
                    <Link href={communityPublishRoute(communityId)} className={ACTION_LINK}>
                      {frCommunities.detail.publish}
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-5">
                <ul className="flex flex-col gap-5">
                  {posts.data.rows.map((post) => (
                    <li key={post.postId}>
                      <Card>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={post.author?.displayName ?? '—'} size={32} />
                            <div>
                              <p className="text-body-sm text-text-primary font-medium">
                                {post.author?.displayName ?? '—'}
                              </p>
                              <p className="text-caption text-text-muted">
                                {[post.author?.currentPosition, post.author?.promotionLabel]
                                  .filter((value) => value !== null && value !== undefined)
                                  .join(' · ')}
                              </p>
                            </div>
                          </div>
                          <Badge tone="info">
                            {frCommunities.postType[
                              post.postType as keyof typeof frCommunities.postType
                            ] ?? post.postType}
                          </Badge>
                        </div>

                        <h2 className="text-h3 text-text-primary mt-4 font-semibold">
                          <Link
                            href={communityPostRoute(communityId, post.postId)}
                            className="focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            {post.title}
                          </Link>
                        </h2>

                        {post.skills.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {post.skills.map((skill) => (
                              <li key={skill} className={CHIP}>
                                {skill}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                          <span className="text-caption text-text-muted">
                            {post.replyCount} {frCommunities.detail.replies}
                            {post.helpfulCount > 0
                              ? ` · ${post.helpfulCount} ${frCommunities.detail.helpful}`
                              : ''}
                            {post.publishedAt === null
                              ? ''
                              : ` · ${formatDay(post.publishedAt) ?? ''}`}
                          </span>
                          {post.isResolved ? (
                            <Badge tone="success">{frCommunities.detail.resolved}</Badge>
                          ) : null}
                          <Link
                            href={communityPostRoute(communityId, post.postId)}
                            className={`${ACTION_LINK} ml-auto`}
                          >
                            {frCommunities.detail.openPost}
                          </Link>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>

                {nextHref(posts.data.nextCursor) === null ? (
                  <p className="text-caption text-text-muted">{frCommunities.common.endOfPosts}</p>
                ) : (
                  <Link
                    href={nextHref(posts.data.nextCursor) ?? '#'}
                    className={`${ACTION_LINK} self-start`}
                  >
                    {frCommunities.common.loadMore}
                  </Link>
                )}
              </div>
            )
          ) : null}
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCommunities.detail.briefTitle}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col gap-2">
              {[
                [frCommunities.detail.statMembers, detail.stats.members],
                [frCommunities.detail.statActive, detail.stats.active30d],
                [frCommunities.detail.statOpenDiscussions, detail.stats.openDiscussions],
                [frCommunities.detail.statExpertiseCalls, detail.stats.expertiseCalls],
                [frCommunities.detail.statCountries, detail.stats.countries],
                [frCommunities.detail.statPromotions, detail.stats.promotions],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-baseline justify-between gap-4">
                  <dt className="text-caption text-text-secondary">{label}</dt>
                  <dd className="text-body-sm text-text-primary font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {detail.moderators.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frCommunities.detail.moderatorsTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary mb-4">
                {frCommunities.detail.moderatorsBody}
              </p>
              <ul className="flex flex-col gap-3">
                {detail.moderators.map((moderator) => (
                  <li key={moderator.profileId} className="flex items-center gap-3">
                    <Avatar name={moderator.displayName} size={32} />
                    <Link
                      href={memberProfileRoute(moderator.profileId)}
                      className="text-body-sm text-text-primary hover:underline"
                    >
                      {moderator.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {detail.knownMembers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frCommunities.detail.knownMembersTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary mb-4">
                {frCommunities.detail.knownMembersBody}
              </p>
              <ul className="flex flex-col gap-3">
                {detail.knownMembers.map((member) => (
                  <li key={member.profileId} className="flex items-center gap-3">
                    <Avatar name={member.displayName} size={32} />
                    <Link
                      href={memberProfileRoute(member.profileId)}
                      className="text-body-sm text-text-primary hover:underline"
                    >
                      {member.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {isMember ? null : (
            <Alert variant="info" title={frCommunities.detail.joinToPublish}>
              {frCommunities.detail.membersReservedBody}
            </Alert>
          )}
        </aside>
      </div>
    </div>,
  );
}
