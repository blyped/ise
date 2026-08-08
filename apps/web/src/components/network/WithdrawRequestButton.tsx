'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frNetwork } from '@/i18n/network';
import { initialFormState } from '@/lib/form-state';
import { respondToConnectionRequestAction } from '@/app/reseau/actions';

/**
 * ISE-039 — Retirer une demande de connexion encore en attente.
 *
 * Le bouton n'est rendu que par un ecran qui a deja constate le statut
 * `pending` : la base refuserait de toute facon toute autre transition
 * (`invalid_transition`).
 */
export function WithdrawRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(
    respondToConnectionRequestAction,
    initialFormState,
  );

  if (state.status === 'success') {
    return <Alert variant="success" title={state.message ?? ''} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {isPending ? frNetwork.sent.withdrawPending : ''}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frNetwork.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="decision" value="withdrawn" />
        <Button
          type="submit"
          variant="danger"
          size="md"
          loading={isPending}
          loadingLabel={frNetwork.sent.withdrawPending}
        >
          {frNetwork.sent.withdraw}
        </Button>
      </form>

      <p className="text-caption text-text-muted">{frNetwork.sent.controlBody}</p>
    </div>
  );
}
