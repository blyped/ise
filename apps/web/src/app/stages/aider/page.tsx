import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { INTERNSHIP_ROUTES } from '@/lib/routes/internships';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipAlumniHome } from '@/lib/queries/internships';
import { formatDate } from '@/lib/collaborate-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  INPUT,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
} from '@/components/collaborate/CollaborateUI';
import { respondHelpAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.alumni.title };

const SUCCESS: Record<string, string> = {
  help_answered: frInternships.alumni.requestAnswer,
};

/**
 * ISE-072, version ancien — « je peux aider ».
 *
 * Un refus n'exige AUCUNE justification : le bouton « Décliner » n'ouvre
 * pas de champ obligatoire, et l'aide sous le formulaire le dit.
 */
export default async function InternshipAlumniPage({
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
    loadInternshipAlumniHome(correlationId),
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

  if (!home.ok) {
    return shell(
      <ErrorState
        title={frInternships.common.loadErrorTitle}
        description={home.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frInternships.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: frPromotions.hub.internshipsTitle, href: INTERNSHIP_ROUTES.home },
          { label: frInternships.alumni.title, href: null },
        ]}
      />

      <PageHeader title={frInternships.alumni.title} subtitle={frInternships.alumni.subtitle} />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} successCatalog={SUCCESS} />

      <Card>
        <p className="text-body text-text-primary">
          {home.data.studentsInMySectors === 0
            ? frInternships.alumni.studentsNone
            : frInternships.alumni.studentsInSectors.replace(
                '{count}',
                String(home.data.studentsInMySectors),
              )}
        </p>
        <p className="text-caption text-text-secondary mt-2">
          {frInternships.alumni.myOffers.replace('{count}', String(home.data.myOffers))}
        </p>
        <p className="mt-5">
          <Link href={OPPORTUNITY_ROUTES.create} className={PRIMARY_BUTTON}>
            {frInternships.home.alumniAction}
          </Link>
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frInternships.alumni.requestsTitle}</CardTitle>
        </CardHeader>
        {home.data.pendingRequests.length === 0 ? (
          <EmptyState
            title={frInternships.alumni.requestsEmpty}
            description={frInternships.alumni.subtitle}
          />
        ) : (
          <ul className="flex flex-col gap-5">
            {home.data.pendingRequests.map((request) => (
              <li key={request.requestId} className="border-border rounded-base border p-5">
                <p className="text-body-sm text-text-primary font-semibold">
                  {request.studentName} ·{' '}
                  {frInternships.alumni.requestType[
                    request.requestType as keyof typeof frInternships.alumni.requestType
                  ] ?? request.requestType}
                </p>
                <p className="text-caption text-text-secondary mt-1">
                  {formatDate(request.createdAt) ?? ''}
                </p>
                <p className="text-body-sm text-text-secondary mt-3">{request.message}</p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={respondHelpAction}>
                    <input type="hidden" name="requestId" value={request.requestId} />
                    <input type="hidden" name="decision" value="accept" />
                    <button type="submit" className={PRIMARY_BUTTON}>
                      {frInternships.alumni.requestAccept}
                    </button>
                  </form>
                  <form action={respondHelpAction} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="requestId" value={request.requestId} />
                    <input type="hidden" name="decision" value="decline" />
                    <label className="text-caption text-text-secondary flex flex-col gap-1">
                      <span className="sr-only">{frInternships.alumni.requestDeclineHelp}</span>
                      <input
                        name="message"
                        placeholder={frInternships.alumni.requestDeclineHelp}
                        className={INPUT}
                      />
                    </label>
                    <button type="submit" className={LINK_BUTTON}>
                      {frInternships.alumni.requestDecline}
                    </button>
                  </form>
                </div>
                <p className="text-caption text-text-secondary mt-2">
                  {frInternships.alumni.requestDeclineHelp}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>,
  );
}
