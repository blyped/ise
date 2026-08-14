import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES } from '@/lib/routes/content';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCountries } from '@/lib/queries/reference';
import { loadEventTypeOptions } from '@/lib/queries/content-proposals';
import { AppShell } from '@/components/layout/AppShell';
import { ACTION_LINK } from '@/components/collab/styles';
import { ProposeEventForm } from './ProposeEventForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContentProposals.member.eventTitle };

/**
 * Fuseau proposé par défaut. Même valeur que le défaut de `propose_event`
 * (0132) : le réseau est majoritairement en Côte d'Ivoire, et le champ
 * reste modifiable.
 */
const DEFAULT_TIMEZONE = 'Africa/Abidjan';

/** Proposer un événement (0132) — écran MEMBRE. */
export default async function ProposeEventPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, eventTypes, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadEventTypeOptions(),
    loadCountries(correlationId),
  ]);

  const countryOptions = countries.ok
    ? countries.data.map((country) => ({ code: country.code, label: country.name }))
    : [];

  return (
    <AppShell
      currentPath={CONTENT_ROUTES.events}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-caption text-primary font-medium">
            <Link href={CONTENT_ROUTES.events} className="hover:underline">
              {frContentProposals.common.back}
            </Link>
          </p>
          <h1 className="text-h1 text-text-primary font-bold">
            {frContentProposals.member.eventTitle}
          </h1>
          <p className="text-body text-text-secondary max-w-[68ch]">
            {frContentProposals.member.eventSubtitle}
          </p>
          <p>
            <Link href={CONTENT_ROUTES.myProposals} className={`${ACTION_LINK} mt-3`}>
              {frContentProposals.member.myProposalsLink}
            </Link>
          </p>
        </div>

        {eventTypes.length === 0 ? (
          <EmptyState
            title={frContentProposals.common.loadErrorTitle}
            description={frContentProposals.errors['invalid_category'] ?? ''}
          />
        ) : (
          <ProposeEventForm
            eventTypes={eventTypes}
            countries={countryOptions}
            defaultTimezone={DEFAULT_TIMEZONE}
          />
        )}
      </div>
    </AppShell>
  );
}
