'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Button } from '@ise/ui-web';
import { frNetwork } from '@/i18n/network';
import { initialFormState } from '@/lib/form-state';
import {
  acceptConnectionRequestAction,
  respondToConnectionRequestAction,
} from '@/app/reseau/actions';

/**
 * ISE-041 / ISE-042 — Accepter, décliner, ignorer.
 *
 * « Ignorer » est un simple LIEN de retour : il n'ecrit rien, n'appelle
 * aucune action et ne change aucun statut. C'est exactement ce que le
 * mot veut dire, et c'est ce que dit le texte d'aide sous les boutons
 * (D-55). Un bouton « Ignorer » qui enregistrerait un « ignoré » serait
 * un statut pose sur un non-evenement.
 *
 * ACCESSIBILITE : les deux formulaires annoncent leur resultat dans une
 * region `aria-live` ; le focus n'est jamais deplace de force. Chaque
 * bouton fait 44 px de haut au minimum.
 */
export function InvitationActions({
  requestId,
  ignoreHref,
  detailHref,
  layout = 'row',
}: {
  requestId: string;
  /** Ou mene « Ignorer ». Aucune ecriture n'a lieu. */
  ignoreHref: string;
  /** `null` sur l'ecran de detail : on y est deja. */
  detailHref: string | null;
  layout?: 'row' | 'stack';
}) {
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptConnectionRequestAction,
    initialFormState,
  );
  const [declineState, declineAction, declinePending] = useActionState(
    respondToConnectionRequestAction,
    initialFormState,
  );

  const state = acceptState.status !== 'idle' ? acceptState : declineState;
  const answered = state.status === 'success';

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {acceptPending || declinePending ? frNetwork.common.loadMorePending : (state.message ?? '')}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frNetwork.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      {answered ? (
        <Alert variant="success" title={state.message ?? ''} />
      ) : (
        <div
          className={
            layout === 'row'
              ? 'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'
              : 'flex flex-col gap-3'
          }
        >
          <form action={acceptAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <Button
              type="submit"
              size="md"
              fullWidth={layout === 'stack'}
              loading={acceptPending}
              loadingLabel={frNetwork.invitations.acceptPending}
              disabled={declinePending}
            >
              {frNetwork.invitations.accept}
            </Button>
          </form>

          <form action={declineAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="decision" value="declined" />
            <Button
              type="submit"
              variant="secondary"
              size="md"
              fullWidth={layout === 'stack'}
              loading={declinePending}
              loadingLabel={frNetwork.invitations.declinePending}
              disabled={acceptPending}
            >
              {frNetwork.invitations.decline}
            </Button>
          </form>

          {detailHref !== null ? (
            <Link
              href={detailHref}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frNetwork.invitations.detail}
            </Link>
          ) : null}

          <Link
            href={ignoreHref}
            className="rounded-base text-body-sm text-text-secondary hover:text-text-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center px-5 font-medium underline decoration-transparent transition-colors duration-150 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frNetwork.invitations.ignore}
          </Link>
        </div>
      )}

      <p className="text-caption text-text-muted">{frNetwork.invitations.ignoreHint}</p>
    </div>
  );
}
