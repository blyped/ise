'use client';

import { useActionState } from 'react';
import { Button } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { initialSaveState, toggleSavedCallAction } from '@/app/appels/actions';

/**
 * « Enregistrer » / « Retirer » un appel (ISE-047).
 *
 * L'etat affiche est celui renvoye par la BASE apres ecriture, jamais un
 * etat optimiste : un bouton qui affiche « Enregistré » alors que
 * l'ecriture a echoue ment a l'utilisateur.
 */
export function SaveCallButton({ callId, isSaved }: { callId: string; isSaved: boolean }) {
  const [state, formAction, isPending] = useActionState(toggleSavedCallAction, {
    ...initialSaveState,
    isSaved,
  });

  const saved = state.status === 'idle' ? isSaved : state.isSaved;

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="callId" value={callId} />
      <input type="hidden" name="saved" value={saved ? 'false' : 'true'} />
      <Button
        type="submit"
        variant="secondary"
        loading={isPending}
        loadingLabel={frCalls.common.loadMorePending}
      >
        {saved ? frCalls.list.unsave : frCalls.list.save}
      </Button>
      {state.status === 'error' && state.message !== null ? (
        <span role="alert" className="text-caption text-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
