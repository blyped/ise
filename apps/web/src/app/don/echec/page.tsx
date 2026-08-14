import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@ise/ui-web';
import { frDonations } from '@/i18n/donations';
import { ROUTES } from '@/lib/routes';
import { DONATION_ROUTES } from '@/lib/routes/donations';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { AppShell } from '@/components/layout/AppShell';

/**
 * PAIEMENT ABANDONNE (`cancel_url` de Stripe, retour explicite du donateur).
 *
 * CETTE PAGE N'ECRIT RIEN. Arriver ici ne prouve pas qu'un paiement a
 * echoue : l'utilisateur a pu fermer l'onglet apres avoir valide, ou revenir
 * en arriere. Le don garde donc son etat, et le texte renvoie vers
 * « Mes dons », seul endroit ou l'etat constate fait foi.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: frDonations.failurePage.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export default async function DonationFailurePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const viewer = await loadViewerContext(user.id, user.email ?? '');

  return (
    <AppShell
      currentPath={DONATION_ROUTES.home}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">{frDonations.failurePage.title}</h1>

        <Alert variant="warning" title={frDonations.failurePage.title}>
          {frDonations.failurePage.body}
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Link href={DONATION_ROUTES.home} className={LINK}>
            {frDonations.failurePage.retry}
          </Link>
          <Link href={ROUTES.dashboard} className={LINK}>
            {frDonations.back}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
