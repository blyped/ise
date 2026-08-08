'use client';

import { useActionState, useCallback } from 'react';
import {
  Alert,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Select,
  TokenPicker,
  VisibilitySelect,
  type TokenOption,
  type VisibilityLevelValue,
} from '@ise/ui-web';
import { onboardingLocationSchema } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { CountryOption } from '@/lib/queries/reference';
import { StepActions } from '@/components/onboarding/StepActions';
import { saveLocationAction } from '../actions';

function toInput(formData: FormData) {
  return {
    currentCountryCode: formData.get('currentCountryCode'),
    currentCity: formData.get('currentCity'),
    experienceCountryCodes: formData.getAll('experienceCountryCodes'),
    cityVisibility: formData.get('cityVisibility'),
  };
}

export interface LocationFormProps {
  countries: readonly CountryOption[];
  selectedZones: readonly string[];
  currentCountryCode: string | null;
  currentCity: string | null;
  cityVisibility: VisibilityLevelValue;
  allowedLevels: readonly VisibilityLevelValue[];
  backHref: string;
}

export function LocationForm({
  countries,
  selectedZones,
  currentCountryCode,
  currentCity,
  cityVisibility,
  allowedLevels,
  backHref,
}: LocationFormProps) {
  const [state, formAction, isPending] = useActionState(saveLocationAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(onboardingLocationSchema, toInput);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  const countryOptions = countries.map((country) => ({
    value: country.code,
    label: country.name,
  }));

  const zoneOptions: TokenOption[] = countries.map((country) => ({
    value: country.code,
    label: country.name,
  }));

  const zoneDefaults = zoneOptions.filter((option) => selectedZones.includes(option.value));

  return (
    <form
      id="formulaire-onboarding-localisation"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-7"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frOnboarding.location.currentTitle}</CardTitle>
          <CardDescription>{frOnboarding.location.currentHint}</CardDescription>
        </CardHeader>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={frOnboarding.location.countryLabel} error={errorFor('currentCountryCode')}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="currentCountryCode"
                options={countryOptions}
                placeholder={frOnboarding.location.countryPlaceholder}
                defaultValue={currentCountryCode ?? ''}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={() => clearField('currentCountryCode')}
              />
            )}
          </Field>

          <Field label={frOnboarding.location.cityLabel} error={errorFor('currentCity')}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="currentCity"
                type="text"
                autoComplete="address-level2"
                defaultValue={currentCity ?? ''}
                placeholder={frOnboarding.location.cityPlaceholder}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={() => clearField('currentCity')}
              />
            )}
          </Field>
        </div>
      </Card>

      <section aria-labelledby="zones-experience" className="flex flex-col gap-4">
        <h2 id="zones-experience" className="text-h4 text-text-primary font-semibold">
          {frOnboarding.location.zonesTitle}
        </h2>
        <p className="text-body-sm text-text-secondary">{frOnboarding.location.zonesHint}</p>

        <TokenPicker
          name="experienceCountryCodes"
          options={zoneOptions}
          defaultSelected={zoneDefaults}
          browseLimit={40}
          error={errorFor('experienceCountryCodes')}
          labels={{
            searchLabel: frOnboarding.location.zonesSearchLabel,
            searchPlaceholder: frOnboarding.location.zonesSearchPlaceholder,
            selectedLabel: frOnboarding.location.zonesSelected,
            counter: '{count}',
            limitReached: frOnboarding.skills.limitReached,
            browseLabel: frOnboarding.location.zonesSearchLabel,
            resultsLabel: frOnboarding.location.zonesSearchLabel,
            add: frOnboarding.skills.add,
            remove: frOnboarding.skills.remove,
            emptyTitle: frOnboarding.sectors.emptyTitle,
            emptyBody: frOnboarding.sectors.emptyBody,
            loading: 'Chargement en cours…',
            noSelection: frOnboarding.location.zonesEmpty,
          }}
        />
      </section>

      <Alert variant="success" title={frOnboarding.location.privacyTitle}>
        {frOnboarding.location.privacyBody}
      </Alert>

      <VisibilitySelect
        name="cityVisibility"
        label={frOnboarding.location.cityVisibilityLabel}
        hint={frOnboarding.location.cityVisibilityHint}
        labels={frOnboarding.visibility}
        allowedLevels={allowedLevels}
        defaultValue={cityVisibility}
        error={errorFor('cityVisibility')}
        onChange={() => clearField('cityVisibility')}
      />

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <StepActions
        submitLabel={frOnboarding.location.submit}
        pendingLabel={frOnboarding.location.submitPending}
        isPending={isPending}
        backHref={backHref}
        skippable
      />
    </form>
  );
}
