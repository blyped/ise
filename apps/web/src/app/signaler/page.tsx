import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { frSignal } from '@/i18n/signal';
import { ROUTES } from '@/lib/routes';
import { SIGNAL_ROUTES } from '@/lib/routes/signal';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { CONTENT_ROUTES } from '@/lib/routes/content';
import { MENTORSHIP_ROUTES } from '@/lib/routes/mentorship';
import { NETWORK_ROUTES } from '@/lib/routes/network';
import { AVAILABILITY_ROUTES } from '@/lib/routes/onboarding';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSignal.title };

/**
 * GUICHET UNIQUE « Signaler » (D-222).
 *
 * Cette page ne CREE rien : elle oriente. Chaque carte est une intention
 * en langage naturel (les mots du porteur : « les ISE qui..., qu'ils le
 * signalent ») qui mene a l'ecran EXISTANT deja capable de porter le
 * signal — assistant d'opportunite, assistant d'appel au reseau,
 * proposition d'evenement ou d'actualite, disponibilite du profil,
 * mentorat, introductions. Aucun nouveau module, aucun doublon de
 * formulaire : le membre choisit une phrase, jamais une fonctionnalite.
 *
 * La note de bas de page explique la CIRCULATION (D-221) : matching a la
 * publication, notification immediate des meilleurs profils, courrier
 * hebdomadaire pour tout le reste — jamais « tout, a tous, tout de suite ».
 */

interface SignalCard {
  readonly title: string;
  readonly hint: string;
  readonly href: string;
}

const OFFER_CARDS: readonly SignalCard[] = [
  { ...frSignal.cards.offerInternship, href: OPPORTUNITY_ROUTES.create },
  { ...frSignal.cards.offerJob, href: OPPORTUNITY_ROUTES.create },
  { ...frSignal.cards.offerTender, href: OPPORTUNITY_ROUTES.create },
  { ...frSignal.cards.offerTraining, href: OPPORTUNITY_ROUTES.create },
  { ...frSignal.cards.offerAvailability, href: AVAILABILITY_ROUTES.overview },
  { ...frSignal.cards.offerMentoring, href: MENTORSHIP_ROUTES.becomeMentor },
];

const SEEK_CARDS: readonly SignalCard[] = [
  { ...frSignal.cards.seekExpertise, href: CALL_ROUTES.create },
  { ...frSignal.cards.seekSpeaker, href: CALL_ROUTES.create },
  { ...frSignal.cards.seekTeam, href: CALL_ROUTES.create },
  { ...frSignal.cards.seekPartner, href: CALL_ROUTES.create },
  { ...frSignal.cards.seekReview, href: CALL_ROUTES.create },
  { ...frSignal.cards.seekJob, href: CALL_ROUTES.create },
  { ...frSignal.cards.seekInternship, href: CALL_ROUTES.create },
  { ...frSignal.cards.seekMentor, href: MENTORSHIP_ROUTES.need },
  { ...frSignal.cards.seekIntroduction, href: NETWORK_ROUTES.introductions },
];

const ANNOUNCE_CARDS: readonly SignalCard[] = [
  { ...frSignal.cards.announceEvent, href: CONTENT_ROUTES.proposeEvent },
  { ...frSignal.cards.announceNews, href: CONTENT_ROUTES.proposeNews },
];

function CardGrid({ cards }: { cards: readonly SignalCard[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cards.map((card) => (
        <li key={card.title}>
          <Link
            href={card.href}
            className="rounded-base border-border bg-surface hover:border-primary focus-visible:outline-active-blue flex h-full items-start justify-between gap-3 border p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="flex flex-col gap-1">
              <span className="text-body-sm text-text-primary font-medium">{card.title}</span>
              <span className="text-caption text-text-secondary">{card.hint}</span>
            </span>
            <ChevronRight aria-hidden className="text-text-muted mt-1 h-4 w-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function SignalPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const viewer = await loadViewerContext(user.id, user.email ?? '');

  return (
    <AppShell
      currentPath={SIGNAL_ROUTES.home}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frSignal.title}</h1>
          <p className="text-body text-text-secondary max-w-[720px]">{frSignal.subtitle}</p>
        </header>

        <section aria-labelledby="signal-offre" className="flex flex-col gap-3">
          <h2 id="signal-offre" className="text-h3 text-text-primary font-semibold">
            {frSignal.offerSection}
          </h2>
          <CardGrid cards={OFFER_CARDS} />
        </section>

        <section aria-labelledby="signal-cherche" className="flex flex-col gap-3">
          <h2 id="signal-cherche" className="text-h3 text-text-primary font-semibold">
            {frSignal.seekSection}
          </h2>
          <CardGrid cards={SEEK_CARDS} />
        </section>

        <section aria-labelledby="signal-annonce" className="flex flex-col gap-3">
          <h2 id="signal-annonce" className="text-h3 text-text-primary font-semibold">
            {frSignal.announceSection}
          </h2>
          <CardGrid cards={ANNOUNCE_CARDS} />
        </section>

        <p className="text-caption text-text-muted border-border rounded-base border border-dashed p-4">
          {frSignal.circulationNote}
        </p>
      </div>
    </AppShell>
  );
}
