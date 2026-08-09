'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { initialFormState } from '@/lib/form-state';
import { SensitiveActionDialog } from '@/components/system/SensitiveActionDialog';
import type { AdminAction } from './ActionButton';

export interface ReasonActionSelect {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}

export interface ReasonActionInput {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
}

export interface ReasonActionProps {
  action: AdminAction;
  fields: Readonly<Record<string, string>>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** Champ « motif ». `false` = action confirmee sans motif saisi ici. */
  withReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Champ texte additionnel (identifiant de profil, de promotion…). */
  input?: ReasonActionInput;
  /** Liste deroulante optionnelle (issue retenue, role, action…). */
  select?: ReasonActionSelect;
  destructive?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Action administrative SENSIBLE (MASTER PROMPT §38) : dialogue de
 * confirmation (`SensitiveActionDialog`), motif saisi DANS le dialogue,
 * soumission en second geste explicite. La base revalide la permission
 * ET le motif (>= 10 caracteres) ; ce composant ne fait que l'annoncer.
 */
export function ReasonAction({
  action,
  fields,
  triggerLabel,
  title,
  description,
  confirmLabel,
  withReason = true,
  reasonLabel,
  reasonPlaceholder,
  input,
  select,
  destructive = true,
  disabled = false,
  disabledReason,
}: ReasonActionProps) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [reason, setReason] = useState('');
  const base = useId();
  const reasonId = `${base}-motif`;
  const hintId = `${base}-motif-aide`;
  const selectId = `${base}-choix`;
  const inputId = `${base}-champ`;
  const inputHintId = `${base}-champ-aide`;

  if (disabled) {
    return (
      <span className="text-caption text-text-muted">
        {disabledReason ?? frAdmin.errors['permission_denied']}
      </span>
    );
  }

  const reasonTooShort = withReason && reason.trim().length < 10;

  return (
    <div className="flex flex-col gap-2">
      <SensitiveActionDialog
        triggerLabel={triggerLabel}
        title={title}
        description={<p>{description}</p>}
        confirmLabel={confirmLabel}
        confirmationPhrase={null}
        pending={isPending}
        destructive={destructive}
      >
        {() => (
          <form action={formAction} className="flex w-full flex-col gap-4">
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}

            {select !== undefined ? (
              <div className="flex flex-col gap-2">
                <label htmlFor={selectId} className="text-body-sm text-text-primary font-medium">
                  {select.label}
                </label>
                <select
                  id={selectId}
                  name={select.name}
                  className="rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {select.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {input !== undefined ? (
              <div className="flex flex-col gap-2">
                <label htmlFor={inputId} className="text-body-sm text-text-primary font-medium">
                  {input.label}
                </label>
                <input
                  id={inputId}
                  name={input.name}
                  type="text"
                  required
                  placeholder={input.placeholder ?? ''}
                  aria-describedby={input.hint ? inputHintId : undefined}
                  className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                {input.hint ? (
                  <p id={inputHintId} className="text-caption text-text-muted">
                    {input.hint}
                  </p>
                ) : null}
              </div>
            ) : null}

            {withReason ? (
              <div className="flex flex-col gap-2">
                <label htmlFor={reasonId} className="text-body-sm text-text-primary font-medium">
                  {reasonLabel ?? frAdmin.members.actions.reasonLabel}
                </label>
                <textarea
                  id={reasonId}
                  name="reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={reasonPlaceholder ?? ''}
                  aria-describedby={hintId}
                  required
                  className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <p id={hintId} className="text-caption text-text-muted">
                  {frAdmin.common.auditNote}
                </p>
              </div>
            ) : null}

            <div>
              <Button
                type="submit"
                variant={destructive ? 'danger' : 'primary'}
                loading={isPending}
                loadingLabel="Enregistrement…"
                disabled={reasonTooShort}
              >
                {confirmLabel}
              </Button>
            </div>
          </form>
        )}
      </SensitiveActionDialog>

      {state.status !== 'idle' && state.message !== null ? (
        <span
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-caption ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </span>
      ) : null}
    </div>
  );
}
