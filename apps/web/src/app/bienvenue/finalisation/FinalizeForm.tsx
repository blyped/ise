'use client';

import { useActionState } from 'react';
import { Alert, Checkbox, ErrorState } from '@ise/ui-web';
import { onboardingFinalizeSchema } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { StepActions } from '@/components/onboarding/StepActions';
import { completeOnboardingAction } from '../actions';

function toInput(formData: FormData) {
  return { confirmed: formData.get('confirmed') };
}

/**
 * ISE-014 — activation du profil.
 *
 * La bascule est faite par `public.complete_onboarding()` : c'est elle,
 * et elle seule, qui pose `onboarding_completed_at`. L'interface ne
 * declare jamais un etat que la base n'a pas constate (D-55).
 */
export function FinalizeForm({
  backHref,
  promotionMissing,
}: {
  backHref: string;
  promotionMissing: boolean;
}) {
  const [state, formAction, isPending] = useActionState(completeOnboardingAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(onboardingFinalizeSchema, toInput);

  const fieldError = clientErrors['confirmed'] ?? state.fieldErrors['confirmed'];
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  return (
    <form
      id="formulaire-onboarding-finalisation"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <div className="rounded-base border border-[#FDE68A] bg-[#FFFBEB] p-5">
        <Checkbox
          name="confirmed"
          value="on"
          label={frOnboarding.finalize.confirm}
          error={fieldError}
          onChange={() => clearField('confirmed')}
        />
      </div>

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      {promotionMissing ? (
        <Alert variant="warning" title={frOnboarding.finalize.promotionRequiredTitle}>
          {frOnboarding.finalize.promotionRequiredBody}
        </Alert>
      ) : null}

      <StepActions
        submitLabel={frOnboarding.finalize.submit}
        pendingLabel={frOnboarding.finalize.submitPending}
        isPending={isPending}
        backHref={backHref}
      />
    </form>
  );
}
