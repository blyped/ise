'use client';

import { useActionState, useId, type ReactNode } from 'react';
import { Alert, Button } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { initialFormState } from '@/lib/form-state';
import type { CmsAction } from './ActionButton';

export interface CmsFormProps {
  action: CmsAction;
  submitLabel: string;
  /** Rendu des champs. Recoit les erreurs par champ renvoyees par le serveur. */
  children: (fieldErrors: Readonly<Record<string, string>>) => ReactNode;
  /** Formulaire de televersement : impose `multipart/form-data`. */
  multipart?: boolean;
  secondary?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Formulaire du CMS.
 *
 * Un seul endroit gere : l'etat renvoye par la Server Action, le message
 * global, les erreurs par champ et le `correlation_id` (D-93, D-102).
 * Les champs restent des elements natifs : ils fonctionnent au clavier,
 * ils sont annonces, et le formulaire se soumet sans JavaScript si
 * l'hydratation echoue.
 */
export function CmsForm({
  action,
  submitLabel,
  children,
  multipart = false,
  secondary,
  disabled = false,
  disabledReason,
}: CmsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const messageId = `${base}-message`;

  return (
    <form
      action={formAction}
      {...(multipart ? { encType: 'multipart/form-data' } : {})}
      className="flex flex-col gap-6"
      aria-describedby={state.message !== null ? messageId : undefined}
    >
      {state.message !== null ? (
        <div id={messageId} role={state.status === 'error' ? 'alert' : 'status'}>
          <Alert
            variant={state.status === 'error' ? 'error' : 'success'}
            title={state.status === 'error' ? 'Action refusée' : 'Enregistré'}
          >
            {state.message}
            {state.status === 'error' && state.correlationId !== null ? (
              <>
                {' '}
                <code className="font-mono">{state.correlationId}</code>
              </>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {children(state.fieldErrors)}

      {disabled ? (
        <p className="text-caption text-text-muted">
          {disabledReason ?? frCms.common.readOnlyHint}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={isPending} loadingLabel={frCms.common.saving}>
            {submitLabel}
          </Button>
          {secondary}
        </div>
      )}
    </form>
  );
}

export interface CmsFieldProps {
  name: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean;
  children: (props: {
    id: string;
    name: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
    required: boolean;
  }) => ReactNode;
}

/**
 * Champ de formulaire : libelle lie, aide et erreur rattachees par
 * `aria-describedby`, `aria-invalid` pose quand la valeur est refusee.
 */
export function CmsField({ name, label, hint, error, required = false, children }: CmsFieldProps) {
  const base = useId();
  const id = `${base}-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body-sm text-text-primary font-medium">
        {label}
        {required ? (
          <span className="text-error" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        name,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required,
      })}
      {hint ? (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const CMS_INPUT_CLASS =
  'rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue min-h-[44px] w-full border border-[#CBD5E1] px-4 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 aria-[invalid=true]:border-error';

export const CMS_TEXTAREA_CLASS =
  'rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue w-full border border-[#CBD5E1] px-4 py-3 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 aria-[invalid=true]:border-error';
