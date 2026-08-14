'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminSupport } from '@/i18n/admin-support';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../../_components/ActionButton';

/**
 * SA-039 — reponse de l'administration : message au demandeur OU note
 * interne. La case « note interne » est explicite : le demandeur ne la
 * verra jamais (verifie par le cas E04 du harnais 0030, et refiltre par
 * `admin_get_support_ticket` / `get_support_ticket`).
 *
 * Le depot de piece jointe COTE ADMINISTRATION n'est pas branche ici :
 * seul le membre peut joindre un fichier a ce jour (0131). Rien dans cet
 * ecran ne laisse croire le contraire — aucun champ fichier n'est rendu.
 */
export function ReplyForm({ action, ticketId }: { action: AdminAction; ticketId: string }) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const bodyId = `${base}-message`;
  const internalId = `${base}-interne`;
  const feedbackId = `${base}-retour`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label htmlFor={bodyId} className="text-body-sm text-text-primary font-medium">
        {frAdminSupport.detail.replyLabel}
      </label>
      <textarea
        id={bodyId}
        name="body"
        rows={4}
        required
        minLength={2}
        maxLength={5000}
        placeholder={frAdminSupport.detail.replyPlaceholder}
        aria-describedby={feedbackId}
        className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue min-h-[110px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <label
        htmlFor={internalId}
        className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
      >
        <input
          id={internalId}
          name="isInternal"
          type="checkbox"
          className="h-5 w-5 accent-[#1D4ED8]"
        />
        {frAdminSupport.detail.internalLabel}
      </label>
      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Envoi…">
          {frAdminSupport.detail.send}
        </Button>
      </div>
      {state.status !== 'idle' && state.message !== null ? (
        <p
          id={feedbackId}
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-caption ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </p>
      ) : (
        <p id={feedbackId} className="sr-only" />
      )}
    </form>
  );
}
