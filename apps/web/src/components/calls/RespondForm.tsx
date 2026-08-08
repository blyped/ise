'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Radio,
  RadioGroup,
  Textarea,
} from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { callRoute } from '@/lib/routes/calls';
import { initialFormState } from '@/lib/form-state';
import { RESPONSE_TYPES, type ResponseType } from '@/lib/calls-view';
import { respondToCallAction } from '@/app/appels/actions';

/**
 * ISE-051 — répondre à un appel.
 *
 * Le formulaire s'adapte au type de réponse choisi. Le bloc de
 * recommandation n'accepte JAMAIS de coordonnées d'un tiers
 * (CA-CALL-05) : pour une personne hors réseau, seuls un nom et un
 * contexte sont saisissables, et l'écran explique pourquoi.
 *
 * « Partager mes coordonnées » est un geste explicite et décoché par
 * défaut (D6 §51) : rien n'est partagé par omission.
 */
export function RespondForm({
  callId,
  defaultType,
}: {
  callId: string;
  defaultType: ResponseType;
}) {
  const [state, formAction, isPending] = useActionState(respondToCallAction, initialFormState);
  const [responseType, setResponseType] = useState<ResponseType>(defaultType);

  const isRecommendation = responseType === 'knows_someone';
  const isIntroduction = responseType === 'introduction';

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="callId" value={callId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <RadioGroup legend={frCalls.respond.title} hint={frCalls.respond.subtitle}>
        {RESPONSE_TYPES.map((type) => (
          <Radio
            key={type}
            name="responseType"
            value={type}
            checked={responseType === type}
            onChange={() => setResponseType(type)}
            label={frCalls.responseType[type] ?? type}
            description={frCalls.responseTypeHint[type] ?? ''}
          />
        ))}
      </RadioGroup>

      <Field
        label={frCalls.respond.messageLabel}
        hint={frCalls.respond.messageHint}
        error={state.fieldErrors['message']}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="message"
            rows={6}
            maxLength={4000}
            placeholder={frCalls.respond.messagePlaceholder}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      {isRecommendation || isIntroduction ? (
        <fieldset className="rounded-base border-border flex flex-col gap-5 border p-5">
          <legend className="text-body-sm text-text-primary px-2 font-semibold">
            {frCalls.respond.recommendLegend}
          </legend>

          <Alert variant="warning" title={frCalls.respond.consentWarningTitle}>
            {frCalls.respond.consentWarningBody}
          </Alert>

          <Field
            label={frCalls.respond.recommendMemberLabel}
            hint={frCalls.respond.recommendMemberHint}
            error={state.fieldErrors['recommendedProfileId']}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="recommendedProfileId"
                inputMode="text"
                autoComplete="off"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>

          <Field label={frCalls.respond.recommendExternalNameLabel}>
            {({ id }) => <Input id={id} name="externalPersonName" maxLength={160} />}
          </Field>

          <Field label={frCalls.respond.recommendExternalContextLabel}>
            {({ id }) => <Textarea id={id} name="externalPersonContext" rows={3} maxLength={500} />}
          </Field>

          <Field label={frCalls.respond.rationaleLabel}>
            {({ id }) => <Textarea id={id} name="rationale" rows={3} maxLength={2000} />}
          </Field>

          <Checkbox name="offersIntroduction" label={frCalls.respond.offersIntroductionLabel} />
          <Checkbox name="consentConfirmed" label={frCalls.respond.consentLabel} />
        </fieldset>
      ) : null}

      <Checkbox
        name="sharesContact"
        label={frCalls.respond.shareContactLabel}
        description={frCalls.respond.shareContactHint}
      />

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={callRoute(callId)}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frCalls.common.cancel}
        </Link>
        <Button type="submit" loading={isPending} loadingLabel={frCalls.respond.submitPending}>
          {frCalls.respond.submit}
        </Button>
      </div>
    </form>
  );
}
