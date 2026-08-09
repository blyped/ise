'use client';

import { useActionState, useId } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@ise/ui-web';
import { initialFormState, type FormState } from '@/lib/form-state';

export type AdminAction = (previous: FormState, formData: FormData) => Promise<FormState>;

export interface ActionButtonProps {
  action: AdminAction;
  /** Champs caches transmis a l'action. */
  fields: Readonly<Record<string, string>>;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Bouton d'action simple du back-office : un formulaire, une Server
 * Action, l'etat renvoye par la BASE — jamais un etat optimiste. Les
 * messages (succes comme erreur, avec `correlation_id`) sont rendus dans
 * un `role="status"` / `role="alert"` relie par `aria-describedby`.
 */
export function ActionButton({
  action,
  fields,
  label,
  variant = 'secondary',
  size = 'sm',
  disabled = false,
  disabledReason,
}: ActionButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const messageId = `${base}-message`;
  const hasMessage = state.status !== 'idle' && state.message !== null;
  const describedBy = hasMessage || (disabled && disabledReason) ? messageId : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant={variant}
        size={size}
        loading={isPending}
        loadingLabel="Enregistrement…"
        disabled={disabled}
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      >
        {label}
      </Button>

      {hasMessage ? (
        <span
          id={messageId}
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-caption ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </span>
      ) : disabled && disabledReason ? (
        <span id={messageId} className="text-caption text-text-muted">
          {disabledReason}
        </span>
      ) : null}
    </form>
  );
}
