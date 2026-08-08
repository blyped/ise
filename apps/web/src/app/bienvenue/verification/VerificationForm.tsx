'use client';

import { useActionState } from 'react';
import { Alert, Checkbox, ErrorState } from '@ise/ui-web';
import { onboardingVerificationSchema } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { StepActions } from '@/components/onboarding/StepActions';
import { confirmVerificationAction } from '../actions';

function toInput(formData: FormData) {
  return { acknowledged: formData.get('acknowledged') };
}

/** Etape 1 — confirmation explicite, sans code (D-03). */
export function VerificationForm() {
  const [state, formAction, isPending] = useActionState(
    confirmVerificationAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(onboardingVerificationSchema, toInput);

  const fieldError = clientErrors['acknowledged'] ?? state.fieldErrors['acknowledged'];
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const loadFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  return (
    <form
      id="formulaire-onboarding-verification"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Checkbox
        name="acknowledged"
        value="on"
        label={frOnboarding.verification.acknowledge}
        error={fieldError}
        onChange={() => clearField('acknowledged')}
      />

      {loadFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <StepActions
        submitLabel={frOnboarding.verification.submit}
        pendingLabel={frOnboarding.verification.submitPending}
        isPending={isPending}
      />
    </form>
  );
}
