import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import {
  PROMOTION_ROUTES,
  promotionInvitationsRoute,
  promotionInviteRoute,
  promotionMembersRoute,
  promotionRoute,
} from '@/lib/routes/promotions';
import { memberProfileRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadPromotionInvitations } from '@/lib/queries/promotions';
import { completionRate, formatDateTime } from '@/lib/collaborate-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  LINK_BUTTON,
  LoadMoreLink,
  PageHeader,
  StatGrid,
  TabLinks,
} from '@/components/collaborate/CollaborateUI';
import { revokeInvitationAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.overview.tabInvitations };

const SCOPES = ['to_follow', 'claimed', 'to_find', 'all'] as const;
type Scope = (typeof SCOPES)[number];

const STATUS_LABEL: Record<string, string> = {
  none: frPromotions.invitations.statusNone,
  sent: frPromotions.invitations.statusSent,
  opened: frPromotions.invitations.statusOpened,
  claimed: frPromotions.invitations.statusClaimed,
  expired: frPromotions.invitations.statusExpired,
  revoked: frPromotions.invitations.statusRevoked,
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  none: 'warning',
  sent: 'neutral',
  opened: 'info',
  claimed: 'success',
  expired: 'error',
  revoked: 'neutral',
};

const SUCCESS: Record<string, string> = {
  invited: frPromotions.invitations.statusSent,
  revoked: frPromotions.invitations.statusRevoked,
};

/**
 * ISE-071 — Suivi des invitations.
 *
 * L'ecran montre des ETATS, jamais une coordonnee : ni l'adresse
 * destinataire — seule son empreinte existe en base — ni le jeton, qui
 * n'a ete affiche qu'une fois a son emetteur.
 */
export default async function PromotionInvitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ promotionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { promotionId: rawId } = await params;
  const promotionId = Number.parseInt(rawId, 10);
  if (Number.isNaN(promotionId)) notFound();

  const query = await searchParams;
  const feedback = readFeedback(query);
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  const rawScope = one(query['onglet']) ?? 'to_follow';
  const scope: Scope = (SCOPES as readonly string[]).includes(rawScope)
    ? (rawScope as Scope)
    : 'to_follow';
  const cursor = unsealCursor(one(query['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, page] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadPromotionInvitations(promotionId, scope, cursor, correlationId),
  ]);

  const base = promotionInvitationsRoute(promotionId);
  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!page.ok) {
    return shell(
      <ErrorState
        title={frPromotions.common.loadErrorTitle}
        description={page.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const { rows, summary } = page.data;
  const referenced = summary.toFind + summary.claimed;
  const rate = completionRate(summary.claimed, referenced);

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frPromotions.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: frPromotions.hub.promotionTitle, href: promotionRoute(promotionId) },
          { label: frPromotions.overview.tabInvitations, href: null },
        ]}
      />

      <PageHeader
        title={frPromotions.invitations.title.replace('{promotion}', String(promotionId))}
        subtitle={frPromotions.invitations.subtitle}
        actions={
          <Link
            href={`${promotionMembersRoute(promotionId)}?onglet=to_find`}
            className={LINK_BUTTON}
          >
            {frPromotions.overview.invite}
          </Link>
        }
      />

      <FeedbackBanner feedback={feedback} catalog={frPromotions.errors} successCatalog={SUCCESS} />

      <StatGrid
        label={frPromotions.overview.inBrief}
        items={[
          { value: String(summary.toFind), caption: frPromotions.invitations.statToFind },
          { value: String(summary.sent), caption: frPromotions.invitations.statSent },
          { value: String(summary.opened), caption: frPromotions.invitations.statOpened },
          { value: String(summary.claimed), caption: frPromotions.invitations.statClaimed },
        ]}
      />

      {rate === null ? null : (
        <Card>
          <p className="text-body text-text-primary font-semibold">
            {frPromotions.invitations.progress
              .replace('{claimed}', String(summary.claimed))
              .replace('{referenced}', String(referenced))}
          </p>
          <p className="text-caption text-text-secondary mt-1">
            {frPromotions.invitations.progressBody
              .replace('{rate}', String(rate))
              .replace('{toFind}', String(summary.toFind))}
          </p>
          <div
            role="img"
            aria-label={`${rate} %`}
            className="bg-surface-muted mt-4 h-2 w-full overflow-hidden rounded-full"
          >
            <div className="bg-primary h-full" style={{ width: `${rate}%` }} />
          </div>
        </Card>
      )}

      <TabLinks
        label={frPromotions.overview.tabInvitations}
        current={scope}
        items={[
          { id: 'to_follow', label: frPromotions.invitations.tabToFollow, href: base },
          {
            id: 'claimed',
            label: frPromotions.invitations.tabClaimed,
            href: `${base}?onglet=claimed`,
          },
          {
            id: 'to_find',
            label: frPromotions.invitations.tabToFind,
            href: `${base}?onglet=to_find`,
          },
          { id: 'all', label: frPromotions.invitations.tabAll, href: `${base}?onglet=all` },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={frPromotions.invitations.emptyTitle}
          description={frPromotions.invitations.emptyBody}
          action={
            <Link href={promotionMembersRoute(promotionId)} className={LINK_BUTTON}>
              {frPromotions.overview.seeAllMembers}
            </Link>
          }
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <caption className="sr-only">{frPromotions.invitations.title}</caption>
              <thead>
                <tr className="border-border border-b">
                  <th scope="col" className="text-caption text-text-secondary px-5 py-3 text-left">
                    {frPromotions.invitations.columnMember}
                  </th>
                  <th scope="col" className="text-caption text-text-secondary px-5 py-3 text-left">
                    {frPromotions.invitations.columnStatus}
                  </th>
                  <th scope="col" className="text-caption text-text-secondary px-5 py-3 text-left">
                    {frPromotions.invitations.columnChannel}
                  </th>
                  <th scope="col" className="text-caption text-text-secondary px-5 py-3 text-left">
                    {frPromotions.invitations.columnLastAction}
                  </th>
                  <th scope="col" className="text-caption text-text-secondary px-5 py-3 text-left">
                    {frPromotions.invitations.columnAction}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.profileId} className="border-border border-b last:border-0">
                    <td className="text-body-sm text-text-primary px-5 py-4 font-medium">
                      {row.displayName}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={STATUS_TONE[row.invitationStatus] ?? 'neutral'}>
                        {STATUS_LABEL[row.invitationStatus] ?? row.invitationStatus}
                      </Badge>
                    </td>
                    <td className="text-caption text-text-secondary px-5 py-4">
                      {row.channel === 'email'
                        ? frPromotions.invitations.channelEmail
                        : row.channel === 'link'
                          ? frPromotions.invitations.channelLink
                          : '—'}
                    </td>
                    <td className="text-caption text-text-secondary px-5 py-4">
                      {formatDateTime(row.lastActionAt) ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      {row.claimStatus === 'claimed' ? (
                        <Link href={memberProfileRoute(row.profileId)} className={LINK_BUTTON}>
                          {frPromotions.invitations.actionSeeProfile}
                        </Link>
                      ) : row.invitationId !== null &&
                        (row.invitationStatus === 'sent' || row.invitationStatus === 'opened') ? (
                        <form action={revokeInvitationAction}>
                          <input type="hidden" name="promotionId" value={promotionId} />
                          <input type="hidden" name="invitationId" value={row.invitationId} />
                          <button type="submit" className={LINK_BUTTON}>
                            {frPromotions.invitations.actionRevoke}
                          </button>
                        </form>
                      ) : (
                        <Link
                          href={promotionInviteRoute(promotionId, row.profileId)}
                          className={LINK_BUTTON}
                        >
                          {frPromotions.invitations.actionHelp}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <LoadMoreLink
        href={`${base}?onglet=${scope}`}
        label={frPromotions.invitations.loadMore}
        nextCursor={page.data.nextCursor}
      />

      <p className="text-caption text-text-secondary">{frPromotions.invitations.footerNote}</p>
    </div>,
  );
}
