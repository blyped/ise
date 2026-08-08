'use client';

import { useActionState, useMemo } from 'react';
import { Alert, Avatar, Button, Select } from '@ise/ui-web';
import { frMessaging } from '@/i18n/messaging';
import { initialFormState } from '@/lib/form-state';
import { startConversationAction } from '@/app/messages/actions';

const REASONS = [
  'expertise',
  'opportunity',
  'introduction',
  'mentorship',
  'project',
  'other',
] as const;

/**
 * ISE-097 — formulaire d'ouverture de conversation.
 *
 * Le `clientMessageId` est tire ICI, une seule fois pour la duree du
 * formulaire : si l'envoi est rejoue apres une coupure reseau, la base
 * reconnait l'identifiant et ne cree pas un second message (D-83).
 */
export function ComposeForm({
  targetProfileId,
  targetName,
  targetHeadline,
}: {
  targetProfileId: string;
  targetName: string;
  targetHeadline: string | null;
}) {
  const [state, formAction, isPending] = useActionState(startConversationAction, initialFormState);

  const clientMessageId = useMemo(
    () =>
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `cli-${Date.now().toString(16)}`,
    [],
  );

  if (state.status === 'success') {
    return <Alert variant="success" title={state.message ?? frMessaging.compose.successOpened} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="targetProfileId" value={targetProfileId} />
      <input type="hidden" name="clientMessageId" value={clientMessageId} />

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {isPending ? frMessaging.compose.submitting : (state.message ?? '')}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frMessaging.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <div className="rounded-base border-border bg-surface-muted flex items-center gap-4 border p-4">
        <Avatar name={targetName} size={48} />
        <div className="flex min-w-0 flex-col">
          <span className="text-caption text-text-muted">{frMessaging.compose.recipientLabel}</span>
          <span className="text-body-sm text-text-primary truncate font-semibold">
            {targetName}
          </span>
          {targetHeadline !== null ? (
            <span className="text-caption text-text-secondary truncate">{targetHeadline}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="motif-contact" className="text-body-sm text-text-primary font-medium">
          {frMessaging.compose.reasonLabel}
        </label>
        <Select
          id="motif-contact"
          name="reason"
          required
          defaultValue="expertise"
          aria-describedby="motif-contact-aide"
          options={REASONS.map((code) => ({
            value: code,
            label: frMessaging.reason[code] ?? code,
          }))}
        />
        <p id="motif-contact-aide" className="text-caption text-text-muted">
          {frMessaging.compose.reasonHint}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="corps-message" className="text-body-sm text-text-primary font-medium">
          {frMessaging.compose.bodyLabel}
        </label>
        <textarea
          id="corps-message"
          name="body"
          rows={6}
          required
          maxLength={5000}
          placeholder={frMessaging.compose.bodyPlaceholder}
          aria-invalid={state.fieldErrors['body'] !== undefined}
          aria-describedby={state.fieldErrors['body'] ? 'corps-message-erreur' : undefined}
          className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue border border-[#CBD5E1] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {state.fieldErrors['body'] ? (
          <p id="corps-message-erreur" className="text-caption text-error">
            {state.fieldErrors['body']}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={frMessaging.compose.submitting}
        className="self-start"
      >
        {frMessaging.compose.submit}
      </Button>

      <p className="text-caption text-text-muted">{frMessaging.thread.attachmentsUnavailable}</p>
    </form>
  );
}
