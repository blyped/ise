'use client';

import { useActionState, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Button, ErrorState, Field, Input, Select, Textarea } from '@ise/ui-web';
import { promotionSuggestionSchema } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { CountryOption } from '@/lib/queries/reference';
import { reportMissingPromotionAction } from '../../actions';

function toInput(formData: FormData) {
  return {
    promotionLabel: formData.get('promotionLabel'),
    institution: formData.get('institution'),
    countryCode: formData.get('countryCode'),
    approximateYear: formData.get('approximateYear'),
    comment: formData.get('comment'),
  };
}

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export function MissingPromotionForm({ countries }: { countries: readonly CountryOption[] }) {
  const [state, formAction, isPending] = useActionState(
    reportMissingPromotionAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(promotionSuggestionSchema, toInput);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;
  const sent = state.status === 'success';

  const countryOptions = countries.map((country) => ({
    value: country.code,
    label: country.name,
  }));

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="success" title={state.message ?? frOnboarding.missingPromotion.sentTitle}>
          {frOnboarding.missingPromotion.sentBody}
        </Alert>
        <p>
          <Link href={onboardingRoute('promotion')} className={LINK_CLASS}>
            ← {frOnboarding.missingPromotion.backLink}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      id="formulaire-signalement-promotion"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={frOnboarding.missingPromotion.labelField}
          error={errorFor('promotionLabel')}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="promotionLabel"
              type="text"
              required
              placeholder={frOnboarding.missingPromotion.labelPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('promotionLabel')}
            />
          )}
        </Field>

        <Field
          label={frOnboarding.missingPromotion.institutionField}
          error={errorFor('institution')}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="institution"
              type="text"
              placeholder={frOnboarding.missingPromotion.institutionPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('institution')}
            />
          )}
        </Field>

        <Field label={frOnboarding.missingPromotion.countryField} error={errorFor('countryCode')}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="countryCode"
              options={countryOptions}
              placeholder={frOnboarding.missingPromotion.countryPlaceholder}
              defaultValue=""
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('countryCode')}
            />
          )}
        </Field>

        <Field label={frOnboarding.missingPromotion.yearField} error={errorFor('approximateYear')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="approximateYear"
              type="number"
              inputMode="numeric"
              min={1940}
              max={2100}
              placeholder={frOnboarding.missingPromotion.yearPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('approximateYear')}
            />
          )}
        </Field>
      </div>

      <Field label={frOnboarding.missingPromotion.commentField} error={errorFor('comment')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="comment"
            rows={4}
            placeholder={frOnboarding.missingPromotion.commentPlaceholder}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('comment')}
          />
        )}
      </Field>

      <Alert variant="success" title={frOnboarding.missingPromotion.qualifyTitle}>
        {frOnboarding.missingPromotion.qualifyBody}
      </Alert>

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="border-border flex flex-wrap items-center gap-5 border-t pt-6">
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frOnboarding.missingPromotion.submitPending}
        >
          {frOnboarding.missingPromotion.submit}
        </Button>
        <Link href={onboardingRoute('promotion')} className={LINK_CLASS}>
          {frOnboarding.missingPromotion.skip}
        </Link>
        <Link href={onboardingRoute('promotion')} className={`${LINK_CLASS} ml-auto`}>
          ← {frOnboarding.missingPromotion.backLink}
        </Link>
      </div>
    </form>
  );
}
