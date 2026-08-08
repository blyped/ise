'use client';

import { useActionState } from 'react';
import {
  Alert,
  ErrorState,
  OptionCardGroup,
  VisibilitySelect,
  type OptionCardItem,
  type VisibilityLevelValue,
} from '@ise/ui-web';
import {
  AVAILABILITY_INTENSITY_MAX_PER_MONTH,
  onboardingAvailabilitySchema,
  type AvailabilityIntensity,
} from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { AvailabilityTypeOption } from '@/lib/queries/reference';
import type { DeclaredAvailability } from '@/lib/queries/onboarding';
import { StepActions } from '@/components/onboarding/StepActions';
import { saveAvailabilityAction } from '../actions';

function toInput(formData: FormData) {
  return {
    availabilityTypes: formData.getAll('availabilityTypes'),
    intensity: formData.get('intensity'),
    visibility: formData.get('visibility'),
  };
}

export interface AvailabilityFormProps {
  types: readonly AvailabilityTypeOption[];
  declared: readonly DeclaredAvailability[];
  allowedLevels: readonly VisibilityLevelValue[];
  defaultVisibility: VisibilityLevelValue;
  backHref: string;
}

const INTENSITY_ITEMS: readonly OptionCardItem[] = [
  {
    value: 'low',
    label: frOnboarding.availability.intensity.low,
    description: frOnboarding.availability.intensity.lowHint,
    footnote: `Jusqu’à ${AVAILABILITY_INTENSITY_MAX_PER_MONTH.low} sollicitation par mois`,
  },
  {
    value: 'moderate',
    label: frOnboarding.availability.intensity.moderate,
    description: frOnboarding.availability.intensity.moderateHint,
    footnote: `Jusqu’à ${AVAILABILITY_INTENSITY_MAX_PER_MONTH.moderate} sollicitations par mois`,
  },
  {
    value: 'high',
    label: frOnboarding.availability.intensity.high,
    description: frOnboarding.availability.intensity.highHint,
    footnote: `Jusqu’à ${AVAILABILITY_INTENSITY_MAX_PER_MONTH.high} sollicitations par mois`,
  },
];

/** Deduit le niveau a partir du plafond deja enregistre, sans le deviner. */
function intensityOf(declared: readonly DeclaredAvailability[]): AvailabilityIntensity {
  const max = declared.reduce((best, entry) => Math.max(best, entry.maxPerMonth ?? 0), 0);
  if (max >= AVAILABILITY_INTENSITY_MAX_PER_MONTH.high) return 'high';
  if (max >= AVAILABILITY_INTENSITY_MAX_PER_MONTH.moderate) return 'moderate';
  return 'low';
}

export function AvailabilityForm({
  types,
  declared,
  allowedLevels,
  defaultVisibility,
  backHref,
}: AvailabilityFormProps) {
  const [state, formAction, isPending] = useActionState(saveAvailabilityAction, initialFormState);
  const { clientErrors, onSubmit } = useZodForm(onboardingAvailabilitySchema, toInput);

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  const items: OptionCardItem[] = types.map((type) => ({
    value: type.code,
    label: type.name,
    ...(type.description ? { description: type.description } : {}),
  }));

  const activeCodes = declared
    .filter((entry) => entry.active)
    .map((entry) => entry.availabilityType);

  return (
    <form
      id="formulaire-onboarding-disponibilite"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-7"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <OptionCardGroup
        type="checkbox"
        name="availabilityTypes"
        legend={frOnboarding.availability.typesLabel}
        items={items}
        defaultValues={activeCodes}
        error={clientErrors['availabilityTypes'] ?? state.fieldErrors['availabilityTypes']}
      />

      <OptionCardGroup
        type="radio"
        name="intensity"
        columns={3}
        legend={frOnboarding.availability.intensityLabel}
        items={INTENSITY_ITEMS}
        defaultValues={[intensityOf(declared)]}
        error={clientErrors['intensity'] ?? state.fieldErrors['intensity']}
      />

      <VisibilitySelect
        name="visibility"
        label={frOnboarding.availability.visibilityLabel}
        labels={frOnboarding.visibility}
        allowedLevels={allowedLevels}
        defaultValue={defaultVisibility}
        error={clientErrors['visibility'] ?? state.fieldErrors['visibility']}
      />

      <Alert variant="success" title={frOnboarding.availability.noObligationTitle}>
        {frOnboarding.availability.noObligationBody}
      </Alert>

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <StepActions
        submitLabel={frOnboarding.availability.submit}
        pendingLabel={frOnboarding.availability.submitPending}
        isPending={isPending}
        backHref={backHref}
        skippable
      />
    </form>
  );
}
