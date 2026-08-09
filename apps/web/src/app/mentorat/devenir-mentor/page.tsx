import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
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
import {
  MENTORSHIP_FORMAT_CODES,
  MENTORSHIP_OBJECTIVE_CODES,
  mentorshipFormatLabel,
  mentorshipObjectiveLabel,
} from '@/lib/collaborate-status';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  INPUT,
  PRIMARY_BUTTON,
  PageHeader,
  SELECT,
  TEXTAREA,
} from '@/components/collaborate/CollaborateUI';
import { saveMentorProfileAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.becomeMentor.title };

const AUDIENCES = [
  ['students', 'audienceStudents'],
  ['young_graduates', 'audienceYoungGraduates'],
  ['mid_level', 'audienceMidLevel'],
  ['senior', 'audienceSenior'],
  ['entrepreneurs', 'audienceEntrepreneurs'],
] as const;

const CHANNELS = [
  ['video', 'channelVideo'],
  ['phone', 'channelPhone'],
  ['in_person', 'channelInPerson'],
  ['written', 'channelWritten'],
] as const;

/**
 * « Devenir mentor » — activation, ajustement, mise en pause.
 *
 * La capacité est un plafond de CONTRÔLE serveur, jamais une jauge
 * affichée aux mentorés ([U 30]). La mise en pause n'interrompt aucun
 * mentorat en cours ([F 45]) — l'aide du formulaire le rappelle.
 */
export default async function BecomeMentorPage({
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
  const [viewer, home] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMentorshipHome(correlationId),
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
        { label: frMentorship.becomeMentor.title, href: null },
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

  const mentorProfile = home.data.mentorProfile;

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frMentorship.becomeMentor.title}
        subtitle={frMentorship.becomeMentor.subtitle}
      />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <form action={saveMentorProfileAction} className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frMentorship.becomeMentor.objectives}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MENTORSHIP_OBJECTIVE_CODES.map((code) => (
                  <label
                    key={code}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input type="checkbox" name="objectives" value={code} />
                    {mentorshipObjectiveLabel(code)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frMentorship.becomeMentor.audiences}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCES.map(([value, key]) => (
                  <label
                    key={value}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input type="checkbox" name="audiences" value={value} />
                    {frMentorship.becomeMentor[key]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frMentorship.becomeMentor.formats}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MENTORSHIP_FORMAT_CODES.map((code) => (
                  <label
                    key={code}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input type="checkbox" name="formats" value={code} />
                    {mentorshipFormatLabel(code)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frMentorship.becomeMentor.channels}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CHANNELS.map(([value, key]) => (
                  <label
                    key={value}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input type="checkbox" name="channels" value={value} />
                    {frMentorship.becomeMentor[key]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow
                id="capacite-mentor"
                label={frMentorship.becomeMentor.capacity}
                hint={frMentorship.becomeMentor.capacityHelp}
              >
                <input
                  id="capacite-mentor"
                  name="maxActiveMentees"
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={mentorProfile?.maxActiveMentees ?? 2}
                  className={INPUT}
                  aria-describedby="capacite-mentor-aide"
                />
              </FormRow>
              <FormRow id="rythme-mentor" label={frMentorship.becomeMentor.frequency}>
                <select id="rythme-mentor" name="frequency" defaultValue="" className={SELECT}>
                  <option value="">{frMentorship.frequency.flexible}</option>
                  <option value="monthly">{frMentorship.frequency.monthly}</option>
                  <option value="twice_monthly">{frMentorship.frequency.twice_monthly}</option>
                </select>
              </FormRow>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow id="disponibilite-mentor" label={frMentorship.becomeMentor.availability}>
                <select
                  id="disponibilite-mentor"
                  name="availabilityState"
                  defaultValue={mentorProfile?.availabilityState ?? 'available_now'}
                  className={SELECT}
                >
                  <option value="available_now">{frMentorship.becomeMentor.availabilityNow}</option>
                  <option value="available_from">
                    {frMentorship.becomeMentor.availabilityFrom}
                  </option>
                  <option value="temporarily_unavailable">
                    {frMentorship.becomeMentor.availabilityUnavailable}
                  </option>
                </select>
              </FormRow>
              <FormRow id="disponible-depuis" label={frMentorship.becomeMentor.availabilityFrom}>
                <input id="disponible-depuis" name="availableFrom" type="date" className={INPUT} />
              </FormRow>
            </div>

            <FormRow
              id="presentation-mentor"
              label={frMentorship.becomeMentor.statement}
              hint={frMentorship.becomeMentor.statementHelp}
            >
              <textarea
                id="presentation-mentor"
                name="statement"
                maxLength={500}
                defaultValue={mentorProfile?.statement ?? ''}
                className={TEXTAREA}
                aria-describedby="presentation-mentor-aide"
              />
            </FormRow>

            <p className="text-caption text-text-secondary">
              {frMentorship.becomeMentor.pauseNote}
            </p>

            <p>
              <button type="submit" className={PRIMARY_BUTTON}>
                {frMentorship.becomeMentor.submit}
              </button>
            </p>
          </form>
        </Card>

        <aside className="flex flex-col gap-7">
          {/* La verification est controlee par la base a l'activation :
              en cas de refus, `not_authorized` est traduit par le
              catalogue d'erreurs — aucun statut n'est devine ici. */}
          <Alert variant="info" title={frMentorship.errors.not_authorized}>
            {''}
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.home.ethicsTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frMentorship.home.ethicsBody}</p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
