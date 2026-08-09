'use client';

import { useState } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** Logo officiel Google (couleurs de marque, jamais recolorees). */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * ADDENDUM Google OAuth — bouton de connexion applicable a n'importe quel
 * compte deja provisionne cote Supabase Auth (fournisseur `google`).
 *
 * Purement cote client : `signInWithOAuth` redirige lui-meme le navigateur
 * vers l'ecran de consentement Google des que Supabase a renvoye l'URL, il
 * n'y a rien a faire de plus en cas de succes (D-100 : aucune cle privee
 * cote navigateur, uniquement la cle publiable deja utilisee ailleurs).
 */
export function GoogleSignInButton({ next }: { next: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsPending(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}${ROUTES.authCallback}?redirectTo=${encodeURIComponent(next)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (oauthError) {
      console.error('[ISE] connexion Google refusée', { code: oauthError.code });
      setError(fr.auth.signIn.googleUnavailable);
      setIsPending(false);
    }
    // Sinon, le navigateur est deja en cours de redirection vers Google.
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert variant="error" title={error} /> : null}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        fullWidth
        loading={isPending}
        loadingLabel={fr.auth.signIn.googlePending}
        leadingIcon={<GoogleLogo />}
        onClick={handleClick}
      >
        {fr.auth.signIn.googleButton}
      </Button>
    </div>
  );
}
