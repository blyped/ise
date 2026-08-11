'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminEvents } from '@/i18n/admin-events';
import { initialFormState } from '@/lib/form-state';
import type { EventFollowupBlock } from '@/lib/content-view';
import { formatDateTime } from '@/lib/admin/format';
import { upsertEventFollowupAction } from './actions';

const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue ' +
  'min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-033 — Redaction du bilan organisateur via `admin_upsert_event_followup`
 * (0100). La publication est un choix explicite (case a cocher) : un
 * bilan enregistre sans cocher reste un brouillon, jamais visible des
 * participants (meme logique que la publication d'un evenement, D-55).
 */
export function EventFollowupForm({
  eventId,
  followup,
}: {
  eventId: string;
  followup: EventFollowupBlock | null;
}) {
  const [state, formAction, isPending] = useActionState(upsertEventFollowupAction, initialFormState);
  const base = useId();

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-5">
      <input type="hidden" name="eventId" value={eventId} />

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-summary`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.detail.followupSummary}
        </label>
        <textarea
          id={`${base}-summary`}
          name="summary"
          rows={3}
          defaultValue={followup?.summary ?? ''}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-conclusions`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.detail.followupConclusions}
        </label>
        <textarea
          id={`${base}-conclusions`}
          name="conclusions"
          rows={3}
          defaultValue={followup?.conclusions ?? ''}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-decisions`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.detail.followupDecisions}
        </label>
        <textarea
          id={`${base}-decisions`}
          name="decisions"
          rows={3}
          defaultValue={followup?.decisions ?? ''}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-next-steps`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.detail.followupNextSteps}
        </label>
        <textarea
          id={`${base}-next-steps`}
          name="nextSteps"
          rows={3}
          defaultValue={followup?.nextSteps ?? ''}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-replay`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.detail.followupReplayUrl}
        </label>
        <input
          id={`${base}-replay`}
          name="replayUrl"
          type="url"
          defaultValue={followup?.replayUrl ?? ''}
          className={FIELD}
        />
      </div>

      <label className="text-body-sm text-text-primary flex items-center gap-2 font-medium">
        <input type="checkbox" name="publish" defaultChecked={followup?.publishedAt != null} />
        {frAdminEvents.detail.followupPublish}
      </label>
      <p className="text-caption text-text-muted">
        {followup?.publishedAt != null
          ? `${frAdminEvents.detail.followupPublished} : ${formatDateTime(followup.publishedAt)}`
          : frAdminEvents.detail.followupNotPublished}
      </p>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminEvents.detail.followupSubmit}
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
