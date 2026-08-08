import Link from 'next/link';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { AuthCard } from '@/components/layout/AuthCard';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata = { title: fr.auth.forgotPassword.title };

/** ISE-003 — Mot de passe oublie. */
export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title={fr.auth.forgotPassword.title}
      subtitle={fr.auth.forgotPassword.subtitle}
      footer={
        <p className="text-body-sm text-center">
          <Link
            href={ROUTES.signIn}
            className="text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.auth.forgotPassword.backToSignIn}
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
