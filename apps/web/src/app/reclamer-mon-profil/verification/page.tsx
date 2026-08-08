import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, ErrorState } from '@ise/ui-web';
import { fr, t } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadMyClaim, type ClaimStatus } from '@/lib/queries/claim';
import { AuthCard } from '@/components/layout/AuthCard';
import { AuthShell } from '@/components/layout/AuthShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.claim.verification.title };

const LINK_CLASS =
  'font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const STATUS_TONES: Record<ClaimStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  submitted: 'info',
  under_review: 'info',
  approved: 'success',
  rejected: 'error',
  withdrawn: 'neutral',
  expired: 'neutral',
};

function frenchDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(iso));
}

/**
 * ISE-007 — Etat de la reclamation.
 *
 * L'etat affiche est celui que porte la BASE, jamais une deduction de
 * l'interface : `public.my_profile_claim()` dit si la verification par
 * e-mail historique a joue (`auto_approved`) ou si une revue humaine est
 * attendue.
 *
 * D-85 : aucun delai n'est annonce. Aucun engagement de traitement n'existe
 * a ce jour ; promettre « sous 48 h » serait un faux indicateur.
 */
export default async function ClaimVerificationPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const result = await loadMyClaim(correlationId);

  const shell = (children: React.ReactNode) => (
    <AuthShell
      panelTitle={fr.claim.verification.panelTitle}
      panelBody={fr.claim.verification.panelBody}
      panelPillars={fr.claim.verification.panelPillars}
    >
      {children}
    </AuthShell>
  );

  if (!result.ok) {
    return shell(
      <AuthCard title={fr.claim.verification.title}>
        <ErrorState
          title={fr.claim.verification.errorTitle}
          description={result.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
              {fr.claim.verification.noneAction}
            </Link>
          }
        />
      </AuthCard>,
    );
  }

  const claim = result.data;

  if (claim === null) {
    return shell(
      <AuthCard title={fr.claim.verification.title}>
        <Alert variant="info" title={fr.claim.verification.noneTitle}>
          {fr.claim.verification.noneBody}
        </Alert>
        <p className="text-body-sm text-text-secondary">
          <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
            {fr.claim.verification.noneAction}
          </Link>
        </p>
      </AuthCard>,
    );
  }

  /*
    Approuvee : le compte porte desormais un profil actif. On ne laisse pas
    l'utilisateur sur un ecran d'attente devenu faux — il rejoint son espace
    membre, ou un bandeau confirme l'association.

    Les etapes d'onboarding (ISE-008 -> ISE-014) ne sont pas encore livrees :
    la destination est donc le tableau de bord, et le bandeau le dit sans
    promettre de suite immediate.
  */
  if (claim.status === 'approved') {
    redirect(`${ROUTES.dashboard}?reclamation=approuvee`);
  }

  const name = claim.profileDisplayName;

  if (claim.status === 'rejected' || claim.status === 'withdrawn' || claim.status === 'expired') {
    const title =
      claim.status === 'rejected'
        ? fr.claim.verification.rejectedTitle
        : claim.status === 'withdrawn'
          ? fr.claim.verification.withdrawnTitle
          : fr.claim.verification.expiredTitle;

    return shell(
      <AuthCard title={fr.claim.verification.title}>
        <Badge tone={STATUS_TONES[claim.status]}>
          {fr.claim.verification.statusLabel} : {fr.claim.verification.status[claim.status]}
        </Badge>
        <Alert variant="warning" title={title}>
          {t(fr.claim.verification.rejectedBody, { name })}
        </Alert>
        <p className="text-body-sm text-text-secondary">
          <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
            {fr.claim.verification.rejectedAction}
          </Link>
        </p>
      </AuthCard>,
    );
  }

  // `submitted` ou `under_review` : revue humaine attendue.
  return shell(
    <AuthCard title={fr.claim.verification.title}>
      <Badge tone={STATUS_TONES[claim.status]}>
        {fr.claim.verification.statusLabel} : {fr.claim.verification.status[claim.status]}
      </Badge>

      <Alert variant="info" title={fr.claim.verification.pendingTitle}>
        <p>{t(fr.claim.verification.pendingBody, { name })}</p>
        <p className="mt-2">{fr.claim.verification.pendingNoDelay}</p>
      </Alert>

      <p className="text-caption text-text-muted">
        {t(fr.claim.verification.pendingSubmitted, { date: frenchDate(claim.submittedAt) })}
      </p>

      <p className="text-body-sm text-text-secondary">
        <Link href={ROUTES.dashboard} className={LINK_CLASS}>
          {fr.claim.search.backToDashboard}
        </Link>
      </p>
    </AuthCard>,
  );
}
