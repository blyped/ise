'use client';

import { useActionState, useCallback } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  ErrorState,
  Field,
  Input,
  OptionCardGroup,
  Select,
  Textarea,
  VisibilitySelect,
  type VisibilityLevelValue,
} from '@ise/ui-web';
import { educationSchema } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { CountryOption, VisibilityFieldRule } from '@/lib/queries/reference';
import type { EducationRow } from '@/lib/queries/profile-sections';
import { toEducationInput } from '../form-input';
import { saveEducationAction } from '../actions';

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface EducationFormProps {
  education: EducationRow | null;
  countries: readonly CountryOption[];
  visibilityRule: VisibilityFieldRule;
}

/** ISE-021 — ajout et modification partagent le meme formulaire. */
export function EducationForm({ education, countries, visibilityRule }: EducationFormProps) {
  const [state, formAction, isPending] = useActionState(saveEducationAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(educationSchema, toEducationInput);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  return (
    <form
      id="formulaire-profil-formation"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {education ? <input type="hidden" name="educationId" value={education.id} /> : null}

      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <OptionCardGroup
        type="radio"
        name="educationType"
        legend={frProfile.educationForm.typeLegend}
        items={[
          { value: 'academic', label: frProfile.educations.typeAcademic },
          { value: 'certification', label: frProfile.educations.typeCertification },
        ]}
        defaultValues={[education?.educationType ?? 'academic']}
        error={errorFor('educationType')}
      />

      <Field label={frProfile.educationForm.degreeLabel} error={errorFor('degree')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="degree"
            type="text"
            required
            defaultValue={education?.degree ?? ''}
            placeholder={frProfile.educationForm.degreePlaceholder}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('degree')}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={frProfile.educationForm.institutionLabel}
          error={errorFor('institution')}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="institution"
              type="text"
              required
              defaultValue={education?.institution ?? ''}
              placeholder={frProfile.educationForm.institutionPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('institution')}
            />
          )}
        </Field>

        <Field label={frProfile.educationForm.fieldLabel} error={errorFor('fieldOfStudy')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="fieldOfStudy"
              type="text"
              defaultValue={education?.fieldOfStudy ?? ''}
              placeholder={frProfile.educationForm.fieldPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('fieldOfStudy')}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-4">
        <Field label={frProfile.educationForm.startYearLabel} error={errorFor('startYear')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="startYear"
              type="number"
              inputMode="numeric"
              min={1940}
              max={2100}
              defaultValue={education?.startYear ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('startYear')}
            />
          )}
        </Field>

        <Field label={frProfile.educationForm.endYearLabel} error={errorFor('endYear')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="endYear"
              type="number"
              inputMode="numeric"
              min={1940}
              max={2100}
              defaultValue={education?.endYear ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('endYear')}
            />
          )}
        </Field>

        <Field label={frProfile.educationForm.countryLabel} error={errorFor('countryCode')}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="countryCode"
              options={countries.map((country) => ({
                value: country.code,
                label: country.name,
              }))}
              placeholder={frProfile.header.countryPlaceholder}
              defaultValue={education?.countryCode ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('countryCode')}
            />
          )}
        </Field>

        <Field label={frProfile.educationForm.cityLabel} error={errorFor('city')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="city"
              type="text"
              defaultValue={education?.city ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('city')}
            />
          )}
        </Field>
      </div>

      <Field label={frProfile.educationForm.credentialLabel} error={errorFor('credentialUrl')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="credentialUrl"
            type="url"
            inputMode="url"
            defaultValue={education?.credentialUrl ?? ''}
            placeholder={frProfile.educationForm.credentialPlaceholder}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('credentialUrl')}
          />
        )}
      </Field>

      <Field label={frProfile.educationForm.descriptionLabel} error={errorFor('description')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="description"
            rows={5}
            maxLength={400}
            defaultValue={education?.description ?? ''}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('description')}
          />
        )}
      </Field>

      <Alert variant="success" title={frProfile.educationForm.verificationTitle}>
        {frProfile.educationForm.verificationBody}
      </Alert>

      <VisibilitySelect
        name="visibility"
        label={frProfile.common.visibilityLabel}
        hint={frProfile.common.visibilityHint}
        labels={frProfile.visibility}
        allowedLevels={visibilityRule.allowedLevels}
        defaultValue={
          (education?.visibility ?? visibilityRule.defaultVisibility) as VisibilityLevelValue
        }
        error={errorFor('visibility')}
      />

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="border-border flex flex-wrap items-center gap-5 border-t pt-6">
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frProfile.common.savePending}
        >
          {frProfile.common.save}
        </Button>
        <Link href={PROFILE_ROUTES.educations} className={LINK_CLASS}>
          {frProfile.common.cancel}
        </Link>
      </div>
    </form>
  );
}
