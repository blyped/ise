import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { NETWORK_ROUTES, invitationRoute } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import {
  formatDate,
  loadConnectionRequests,
  type ConnectionRequestStatus,
} from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileSummary } from '@/components/network/ProfileSummary';
import { InvitationActions } from '@/components/network/InvitationActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.invitations.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Onglets d'ISE-041. Ce sont des LIENS, pas un composant a etat : chaque
 * onglet est une requete distincte cote base (`p_status`), donc une URL
 * distincte. L'onglet reste partageable, revient dans l'historique, et
 * fonctionne sans JavaScript.
 */
const TABS: readonly { id: ConnectionRequestStatus; label: string }[] = [
  { id: 'pending', label: frNetwork.invitations.tabPending },
  { id: 'accepted', label: frNetwork.invitations.tabAccepted },
  { id: 'declined', label: frNetwork.invitations.tabDeclined },
];

function isTab(value: unknown): value is ConnectionRequestStatus {
  return TABS.some((tab) => tab.id === value);
}

/**
 * ISE-041 — Invitations recues.
 *
 * ECART ASSUME : la maquette annonce « 2 avec un contexte précis · 1
 * relation de promotion ». Cette repartition n'est pas rendue : elle
 * supposerait de qualifier chaque motif comme « précis » ou non, ce
 * qu'aucune donnee ne permet. Le compteur reel — le nombre d'invitations
 * en attente — est affiche, et lui seul.
 */
export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const params = await searchParams;
  const rawTab = params['onglet'];
  const tab: ConnectionRequestStatus = isTab(rawTab) ? rawTab : 'pending';

  const correlationId = newCorrelationId();
  const [viewer, pageResult] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadConnectionRequests('received', tab, null, correlationId),
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

  const rows = pageResult.ok ? pageResult.data.rows : [];

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
            {frNetwork.invitations.title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.invitations.title}</h1>
        <p className="text-body text-text-secondary max-md:hidden">
          {frNetwork.invitations.subtitle}
        </p>
        <p className="text-body-sm text-text-secondary md:hidden">{frNetwork.invitations.pace}</p>
      </div>

      {/* Onglets : `aria-current` porte l'etat, la couleur ne fait que
          le doubler (D-90). Cible tactile 44 px. */}
      <nav aria-label={frNetwork.invitations.title}>
        <ul className="border-border flex flex-wrap gap-2 border-b">
          {TABS.map((item) => {
            const isCurrent = item.id === tab;
            return (
              <li key={item.id}>
                <Link
                  href={`${NETWORK_ROUTES.invitations}?onglet=${item.id}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`rounded-t-base text-body-sm focus-visible:outline-active-blue inline-flex min-h-[44px] items-center px-5 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    isCurrent
                      ? 'border-primary text-primary-hover border-b-2 bg-[#EFF6FF]'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );

  if (!pageResult.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frNetwork.invitations.errorTitle}
          description={pageResult.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={NETWORK_ROUTES.invitations} className={ACTION_LINK}>
              {frNetwork.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const emptyCopy =
    tab === 'pending'
      ? {
          title: frNetwork.invitations.emptyPendingTitle,
          body: frNetwork.invitations.emptyPendingBody,
        }
      : tab === 'accepted'
        ? {
            title: frNetwork.invitations.emptyAcceptedTitle,
            body: frNetwork.invitations.emptyAcceptedBody,
          }
        : {
            title: frNetwork.invitations.emptyDeclinedTitle,
            body: frNetwork.invitations.emptyDeclinedBody,
          };

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      {tab === 'pending' && rows.length > 0 ? (
        <p className="text-body text-text-primary font-semibold">
          {rows.length === 1
            ? tn(frNetwork.invitations.countPending, { count: 1 })
            : tn(frNetwork.invitations.countPendingPlural, { count: rows.length })}
        </p>
      ) : null}

      {/* 375 px : les repères pédagogiques passent SOUS la liste — la
          decision prime sur l'explication.
          1440 px : ils deviennent un rail lateral consultable pendant
          l'examen de chaque invitation. */}
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frNetwork.invitations.title} className="flex min-w-0 flex-col gap-5">
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            {tn(frNetwork.invitations.announce, { count: rows.length })}
          </p>

          {rows.length === 0 ? (
            <EmptyState
              title={emptyCopy.title}
              description={emptyCopy.body}
              action={
                <Link href={SEARCH_ROUTES.find} className={ACTION_LINK}>
                  {frNetwork.connections.findMember}
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-5">
              {rows.map((row) => (
                <li key={row.requestId}>
                  <Card padding="sm">
                    <ProfileSummary card={row.profile} size={48} compact />

                    <dl className="border-border mt-4 flex flex-col gap-3 border-t pt-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
                        <dt className="text-caption text-text-muted">
                          {frNetwork.invitations.motiveLabel}
                        </dt>
                        <dd className="text-body-sm text-text-primary font-medium sm:text-right">
                          {row.context !== null
                            ? (frNetwork.context[row.context] ?? row.context)
                            : frNetwork.sent.motiveNone}
                        </dd>
                      </div>

                      {/* Le message complet n'est pas rendu ici : il est
                          lu sur l'ecran de detail (ISE-042). A 375 px la
                          citation rendrait la carte illisible. */}
                      {row.message !== null ? (
                        <div className="max-md:hidden">
                          <dt className="sr-only">{frNetwork.invitation.messageTitle}</dt>
                          <dd className="rounded-base bg-surface-muted text-body-sm text-text-secondary line-clamp-2 p-3">
                            « {row.message} »
                          </dd>
                        </div>
                      ) : null}

                      {row.createdAt !== null ? (
                        <div className="text-caption text-text-muted">
                          {tn(frNetwork.invitation.receivedAt, {
                            date: formatDate(row.createdAt),
                          })}
                        </div>
                      ) : null}
                    </dl>

                    {tab === 'pending' ? (
                      <div className="mt-5">
                        <InvitationActions
                          requestId={row.requestId}
                          ignoreHref={`${NETWORK_ROUTES.invitations}?onglet=pending`}
                          detailHref={invitationRoute(row.requestId)}
                        />
                      </div>
                    ) : (
                      <p className="mt-5">
                        <Link href={invitationRoute(row.requestId)} className={ACTION_LINK}>
                          {frNetwork.invitations.detail}
                        </Link>
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.invitations.beforeTitle}</CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
              {frNetwork.invitations.beforeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.invitations.acceptMeansTitle}</CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
              {frNetwork.invitations.acceptMeansItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-body-sm text-success mt-4 font-semibold">
              {frNetwork.invitations.acceptMeansNote}
            </p>
          </Card>

          <Alert variant="warning" title={frNetwork.invitations.declineMeansTitle}>
            {frNetwork.invitations.declineMeansBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
