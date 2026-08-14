import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState } from '@ise/ui-web';
import { frDonations } from '@/i18n/donations';
import { ROUTES } from '@/lib/routes';
import { DONATION_ROUTES } from '@/lib/routes/donations';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { donationAvailability } from '@/lib/donations/config';
import { loadDonationCurrencyRules, loadMyDonations } from '@/lib/queries/donations';
import { formatDonationAmount, type DonationCurrencyRule } from '@/lib/donations/shared';
import { AppShell } from '@/components/layout/AppShell';
import { DonationForm } from './DonationForm';

/**
 * « Faire un don » — ecran membre (0134).
 *
 * DEUX ETATS POSSIBLES, ET AUCUN TROISIEME :
 *
 *  · au moins une voie de paiement est configuree -> le formulaire, alimente
 *    par le referentiel de la base (montants proposes, bornes, pas) ;
 *  · aucune ne l'est -> un message qui le DIT. Pas de formulaire decoratif,
 *    pas de bouton qui echouerait a la premiere pression. L'entree de menu
 *    disparait d'ailleurs elle aussi dans ce cas (MASTER PROMPT §113).
 *
 * La liste « Mes dons » affiche l'etat REEL de chaque contribution. Un don
 * en attente de confirmation est presente comme tel, jamais comme recu.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: frDonations.title };

const STATUS_LABELS: Readonly<Record<string, string>> = frDonations.status;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

export default async function DonationPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const availability = donationAvailability();

  const [viewer, rules, donations] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    availability.any ? loadDonationCurrencyRules() : Promise.resolve<DonationCurrencyRule[]>([]),
    loadMyDonations(),
  ]);

  // Une devise n'est proposee que si SON prestataire est reellement
  // configure : la base connait les deux, l'environnement n'en autorise
  // peut-etre qu'un.
  const usableRules = rules.filter((rule) =>
    rule.provider === 'stripe' ? availability.stripe : availability.cinetpay,
  );

  const exponentOf = (currency: string): number =>
    rules.find((rule) => rule.currency === currency)?.minorUnitExponent ?? 0;

  return (
    <AppShell
      currentPath={DONATION_ROUTES.home}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frDonations.title}</h1>
          <p className="text-body text-text-secondary">{frDonations.subtitle}</p>
        </div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {usableRules.length === 0 ? (
              <Card>
                <EmptyState
                  title={frDonations.unavailable.title}
                  description={frDonations.unavailable.body}
                />
              </Card>
            ) : (
              <Card>
                <DonationForm rules={usableRules} />
              </Card>
            )}

            <Alert variant="info" title={frDonations.security.title}>
              {frDonations.security.body}
            </Alert>
          </div>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frDonations.history.title}</CardTitle>
            </CardHeader>

            {donations.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{frDonations.history.empty}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {donations.map((donation) => (
                  <li key={donation.id} className="flex flex-col gap-1">
                    <span className="text-body-sm text-text-primary font-medium">
                      {formatDonationAmount(
                        donation.amountMinor,
                        donation.currency,
                        exponentOf(donation.currency),
                      )}
                    </span>
                    <span className="text-caption text-text-secondary">
                      {formatDate(donation.createdAt)} —{' '}
                      {STATUS_LABELS[donation.status] ?? frDonations.status.unknown}
                    </span>
                    <span className="text-caption text-text-muted break-all">
                      {frDonations.history.referenceLabel} : {donation.reference}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
