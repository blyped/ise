'use client';

import { useActionState } from 'react';
import { Button } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import {
  initialSaveOpportunityState,
  toggleSavedOpportunityAction,
} from '@/app/opportunites/actions';

/**
 * ISE-062 — « Enregistrer » / « Retirer ».
 *
 * Enregistrer une offre ne vaut JAMAIS candidature : le libellé le dit,
 * et l'action n'écrit que dans `saved_opportunities` (D-55).
 */
export function SaveOpportunityButton({
  opportunityId,
  isSaved,
}: {
  opportunityId: string;
  isSaved: boolean;
}) {
  const [state, formAction, isPending] = useActionState(toggleSavedOpportunityAction, {
    ...initialSaveOpportunityState,
    isSaved,
  });

  const saved = state.status === 'idle' ? isSaved : state.isSaved;

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="saved" value={saved ? 'false' : 'true'} />
      <Button
        type="submit"
        variant="secondary"
        loading={isPending}
        loadingLabel={frOpportunities.common.loadMorePending}
      >
        {saved ? frOpportunities.list.unsave : frOpportunities.list.save}
      </Button>
      {state.status === 'error' && state.message !== null ? (
        <span role="alert" className="text-caption text-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
