import Link from 'next/link';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { AuthCard } from '@/components/layout/AuthCard';
import { SignUpForm } from './SignUpForm';

export const metadata = { title: fr.auth.signUp.title };

/** ISE-002 — Creer un compte. */
export default function SignUpPage() {
  return (
    <AuthCard
      title={fr.auth.signUp.title}
      subtitle={fr.auth.signUp.subtitle}
      footer={
        <p className="text-body-sm text-text-secondary text-center">
          {fr.auth.signUp.alreadyMember}{' '}
          <Link
            href={ROUTES.signIn}
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

      <SignUpForm />
    </AuthCard>
  );
}
