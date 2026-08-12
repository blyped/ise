import Link from 'next/link';
import { Alert } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthCard } from '@/components/layout/AuthCard';
import { ActivateAccountForm } from './ActivateAccountForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.auth.activateAccount.title };

/**
 * D-161 — Activation d'un compte pre-cree (provisioning du recensement).
 *
 * La personne arrive ici depuis le lien « Activez votre compte » recu par
 * e-mail : `/auth/callback` (type=invite) a deja ouvert la session. Son
 * profil est deja lie et rempli — il ne lui reste qu'a choisir son mot de
 * passe. Sans session (lien expire ou deja utilise), l'ecran le dit et
 * oriente vers « Mot de passe oublié » : le compte existant, un lien de
 * recuperation classique joue exactement le meme role.
 */
export default async function ActivateAccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthCard title={fr.auth.activateAccount.invalidLinkTitle}>
        <Alert variant="warning" title={fr.auth.activateAccount.invalidLinkBody} />
        <p className="text-body-sm text-center">
          <Link
            href={ROUTES.forgotPassword}
            className="text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.auth.activateAccount.goToForgot}
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={fr.auth.activateAccount.title} subtitle={fr.auth.activateAccount.subtitle}>
      <ActivateAccountForm />
    </AuthCard>
  );
}
