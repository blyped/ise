import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, Chip, EmptyState, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES, mentorRoute } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadRecommendedMentors } from '@/lib/queries/mentorship';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { MENTORSHIP_FORMAT_CODES, mentorshipFormatLabel } from '@/lib/collaborate-status';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  INPUT,
  LINK_BUTTON,
  LoadMoreLink,
  PRIMARY_BUTTON,
  PageHeader,
  ReasonList,
  RelevanceBadge,
  SELECT,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.recommendations.title };

const SUCCESS: Record<string, string> = { need_saved: frMentorship.need.done };
const RELEVANCE_LABELS: Record<string, string> = frMentorship.relevance;

/**
 * ISE-080 — Mentors recommandés.
 *
 * REGLE CARDINALE (MASTER PROMPT §30, D-42/D-43) : la pertinence est un
 * LIBELLÉ QUALITATIF accompagné de raisons, jamais un score chiffré.
 * La disponibilité se dit en deux états — « Disponible » ou « Capacité
 * atteinte » — jamais en fraction ([U 30]).
 *
 * Sans besoin déclaré, l'écran ne déballe pas deux cents fiches : il
 * renvoie vers ISE-079, sauf si le membre choisit la recherche libre.
 */
export default async function RecommendedMentorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const query = await searchParams;
  const feedback = readFeedback(query);
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const manual = one(query['librement']) === '1';
  const search = one(query['recherche']);
  const countryCode = one(query['pays']);
  const sectorParam = one(query['secteur']);
  const sectorId = sectorParam === null ? null : Number.parseInt(sectorParam, 10);
  const format = one(query['format']);
  const cursor = unsealCursor(one(query['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, page, countries, sectors] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadRecommendedMentors(
      {
        query: search,
        sectorId: sectorId !== null && !Number.isNaN(sectorId) ? sectorId : null,
        countryCode,
        format,
        manual,
      },
      cursor,
      correlationId,
    ),
    loadCountries(correlationId),
    loadSectors(correlationId),
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
      label={frMentorship.common.breadcrumb}
      items={[
        { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
        { label: frPromotions.hub.mentorshipTitle, href: MENTORSHIP_ROUTES.home },
        { label: frMentorship.recommendations.title, href: null },
      ]}
    />
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <ErrorState
          title={frMentorship.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  // Pas de besoin ET pas de recherche libre : on demande l'objectif d'abord.
  if (!page.data.hasNeed && !manual) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <PageHeader title={frMentorship.recommendations.title} />
        <FeedbackBanner
          feedback={feedback}
          catalog={frMentorship.errors}
          successCatalog={SUCCESS}
        />
        <EmptyState
          title={frMentorship.recommendations.needFirstTitle}
          description={frMentorship.recommendations.needFirstBody}
          action={
            <span className="flex flex-wrap justify-center gap-3">
              <Link href={MENTORSHIP_ROUTES.need} className={PRIMARY_BUTTON}>
                {frMentorship.recommendations.needFirstAction}
              </Link>
              <Link
                href={`${MENTORSHIP_ROUTES.recommendations}?librement=1`}
                className={LINK_BUTTON}
              >
                {frMentorship.recommendations.manualToggle}
              </Link>
            </span>
          }
        />
      </div>,
    );
  }

  const baseHref = manual
    ? `${MENTORSHIP_ROUTES.recommendations}?librement=1`
    : MENTORSHIP_ROUTES.recommendations;

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frMentorship.recommendations.title}
        subtitle={frMentorship.recommendations.compareSubtitle}
        actions={
          <Link href={MENTORSHIP_ROUTES.need} className={LINK_BUTTON}>
            {frMentorship.recommendations.editNeed}
          </Link>
        }
      />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} successCatalog={SUCCESS} />

      {page.data.isManual ? (
        <p className="text-body-sm text-text-secondary">{frMentorship.recommendations.manualOn}</p>
      ) : null}

      <form method="get" action={MENTORSHIP_ROUTES.recommendations} className="flex flex-col gap-4">
        {manual ? <input type="hidden" name="librement" value="1" /> : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="recherche-mentors" className="sr-only">
            {frMentorship.recommendations.searchPlaceholder}
          </label>
          <input
            id="recherche-mentors"
            name="recherche"
            type="search"
            defaultValue={search ?? ''}
            placeholder={frMentorship.recommendations.searchPlaceholder}
            className={INPUT}
          />
          <button type="submit" className={PRIMARY_BUTTON}>
            {frMentorship.recommendations.filterApply}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frMentorship.recommendations.filterSector}
            <select name="secteur" defaultValue={sectorParam ?? ''} className={SELECT}>
              <option value="">{frMentorship.recommendations.filterAll}</option>
              {(sectors.ok ? sectors.data : []).map((sector) => (
                <option key={sector.id} value={String(sector.id)}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frMentorship.recommendations.filterCountry}
            <select name="pays" defaultValue={countryCode ?? ''} className={SELECT}>
              <option value="">{frMentorship.recommendations.filterAll}</option>
              {(countries.ok ? countries.data : []).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frMentorship.recommendations.filterFormat}
            <select name="format" defaultValue={format ?? ''} className={SELECT}>
              <option value="">{frMentorship.recommendations.filterAll}</option>
              {MENTORSHIP_FORMAT_CODES.map((code) => (
                <option key={code} value={code}>
                  {mentorshipFormatLabel(code)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section
          aria-label={frMentorship.recommendations.title}
          className="flex min-w-0 flex-col gap-5"
        >
          {page.data.rows.length === 0 ? (
            <EmptyState
              title={frMentorship.recommendations.emptyTitle}
              description={frMentorship.recommendations.emptyBody}
              action={
                manual ? undefined : (
                  <Link
                    href={`${MENTORSHIP_ROUTES.recommendations}?librement=1`}
                    className={LINK_BUTTON}
                  >
                    {frMentorship.recommendations.manualToggle}
                  </Link>
                )
              }
            />
          ) : (
            <ul className="grid gap-5 lg:grid-cols-2">
              {page.data.rows.map((mentor) => (
                <li key={mentor.profileId}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <p className="text-body text-text-primary font-semibold">
                          {mentor.displayName}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {[mentor.position, mentor.organization].filter(Boolean).join(' · ')}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {[mentor.city ?? mentor.countryName, mentor.promotion]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <Badge tone={mentor.availability === 'available' ? 'success' : 'neutral'}>
                        {mentor.availability === 'available'
                          ? frMentorship.mentor.available
                          : frMentorship.mentor.capacityReached}
                      </Badge>
                    </div>

                    {mentor.expertises.length === 0 && mentor.topics.length === 0 ? null : (
                      <ul className="flex flex-wrap gap-2">
                        {[...mentor.expertises, ...mentor.topics].slice(0, 4).map((item) => (
                          <li key={item}>
                            <Chip>{item}</Chip>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center gap-2">
                      <RelevanceBadge relevance={mentor.relevance} labels={RELEVANCE_LABELS} />
                    </div>
                    <ReasonList
                      title={frMentorship.recommendations.whyTitle}
                      reasons={mentor.relevance.reasons.slice(0, 3)}
                    />

                    <p className="mt-auto pt-2">
                      <Link href={mentorRoute(mentor.profileId)} className={LINK_BUTTON}>
                        {frMentorship.recommendations.seeProfile}
                      </Link>
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <LoadMoreLink
            href={baseHref}
            label={frMentorship.recommendations.loadMore}
            nextCursor={page.data.nextCursor}
          />
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <p className="text-body-sm text-text-primary font-semibold">
              {frMentorship.recommendations.criteriaTitle}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {frMentorship.recommendations.criteriaItems.map((item) => (
                <li key={item} className="text-body-sm text-text-secondary flex items-start gap-2">
                  <span aria-hidden="true" className="text-success mt-[2px]">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-caption text-text-muted mt-4">{frMentorship.need.noScoreNote}</p>
          </Card>

          <Card>
            <p className="text-body-sm text-text-primary font-semibold">
              {frMentorship.recommendations.notFoundTitle}
            </p>
            <p className="text-body-sm text-text-secondary mt-2">
              {frMentorship.recommendations.notFoundBody}
            </p>
            {manual ? null : (
              <p className="mt-4">
                <Link
                  href={`${MENTORSHIP_ROUTES.recommendations}?librement=1`}
                  className={LINK_BUTTON}
                >
                  {frMentorship.recommendations.manualToggle}
                </Link>
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>,
  );
}
