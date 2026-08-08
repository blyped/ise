import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { INTRODUCTION_STATUS_LABELS } from '@ise/domain';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { NETWORK_ROUTES, introductionRoute } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { formatDate, loadIntroductions } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.follow.listTitle };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const ROLE_LABEL = {
  requester: frNetwork.follow.roleRequester,
  intermediary: frNetwork.follow.roleIntermediary,
  target: frNetwork.follow.roleTarget,
} as const;

/**
 * Point d'entree d'ISE-045 : les introductions qui me concernent, quel
 * que soit mon role.
 *
 * La liste est celle que la base accepte de composer. En particulier,
 * une demande dont je suis la CIBLE n'y figure qu'a partir de
 * `introduced` : tant que l'introduction n'a pas ete transmise, elle
 * n'existe pas pour moi — ce n'est pas un filtre d'affichage, c'est
 * `list_my_introductions()` qui refuse de la renvoyer.
 */
export default async function IntroductionsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadIntroductions('all', null, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={NETWORK_ROUTES.connections}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d’Ariane">
        <ol className="text-body-sm text-text-muted flex flex-wrap items-center gap-2">
          <li>
            <Link
              href={NETWORK_ROUTES.connections}
              className="text-primary hover:text-primary-hover focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frNetwork.common.breadcrumbNetwork}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-primary font-medium">
            {frNetwork.follow.listTitle}
          </li>
        </ol>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.follow.listTitle}</h1>
        <p className="text-body text-text-secondary max-md:hidden">
          {frNetwork.follow.listSubtitle}
        </p>
      </div>
    </div>
  );

  if (!result.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frNetwork.follow.errorTitle}
          description={result.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={NETWORK_ROUTES.introductions} className={ACTION_LINK}>
              {frNetwork.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = result.data.rows;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {tn(frNetwork.follow.listAnnounce, { count: rows.length })}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title={frNetwork.follow.listEmptyTitle}
          description={frNetwork.follow.listEmptyBody}
          action={
            <Link href={SEARCH_ROUTES.find} className={ACTION_LINK}>
              {frNetwork.connections.findMember}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-5">
          {rows.map((row) => (
            <li key={row.introductionId}>
              <Card padding="sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                  <div className="min-w-0">
                    <p className="text-body text-text-primary font-semibold">
                      {row.requester?.displayName ?? '—'} → {row.intermediary?.displayName ?? '—'} →{' '}
                      {row.target?.displayName ?? '—'}
                    </p>
                    <p className="text-body-sm text-text-secondary mt-1">
                      {frNetwork.follow.purposeLabel} :{' '}
                      {frNetwork.purpose[row.purpose] ?? row.purpose}
                    </p>
                    <p className="text-caption text-text-muted mt-1">
                      {ROLE_LABEL[row.myRole]}
                      {row.createdAt !== null ? ` · ${formatDate(row.createdAt)}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                    {/* Le statut est double par son libelle : la couleur
                        ne porte jamais seule l'information (D-90). */}
                    <Badge
                      tone={
                        row.status === 'completed'
                          ? 'success'
                          : row.status === 'intermediary_declined' ||
                              row.status === 'withdrawn' ||
                              row.status === 'expired' ||
                              row.status === 'no_outcome'
                            ? 'neutral'
                            : 'warning'
                      }
                    >
                      {INTRODUCTION_STATUS_LABELS[row.status]}
                    </Badge>
                    <Link href={introductionRoute(row.introductionId)} className={ACTION_LINK}>
                      {frNetwork.follow.titleShort}
                    </Link>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>,
  );
}
