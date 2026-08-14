'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminSupport } from '@/i18n/admin-support';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../../_components/ActionButton';

const URGENCIES = ['low', 'standard', 'high', 'critical'] as const;

/**
 * SA-039 — requalification de la priorite d'une remontee.
 *
 * D-85 : le demandeur ne choisit jamais sa priorite. Elle est posee par
 * la plateforme d'apres la nature de la remontee, puis ajustee ICI. Le
 * motif est facultatif mais conserve au journal d'audit — c'est la trace
 * qui rend l'arbitrage relisible plus tard.
 */
export function UrgencyForm({
  action,
  ticketId,
  currentUrgency,
}: {
  action: AdminAction;
  ticketId: string;
  currentUrgency: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const urgencyId = `${base}-priorite`;
  const reasonId = `${base}-motif`;
  const feedbackId = `${base}-retour`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />

      <p className="text-body-sm text-text-secondary">{frAdminSupport.detail.urgencyIntro}</p>

      <label htmlFor={urgencyId} className="text-body-sm text-text-primary font-medium">
        {frAdminSupport.detail.urgencyLabel}
      </label>
      <select
        id={urgencyId}
        name="urgency"
        defaultValue={currentUrgency}
        className="rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue h-[44px] max-w-[280px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {URGENCIES.map((value) => (
          <option key={value} value={value}>
            {frAdminSupport.urgency[value] ?? value}
          </option>
        ))}
      </select>

      <label htmlFor={reasonId} className="text-body-sm text-text-primary font-medium">
        {frAdminSupport.detail.urgencyReasonLabel}
      </label>
      <input
        id={reasonId}
        name="reason"
        type="text"
        maxLength={300}
        placeholder={frAdminSupport.detail.urgencyReasonPlaceholder}
        aria-describedby={feedbackId}
        className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      />

      <div>
        <Button type="submit" variant="secondary" loading={isPending} loadingLabel="Envoi…">
          {frAdminSupport.detail.urgencySubmit}
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
