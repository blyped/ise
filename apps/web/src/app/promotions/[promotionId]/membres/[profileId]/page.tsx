import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Avatar, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import {
  PROMOTION_ROUTES,
  promotionInviteRoute,
  promotionMembersRoute,
  promotionRoute,
} from '@/lib/routes/promotions';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadReferencedMember } from '@/lib/queries/promotions';
import { loadCountries } from '@/lib/queries/reference';
import { formatDate } from '@/lib/collaborate-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  INPUT,
  PRIMARY_BUTTON,
  SELECT,
  TEXTAREA,
} from '@/components/collaborate/CollaborateUI';
import { suggestMissingMemberAction } from '../../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.referenced.badge };

const QUALITY_LABEL: Record<string, string> = {
  confirmed: frPromotions.referenced.confirmed,
  to_confirm: frPromotions.referenced.toConfirm,
  missing: frPromotions.referenced.missing,
  unknown: frPromotions.referenced.unknown,
};

const SUCCESS: Record<string, string> = { suggested: frPromotions.referenced.suggestDone };

/**
 * ISE-069 — Aider à retrouver un camarade.
 *
 * CE QUE CET ECRAN N'AFFICHE JAMAIS (CA-PROMO-04, [F 53][U 59]) :
 * l'e-mail historique, le telephone historique, les notes
 * administratives, et l'indice de contact eventuellement transmis par un
 * autre membre. La base ne les projette pas : il n'y a donc rien a
 * masquer ici, ce qui est le seul masquage fiable (MASTER PROMPT §47).
 */
export default async function ReferencedMemberPage({
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

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, result, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadReferencedMember(profileId, correlationId),
    loadCountries(correlationId),
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

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frPromotions.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: member.promotionLabel, href: promotionRoute(promotionId) },
          { label: frPromotions.overview.tabMembers, href: promotionMembersRoute(promotionId) },
          { label: frPromotions.referenced.badge, href: null },
        ]}
      />

      <FeedbackBanner feedback={feedback} catalog={frPromotions.errors} successCatalog={SUCCESS} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <div className="flex flex-wrap items-center gap-5">
              <Avatar name={member.displayName} size={96} decorative />
              <div className="flex flex-col gap-2">
                <h1 className="text-h1 text-text-primary font-bold">{member.displayName}</h1>
                <p>
                  <Badge tone="warning">{frPromotions.referenced.badge}</Badge>
                </p>
                <p className="text-body-sm text-text-secondary">{member.promotionLabel}</p>
              </div>
            </div>
            <p className="mt-6">
              <Link
                href={promotionInviteRoute(promotionId, member.profileId)}
                className={PRIMARY_BUTTON}
              >
                {frPromotions.referenced.inviteAction}
              </Link>
            </p>
          </Card>

          <Alert variant="warning" title={frPromotions.referenced.notActiveTitle}>
            {frPromotions.referenced.notActiveBody.replace('{name}', member.displayName)}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.referenced.knownTitle}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                <dt className="text-caption text-text-secondary sm:w-[180px]">
                  {frPromotions.referenced.fieldPromotion}
                </dt>
                <dd className="text-body-sm text-text-primary">{member.promotionLabel}</dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                <dt className="text-caption text-text-secondary sm:w-[180px]">
                  {frPromotions.referenced.fieldCountry}
                </dt>
                <dd className="text-body-sm text-text-primary">
                  {member.countryName ?? frPromotions.referenced.unknown}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                <dt className="text-caption text-text-secondary sm:w-[180px]">
                  {frPromotions.referenced.fieldExpertise}
                </dt>
                <dd className="text-body-sm text-text-primary">
                  {member.declaredExpertise.length === 0
                    ? frPromotions.referenced.unknown
                    : member.declaredExpertise.join(' · ')}
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                <dt className="text-caption text-text-secondary sm:w-[180px]">
                  {frPromotions.referenced.fieldOrganization}
                </dt>
                <dd className="text-body-sm text-text-primary">
                  {member.organization ?? frPromotions.referenced.toConfirm}
                </dd>
              </div>
            </dl>
            <p className="text-caption text-text-secondary mt-5">
              {frPromotions.referenced.correctionNote.replace('{name}', member.displayName)}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.referenced.suggestTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {frPromotions.referenced.suggestBody}
            </p>
            <form action={suggestMissingMemberAction} className="mt-5 flex flex-col gap-4">
              <input type="hidden" name="promotionId" value={promotionId} />
              <input type="hidden" name="profileId" value={member.profileId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow id="prenom-manquant" label={frPromotions.referenced.suggestFirstName}>
                  <input id="prenom-manquant" name="firstName" required className={INPUT} />
                </FormRow>
                <FormRow id="nom-manquant" label={frPromotions.referenced.suggestLastName}>
                  <input id="nom-manquant" name="lastName" required className={INPUT} />
                </FormRow>
              </div>
              <FormRow id="pays-manquant" label={frPromotions.referenced.suggestCountry}>
                <select id="pays-manquant" name="countryCode" className={SELECT} defaultValue="">
                  <option value="">{frPromotions.members.filterAll}</option>
                  {(countries.ok ? countries.data : []).map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow
                id="indice-manquant"
                label={frPromotions.referenced.suggestHint}
                hint={frPromotions.referenced.suggestHintHelp}
              >
                <textarea
                  id="indice-manquant"
                  name="contactHint"
                  className={TEXTAREA}
                  aria-describedby="indice-manquant-aide"
                />
              </FormRow>
              <p>
                <button type="submit" className={PRIMARY_BUTTON}>
                  {frPromotions.referenced.suggestSubmit}
                </button>
              </p>
            </form>
          </Card>
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.referenced.howItWorksTitle}</CardTitle>
            </CardHeader>
            <ol className="text-body-sm text-text-secondary flex list-decimal flex-col gap-2 pl-5">
              {frPromotions.referenced.howItWorks.map((step) => (
                <li key={step}>{step.replace('{name}', member.displayName)}</li>
              ))}
            </ol>
            <p className="text-caption text-success mt-4 font-semibold">
              {frPromotions.referenced.noFakeAccount}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.referenced.qualityTitle}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col gap-2">
              {(
                [
                  [frPromotions.referenced.fieldPromotion, member.dataQuality.promotion],
                  [frPromotions.referenced.fieldCountry, member.dataQuality.country],
                  [frPromotions.referenced.fieldOrganization, member.dataQuality.organization],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-caption text-text-secondary">{label}</dt>
                  <dd className="text-caption text-text-primary font-medium">
                    {QUALITY_LABEL[value] ?? value}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-caption text-text-secondary">
                  {frPromotions.referenced.fieldUpdated}
                </dt>
                <dd className="text-caption text-text-primary font-medium">
                  {formatDate(member.lastUpdatedAt) ?? frPromotions.referenced.unknown}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.referenced.privacyTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {frPromotions.referenced.privacyBody}
            </p>
            <p className="text-caption text-text-secondary mt-3">
              {member.hasContactHint
                ? frPromotions.referenced.contactHintPresent
                : frPromotions.referenced.contactHintAbsent}
            </p>
          </Card>

          {member.pendingInvitation === null ? null : (
            <Alert variant="info" title={frPromotions.invitations.statusSent}>
              {frPromotions.referenced.pendingInvitation.replace(
                '{date}',
                formatDate(member.pendingInvitation.expiresAt) ?? '',
              )}
            </Alert>
          )}
        </aside>
      </div>
    </div>,
  );
}
