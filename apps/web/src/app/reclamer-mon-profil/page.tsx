import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { accountIsLinkedToProfile, loadGraduationYears, loadMyClaim } from '@/lib/queries/claim';
import { AuthCard } from '@/components/layout/AuthCard';
import { AuthShell } from '@/components/layout/AuthShell';
import { ClaimSearchForm } from './ClaimSearchForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.claim.search.title };

const LINK_CLASS =
  'font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-005 — Rechercher son profil reference.
 *
 * Trois sorties possibles, toutes reelles :
 *  - le compte est deja rattache a un profil  -> il n'y a plus rien a reclamer ;
 *  - une reclamation est deja en cours        -> ISE-007 ;
 *  - sinon                                    -> le formulaire de recherche.
 */
export default async function ClaimSearchPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense en profondeur : le middleware a deja filtre, on ne s'y fie pas seul.
  if (!user) redirect(ROUTES.sessionExpired);

  const linked = await accountIsLinkedToProfile(user.id);

  const shell = (children: React.ReactNode) => (
    <AuthShell
      panelTitle={fr.claim.search.panelTitle}
      panelBody={fr.claim.search.panelBody}
      panelPillars={fr.claim.search.panelPillars}
      contentWidth="wide"
    >
      {children}
    </AuthShell>
  );

  if (linked) {
    return shell(
      <AuthCard title={fr.claim.search.title}>
        <Alert variant="info" title={fr.claim.search.alreadyLinkedTitle}>
          {fr.claim.search.alreadyLinkedBody}
        </Alert>
        <p className="text-body-sm text-text-secondary">
          <Link href={ROUTES.dashboard} className={LINK_CLASS}>
            {fr.claim.search.backToDashboard}
          </Link>
        </p>
      </AuthCard>,
    );
  }

  const claim = await loadMyClaim(newCorrelationId());
  const pending =
    claim.ok && claim.data !== null && ['submitted', 'under_review'].includes(claim.data.status);

  if (pending) {
    return shell(
      <AuthCard title={fr.claim.search.title}>
        <Alert variant="info" title={fr.claim.search.pendingTitle} />
        <p className="text-body-sm text-text-secondary">
          <Link href={ROUTES.claimVerification} className={LINK_CLASS}>
            {fr.claim.search.pendingAction}
          </Link>
        </p>
      </AuthCard>,
    );
  }

  const graduationYears = await loadGraduationYears();

  return shell(
    <AuthCard title={fr.claim.search.title} subtitle={fr.claim.search.subtitle}>
      <ClaimSearchForm graduationYears={graduationYears} />
    </AuthCard>,
  );
}
