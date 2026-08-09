'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../../_components/ActionButton';

/**
 * Ajout d'une note administrative interne (SA-003). La note vit dans
 * `private.admin_profile_notes` : aucun membre ne la voit jamais —
 * l'ecran l'ecrit en toutes lettres au-dessus du champ.
 */
export function NoteForm({ action, profileId }: { action: AdminAction; profileId: string }) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const bodyId = `${base}-note`;
  const messageId = `${base}-message`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      <label htmlFor={bodyId} className="text-body-sm text-text-primary font-medium">
        {frAdmin.notes.bodyLabel}
      </label>
      <textarea
        id={bodyId}
        name="body"
        rows={3}
        required
        minLength={3}
        maxLength={4000}
        placeholder={frAdmin.notes.bodyPlaceholder}
        aria-describedby={messageId}
        className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={isPending}
          loadingLabel="Enregistrement…"
        >
          {frAdmin.notes.add}
        </Button>
      </div>
      {state.status !== 'idle' && state.message !== null ? (
        <span
          id={messageId}
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-caption ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </span>
      ) : (
        <span id={messageId} className="sr-only" />
      )}
    </form>
  );
}
