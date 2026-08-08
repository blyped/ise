'use client';

import { useActionState } from 'react';
import { Button } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { initialFormState } from '@/lib/form-state';
import { transitionCallAction } from '@/app/appels/actions';

/**
 * ISE-053 — mise en pause et reprise d'un appel.
 *
 * Seules les transitions RÉELLEMENT acceptées par
 * `transition_network_call` (0007) sont rendues : `active -> paused` et
 * `paused -> active`. Aucun autre bouton n'existe, parce qu'aucune autre
 * transition ne passerait.
 */
export function CallStateActions({ callId, status }: { callId: string; status: string }) {
  const [state, formAction, isPending] = useActionState(transitionCallAction, initialFormState);

  if (status !== 'active' && status !== 'paused') return null;
  const target = status === 'active' ? 'paused' : 'active';

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="callId" value={callId} />
      <input type="hidden" name="toStatus" value={target} />
      <Button
        type="submit"
        variant="secondary"
        fullWidth
        loading={isPending}
        loadingLabel={frCalls.common.savePending}
      >
        {target === 'paused' ? frCalls.detail.managePause : frCalls.detail.manageResume}
      </Button>
      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
