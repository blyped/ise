'use client';

import { useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, Radio, RadioGroup, Textarea } from '@ise/ui-web';
import { limits } from '@ise/config';
import { introductionRequestSchema } from '@ise/validation';
import { frNetwork, tn } from '@/i18n/network';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { introductionPathRoute } from '@/lib/routes/network';
import { requestIntroductionAction } from './actions';

/**
 * Motifs d'ISE-044. Chaque valeur est un code REEL de
 * `introduction_requests.purpose` : aucun motif affiche n'est sans
 * destination en base (MASTER PROMPT §113).
 */
const PURPOSES = [
  { value: 'expertise', hint: 'Pratiques, retours d’expérience, méthodes.' },
  { value: 'partnership', hint: 'Mission, projet ou consortium.' },
  { value: 'opportunity', hint: 'Comprendre une organisation ou être orienté.' },
  { value: 'advice', hint: 'Orientation ou avis ponctuel.' },
] as const;

function toInput(formData: FormData) {
  const toTarget = formData.get('messageToTarget');
  return {
    intermediaryProfileId: formData.get('intermediaryProfileId'),
    targetProfileId: formData.get('targetProfileId'),
    purpose: formData.get('purpose'),
    messageToIntermediary: formData.get('messageToIntermediary'),
    ...(typeof toTarget === 'string' && toTarget.trim().length > 0
      ? { messageToTarget: toTarget }
      : {}),
  };
}

export function IntroductionRequestForm({
  targetProfileId,
  intermediaryProfileId,
  intermediaryName,
  targetName,
}: {
  targetProfileId: string;
  intermediaryProfileId: string;
  intermediaryName: string;
  targetName: string;
}) {
  const [state, formAction, isPending] = useActionState(
    requestIntroductionAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(introductionRequestSchema, toInput);
  const [length, setLength] = useState(0);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const max = limits.text.introductionMessageMax;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="targetProfileId" value={targetProfileId} />
      <input type="hidden" name="intermediaryProfileId" value={intermediaryProfileId} />

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={frNetwork.ask.errorTitle}>
          {state.message}
          {state.correlationId !== null ? (
            <>
              <br />
              {frNetwork.common.correlationLabel} : {state.correlationId}
            </>
          ) : null}
        </Alert>
      ) : null}

      <RadioGroup legend={frNetwork.ask.purposeLegend} error={errorFor('purpose')}>
        {PURPOSES.map((option, index) => (
          <Radio
            key={option.value}
            name="purpose"
            value={option.value}
            label={frNetwork.purpose[option.value] ?? option.value}
            description={option.hint}
            defaultChecked={index === 0}
            onChange={() => clearField('purpose')}
          />
        ))}
      </RadioGroup>

      <Field
        label={tn(frNetwork.ask.messageLabel, { name: intermediaryName })}
        hint={frNetwork.ask.messageHint}
        error={errorFor('messageToIntermediary')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <div className="flex flex-col gap-2">
            <Textarea
              id={id}
              name="messageToIntermediary"
              rows={6}
              maxLength={max}
              required
              placeholder={frNetwork.ask.messagePlaceholder}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(event) => {
                setLength(event.currentTarget.value.length);
                clearField('messageToIntermediary');
              }}
            />
            <p className="text-caption text-text-muted self-end" aria-live="off">
              {tn(frNetwork.common.charactersLeft, { count: max - length })}
            </p>
          </div>
        )}
      </Field>

      <Field
        label={tn(frNetwork.ask.messageToTargetLabel, { target: targetName })}
        hint={frNetwork.ask.messageToTargetHint}
        error={errorFor('messageToTarget')}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="messageToTarget"
            rows={4}
            maxLength={max}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={() => clearField('messageToTarget')}
          />
        )}
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={introductionPathRoute(targetProfileId)}
          className="rounded-base bg-surface text-body text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[48px] items-center justify-center border border-[#CBD5E1] px-7 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frNetwork.common.cancel}
        </Link>
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frNetwork.ask.submitPending}
        >
          {frNetwork.ask.submit}
        </Button>
      </div>
    </form>
  );
}
