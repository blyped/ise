'use client';

import { useActionState } from 'react';
import { Alert, Button, Select } from '@ise/ui-web';
import { frSettings, ts } from '@/i18n/settings';
import { initialFormState } from '@/lib/form-state';
import { formatDate, type MemberSettings } from '@/lib/messaging-view';
import { setProfilePausedAction, updateMemberSettingsAction } from '@/app/parametres/actions';

const POLICIES = ['members', 'connections', 'none'] as const;
const DIGESTS = ['daily', 'weekly', 'off'] as const;

/**
 * ISE-099 — compte et sollicitations.
 *
 * « Qui peut m'écrire » n'est pas un affichage : `direct_message_policy`
 * est lu par `private.can_message_profile()` au moment ou quelqu'un
 * tente d'ouvrir une conversation. Le reglage est donc APPLIQUE par la
 * base, pas seulement respecte par l'interface (CA-SET-01).
 *
 * La mise en pause est un formulaire SEPARE : c'est une decision d'un
 * autre ordre que le reglage des sollicitations, et elle ne doit pas
 * partir avec un « Enregistrer » global.
 */
export function AccountSettingsForm({ settings }: { settings: MemberSettings }) {
  const [state, formAction, isPending] = useActionState(
    updateMemberSettingsAction,
    initialFormState,
  );
  const [pauseState, pauseAction, pausePending] = useActionState(
    setProfilePausedAction,
    initialFormState,
  );

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-6">
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {isPending ? frSettings.saving : (state.message ?? '')}
        </p>

        {state.status === 'error' && state.message !== null ? (
          <Alert variant="error" title={state.message}>
            {frSettings.correlationLabel} : {state.correlationId}
          </Alert>
        ) : null}
        {state.status === 'success' && state.message !== null ? (
          <Alert variant="success" title={state.message} />
        ) : null}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="politique-messages"
            className="text-body-sm text-text-primary font-medium"
          >
            {frSettings.account.directMessagePolicy}
          </label>
          <Select
            id="politique-messages"
            name="directMessagePolicy"
            defaultValue={settings.directMessagePolicy}
            aria-describedby="politique-messages-aide"
            options={POLICIES.map((policy) => ({
              value: policy,
              label: frSettings.account.policy[policy] ?? policy,
            }))}
          />
          <p id="politique-messages-aide" className="text-caption text-text-muted">
            {frSettings.account.directMessagePolicyHint}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <input
              id="accuses-lecture"
              name="showReadReceipts"
              type="checkbox"
              value="true"
              defaultChecked={settings.showReadReceipts}
              className="focus-visible:outline-active-blue mt-1 h-5 w-5 rounded border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <label htmlFor="accuses-lecture" className="flex flex-col gap-1">
              <span className="text-body-sm text-text-primary">
                {frSettings.account.readReceipts}
              </span>
              <span className="text-caption text-text-muted">
                {frSettings.account.readReceiptsHint}
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="matching"
              name="appearInMatching"
              type="checkbox"
              value="true"
              defaultChecked={settings.appearInMatching}
              className="focus-visible:outline-active-blue mt-1 h-5 w-5 rounded border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <label htmlFor="matching" className="text-body-sm text-text-primary">
              {frSettings.account.appearInMatching}
            </label>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="listes-participants"
              name="appearInAttendeeLists"
              type="checkbox"
              value="true"
              defaultChecked={settings.appearInAttendeeLists}
              className="focus-visible:outline-active-blue mt-1 h-5 w-5 rounded border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <label htmlFor="listes-participants" className="text-body-sm text-text-primary">
              {frSettings.account.appearInAttendeeLists}
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="frequence-digest" className="text-body-sm text-text-primary font-medium">
            {frSettings.account.digestFrequency}
          </label>
          <Select
            id="frequence-digest"
            name="emailDigestFrequency"
            defaultValue={settings.emailDigestFrequency}
            options={DIGESTS.map((digest) => ({
              value: digest,
              label: frSettings.account.digest[digest] ?? digest,
            }))}
          />
          <p className="text-caption text-text-muted">{frSettings.notifications.deliveryNotice}</p>
        </div>

        <Button
          type="submit"
          loading={isPending}
          loadingLabel={frSettings.saving}
          className="self-start"
        >
          {frSettings.save}
        </Button>
      </form>

      <form action={pauseAction} className="border-border flex flex-col gap-4 border-t pt-6">
        <input type="hidden" name="paused" value={settings.isPaused ? 'false' : 'true'} />
        <div className="flex flex-col gap-1">
          <p className="text-body-sm text-text-primary font-medium">{frSettings.account.pause}</p>
          <p className="text-caption text-text-muted">{frSettings.account.pauseHint}</p>
          {settings.isPaused && settings.pausedAt !== null ? (
            <p className="text-caption text-text-secondary">
              {ts(frSettings.account.paused, { date: formatDate(settings.pausedAt) })}
            </p>
          ) : null}
        </div>

        {!settings.isPaused ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="motif-pause" className="text-body-sm text-text-primary">
              {frSettings.account.pauseReasonLabel}
            </label>
            <input
              id="motif-pause"
              name="reason"
              type="text"
              maxLength={200}
              className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue h-[44px] border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </div>
        ) : null}

        {pauseState.status === 'error' && pauseState.message !== null ? (
          <Alert variant="error" title={pauseState.message}>
            {frSettings.correlationLabel} : {pauseState.correlationId}
          </Alert>
        ) : null}
        {pauseState.status === 'success' && pauseState.message !== null ? (
          <Alert variant="success" title={pauseState.message} />
        ) : null}

        <Button type="submit" variant="secondary" loading={pausePending} className="self-start">
          {settings.isPaused ? frSettings.account.resume : frSettings.account.pause}
        </Button>
      </form>

      <p className="text-caption text-text-muted">{frSettings.account.notInScope}</p>
    </div>
  );
}
