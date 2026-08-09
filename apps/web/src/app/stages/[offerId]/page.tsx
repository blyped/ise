import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import {
  INTERNSHIP_ROUTES,
  internshipApplicationRoute,
  internshipApplyRoute,
  internshipHelpRoute,
} from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipOffer } from '@/lib/queries/internships';
import { formatDate } from '@/lib/collaborate-view';
import {
  internshipOfferType,
  internshipOfferTypeHint,
  internshipOfferTypeLabel,
  internshipWorkModeLabel,
} from '@/lib/collaborate-status';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
  ReasonList,
  RelevanceBadge,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.offer.badge };

const RELEVANCE_LABELS: Record<string, string> = {
  very_relevant: frInternships.offer.relevanceVeryRelevant,
  relevant: frInternships.offer.relevanceRelevant,
  close_profile: frInternships.offer.relevanceCloseProfile,
};

const OFFER_TYPE_TONE = {
  official_offer: 'info',
  hosting_possibility: 'warning',
  introduction_capacity: 'neutral',
  external_lead: 'neutral',
} as const;

/**
 * ISE-073 — Détail d'une offre ou d'une porte ouverte.
 *
 * Le TYPE d'entrée est toujours affiché et expliqué : une « possibilité
 * d'accueil » ou une « piste externe » ne se déguise jamais en offre
 * officielle (D-53). Et quand `platform_transmits` est faux — c'est
 * toujours le cas —, l'écran dit littéralement que la plateforme
 * n'enverra rien à la place de l'élève (D-55).
 */
export default async function InternshipOfferPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  if (!isUuid(offerId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadInternshipOffer(offerId, correlationId),
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

  const crumbs = (
    <Breadcrumb
      label={frInternships.common.breadcrumb}
      items={[
        { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
        { label: frPromotions.hub.internshipsTitle, href: INTERNSHIP_ROUTES.home },
        { label: frInternships.offer.badge, href: null },
      ]}
    />
  );

  if (!result.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        {result.error.code === 'not_authorized' ? (
          <EmptyState
            title={frInternships.common.studentsOnlyTitle}
            description={frInternships.common.studentsOnlyBody}
            action={
              <Link href={INTERNSHIP_ROUTES.alumni} className={PRIMARY_BUTTON}>
                {frInternships.common.studentsOnlyAction}
              </Link>
            }
          />
        ) : (
          <ErrorState
            title={frInternships.common.loadErrorTitle}
            description={result.error.userMessage}
            correlationId={correlationId}
          />
        )}
      </div>,
    );
  }

  const offer = result.data;
  if (offer === null) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frInternships.errors.not_found}
          description={frInternships.home.emptyBody}
          action={
            <Link href={INTERNSHIP_ROUTES.home} className={LINK_BUTTON}>
              {frInternships.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const offerType = internshipOfferType(offer.offerType);
  const place = [offer.city, offer.countryName].filter(Boolean).join(', ');
  const isOfficial = offerType === 'official_offer';

  const aboutItems: { label: string; value: string }[] = [
    ...(offer.organization === null
      ? []
      : [{ label: frInternships.offer.organization, value: offer.organization }]),
    ...(place === '' ? [] : [{ label: frInternships.offer.place, value: place }]),
    ...(offer.durationMonths === null
      ? []
      : [{ label: frInternships.offer.duration, value: `${offer.durationMonths} mois` }]),
    { label: frInternships.offer.mode, value: internshipWorkModeLabel(offer.workMode) },
    { label: frInternships.offer.source, value: internshipOfferTypeLabel(offerType) },
  ];

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Badge tone={OFFER_TYPE_TONE[offerType]}>{internshipOfferTypeLabel(offerType)}</Badge>
              <RelevanceBadge relevance={offer.relevance} labels={RELEVANCE_LABELS} />
            </div>

            <PageHeader
              title={offer.title}
              subtitle={[offer.organization, place].filter(Boolean).join(' · ')}
            />

            <p className="text-caption text-text-secondary">
              {[
                offer.durationMonths === null ? null : `${offer.durationMonths} mois`,
                internshipWorkModeLabel(offer.workMode),
                offer.startDate === null
                  ? null
                  : `Début ${formatDate(offer.startDate) ?? ''}`.trim(),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>

            {offer.deadline === null ? null : (
              <p className="text-body-sm text-warning font-semibold">
                {frInternships.offer.deadline.replace('{date}', formatDate(offer.deadline) ?? '')}
              </p>
            )}

            <p className="text-body-sm text-text-secondary">{internshipOfferTypeHint(offerType)}</p>

            {offer.myApplication === null ? (
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href={internshipApplyRoute(offer.offerId)} className={PRIMARY_BUTTON}>
                  {frInternships.offer.prepare}
                </Link>
                <Link href={internshipHelpRoute(offer.offerId)} className={LINK_BUTTON}>
                  {frInternships.offer.askHelp}
                </Link>
              </div>
            ) : (
              <Alert
                variant="info"
                title={frInternships.offer.alreadyApplied}
                action={
                  <Link
                    href={internshipApplicationRoute(offer.myApplication.applicationId)}
                    className={LINK_BUTTON}
                  >
                    {frInternships.offer.seeApplication}
                  </Link>
                }
              >
                {''}
              </Alert>
            )}
          </Card>

          {offer.relevance.reasons.length === 0 ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frInternships.offer.relevanceTitle}</CardTitle>
              </CardHeader>
              <ReasonList reasons={offer.relevance.reasons} />
            </Card>
          )}

          {offer.description === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frInternships.offer.missionTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary whitespace-pre-line">
                {offer.description}
              </p>
            </Card>
          )}

          {offer.profileWanted === null && offer.skills.length === 0 ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frInternships.offer.profileTitle}</CardTitle>
              </CardHeader>
              {offer.profileWanted === null ? null : (
                <p className="text-body-sm text-text-secondary whitespace-pre-line">
                  {offer.profileWanted}
                </p>
              )}
              {offer.skills.length === 0 ? null : (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-body-sm text-text-primary font-semibold">
                    {frInternships.offer.skills}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {offer.skills.map((skill) => (
                      <li key={skill}>
                        <Chip>{skill}</Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {offer.conditionsToConfirm === null ? null : (
            <Alert variant="warning" title={frInternships.offer.conditionsTitle}>
              {offer.conditionsToConfirm}
            </Alert>
          )}

          {/* D-55 : la candidature se traite HORS plateforme, et l'écran le dit. */}
          <Alert variant="info" title={frInternships.offer.externalTitle}>
            <span className="flex flex-col gap-2">
              <span>{frInternships.offer.externalBody}</span>
              {offer.applicationInstructions === null ? null : (
                <span>{offer.applicationInstructions}</span>
              )}
              {offer.externalUrl === null ? null : (
                <a
                  href={offer.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {frInternships.offer.externalLink}
                </a>
              )}
            </span>
          </Alert>
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.offer.networkTitle}</CardTitle>
            </CardHeader>
            {offer.networkMembers.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{frInternships.offer.networkEmpty}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-body-sm text-text-secondary">
                  {frInternships.offer.networkBody.replace(
                    '{count}',
                    String(offer.networkIseCount),
                  )}
                </p>
                <ul className="flex flex-col gap-3">
                  {offer.networkMembers.map((member) => (
                    <li key={member.profileId} className="flex flex-col">
                      <span className="text-body-sm text-text-primary font-semibold">
                        {member.displayName}
                      </span>
                      <span className="text-caption text-text-secondary">
                        {[member.position, member.promotion].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.apply.helpTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frInternships.apply.helpBody}</p>
            <p className="mt-5">
              <Link href={internshipHelpRoute(offer.offerId)} className={LINK_BUTTON}>
                {frInternships.apply.helpAction}
              </Link>
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.offer.aboutTitle}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col gap-3">
              {aboutItems.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-text-secondary">{item.label}</dt>
                  <dd className="text-body-sm text-text-primary text-right font-medium">
                    {item.value}
                  </dd>
                </div>
              ))}
              {offer.compensationDetails === null ? null : (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-text-secondary">
                    {frInternships.offer.compensation}
                  </dt>
                  <dd className="text-body-sm text-text-primary text-right font-medium">
                    {offer.compensationDetails}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {isOfficial ? null : (
            <Alert variant="warning" title={internshipOfferTypeLabel(offerType)}>
              {internshipOfferTypeHint(offerType)}
            </Alert>
          )}
        </aside>
      </div>
    </div>,
  );
}
