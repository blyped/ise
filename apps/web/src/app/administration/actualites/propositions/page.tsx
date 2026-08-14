import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { ADMIN_ROUTES, adminNewsProposalRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadProposalQueue, type QueueState } from '@/lib/admin/queries-proposals';
import { paramOneOf, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader } from '../../_components/PageHeader';
import { ProposalQueueList } from '@/components/proposals/AdminProposalViews';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContentProposals.admin.newsQueueTitle };

const TAB_BASE =
  'inline-flex min-h-[44px] items-center border-b-2 px-4 text-body-sm transition-colors ' +
  'duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * FILE DE VALIDATION DES PROPOSITIONS D'ACTUALITÉS (0132).
 *
 * Écran distinct de `/administration/actualites`, qui liste les articles
 * de la rédaction : ici, on ne rédige pas, on tranche. Les deux ne se
 * mélangent pas — la liste éditoriale a ses filtres et ses huit états,
 * cette file n'en a que deux.
 *
 * Permission `content.publish`, vérifiée ici ET par
 * `admin_list_content_proposals` en base.
 */
export default async function NewsProposalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('content.publish');
  const params = await searchParams;
  const state = (paramOneOf(params, 'etat', ['pending', 'rejected']) ?? 'pending') as QueueState;
  const correlationId = newCorrelationId();

  const queue = await loadProposalQueue('news', state, correlationId);
  const labels = frContentProposals.admin;

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.news}
      screenTitle={labels.newsQueueTitle}
    >
      {children}
    </AdminShell>
  );

  const tabs = (
    <nav aria-label={labels.newsQueueTitle} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {(
          [
            { id: 'pending', label: labels.tabPending },
            { id: 'rejected', label: labels.tabRejected },
          ] as const
        ).map((tab) => (
          <li key={tab.id}>
            <Link
              href={`${ADMIN_ROUTES.newsProposals}?etat=${tab.id}`}
              aria-current={tab.id === state ? 'page' : undefined}
              className={`${TAB_BASE} ${
                tab.id === state
                  ? 'border-primary text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary border-transparent'
              }`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  const header = (
    <PageHeader
      title={labels.newsQueueTitle}
      subtitle={labels.newsQueueSubtitle}
      action={{ href: ADMIN_ROUTES.news, label: frContentProposals.common.back }}
    />
  );

  if (!queue.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frContentProposals.common.loadErrorTitle}
          description={queue.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      {queue.data.length === 0 ? (
        <EmptyState
          title={state === 'pending' ? labels.empty : labels.emptyRejected}
          description={state === 'pending' ? labels.emptyBody : labels.emptyRejectedBody}
        />
      ) : (
        <ProposalQueueList
          rows={queue.data}
          detailHref={adminNewsProposalRoute}
          label={labels.newsQueueTitle}
        />
      )}
    </div>,
  );
}
