'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, ErrorState, Field, Select } from '@ise/ui-web';
import { onboardingPromotionSchema } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { ONBOARDING_MISSING_PROMOTION } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { PromotionOption } from '@/lib/queries/reference';
import { StepActions } from '@/components/onboarding/StepActions';
import { savePromotionAction } from '../actions';

function toInput(formData: FormData) {
  return { promotionId: formData.get('promotionId') };
}

const LINK_CLASS =
  'font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface PromotionFormProps {
  promotions: readonly PromotionOption[];
  defaultPromotionId: number | null;
  backHref: string;
}

/** ISE-008 — selection de la promotion parmi le referentiel reel. */
export function PromotionForm({ promotions, defaultPromotionId, backHref }: PromotionFormProps) {
  const [state, formAction, isPending] = useActionState(savePromotionAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(onboardingPromotionSchema, toInput);

  const fieldError = clientErrors['promotionId'] ?? state.fieldErrors['promotionId'];
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const loadFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  const options = promotions.map((promotion) => ({
    value: String(promotion.id),
    label: `${promotion.programCode} ${promotion.graduationYear} — ${promotion.name}`,
  }));

  const current = promotions.find((promotion) => promotion.id === defaultPromotionId);

  return (
    <form
      id="formulaire-onboarding-promotion"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      {current ? (
        <p className="text-body-sm text-text-secondary">
          {frOnboarding.promotion.currentLabel} :{' '}
          <strong className="text-text-primary font-semibold">
            {current.programCode} {current.graduationYear}
          </strong>
        </p>
      ) : null}

      <Field
        label={frOnboarding.promotion.label}
        hint={frOnboarding.promotion.hint}
        error={fieldError}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            name="promotionId"
            options={options}
            placeholder={frOnboarding.promotion.placeholder}
            defaultValue={defaultPromotionId === null ? '' : String(defaultPromotionId)}
            required
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('promotionId')}
          />
        )}
      </Field>

      <p className="text-body-sm text-text-secondary">
        {frOnboarding.promotion.missingLead}{' '}
        <Link href={ONBOARDING_MISSING_PROMOTION} className={LINK_CLASS}>
          {frOnboarding.promotion.missingLink}
        </Link>
      </p>

      <Alert variant="success" title={frOnboarding.promotion.confirmTitle}>
        {frOnboarding.promotion.confirmBody}
      </Alert>

      {loadFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <StepActions
        submitLabel={frOnboarding.promotion.submit}
        pendingLabel={frOnboarding.promotion.submitPending}
        isPending={isPending}
        backHref={backHref}
      />
    </form>
  );
}
