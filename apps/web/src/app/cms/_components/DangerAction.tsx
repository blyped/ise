'use client';

import { useActionState } from 'react';
import { Button } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { initialFormState } from '@/lib/form-state';
import { SensitiveActionDialog } from '@/components/system/SensitiveActionDialog';
import type { CmsAction } from './ActionButton';

export interface DangerActionProps {
  action: CmsAction;
  fields: Readonly<Record<string, string>>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Action destructive du CMS (MASTER PROMPT §38 : toute action sensible est
 * confirmee par un dialogue).
 *
 * Reutilise `SensitiveActionDialog`, deja en place : le dialogue n'est
 * qu'un rappel, la confirmation est un SECOND geste, et la base revalide
 * la permission de toute facon. Aucun composant existant n'est modifie.
 */
export function DangerAction({
  action,
  fields,
  triggerLabel,
  title,
  description,
  confirmLabel,
  disabled = false,
  disabledReason,
}: DangerActionProps) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);

  if (disabled) {
    return (
      <span className="text-caption text-text-muted">
        {disabledReason ?? frCms.common.forbidden}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SensitiveActionDialog
        triggerLabel={triggerLabel}
        title={title}
        description={<p>{description}</p>}
        confirmLabel={confirmLabel}
        confirmationPhrase={null}
        pending={isPending}
      >
        {() => (
          <form action={formAction} className="contents">
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Button
              type="submit"
              variant="danger"
              loading={isPending}
              loadingLabel={frCms.common.saving}
            >
              {confirmLabel}
            </Button>
          </form>
        )}
      </SensitiveActionDialog>

      {state.status === 'error' && state.message !== null ? (
        <span role="alert" className="text-caption text-error">
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </span>
      ) : null}
    </div>
  );
}
