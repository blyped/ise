'use client';

import { useActionState } from 'react';
import { Button } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { initialFormState } from '@/lib/form-state';
import { transitionOpportunityAction } from '@/app/opportunites/actions';

/**
 * ISE-060 — mise en pause d'une offre.
 *
 * Seule la transition RÉELLEMENT acceptée par `transition_opportunity`
 * (0053) est rendue : `active -> paused`. La reprise passe par
 * `publish_opportunity`, qui recalcule l'audience — c'est le même geste
 * qu'une publication, et l'écran ne prétend pas le contraire.
 */
export function OpportunityStateActions({
  opportunityId,
  status,
}: {
  opportunityId: string;
  status: string;
}) {
  const [state, formAction, isPending] = useActionState(
    transitionOpportunityAction,
    initialFormState,
  );

  if (status !== 'active') return null;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="toStatus" value="paused" />
      <Button
        type="submit"
        variant="secondary"
        fullWidth
        loading={isPending}
        loadingLabel={frOpportunities.common.savePending}
      >
        {frOpportunities.detail.managePause}
      </Button>
      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
