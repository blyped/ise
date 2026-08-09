import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMentorshipHome } from '@/lib/queries/mentorship';
import { loadSectors } from '@/lib/queries/reference';
import {
  MENTORSHIP_FORMAT_CODES,
  MENTORSHIP_OBJECTIVE_CODES,
  MENTORSHIP_TOPIC_CODES,
  mentorshipFormatLabel,
  mentorshipObjectiveLabel,
  mentorshipTopicLabel,
} from '@/lib/collaborate-status';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
  SELECT,
  TEXTAREA,
} from '@/components/collaborate/CollaborateUI';
import { saveNeedAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.need.title };

/**
 * ISE-079 — Définir mon besoin de mentorat.
 *
 * Le besoin est STRICTEMENT personnel (politique `mentorship_needs_own`).
 * L'encart « Ce que le matching comprend » liste les critères réels, et
 * rappelle qu'aucun score numérique n'est affiché (D-42, D-43).
 */
export default async function MentorshipNeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, home, sectors] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMentorshipHome(correlationId),
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
        { label: frMentorship.need.title, href: null },
      ]}
    />
  );

  if (!home.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <ErrorState
          title={frMentorship.common.loadErrorTitle}
          description={home.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const need = home.data.need;

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader title={frMentorship.need.title} subtitle={frMentorship.need.subtitle} />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frMentorship.need.resultTitle}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-secondary mb-5">{frMentorship.need.resultHelp}</p>
          <form action={saveNeedAction} className="flex flex-col gap-5">
            <FormRow id="objectif-type" label={frMentorship.need.objectiveType}>
              <select
                id="objectif-type"
                name="objectiveType"
                defaultValue={need?.objectiveType ?? 'career_progression'}
                className={SELECT}
              >
                {MENTORSHIP_OBJECTIVE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {mentorshipObjectiveLabel(code)}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow
              id="objectif-texte"
              label={frMentorship.need.objectiveText}
              hint={frMentorship.need.objectiveTextHelp}
            >
              <textarea
                id="objectif-texte"
                name="objectiveText"
                required
                maxLength={250}
                defaultValue={need?.objectiveText ?? ''}
                className={TEXTAREA}
                aria-describedby="objectif-texte-aide"
              />
            </FormRow>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frMentorship.need.topicsTitle}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MENTORSHIP_TOPIC_CODES.map((code) => (
                  <label
                    key={code}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      name="topics"
                      value={code}
                      defaultChecked={need?.topics.includes(code) ?? false}
                    />
                    {mentorshipTopicLabel(code)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frMentorship.need.mentorTypeTitle}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['experienced_manager', frMentorship.need.mentorExperienced],
                    ['domain_expert', frMentorship.need.mentorExpert],
                    ['similar_transition', frMentorship.need.mentorTransition],
                    ['let_matching_decide', frMentorship.need.mentorLetMatching],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input
                      type="radio"
                      name="mentorPreference"
                      value={value}
                      defaultChecked={(need?.mentorPreference ?? 'let_matching_decide') === value}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <FormRow id="contraintes" label={frMentorship.need.constraintsTitle}>
              <textarea
                id="contraintes"
                name="constraints"
                maxLength={500}
                defaultValue={need?.constraintsText ?? ''}
                className={TEXTAREA}
              />
            </FormRow>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow id="horizon" label={frMentorship.need.horizonTitle}>
                <select
                  id="horizon"
                  name="preferredFormat"
                  defaultValue={need?.preferredFormat ?? 'three_months'}
                  className={SELECT}
                >
                  {MENTORSHIP_FORMAT_CODES.map((code) => (
                    <option key={code} value={code}>
                      {mentorshipFormatLabel(code)}
                    </option>
                  ))}
                </select>
              </FormRow>

              <FormRow id="rythme-besoin" label={frMentorship.request.frequencyTitle}>
                <select
                  id="rythme-besoin"
                  name="preferredFrequency"
                  defaultValue={need?.preferredFrequency ?? ''}
                  className={SELECT}
                >
                  <option value="">{frMentorship.frequency.flexible}</option>
                  <option value="monthly">{frMentorship.frequency.monthly}</option>
                  <option value="twice_monthly">{frMentorship.frequency.twice_monthly}</option>
                </select>
              </FormRow>
            </div>

            <FormRow id="secteur-besoin" label={frMentorship.need.sectorTitle}>
              <select
                id="secteur-besoin"
                name="sectorId"
                defaultValue={need?.sectorId === null || need === null ? '' : String(need.sectorId)}
                className={SELECT}
              >
                <option value="">{frMentorship.recommendations.filterAll}</option>
                {(sectors.ok ? sectors.data : []).map((sector) => (
                  <option key={sector.id} value={String(sector.id)}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </FormRow>

            <p>
              <button type="submit" className={PRIMARY_BUTTON}>
                {frMentorship.need.submit}
              </button>
            </p>
          </form>
        </Card>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.need.matchingTitle}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-2">
              {frMentorship.need.matchingItems.map((item) => (
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
            <CardHeader>
              <CardTitle as="h2">{frMentorship.need.controlTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frMentorship.need.controlBody}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.need.manualTitle}</CardTitle>
            </CardHeader>
            <p className="mt-2">
              <Link
                href={`${MENTORSHIP_ROUTES.recommendations}?librement=1`}
                className={LINK_BUTTON}
              >
                {frMentorship.need.manualAction}
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
