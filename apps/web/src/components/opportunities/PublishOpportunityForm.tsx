'use client';

import { useActionState } from 'react';
import { Button, ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { initialFormState } from '@/lib/form-state';
import { publishOpportunityAction } from '@/app/opportunites/actions';

/** ISE-059 — bouton de publication. */
export function PublishOpportunityForm({ opportunityId }: { opportunityId: string }) {
  const [state, formAction, isPending] = useActionState(publishOpportunityAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Button
        type="submit"
        size="lg"
        loading={isPending}
        loadingLabel={frOpportunities.wizard.publishPending}
      >
        {frOpportunities.wizard.publish}
      </Button>
      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}
    </form>
  );
}
