'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@ise/ui-web';
import { frMemberModeration } from '@/i18n/moderation-membre';
import { initialFormState } from '@/lib/form-state';
import { SensitiveActionDialog } from '@/components/system/SensitiveActionDialog';
import type { AdminAction } from '../../_components/ActionButton';

/**
 * SUPPRESSION DU COMPTE d'un membre (migration 0130, decision D-19).
 *
 * POURQUOI CE COMPOSANT ET PAS `ReasonAction`
 *   `ReasonAction` couvre les sanctions motivees (suspension, archivage,
 *   roles) et passe `confirmationPhrase={null}` : une confirmation simple
 *   y suffit. La suppression d'un compte, elle, releve du MASTER PROMPT
 *   §48 : phrase a recopier, bouton inerte tant qu'elle n'est pas exacte.
 *   `SensitiveActionDialog` sait le faire ; il fallait juste l'utiliser
 *   avec sa phrase, comme le fait deja SYS-008 cote membre.
 *
 * CE QUE LE DIALOGUE DOIT DIRE, ET DIT
 *   Ce qui est supprime (le COMPTE) et ce qui reste (le PROFIL, qui
 *   redevient reference non reclame). C'est toute la decision D-19 :
 *   sans cette distinction, un administrateur croirait effacer une
 *   personne de l'annuaire.
 *
 * La base revalide TOUT : permission `profiles.moderate`, motif d'au
 * moins 10 caracteres, confirmation exacte, et journalise le succes
 * comme le refus.
 */
export function DeleteAccountAction({
  action,
  profileId,
  displayName,
  hasAccount,
}: {
  action: AdminAction;
  profileId: string;
  displayName: string;
  hasAccount: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [reason, setReason] = useState('');
  const base = useId();
  const reasonId = `${base}-motif`;
  const hintId = `${base}-motif-aide`;

  // Un profil sans compte n'a rien a supprimer : la base refuserait
  // (`invalid_transition`). On l'explique plutot que d'offrir le bouton.
  if (!hasAccount) {
    return (
      <p className="text-body-sm text-text-secondary">
        {frMemberModeration.adminDelete.noAccount}
      </p>
    );
  }

  const reasonTooShort = reason.trim().length < 10;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-text-secondary">{frMemberModeration.adminDelete.intro}</p>

      <SensitiveActionDialog
        triggerLabel={frMemberModeration.adminDelete.action}
        title={`${frMemberModeration.adminDelete.title} — ${displayName}`}
        description={
          <>
            <p>{frMemberModeration.adminDelete.description}</p>
            <div>
              <h4 className="text-body-sm text-text-primary font-semibold">
                {frMemberModeration.adminDelete.effectsTitle}
              </h4>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
                {frMemberModeration.adminDelete.effects.map((item) => (
                  <li key={item} className="text-body-sm text-text-secondary">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </>
        }
        confirmLabel={frMemberModeration.adminDelete.confirm}
        confirmationPhrase="SUPPRIMER"
        confirmationLabel={frMemberModeration.adminDelete.confirmationLabel}
        confirmationHint={frMemberModeration.adminDelete.confirmationHint}
        preservedTitle={frMemberModeration.adminDelete.preservedTitle}
        preservedItems={frMemberModeration.adminDelete.preserved}
        noticeTitle={frMemberModeration.adminDelete.noticeTitle}
        notice={frMemberModeration.adminDelete.notice}
        pending={isPending}
      >
        {(confirmation) => (
          <form action={formAction} className="flex w-full flex-col gap-4">
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="confirmation" value={confirmation} />

            <div className="flex flex-col gap-2">
              <label htmlFor={reasonId} className="text-body-sm text-text-primary font-medium">
                {frMemberModeration.adminDelete.reasonLabel}
              </label>
              <textarea
                id={reasonId}
                name="reason"
                rows={3}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={frMemberModeration.adminDelete.reasonPlaceholder}
                aria-describedby={hintId}
                className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <p id={hintId} className="text-caption text-text-muted">
                {frMemberModeration.adminDelete.noticeTitle} —{' '}
                {frMemberModeration.adminDelete.notice}
              </p>
            </div>

            <div>
              <Button
                type="submit"
                variant="danger"
                loading={isPending}
                loadingLabel={frMemberModeration.adminDelete.confirm}
                disabled={reasonTooShort || confirmation.trim().toUpperCase() !== 'SUPPRIMER'}
              >
                {frMemberModeration.adminDelete.confirm}
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
