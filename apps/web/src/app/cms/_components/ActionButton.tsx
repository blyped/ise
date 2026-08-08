'use client';

import { useActionState, useId } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { initialFormState, type FormState } from '@/lib/form-state';

export type CmsAction = (previous: FormState, formData: FormData) => Promise<FormState>;

export interface ActionButtonProps {
  action: CmsAction;
  /** Champs caches transmis a l'action. */
  fields: Readonly<Record<string, string>>;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Desactive le bouton lorsque la permission manque. Ce n'est PAS la securite. */
  disabled?: boolean;
  disabledReason?: string;
  /** Texte lu par les lecteurs d'ecran a la place du libelle visible. */
  srLabel?: string;
}

/**
 * Bouton d'action du CMS : un formulaire, une Server Action, un etat reel.
 *
 * REGLES
 *   * l'etat affiche est celui renvoye par la BASE, jamais un etat
 *     optimiste : un bouton qui annonce « Publié » alors que l'ecriture a
 *     echoue ment a l'utilisateur ;
 *   * l'erreur est rendue dans un `role="alert"` rattache au bouton par
 *     `aria-describedby` ;
 *   * un bouton desactive dit POURQUOI il l'est. « Grisé sans raison » est
 *     une impasse pour l'utilisateur.
 */
export function ActionButton({
  action,
  fields,
  label,
  variant = 'secondary',
  size = 'sm',
  disabled = false,
  disabledReason,
  srLabel,
}: ActionButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const messageId = `${base}-message`;
  const hasMessage = state.status === 'error' && state.message !== null;
  const describedBy = hasMessage ? messageId : disabled && disabledReason ? messageId : undefined;

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
        loadingLabel={frCms.common.saving}
        disabled={disabled}
        {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      >
        {srLabel ? <span className="sr-only">{srLabel}</span> : null}
        <span aria-hidden={srLabel ? 'true' : undefined}>{label}</span>
      </Button>

      {hasMessage ? (
        <span id={messageId} role="alert" className="text-caption text-error">
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
