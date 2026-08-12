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
  // INSTRUMENTATION TEMPORAIRE (a retirer) — isole le TypeError
  // "Cannot convert undefined or null to object at Object.keys" (digest
  // 1724077822 / 3088685757) qui persiste sur cette route depuis plusieurs
  // deploiements, alors que le middleware s'execute sans erreur (confirme
  // par les logs edge-middleware). Chaque etape logge avant d'etre tentee.
  let step = 'start';
  try {
    step = 'createSupabaseServerClient';
    const supabase = await createSupabaseServerClient();

    step = 'auth.getUser';
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Defense en profondeur : le middleware a deja filtre, on ne s'y fie pas seul.
    if (!user) redirect(ROUTES.sessionExpired);

    step = 'accountIsLinkedToProfile';
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
      step = 'render:linked';
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

    step = 'loadMyClaim';
    const claim = await loadMyClaim(newCorrelationId());
    const pending =
      claim.ok && claim.data !== null && ['submitted', 'under_review'].includes(claim.data.status);

    if (pending) {
      step = 'render:pending';
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

    step = 'loadGraduationYears';
    const graduationYears = await loadGraduationYears();

    step = 'render:form';
    return shell(
      <AuthCard title={fr.claim.search.title} subtitle={fr.claim.search.subtitle}>
        <ClaimSearchForm graduationYears={graduationYears} />
      </AuthCard>,
    );
  } catch (err) {
    // `redirect()` leve volontairement une exception de controle de flux
    // (digest 'NEXT_REDIRECT...') : ce n'est pas une erreur, on la laisse
    // simplement remonter sans la journaliser.
    const digest = (err as { digest?: string } | null)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    const name = err instanceof Error ? err.name : typeof err;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[ISE][DEBUG reclamer-mon-profil]', { step, name, message, stack });
    throw err;
  }
}
