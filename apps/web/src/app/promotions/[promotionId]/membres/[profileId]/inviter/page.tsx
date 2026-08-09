import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import {
  PROMOTION_ROUTES,
  promotionInvitationsRoute,
  promotionMembersRoute,
  promotionReferencedMemberRoute,
  promotionRoute,
} from '@/lib/routes/promotions';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { publicEnv } from '@/lib/env';
import { invitationRoute } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadReferencedMember } from '@/lib/queries/promotions';
import { formatDate } from '@/lib/collaborate-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  INPUT,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
} from '@/components/collaborate/CollaborateUI';
import { createInvitationAction } from '../../../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.overview.invite };

/**
 * ISE-070 — Inviter un camarade à réclamer son profil.
 *
 * DEUX GARANTIES AFFICHEES LITTERALEMENT :
 *   * aucun compte n'est cree a la place du camarade — c'est lui qui
 *     decide ;
 *   * le lien d'invitation n'apparait QU'UNE FOIS. La plateforme n'en
 *     conserve qu'une empreinte ([U 110]) : elle ne pourra pas le
 *     reafficher, et l'ecran le dit avant que l'utilisateur ne quitte
 *     la page.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ promotionId: string; profileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { promotionId: rawId, profileId } = await params;
  const promotionId = Number.parseInt(rawId, 10);
  if (Number.isNaN(promotionId)) notFound();

  const query = await searchParams;
  const feedback = readFeedback(query);
  const token = typeof query['jeton'] === 'string' ? query['jeton'] : null;

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadReferencedMember(profileId, correlationId),
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
  const member = result.data;
  if (member === null) notFound();

  const firstName = member.displayName.split(' ')[0] ?? member.displayName;

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frPromotions.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: member.promotionLabel, href: promotionRoute(promotionId) },
          {
            label: member.displayName,
            href: promotionReferencedMemberRoute(promotionId, member.profileId),
          },
          { label: frPromotions.overview.invite, href: null },
        ]}
      />

      <PageHeader
        title={frPromotions.invite.title.replace('{name}', firstName)}
        subtitle={frPromotions.invite.subtitle}
      />

      <FeedbackBanner feedback={feedback} catalog={frPromotions.errors} />

      {token === null ? null : (
        <Alert variant="success" title={frPromotions.invite.tokenTitle}>
          <span className="flex flex-col gap-3">
            <span>{frPromotions.invite.tokenBody}</span>
            <code className="rounded-base border-border bg-surface text-body-sm text-text-primary block overflow-x-auto border px-4 py-3">
              {`${publicEnv().NEXT_PUBLIC_SITE_URL}${invitationRoute(token)}`}
            </code>
            <span className="text-caption">
              {frPromotions.invite.tokenExpiry.replace(
                '{date}',
                formatDate(member.pendingInvitation?.expiresAt ?? null) ?? '',
              )}
            </span>
            <span className="flex flex-wrap gap-3">
              <Link href={promotionInvitationsRoute(promotionId)} className={LINK_BUTTON}>
                {frPromotions.overview.tabInvitations}
              </Link>
            </span>
          </span>
        </Alert>
      )}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.invite.modeTitle}</CardTitle>
            </CardHeader>
            <form action={createInvitationAction} className="flex flex-col gap-5">
              <input type="hidden" name="promotionId" value={promotionId} />
              <input type="hidden" name="profileId" value={member.profileId} />
              {/* Personnalisation du corps de l'e-mail uniquement : la
                  fonction SQL ne fait confiance a aucun de ces deux champs
                  pour l'autorisation, seulement au jeton (0087). */}
              <input type="hidden" name="invitedFirstName" value={firstName} />
              <input type="hidden" name="promotionLabel" value={member.promotionLabel} />

              <fieldset className="flex flex-col gap-3">
                <legend className="text-body-sm text-text-primary font-medium">
                  {frPromotions.invite.modeTitle}
                </legend>
                <label className="border-border rounded-base flex min-h-[44px] items-start gap-3 border p-4">
                  <input type="radio" name="channel" value="link" defaultChecked className="mt-1" />
                  <span className="flex flex-col">
                    <span className="text-body-sm text-text-primary font-semibold">
                      {frPromotions.invite.modeLink}
                    </span>
                    <span className="text-caption text-text-secondary">
                      {frPromotions.invite.modeLinkHint}
                    </span>
                  </span>
                </label>
                <label className="border-border rounded-base flex min-h-[44px] items-start gap-3 border p-4">
                  <input type="radio" name="channel" value="email" className="mt-1" />
                  <span className="flex flex-col">
                    <span className="text-body-sm text-text-primary font-semibold">
                      {frPromotions.invite.modeEmail}
                    </span>
                    <span className="text-caption text-text-secondary">
                      {frPromotions.invite.modeEmailHint}
                    </span>
                  </span>
                </label>
              </fieldset>

              <FormRow
                id="email-invitation"
                label={frPromotions.invite.emailLabel.replace('{name}', firstName)}
                hint={frPromotions.invite.emailHelp}
              >
                <input
                  id="email-invitation"
                  name="email"
                  type="email"
                  autoComplete="off"
                  className={INPUT}
                  aria-describedby="email-invitation-aide"
                />
              </FormRow>

              <Alert variant="info" title={frPromotions.invite.noAccountTitle}>
                {frPromotions.invite.noAccountBody.replace('{name}', firstName)}
              </Alert>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={promotionReferencedMemberRoute(promotionId, member.profileId)}
                  className={LINK_BUTTON}
                >
                  {frPromotions.common.cancel}
                </Link>
                <button type="submit" className={PRIMARY_BUTTON}>
                  {frPromotions.invite.submit}
                </button>
              </div>
            </form>
          </Card>
        </div>

        <aside className="flex flex-col gap-7">
          <Card className="bg-[#0F172A] text-white">
            <CardHeader>
              <CardTitle as="h2" className="text-white">
                {frPromotions.invite.previewTitle}
              </CardTitle>
            </CardHeader>
            <p className="text-body-sm text-[#CBD5E1]">
              {frPromotions.invite.previewBody
                .replace('{name}', firstName)
                .replace('{promotion}', member.promotionLabel)}
            </p>
            <p className="text-caption mt-4 text-[#94A3B8]">{frPromotions.invite.previewNote}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.invite.trackingTitle}</CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex flex-col gap-2">
              <li>{frPromotions.invite.trackingSent}</li>
              <li>{frPromotions.invite.trackingOpened}</li>
              <li>{frPromotions.invite.trackingClaimed}</li>
            </ul>
            <p className="text-caption text-text-secondary mt-3">
              {frPromotions.invite.trackingNote}
            </p>
            <p className="mt-5">
              <Link href={promotionInvitationsRoute(promotionId)} className={LINK_BUTTON}>
                {frPromotions.overview.tabInvitations}
              </Link>
            </p>
          </Card>

          <Alert variant="warning" title={frPromotions.members.sideHelpTitle}>
            {frPromotions.invite.whatsappNote}
          </Alert>

          <p className="text-caption text-text-secondary">
            <Link
              href={promotionMembersRoute(promotionId)}
              className="focus-visible:outline-active-blue underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frPromotions.overview.seeAllMembers}
            </Link>
          </p>
        </aside>
      </div>
    </div>,
  );
}
