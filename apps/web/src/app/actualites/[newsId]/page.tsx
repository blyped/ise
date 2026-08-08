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
import { frContent } from '@/i18n/content';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES, newsRoute } from '@/lib/routes/content';
import { memberProfileRoute } from '@/lib/routes/search';
import { composeRoute } from '@/lib/routes/messaging';
import { reportRoute } from '@/lib/routes/support';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNews } from '@/lib/queries/content';
import { formatDay } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import { ACTION_LINK, CHIP } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContent.news.breadcrumb };

/**
 * ISE-093 — Détail d'une actualité.
 *
 * L'écran dit explicitement si le contenu paraît sur le site public :
 * une actualité en `landing_visibility = 'visible'` est lue par
 * n'importe quel visiteur, y compris sans compte (D-123). Ce fait est
 * affiché, jamais modifiable ici — l'exposer relève de `cms.publish`
 * (D-131), et le circuit éditorial de `content.publish` (D-128).
 *
 * ÉCART ASSUMÉ : le bouton « Féliciter » de la maquette n'ouvre pas un
 * compteur de félicitations. Il ouvre une conversation : un message vaut
 * mieux qu'un compteur, et le MASTER PROMPT §1 exclut la mécanique de
 * réaction.
 */
export default async function NewsDetailPage({ params }: { params: Promise<{ newsId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { newsId } = await params;
  const correlationId = newCorrelationId();

  const [viewer, news] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNews(newsId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CONTENT_ROUTES.news}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!news.ok) {
    return shell(
      <ErrorState
        title={frContent.common.loadErrorTitle}
        description={news.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const detail = news.data;
  if (detail === null) {
    return shell(
      <EmptyState
        title={frContent.newsDetail.notFoundTitle}
        description={frContent.newsDetail.notFoundBody}
        action={
          <Link href={CONTENT_ROUTES.news} className={ACTION_LINK}>
            {frContent.news.breadcrumb}
          </Link>
        }
      />,
    );
  }

  const mainProfile = detail.profiles[0] ?? null;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <Link href={CONTENT_ROUTES.news} className="text-primary hover:underline">
          {frContent.news.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span> <span>{detail.categoryName ?? ''}</span>
      </nav>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <article className="flex min-w-0 flex-col gap-6">
          <Card>
            <Badge tone="info">{detail.categoryName ?? ''}</Badge>
            <h1 className="text-h1 text-text-primary mt-4 max-w-[36ch] font-bold">
              {detail.title}
            </h1>

            {mainProfile === null ? null : (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Avatar name={mainProfile.displayName} size={48} />
                <div className="min-w-0">
                  <p className="text-body-sm text-text-primary font-medium">
                    {mainProfile.displayName}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {[mainProfile.promotionLabel, mainProfile.currentPosition]
                      .filter((value) => value !== null)
                      .join(' · ')}
                  </p>
                </div>
                <span className="ml-auto flex flex-wrap gap-3">
                  <Link href={memberProfileRoute(mainProfile.profileId)} className={ACTION_LINK}>
                    {frContent.common.seeProfile}
                  </Link>
                  <Link href={composeRoute(mainProfile.profileId)} className={ACTION_LINK}>
                    {frContent.newsDetail.sendMessage}
                  </Link>
                </span>
              </div>
            )}

            <p className="text-caption text-text-muted mt-4">
              {detail.publishedAt === null
                ? ''
                : `${frContent.newsDetail.publishedOn} ${formatDay(detail.publishedAt) ?? ''}`}
              {detail.eventDate === null
                ? ''
                : ` · ${frContent.newsDetail.eventDate} : ${formatDay(detail.eventDate) ?? ''}`}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.newsDetail.changeTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary whitespace-pre-line">{detail.summary}</p>
            {detail.body === null ? null : (
              <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
                {detail.body}
              </p>
            )}

            {detail.skills.length > 0 ? (
              <div className="border-border mt-5 border-t pt-4">
                <h3 className="text-body-sm text-text-primary font-semibold">
                  {frContent.newsDetail.skillsTitle}
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {detail.skills.map((skill) => (
                    <li key={skill} className={CHIP}>
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {detail.profiles.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.newsDetail.peopleTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-3">
                {detail.profiles.map((profile) => (
                  <li key={profile.profileId} className="flex items-center gap-3">
                    <Avatar name={profile.displayName} size={32} />
                    <Link
                      href={memberProfileRoute(profile.profileId)}
                      className="text-body-sm text-text-primary hover:underline"
                    >
                      {profile.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Alert variant="info" title={frContent.newsDetail.noReactionsTitle}>
            {frContent.newsDetail.noReactionsBody}
          </Alert>
        </article>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">
                {detail.landingVisibility === 'visible'
                  ? frContent.landing.visibleTitle
                  : frContent.landing.hiddenTitle}
              </CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {detail.landingVisibility === 'visible'
                ? frContent.landing.visibleBody
                : frContent.landing.hiddenBody}
            </p>
          </Card>

          {detail.sources.length > 0 || detail.sourceUrl !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.newsDetail.sourcesTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-2">
                {detail.sourceUrl === null ? null : (
                  <li className="text-body-sm">
                    <a
                      href={detail.sourceUrl}
                      rel="noreferrer noopener"
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      {frContent.common.seeSource}
                    </a>
                  </li>
                )}
                {detail.sources.map((source, index) => (
                  <li key={`${source.sourceType}-${index}`} className="text-body-sm">
                    {source.sourceUrl === null ? (
                      <span className="text-text-secondary">
                        {source.title ?? source.sourceType}
                      </span>
                    ) : (
                      <a
                        href={source.sourceUrl}
                        rel="noreferrer noopener"
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        {source.title ?? source.sourceType}
                      </a>
                    )}
                    <span className="text-caption text-text-muted">
                      {' '}
                      —{' '}
                      {source.verifiedAt === null
                        ? frContent.newsDetail.sourceUnverified
                        : `${frContent.newsDetail.sourceVerified} ${formatDay(source.verifiedAt) ?? ''}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.newsDetail.reliabilityTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {frContent.newsDetail.reliabilityBody}
            </p>
            <p className="mt-5">
              <Link href={reportRoute('news', detail.newsId)} className={ACTION_LINK}>
                {frContent.newsDetail.report}
              </Link>
            </p>
          </Card>

          {detail.communities.length > 0 || detail.promotion !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.newsDetail.communitiesTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-wrap gap-2">
                {detail.promotion === null ? null : <li className={CHIP}>{detail.promotion}</li>}
                {detail.communities.map((community) => (
                  <li key={community.id} className={CHIP}>
                    {community.name}
                  </li>
                ))}
                {detail.organizations.map((organization) => (
                  <li key={organization.id} className={CHIP}>
                    {organization.name}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {detail.related.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.newsDetail.relatedTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-3">
                {detail.related.map((related) => (
                  <li key={related.newsId}>
                    <Link
                      href={newsRoute(related.newsId)}
                      className="text-body-sm text-text-primary hover:underline"
                    >
                      {related.title}
                    </Link>
                    <p className="text-caption text-text-muted">
                      {formatDay(related.publishedAt) ?? ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>,
  );
}
