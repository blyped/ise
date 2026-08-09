'use client';

import { useActionState, useCallback, useState } from 'react';
import { Alert, Button, ErrorState, Field, Textarea, Input, VisibilitySelect } from '@ise/ui-web';
import { recommendationAcceptSchema } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { initialFormState, type FormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { toRecommendationAcceptInput } from '../form-input-extras';
import {
  acceptRecommendationRequestAction,
  declineRecommendationRequestAction,
  moderateRecommendationAction,
  withdrawRecommendationRequestAction,
} from '../actions-extras';

const t = frProfile.recommendations;

const VISIBILITY_LABELS = {
  private: frProfile.visibility.private,
  connections: frProfile.visibility.connections,
  promotion: frProfile.visibility.promotion,
  members: frProfile.visibility.members,
} as const;

function StateFeedback({ state }: { state: FormState }) {
  if (state.status === 'success' && state.message !== null) {
    return <Alert variant="success" title={state.message} />;
  }
  if (state.status === 'error' && state.correlationId !== null) {
    return (
      <ErrorState
        title={frProfile.common.saveErrorTitle}
        correlationId={state.correlationId}
        {...(state.message ? { description: state.message } : {})}
      />
    );
  }
  return null;
}

/**
 * ISE-028 — le SUJET valide ou masque une recommandation recue.
 * Le trigger de 0085 interdit toute reecriture du texte : ces boutons ne
 * changent que le statut, et la base le garantit.
 */
export function ModerationButtons({
  recommendationId,
  status,
}: {
  recommendationId: string;
  status: 'draft' | 'published' | 'hidden';
}) {
  const [state, formAction, isPending] = useActionState(
    moderateRecommendationAction,
    initialFormState,
  );

  if (state.status === 'success') return <StateFeedback state={state} />;

  return (
    <form action={formAction} className="flex flex-col items-end gap-3">
      <input type="hidden" name="recommendationId" value={recommendationId} />
      <div className="flex flex-wrap gap-3">
        {status !== 'published' ? (
          <Button type="submit" name="action" value="publish" size="sm" loading={isPending}>
            {status === 'hidden' ? t.unhide : t.publish}
          </Button>
        ) : null}
        {status !== 'hidden' ? (
          <Button
            type="submit"
            name="action"
            value="hide"
            size="sm"
            variant="secondary"
            loading={isPending}
          >
            {t.hide}
          </Button>
        ) : null}
      </div>
      <StateFeedback state={state} />
    </form>
  );
}

/** ISE-028 — decliner une demande recue (sans justification, §19). */
export function DeclineRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(
    declineRecommendationRequestAction,
    initialFormState,
  );

  if (state.status === 'success') return <StateFeedback state={state} />;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" size="sm" variant="secondary" loading={isPending}>
        {t.decline}
      </Button>
      <StateFeedback state={state} />
    </form>
  );
}

/** ISE-028 — retirer une demande envoyee, tant qu'elle est en attente. */
export function WithdrawRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(
    withdrawRecommendationRequestAction,
    initialFormState,
  );

  if (state.status === 'success') return <StateFeedback state={state} />;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" size="sm" variant="ghost" loading={isPending}>
        {t.withdraw}
      </Button>
      <StateFeedback state={state} />
    </form>
  );
}

/**
 * ISE-028 — accepter une demande = ECRIRE la recommandation (jamais un
 * simple like, MASTER PROMPT §19). La recommandation nait en brouillon :
 * son sujet la validera avant qu'elle ne soit visible.
 */
export function AcceptRequestForm({
  requestId,
  requesterName,
  defaultSkillId,
  skillName,
  requestContext,
}: {
  requestId: string;
  requesterName: string;
  defaultSkillId: number | null;
  skillName: string | null;
  requestContext: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    acceptRecommendationRequestAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(
    recommendationAcceptSchema,
    toRecommendationAcceptInput,
  );
  const [bodyLength, setBodyLength] = useState(0);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  if (state.status === 'success') return <StateFeedback state={state} />;

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {t.accept}
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="border-border rounded-base flex flex-col gap-5 border p-5"
    >
      <input type="hidden" name="requestId" value={requestId} />
      {defaultSkillId !== null ? (
        <input type="hidden" name="skillId" value={defaultSkillId} />
      ) : null}

      <h4 className="text-body text-text-primary font-semibold">
        {t.acceptTitle.replace('{name}', requesterName)}
      </h4>
      {skillName !== null ? (
        <p className="text-caption text-text-secondary">
          {t.skillLabel} {skillName}
        </p>
      ) : null}

      {state.status === 'error' && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Field label={t.acceptRelationshipLabel} error={errorFor('relationshipContext')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="relationshipContext"
            type="text"
            required
            defaultValue={requestContext ?? ''}
            placeholder={t.acceptRelationshipPlaceholder}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('relationshipContext')}
          />
        )}
      </Field>

      <Field label={t.acceptEngagementLabel} error={errorFor('engagementContext')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="engagementContext"
            type="text"
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('engagementContext')}
          />
        )}
      </Field>

      <Field
        label={t.acceptBodyLabel}
        hint={frProfile.common.counter
          .replace('{current}', String(bodyLength))
          .replace('{max}', '2000')}
        error={errorFor('body')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="body"
            rows={5}
            required
            maxLength={2000}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={(event) => {
              setBodyLength(event.currentTarget.value.length);
              clearField('body');
            }}
          />
        )}
      </Field>

      <VisibilitySelect
        name="visibility"
        label={frProfile.common.visibilityLabel}
        labels={VISIBILITY_LABELS}
        allowedLevels={['private', 'connections', 'promotion', 'members']}
        defaultValue="members"
        error={errorFor('visibility')}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" loading={isPending}>
          {t.accept}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {frProfile.common.cancel}
        </Button>
      </div>
    </form>
  );
}
