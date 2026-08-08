import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Avatar, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import {
  PROMOTION_ROUTES,
  promotionInvitationsRoute,
  promotionMembersRoute,
  promotionRoute,
} from '@/lib/routes/promotions';
import { NETWORK_ROUTES } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadPromotionOverview } from '@/lib/queries/promotions';
import { completionRate, formatDateTime } from '@/lib/collaborate-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  StatGrid,
  TabLinks,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.overview.kicker };

const MANAGER_LABEL: Record<string, string> = {
  delegate: frPromotions.overview.managerDelegate,
  co_delegate: frPromotions.overview.managerCoDelegate,
  referent: frPromotions.overview.managerReferent,
};

/**
 * ISE-067 — Ma promotion.
 *
 * UN ESPACE PROFESSIONNEL, PAS UN RESEAU SOCIAL NOSTALGIQUE
 * (MASTER PROMPT §28). Consequences visibles ici : les nouvelles sont
 * limitees a trois entrees factuelles, il n'existe ni « J'aime », ni
 * reaction, ni fil ; le taux de reconstitution est affiche sans
 * comparaison a une autre promotion (CA-PROMO-02) ; et un bloc pousse
 * explicitement vers le reseau global (CA-PROMO-09).
 */
export default async function PromotionOverviewPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { promotionId: rawId } = await params;
  const promotionId = Number.parseInt(rawId, 10);
  if (Number.isNaN(promotionId)) notFound();

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadPromotionOverview(promotionId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!result.ok) {
    return shell(
      <ErrorState
        title={frPromotions.common.loadErrorTitle}
        description={result.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }
  const promotion = result.data;
  if (promotion === null) notFound();

  const rate = completionRate(promotion.stats.claimed, promotion.stats.referenced);

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frPromotions.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: frPromotions.hub.promotionTitle, href: PROMOTION_ROUTES.mine },
          { label: promotion.label, href: null },
        ]}
      />

      <section className="rounded-base bg-[#0F172A] px-6 py-8 text-white sm:px-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-caption font-semibold tracking-[0.14em] text-[#FBBF24]">
              {frPromotions.overview.kicker}
            </p>
            <h1 className="text-h1 font-bold">{promotion.label}</h1>
            <p className="text-body max-w-[62ch] text-[#CBD5E1]">
              {promotion.description ?? frPromotions.overview.subtitle}
            </p>
            <p className="text-caption text-[#94A3B8]">
              {promotion.stats.referenced} {frPromotions.overview.statReferenced} ·{' '}
              {promotion.stats.claimed} {frPromotions.overview.statClaimed}
            </p>
          </div>
          {promotion.isMember ? (
            <Link href={promotionInvitationsRoute(promotion.promotionId)} className={LINK_BUTTON}>
              {frPromotions.overview.invite}
            </Link>
          ) : null}
        </div>
      </section>

      <TabLinks
        label={frPromotions.overview.kicker}
        current="overview"
        items={[
          {
            id: 'overview',
            label: frPromotions.overview.tabOverview,
            href: promotionRoute(promotion.promotionId),
          },
          {
            id: 'members',
            label: frPromotions.overview.tabMembers,
            href: promotionMembersRoute(promotion.promotionId),
          },
          {
            id: 'invitations',
            label: frPromotions.overview.tabInvitations,
            href: promotionInvitationsRoute(promotion.promotionId),
          },
        ]}
      />

      {promotion.isMember ? null : (
        <Alert variant="info" title={frPromotions.overview.otherPromotionTitle}>
          <span className="flex flex-col gap-3">
            <span>{frPromotions.overview.otherPromotionBody}</span>
            <Link href={PROMOTION_ROUTES.mine} className={LINK_BUTTON}>
              {frPromotions.overview.backToMine}
            </Link>
          </span>
        </Alert>
      )}

      <StatGrid
        label={frPromotions.overview.inBrief}
        items={[
          {
            value: String(promotion.stats.referenced),
            caption: frPromotions.overview.statReferenced,
          },
          { value: String(promotion.stats.claimed), caption: frPromotions.overview.statClaimed },
          { value: String(promotion.stats.verified), caption: frPromotions.overview.statVerified },
          {
            value: String(promotion.stats.countries),
            caption: frPromotions.overview.statCountries,
          },
        ]}
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          {promotion.classmates === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frPromotions.overview.classmates}</CardTitle>
              </CardHeader>
              {promotion.classmates.length === 0 ? (
                <p className="text-body-sm text-text-secondary">
                  {frPromotions.members.emptyTitle}
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {promotion.classmates.map((mate) => (
                    <li key={mate.profileId} className="flex items-center gap-3">
                      <Avatar name={mate.displayName} size={40} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-body-sm text-text-primary truncate font-semibold">
                          {mate.displayName}
                        </span>
                        <span className="text-caption text-text-secondary truncate">
                          {[mate.city, mate.organization].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-5">
                <Link href={promotionMembersRoute(promotion.promotionId)} className={LINK_BUTTON}>
                  {frPromotions.overview.seeAllMembers}
                </Link>
              </p>
            </Card>
          )}

          {promotion.news === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frPromotions.overview.newsTitle}</CardTitle>
              </CardHeader>
              {promotion.news.length === 0 ? (
                <p className="text-body-sm text-text-secondary">
                  {frPromotions.overview.newsEmpty}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {promotion.news.map((item) => (
                    <li key={item.newsId} className="flex flex-col gap-1">
                      <span className="text-body-sm text-text-primary font-medium">
                        {item.title}
                      </span>
                      {item.summary === null ? null : (
                        <span className="text-caption text-text-secondary">{item.summary}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.overview.networkBridgeTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {frPromotions.overview.networkBridgeBody}
            </p>
            <p className="mt-5">
              <Link href={NETWORK_ROUTES.connections} className={LINK_BUTTON}>
                {frPromotions.overview.networkBridgeAction}
              </Link>
            </p>
          </Card>
        </div>

        <aside className="flex flex-col gap-7">
          {rate === null || !promotion.isMember ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frPromotions.overview.toFindTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frPromotions.overview.toFindBody.replace(
                  '{count}',
                  String(promotion.toFindCount ?? 0),
                )}
              </p>
              <div
                role="img"
                aria-label={`${rate} %`}
                className="bg-surface-muted mt-4 h-2 w-full overflow-hidden rounded-full"
              >
                <div className="bg-primary h-full" style={{ width: `${rate}%` }} />
              </div>
              <p className="text-caption text-text-secondary mt-2">{rate} %</p>
              <p className="mt-5">
                <Link
                  href={`${promotionMembersRoute(promotion.promotionId)}?onglet=to_find`}
                  className={PRIMARY_BUTTON}
                >
                  {frPromotions.overview.toFindAction}
                </Link>
              </p>
            </Card>
          )}

          {promotion.managers.length === 0 ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frPromotions.overview.managersTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-3">
                {promotion.managers.map((manager) => (
                  <li key={manager.profileId} className="flex items-center gap-3">
                    <Avatar name={manager.displayName} size={32} />
                    <span className="flex flex-col">
                      <span className="text-body-sm text-text-primary font-medium">
                        {manager.displayName}
                      </span>
                      <span className="text-caption text-text-secondary">
                        {MANAGER_LABEL[manager.managerRole] ?? manager.managerRole}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {promotion.nextEvent === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frPromotions.overview.nextEventTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-primary font-semibold">
                {promotion.nextEvent.title}
              </p>
              <p className="text-caption text-text-secondary mt-1">
                {[formatDateTime(promotion.nextEvent.startsAt), promotion.nextEvent.city]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {promotion.nextEvent.format === null ? null : (
                <p className="mt-3">
                  <Badge tone="neutral">{promotion.nextEvent.format}</Badge>
                </p>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>,
  );
}
