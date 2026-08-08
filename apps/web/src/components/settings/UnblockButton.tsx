'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { initialFormState } from '@/lib/form-state';
import { unblockProfileAction } from '@/app/parametres/actions';

/** ISE-099 — deblocage d'un membre depuis « Membres bloqués » [34 §109]. */
export function UnblockButton({ profileId }: { profileId: string }) {
  const [state, formAction, isPending] = useActionState(unblockProfileAction, initialFormState);

  if (state.status === 'success') {
    return <Alert variant="success" title={state.message ?? frSettings.blocked.unblocked} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frSettings.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" loading={isPending}>
        {frSettings.blocked.unblock}
      </Button>
    </form>
  );
}
