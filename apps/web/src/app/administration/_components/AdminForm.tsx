'use client';

import { useActionState, useId, type ReactNode } from 'react';
import { Alert, Button, type ButtonVariant } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { initialFormState, type FormState } from '@/lib/form-state';

export type AdminAction = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Formulaire du back-office « données » — même contrat que `CmsForm` :
 * état renvoyé par la Server Action, message global, erreurs par champ,
 * `correlation_id` en cas d'échec (D-102). Champs natifs : le formulaire
 * se soumet sans JavaScript si l'hydratation échoue.
 */
export function AdminForm({
  action,
  submitLabel,
  children,
  multipart = false,
  variant = 'primary',
  disabled = false,
  disabledReason,
}: {
  action: AdminAction;
  submitLabel: string;
  children?: ((fieldErrors: Readonly<Record<string, string>>) => ReactNode) | undefined;
  multipart?: boolean;
  variant?: ButtonVariant;
  disabled?: boolean;
  disabledReason?: string | undefined;
}) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const messageId = `${base}-message`;

  return (
    <form
      action={formAction}
      {...(multipart ? { encType: 'multipart/form-data' } : {})}
      className="flex flex-col gap-5"
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
                <code className="font-mono">
                  {frAdminData.common.correlationPrefix} {state.correlationId}
                </code>
              </>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {children?.(state.fieldErrors)}

      {disabled ? (
        <p className="text-caption text-text-muted">{disabledReason ?? ''}</p>
      ) : (
        <div>
          <Button type="submit" variant={variant} loading={isPending} loadingLabel="…">
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

export const ADMIN_INPUT_CLASS =
  'border-border text-body-sm text-text-primary bg-surface w-full rounded-lg border px-3 py-2 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Champ : libellé lié, aide et erreur rattachées par `aria-describedby`. */
export function AdminField({
  name,
  label,
  hint,
  error,
  required = false,
  children,
}: {
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
}) {
  const base = useId();
  const id = `${base}-${name}`;
  const hintId = hint !== undefined ? `${id}-hint` : undefined;
  const errorId = error !== undefined ? `${id}-error` : undefined;
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
        'aria-invalid': error !== undefined ? true : undefined,
        required,
      })}
      {hint !== undefined ? (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Action à un bouton (avec champs cachés) : franchir une étape du lot,
 * arbitrer un doublon, basculer un feature flag… L'état d'erreur est
 * affiché sous le bouton, avec l'identifiant de corrélation.
 */
export function AdminActionButton({
  action,
  label,
  hidden,
  variant = 'secondary',
  note,
}: {
  action: AdminAction;
  label: string;
  hidden: Record<string, string>;
  variant?: ButtonVariant;
  note?: string | undefined;
}) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="inline-flex flex-col gap-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} loading={isPending} loadingLabel="…">
        {label}
      </Button>
      {note !== undefined ? <p className="text-caption text-text-muted max-w-xs">{note}</p> : null}
      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error max-w-xs">
          {state.message}
          {state.correlationId !== null ? (
            <>
              {' '}
              <code className="font-mono">{state.correlationId}</code>
            </>
          ) : null}
        </p>
      ) : null}
      {state.status === 'success' && state.message !== null ? (
        <p role="status" className="text-caption text-text-secondary max-w-xs">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
