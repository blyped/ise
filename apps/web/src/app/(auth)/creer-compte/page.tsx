import Link from 'next/link';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { REDIRECT_FALLBACK, safeRedirect } from '@/lib/public/safe-redirect';
import { AuthCard } from '@/components/layout/AuthCard';
import { SignUpForm } from './SignUpForm';

export const metadata = { title: fr.auth.signUp.title };

/**
 * ISE-002 — Creer un compte.
 *
 * Accepte `redirectTo` au meme titre que ISE-001 (connexion) : une personne
 * invitee (ISE-070 suite) qui n'a pas encore de compte doit pouvoir en
 * creer un et retomber directement sur l'invitation, pas sur le tableau de
 * bord.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params['redirectTo'] ?? params['suivant'];
  const next = safeRedirect(raw, { source: 'ISE-002 (page)' });
  const hasTarget = next !== REDIRECT_FALLBACK;

  return (
    <AuthCard
      title={fr.auth.signUp.title}
      subtitle={fr.auth.signUp.subtitle}
      footer={
        <p className="text-body-sm text-text-secondary text-center">
          {fr.auth.signUp.alreadyMember}{' '}
          <Link
            href={
              hasTarget
                ? `${ROUTES.signIn}?redirectTo=${encodeURIComponent(next)}`
                : ROUTES.signIn
            }
            className="text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.auth.signUp.signInLink}
          </Link>
        </p>
      }
    >
      <div className="rounded-base border border-[#BFDBFE] bg-[#EFF6FF] p-5">
        <p className="text-body-sm text-text-primary font-semibold">{fr.auth.signUp.claimTitle}</p>
        <p className="text-body-sm text-text-secondary mt-1">{fr.auth.signUp.claimBody}</p>
        <p className="text-caption text-text-muted mt-2">{fr.auth.signUp.accountNote}</p>
        {/*
          La reclamation (ISE-005) exige une session : depuis la creation de
          compte, on passe donc par la connexion en conservant la destination.
        */}
        <p className="mt-3">
          <Link
            href={`${ROUTES.signIn}?suivant=${encodeURIComponent(ROUTES.claimSearch)}`}
            className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.claim.entryLink}
          </Link>
        </p>
      </div>

      <SignUpForm next={next} />
    </AuthCard>
  );
}
