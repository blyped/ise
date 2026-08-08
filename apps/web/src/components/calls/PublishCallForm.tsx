'use client';

import { useActionState } from 'react';
import { Button, ErrorState } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { initialFormState } from '@/lib/form-state';
import { publishCallAction } from '@/app/appels/actions';

/** ISE-052 — bouton de publication. */
export function PublishCallForm({ callId }: { callId: string }) {
  const [state, formAction, isPending] = useActionState(publishCallAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-3">
      <input type="hidden" name="callId" value={callId} />
      <Button
        type="submit"
        size="lg"
        loading={isPending}
        loadingLabel={frCalls.wizard.publishPending}
      >
        {frCalls.wizard.publish}
      </Button>
      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}
    </form>
  );
}
