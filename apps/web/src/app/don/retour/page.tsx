import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card } from '@ise/ui-web';
import { frDonations } from '@/i18n/donations';
import { ROUTES } from '@/lib/routes';
import { DONATION_REFERENCE_PARAM, DONATION_ROUTES } from '@/lib/routes/donations';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadDonationByReference, loadDonationCurrencyRules } from '@/lib/queries/donations';
import { formatDonationAmount, type DonationStatus } from '@/lib/donations/shared';
import { AppShell } from '@/components/layout/AppShell';

/**
 * RETOUR DU GUICHET DE PAIEMENT.
 *
 * CETTE PAGE NE PROUVE RIEN, ET NE PRETEND RIEN PROUVER.
 *
 * L'URL sur laquelle le donateur atterrit est publique, devinable et
 * rejouable : n'importe qui peut l'ouvrir avec n'importe quelle reference.
 * Elle ne DECLARE donc aucun paiement. Elle se contente de RELIRE en base,
 * sous la session du membre, l'etat que la notification serveur a serveur du
 * prestataire a — ou n'a pas encore — pose.
 *
 * Tant que cette notification n'est pas arrivee, le texte affiche dit
 * exactement cela : la confirmation est en cours. On ne remercie pas pour un
 * don qu'on n'a pas constate.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: frDonations.returnPage.title };

type SearchParams = Record<string, string | string[] | undefined>;

function readReference(params: SearchParams): string | null {
  const raw = params[DONATION_REFERENCE_PARAM];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return /^[A-Za-z0-9._-]{8,64}$/.test(trimmed) ? trimmed : null;
}

interface Presentation {
  readonly variant: 'info' | 'success' | 'error' | 'warning';
  readonly title: string;
  readonly body: string;
}

function present(status: DonationStatus): Presentation {
  switch (status) {
    case 'succeeded':
      return {
        variant: 'success',
        title: frDonations.returnPage.succeededTitle,
        body: frDonations.returnPage.succeededBody,
      };
    case 'failed':
      return {
        variant: 'error',
        title: frDonations.returnPage.failedTitle,
        body: frDonations.returnPage.failedBody,
      };
    case 'cancelled':
      return {
        variant: 'warning',
        title: frDonations.returnPage.cancelledTitle,
        body: frDonations.returnPage.cancelledBody,
      };
    default:
      // `pending` et `processing` : rien n'est constate. C'est le cas le
      // plus frequent a la seconde ou l'utilisateur revient.
      return {
        variant: 'info',
        title: frDonations.returnPage.pendingTitle,
        body: frDonations.returnPage.pendingBody,
      };
  }
}

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export default async function DonationReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const params = await searchParams;
  const reference = readReference(params);
  const correlationId = newCorrelationId();

  const viewer = await loadViewerContext(user.id, user.email ?? '');

  const donationResult =
    reference === null ? null : await loadDonationByReference(reference, correlationId);
  const donation = donationResult !== null && donationResult.ok ? donationResult.data : null;

  const rules = donation === null ? [] : await loadDonationCurrencyRules();
  const exponent =
    donation === null
      ? 0
      : (rules.find((rule) => rule.currency === donation.currency)?.minorUnitExponent ?? 0);

  return (
    <AppShell
      currentPath={DONATION_ROUTES.home}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">{frDonations.returnPage.title}</h1>

        {reference === null ? (
          <Alert variant="warning" title={frDonations.returnPage.missingReference}>
            {frDonations.history.title}
          </Alert>
        ) : donation === null ? (
          <Alert variant="warning" title={frDonations.returnPage.notFound}>
            {frDonations.correlationLabel} : {correlationId}
          </Alert>
        ) : (
          <>
            <Alert variant={present(donation.status).variant} title={present(donation.status).title}>
              {present(donation.status).body}
            </Alert>

            <Card>
              <dl className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <dt className="text-caption text-text-muted">
                    {frDonations.history.amountLabel}
                  </dt>
                  <dd className="text-body-sm text-text-primary font-medium">
                    {formatDonationAmount(donation.amountMinor, donation.currency, exponent)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-caption text-text-muted">
                    {frDonations.history.statusLabel}
                  </dt>
                  <dd className="text-body-sm text-text-primary">
                    {frDonations.status[donation.status]}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-caption text-text-muted">
                    {frDonations.history.referenceLabel}
                  </dt>
                  <dd className="text-body-sm text-text-primary break-all">{donation.reference}</dd>
                </div>
              </dl>
            </Card>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          {/* Une simple navigation vers la meme page : elle relit l'etat reel
              en base. Aucun statut n'est « force » par ce bouton. */}
          <Link href={DONATION_ROUTES.home} className={LINK}>
            {frDonations.returnPage.newDonation}
          </Link>
          <Link href={ROUTES.dashboard} className={LINK}>
            {frDonations.back}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
