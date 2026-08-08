'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Select } from '@ise/ui-web';
import { frMessaging } from '@/i18n/messaging';
import { initialFormState } from '@/lib/form-state';
import {
  blockProfileAction,
  reportMessageAction,
  setConversationArchivedAction,
} from '@/app/messages/actions';
import { SensitiveActionDialog } from '@/components/system/SensitiveActionDialog';

/**
 * ISE-097 — actions d'une conversation : archiver (D-82), bloquer
 * (CA-MSG-04), signaler le dernier message recu (D-66).
 *
 * Le blocage passe par `SensitiveActionDialog` : il modifie durablement
 * la relation entre deux membres et n'est pas notifie a la personne
 * bloquee — on ne le declenche donc pas d'un simple clic.
 *
 * Le signalement n'est propose que si un message de l'interlocuteur
 * existe : signaler « la conversation » sans designer de contenu ne
 * transmettrait rien d'examinable a la moderation.
 */
export function ConversationActions({
  conversationId,
  counterpartId,
  counterpartName,
  archived,
  reportableMessageId,
  reasons,
}: {
  conversationId: string;
  counterpartId: string | null;
  counterpartName: string;
  archived: boolean;
  reportableMessageId: string | null;
  reasons: readonly { code: string; name: string }[];
}) {
  const [archiveState, archiveAction, archivePending] = useActionState(
    setConversationArchivedAction,
    initialFormState,
  );
  const [blockState, blockAction, blockPending] = useActionState(
    blockProfileAction,
    initialFormState,
  );
  const [reportState, reportAction, reportPending] = useActionState(
    reportMessageAction,
    initialFormState,
  );
  const [reportOpen, setReportOpen] = useState(false);

  const state =
    reportState.status !== 'idle'
      ? reportState
      : blockState.status !== 'idle'
        ? blockState
        : archiveState;

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {state.message ?? ''}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frMessaging.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}
      {state.status === 'success' && state.message !== null ? (
        <Alert variant="success" title={state.message} />
      ) : null}

      <div className="flex flex-col gap-3">
        <form action={archiveAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="archived" value={archived ? 'false' : 'true'} />
          <Button type="submit" variant="secondary" fullWidth loading={archivePending}>
            {archived ? frMessaging.thread.unarchive : frMessaging.thread.archive}
          </Button>
        </form>

        {counterpartId !== null ? (
          <SensitiveActionDialog
            triggerLabel={frMessaging.thread.block}
            title={`Bloquer ${counterpartName} ?`}
            description={<p>{frMessaging.thread.blockConfirm}</p>}
            confirmLabel={frMessaging.thread.block}
            confirmationPhrase={null}
            pending={blockPending}
          >
            {() => (
              <form action={blockAction}>
                <input type="hidden" name="profileId" value={counterpartId} />
                <input type="hidden" name="conversationId" value={conversationId} />
                <Button type="submit" variant="danger" loading={blockPending}>
                  {frMessaging.thread.block}
                </Button>
              </form>
            )}
          </SensitiveActionDialog>
        ) : null}

        {reportableMessageId !== null && reasons.length > 0 ? (
          reportOpen ? (
            <form action={reportAction} className="flex flex-col gap-3">
              <input type="hidden" name="messageId" value={reportableMessageId} />
              <input type="hidden" name="conversationId" value={conversationId} />
              <label
                htmlFor="motif-signalement-message"
                className="text-body-sm text-text-primary font-medium"
              >
                Motif du signalement
              </label>
              <Select
                id="motif-signalement-message"
                name="reasonCode"
                required
                aria-describedby={
                  reportState.fieldErrors['reasonCode'] ? 'motif-signalement-erreur' : undefined
                }
                options={reasons.map((reason) => ({ value: reason.code, label: reason.name }))}
                placeholder="Choisissez un motif"
              />
              {reportState.fieldErrors['reasonCode'] ? (
                <p id="motif-signalement-erreur" className="text-caption text-error">
                  {reportState.fieldErrors['reasonCode']}
                </p>
              ) : null}
              <label
                htmlFor="precisions-signalement"
                className="text-body-sm text-text-primary font-medium"
              >
                Précisions (facultatif)
              </label>
              <textarea
                id="precisions-signalement"
                name="description"
                rows={3}
                className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue border border-[#CBD5E1] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <div className="flex gap-3">
                <Button type="submit" loading={reportPending}>
                  Envoyer le signalement
                </Button>
                <Button type="button" variant="secondary" onClick={() => setReportOpen(false)}>
                  {frMessaging.common.cancel}
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="secondary" fullWidth onClick={() => setReportOpen(true)}>
              {frMessaging.thread.report}
            </Button>
          )
        ) : null}
      </div>

      <p className="text-caption text-text-muted">{frMessaging.thread.noAdminAccess}</p>
    </div>
  );
}
