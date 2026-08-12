import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminNews } from '@/i18n/admin-news';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminNewsDetail } from '@/lib/admin/queries-news';
import { formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { ActionButton } from '../../_components/ActionButton';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { NewsEditForm } from './NewsEditForm';
import { setNewsStatusAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminNews.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** Cibles de statut atteignables depuis chaque statut courant (0110, admin_set_news_status). */
const STATUS_TARGETS: Record<string, readonly string[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
};

/**
 * Fiche article (0110, tache #83) : edition du contenu + cycle
 * editorial (brouillon / publie / archive), un seul ecran — meme
 * principe que la fiche evenement SA-031.
 *
 * Frontiere D-128, rappelee a l'ecran : publier ICI rend l'article
 * editorialement publie, mais ne l'affiche pas sur la landing.
 * L'exposition (visible / mis en avant) se regle ensuite dans le CMS.
 */
export default async function AdminNewsDetailPage({
  params,
}: {
  params: Promise<{ newsId: string }>;
}) {
  const access = await requireAdminPermission('content.publish');
  const { newsId } = await params;
  const correlationId = newCorrelationId();

  const detail = await loadAdminNewsDetail(newsId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.news} screenTitle={frAdminNews.detail.title}>
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdminNews.detail.title} subtitle={frAdminNews.list.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.news} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const news = detail.data;
  const statusTargets = STATUS_TARGETS[news.editorialStatus] ?? [];

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.news} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader title={news.title} subtitle={news.summary}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={news.editorialStatus}
              label={frAdminNews.status[news.editorialStatus] ?? news.editorialStatus}
            />
            <StatusBadge
              status={news.categoryCode}
              label={frAdminNews.category[news.categoryCode] ?? news.categoryCode}
            />
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdminNews.detail.contentTitle}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdminNews.detail.createdAt}>{formatDateTime(news.createdAt)}</KeyValue>
          <KeyValue label={frAdminNews.detail.publishedAt}>
            {news.publishedAt !== null ? formatDateTime(news.publishedAt) : frAdmin.common.none}
          </KeyValue>
        </dl>
      </SectionCard>

      {statusTargets.length > 0 ? (
        <SectionCard title={frAdminNews.detail.lifecycleTitle}>
          <p className="text-caption text-text-muted">{frAdminNews.detail.lifecycleHint}</p>
          <div className="flex flex-wrap gap-3">
            {statusTargets.map((target) => (
              <ActionButton
                key={target}
                action={setNewsStatusAction}
                fields={{ newsId, status: target }}
                label={`${frAdminNews.detail.setStatus} : ${frAdminNews.status[target]}`}
                variant="secondary"
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {news.editorialStatus === 'published' ? (
        <Alert variant="info" title={frAdminNews.detail.exposureTitle}>
          {frAdminNews.detail.exposureHint}
        </Alert>
      ) : null}

      <SectionCard title={frAdminNews.form.editTitle}>
        <NewsEditForm news={news} />
      </SectionCard>
    </div>,
  );
}
