'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { initialFormState, type FormState } from '@/lib/form-state';

export interface DeleteRowFormProps {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  /** Nom du champ cache portant l'identifiant (`experienceId`, `skillId`…). */
  fieldName: string;
  fieldValue: string;
  /** Question posee avant suppression. Aucune suppression en un clic. */
  confirmLabel: string;
  /** Nom de l'element, lu par les technologies d'assistance. */
  itemLabel: string;
}

/**
 * Suppression d'une ligne de profil, en deux temps.
 *
 * La confirmation est un vrai etat de l'interface, pas un `window.confirm`
 * (non stylable, non traduisible, hors du flux clavier).
 */
export function DeleteRowForm({
  action,
  fieldName,
  fieldValue,
  confirmLabel,
  itemLabel,
}: DeleteRowFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [confirming, setConfirming] = useState(false);

  if (state.status === 'success') {
    return <Alert variant="success" title={state.message ?? frProfile.common.saved} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name={fieldName} value={fieldValue} />

      {confirming ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-body-sm text-text-secondary">{confirmLabel}</p>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            loading={isPending}
            loadingLabel={frProfile.common.removePending}
          >
            {frProfile.common.remove}
            <span className="sr-only"> — {itemLabel}</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {frProfile.common.cancel}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          {frProfile.common.remove}
          <span className="sr-only"> — {itemLabel}</span>
        </Button>
      )}

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}
    </form>
  );
}
