'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../../_components/ActionButton';

/**
 * SA-039 — Reponse d'un agent : message au demandeur OU note interne.
 * La case « note interne » est explicite : le demandeur ne la verra
 * jamais (verifie par le cas E04 du harnais 0030).
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
        {frAdmin.support.detail.replyLabel}
      </label>
      <textarea
        id={bodyId}
        name="body"
        rows={4}
        required
        minLength={2}
        maxLength={8000}
        placeholder={frAdmin.support.detail.replyPlaceholder}
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
        {frAdmin.support.detail.internalLabel}
      </label>
      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Envoi…">
          {frAdmin.support.detail.send}
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
