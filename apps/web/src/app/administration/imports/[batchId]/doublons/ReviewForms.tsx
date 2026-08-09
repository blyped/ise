'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { initialFormState } from '@/lib/form-state';
import { ADMIN_INPUT_CLASS } from '../../_components/AdminForm';
import { decideRowAction, reviewCandidateAction } from './actions';

const t = frAdminData.imports.duplicates;

/**
 * Revue d'un candidat doublon : trois issues possibles, toutes humaines,
 * toutes journalisées. La note est partagée par les trois boutons.
 */
export function CandidateReviewForm({
  batchId,
  candidateId,
  disabled,
}: {
  batchId: string;
  candidateId: string;
  disabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(reviewCandidateAction, initialFormState);
  const noteId = useId();

  if (disabled) return null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <div className="flex flex-col gap-2">
        <label htmlFor={noteId} className="text-body-sm text-text-primary font-medium">
          {t.note}
        </label>
        <input id={noteId} name="note" type="text" maxLength={300} className={ADMIN_INPUT_CLASS} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="status"
          value="confirmed_duplicate"
          variant="primary"
          loading={isPending}
          loadingLabel="…"
        >
          {t.confirm}
        </Button>
        <Button
          type="submit"
          name="status"
          value="not_duplicate"
          variant="secondary"
          loading={isPending}
          loadingLabel="…"
        >
          {t.dismiss}
        </Button>
        <Button
          type="submit"
          name="status"
          value="deferred"
          variant="ghost"
          loading={isPending}
          loadingLabel="…"
        >
          {t.defer}
        </Button>
      </div>
      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error">
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
        <p role="status" className="text-caption text-text-secondary">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Décision sur la LIGNE importée. Le bouton « Fusionner » n'est actif que
 * si un candidat a été confirmé par un humain — et la base le revérifie.
 */
export function RowDecisionForm({
  batchId,
  rowId,
  matchedProfileId,
  mergeEnabled,
}: {
  batchId: string;
  rowId: number;
  matchedProfileId: string | null;
  mergeEnabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(decideRowAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="rowId" value={String(rowId)} />
      {matchedProfileId !== null ? (
        <input type="hidden" name="matchedProfileId" value={matchedProfileId} />
      ) : null}
      <p className="text-body-sm text-text-primary font-medium">{t.rowDecisionTitle}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="decision"
          value="merge"
          variant="primary"
          disabled={!mergeEnabled}
          loading={isPending}
          loadingLabel="…"
        >
          {t.decideMerge}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="create_new"
          variant="secondary"
          loading={isPending}
          loadingLabel="…"
        >
          {t.decideCreate}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="ignore"
          variant="secondary"
          loading={isPending}
          loadingLabel="…"
        >
          {t.decideIgnore}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="review_later"
          variant="ghost"
          loading={isPending}
          loadingLabel="…"
        >
          {t.decideLater}
        </Button>
      </div>
      {!mergeEnabled ? (
        <p className="text-caption text-text-muted">{t.mergeNeedsConfirmed}</p>
      ) : null}
      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error">
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
        <p role="status" className="text-caption text-text-secondary">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
