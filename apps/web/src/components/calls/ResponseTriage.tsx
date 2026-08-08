'use client';

import { useActionState } from 'react';
import { Button, Select } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { initialFormState } from '@/lib/form-state';
import { RESPONSE_STATUSES, type ResponseStatus } from '@/lib/calls-view';
import { setResponseStatusAction } from '@/app/appels/actions';

/**
 * ISE-053 — statut de traitement d'une réponse.
 *
 * Ces statuts sont PRIVÉS (D6 §65) : la politique `network_call_responses_select`
 * ne les expose qu'à l'auteur de l'appel. L'écran le rappelle, pour que
 * personne ne croie marquer publiquement une réponse.
 *
 * Aucun libellé de rejet n'existe (D6 §66) : « Archivée » range, elle ne
 * juge pas.
 */
export function ResponseTriage({
  callId,
  responseId,
  status,
}: {
  callId: string;
  responseId: string;
  status: ResponseStatus;
}) {
  const [state, formAction, isPending] = useActionState(setResponseStatusAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="callId" value={callId} />
      <input type="hidden" name="responseId" value={responseId} />

      <label className="text-caption text-text-secondary flex flex-col gap-1">
        {frCalls.tracking.statusLabel}
        <Select
          name="status"
          defaultValue={status}
          options={RESPONSE_STATUSES.map((value) => ({
            value,
            label: frCalls.responseStatus[value] ?? value,
          }))}
        />
      </label>

      <Button
        type="submit"
        variant="secondary"
        loading={isPending}
        loadingLabel={frCalls.common.savePending}
      >
        {frCalls.tracking.setStatus}
      </Button>

      <p className="text-caption text-text-muted w-full">{frCalls.tracking.statusHint}</p>

      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error w-full">
          {state.message}
        </p>
      ) : null}
      {state.status === 'success' && state.message !== null ? (
        <p aria-live="polite" className="text-caption text-success w-full">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
