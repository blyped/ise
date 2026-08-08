'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { signOutAction } from '@/app/actions/auth';

function SubmitButton({ variant }: { variant: 'secondary' | 'primary' }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      loading={pending}
      loadingLabel={fr.auth.signOut.submitPending}
    >
      {fr.auth.signOut.submit}
    </Button>
  );
}

/** Formulaire POST : la deconnexion n'est jamais declenchee par un GET. */
export function SignOutButton({ variant = 'secondary' }: { variant?: 'secondary' | 'primary' }) {
  return (
    <form action={signOutAction}>
      <SubmitButton variant={variant} />
    </form>
  );
}
