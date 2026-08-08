import Link from 'next/link';
import { Alert } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthCard } from '@/components/layout/AuthCard';
import { ResetPasswordForm } from './ResetPasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.auth.resetPassword.title };

/**
 * ISE-004 — Reinitialiser le mot de passe.
 * L'ecran n'est utilisable que si le lien de recuperation a bien ouvert une
 * session ; sinon on l'annonce clairement plutot que d'afficher un formulaire
 * qui echouerait a l'envoi.
 */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthCard title={fr.auth.resetPassword.invalidLinkTitle}>
        <Alert variant="warning" title={fr.auth.resetPassword.invalidLinkBody} />
        <p className="text-body-sm text-center">
          <Link
            href={ROUTES.forgotPassword}
            className="text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.auth.resetPassword.requestNewLink}
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={fr.auth.resetPassword.title} subtitle={fr.auth.resetPassword.subtitle}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
