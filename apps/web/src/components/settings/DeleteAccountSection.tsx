'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { initialFormState } from '@/lib/form-state';
import { deleteMyAccountAction } from '@/app/parametres/actions';
import { SensitiveActionDialog } from '@/components/system/SensitiveActionDialog';

/**
 * SYS-008 — suppression du compte (D-19, MASTER PROMPT §48).
 *
 * L'ecran distingue EXPLICITEMENT deux choses que l'on confond souvent :
 *   * supprimer mon COMPTE — c'est ce que fait ce bouton ;
 *   * supprimer mon PROFIL REFERENCE — ce n'est pas la meme chose, et ce
 *     n'est pas ce qui se passe ici. Le profil ISE appartient a
 *     l'annuaire ; il subsiste et redevient non reclame.
 *
 * §46 — l'action n'est JAMAIS mise en file d'attente hors connexion :
 * elle aboutit ou elle echoue, et le dialogue l'ecrit.
 */
export function DeleteAccountSection() {
  const [state, formAction, isPending] = useActionState(deleteMyAccountAction, initialFormState);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-body text-text-primary font-semibold">
            {frSettings.data.deleteWhatHappens}
          </h3>
          <p className="text-body-sm text-text-secondary">
            {frSettings.data.deleteWhatHappensBody}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-body text-text-primary font-semibold">
            {frSettings.data.deleteWhatRemains}
          </h3>
          <p className="text-body-sm text-text-secondary">
            {frSettings.data.deleteWhatRemainsBody}
          </p>
        </div>
        <Alert variant="info" title={frSettings.data.deleteNotProfileDeletion} />
      </div>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frSettings.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <SensitiveActionDialog
        triggerLabel={frSettings.data.deleteAction}
        title={frSettings.data.deleteDialogTitle}
        description={
          <>
            <p>{frSettings.data.deleteWhatHappensBody}</p>
            <p>{frSettings.data.deleteWhatRemainsBody}</p>
            <p>{frSettings.data.deleteIrreversible}</p>
          </>
        }
        confirmLabel={frSettings.data.deleteConfirmAction}
        confirmationPhrase="SUPPRIMER"
        confirmationLabel={frSettings.data.deleteConfirmLabel}
        confirmationHint={frSettings.data.deleteConfirmHint}
        offlineNotice={frSettings.data.deleteOnlineOnly}
        pending={isPending}
      >
        {(confirmation) => (
          <form action={formAction}>
            <input type="hidden" name="confirmation" value={confirmation} />
            <Button
              type="submit"
              variant="danger"
              loading={isPending}
              disabled={confirmation.trim().toUpperCase() !== 'SUPPRIMER'}
            >
              {frSettings.data.deleteConfirmAction}
            </Button>
          </form>
        )}
      </SensitiveActionDialog>
    </div>
  );
}
