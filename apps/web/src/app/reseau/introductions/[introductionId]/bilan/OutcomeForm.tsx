'use client';

import { useActionState, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, Radio, RadioGroup, Textarea } from '@ise/ui-web';
import { INTRODUCTION_OUTCOMES, introductionOutcomeSchema } from '@ise/validation';
import { limits } from '@ise/config';
import { frNetwork } from '@/i18n/network';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { introductionRoute } from '@/lib/routes/network';
import { declareIntroductionOutcomeAction } from './actions';

function toInput(formData: FormData) {
  const note = formData.get('note');
  return {
    introductionId: formData.get('introductionId'),
    outcome: formData.get('outcome'),
    ...(typeof note === 'string' && note.trim().length > 0 ? { note } : {}),
  };
}

/**
 * ISE-046 — declaration du resultat.
 *
 * Les six options sont les six valeurs REELLES de
 * `introduction_requests.outcome`. Aucune n'est intitulee « introduction
 * réussie » : le vocabulaire decrit ce qui s'est passe (un échange, une
 * collaboration envisagée, une orientation, une absence de suite), pas
 * une appreciation.
 */
export function OutcomeForm({ introductionId }: { introductionId: string }) {
  const [state, formAction, isPending] = useActionState(
    declareIntroductionOutcomeAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(introductionOutcomeSchema, toInput);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="introductionId" value={introductionId} />

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={frNetwork.outcome.errorTitle}>
          {state.message}
          {state.correlationId !== null ? (
            <>
              <br />
              {frNetwork.common.correlationLabel} : {state.correlationId}
            </>
          ) : null}
        </Alert>
      ) : null}

      <RadioGroup legend={frNetwork.outcome.legend} error={errorFor('outcome')}>
        {INTRODUCTION_OUTCOMES.map((value, index) => (
          <Radio
            key={value}
            name="outcome"
            value={value}
            label={frNetwork.outcome.labels[value] ?? value}
            description={frNetwork.outcome.hints[value]}
            defaultChecked={index === 0}
            onChange={() => clearField('outcome')}
          />
        ))}
      </RadioGroup>

      <Field
        label={frNetwork.outcome.noteLabel}
        hint={frNetwork.outcome.noteHint}
        error={errorFor('note')}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="note"
            rows={4}
            maxLength={limits.text.introductionMessageMax}
            placeholder={frNetwork.outcome.notePlaceholder}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={() => clearField('note')}
          />
        )}
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={introductionRoute(introductionId)}
          className="rounded-base bg-surface text-body text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[48px] items-center justify-center border border-[#CBD5E1] px-7 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frNetwork.common.cancel}
        </Link>
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frNetwork.outcome.submitPending}
        >
          {frNetwork.outcome.submit}
        </Button>
      </div>
    </form>
  );
}
