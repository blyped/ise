'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frSupport } from '@/i18n/support';
import { initialFormState } from '@/lib/form-state';
import { replyToSupportTicketAction, transitionSupportTicketAction } from '@/app/aide/actions';

/**
 * ISE-100 — reponse du demandeur, cloture et reouverture.
 *
 * La cloture et la reouverture passent par `transition_support_ticket` :
 * un `update` direct de `status` est refuse par le trigger de 0049. Le
 * bouton n'est rendu que lorsque la transition est REELLEMENT possible —
 * la base a deja repondu `can_close` / `can_reopen`.
 */
export function TicketReplyForm({
  ticketId,
  canReply,
  canClose,
  canReopen,
}: {
  ticketId: string;
  canReply: boolean;
  canClose: boolean;
  canReopen: boolean;
}) {
  const [replyState, replyAction, replyPending] = useActionState(
    replyToSupportTicketAction,
    initialFormState,
  );
  const [transitionState, transitionAction, transitionPending] = useActionState(
    transitionSupportTicketAction,
    initialFormState,
  );

  const state = transitionState.status !== 'idle' ? transitionState : replyState;

  return (
    <div className="flex flex-col gap-5">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {state.message ?? ''}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frSupport.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}
      {state.status === 'success' && state.message !== null ? (
        <Alert variant="success" title={state.message} />
      ) : null}

      {canReply ? (
        <form action={replyAction} className="flex flex-col gap-3">
          <input type="hidden" name="ticketId" value={ticketId} />
          <label htmlFor="reponse-demande" className="text-body-sm text-text-primary font-medium">
            {frSupport.ticket.replyLabel}
          </label>
          <textarea
            id="reponse-demande"
            name="body"
            rows={4}
            required
            maxLength={5000}
            placeholder={frSupport.ticket.replyPlaceholder}
            aria-invalid={replyState.fieldErrors['body'] !== undefined}
            aria-describedby={replyState.fieldErrors['body'] ? 'reponse-erreur' : undefined}
            className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue border border-[#CBD5E1] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          {replyState.fieldErrors['body'] ? (
            <p id="reponse-erreur" className="text-caption text-error">
              {replyState.fieldErrors['body']}
            </p>
          ) : null}
          <Button
            type="submit"
            loading={replyPending}
            loadingLabel={frSupport.ticket.submitting}
            className="self-start"
          >
            {frSupport.ticket.reply}
          </Button>
        </form>
      ) : (
        <p className="text-body-sm text-text-muted">{frSupport.ticket.closedNoReply}</p>
      )}

      {canClose || canReopen ? (
        <div className="border-border flex flex-col gap-3 border-t pt-5 sm:flex-row">
          {canReopen ? (
            <form action={transitionAction}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <input type="hidden" name="toStatus" value="open" />
              <Button type="submit" variant="secondary" loading={transitionPending}>
                {frSupport.ticket.reopen}
              </Button>
            </form>
          ) : null}
          {canClose ? (
            <form action={transitionAction}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <input type="hidden" name="toStatus" value="closed" />
              <Button type="submit" variant="ghost" loading={transitionPending}>
                {frSupport.ticket.close}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
