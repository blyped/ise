'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminCommunities } from '@/i18n/admin-communities';
import { initialFormState } from '@/lib/form-state';
import type { CommunityDetail } from '@/lib/communities-view';
import { updateCommunityAction } from './actions';

const VISIBILITIES = ['network', 'private'] as const;
const JOIN_POLICIES = ['open', 'request', 'invitation'] as const;
const POST_MODERATION_MODES = ['immediate', 'pre_approval'] as const;

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue ' +
  'min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-028 — Edition du contenu et des politiques d'une communaute. Le
 * type, le slug et le discriminant pays/secteur ne sont pas editables
 * ici (immuables apres creation) : seuls le contenu et les politiques
 * d'adhesion / moderation le sont.
 */
export function CommunityEditForm({ community }: { community: CommunityDetail }) {
  const [state, formAction, isPending] = useActionState(updateCommunityAction, initialFormState);
  const base = useId();

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-5">
      <input type="hidden" name="communityId" value={community.communityId} />

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-name`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.name}
        </label>
        <input
          id={`${base}-name`}
          name="name"
          type="text"
          required
          minLength={3}
          defaultValue={community.name}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-description`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.description}
        </label>
        <textarea
          id={`${base}-description`}
          name="description"
          rows={2}
          required
          defaultValue={community.description}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-purpose`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.purpose}
        </label>
        <textarea
          id={`${base}-purpose`}
          name="purpose"
          rows={2}
          defaultValue={community.purpose ?? ''}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-charter`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.charterText}
        </label>
        <textarea
          id={`${base}-charter`}
          name="charterText"
          rows={3}
          defaultValue={community.charterText ?? ''}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-visibility`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.visibility}
          </label>
          <select
            id={`${base}-visibility`}
            name="visibility"
            defaultValue={community.visibility}
            className={`${FIELD} w-[180px]`}
          >
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {frAdminCommunities.visibility[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-join`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.joinPolicy}
          </label>
          <select
            id={`${base}-join`}
            name="joinPolicy"
            defaultValue={community.joinPolicy}
            className={`${FIELD} w-[220px]`}
          >
            {JOIN_POLICIES.map((value) => (
              <option key={value} value={value}>
                {frAdminCommunities.joinPolicy[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-mod`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.postModerationMode}
          </label>
          <select
            id={`${base}-mod`}
            name="postModerationMode"
            defaultValue={community.postModerationMode}
            className={`${FIELD} w-[220px]`}
          >
            {POST_MODERATION_MODES.map((value) => (
              <option key={value} value={value}>
                {frAdminCommunities.postModerationMode[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminCommunities.form.submitEdit}
        </Button>
      </div>

      {state.status !== 'idle' && state.message !== null ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-body-sm ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </p>
      ) : null}
    </form>
  );
}
