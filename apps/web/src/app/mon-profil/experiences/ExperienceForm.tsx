'use client';

import { useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Select,
  Textarea,
  VisibilitySelect,
  type VisibilityLevelValue,
} from '@ise/ui-web';
import { experienceSchema } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type {
  CountryOption,
  JobFunctionOption,
  SectorOption,
  VisibilityFieldRule,
} from '@/lib/queries/reference';
import type { ExperienceRow } from '@/lib/queries/profile-sections';
import { toExperienceInput } from '../form-input';
import { saveExperienceAction } from '../actions';

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface ExperienceFormProps {
  experience: ExperienceRow | null;
  sectors: readonly SectorOption[];
  jobFunctions: readonly JobFunctionOption[];
  countries: readonly CountryOption[];
  visibilityRule: VisibilityFieldRule;
}

/** ISE-019 — ajout et modification partagent le meme formulaire. */
export function ExperienceForm({
  experience,
  sectors,
  jobFunctions,
  countries,
  visibilityRule,
}: ExperienceFormProps) {
  const [state, formAction, isPending] = useActionState(saveExperienceAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(experienceSchema, toExperienceInput);
  const [isCurrent, setIsCurrent] = useState(experience?.isCurrent ?? false);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  return (
    <form
      id="formulaire-profil-experience"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {experience ? <input type="hidden" name="experienceId" value={experience.id} /> : null}

      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={frProfile.experienceForm.organizationLabel}
          error={errorFor('organizationNameRaw')}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="organizationNameRaw"
              type="text"
              required
              defaultValue={experience?.organizationName ?? ''}
              placeholder={frProfile.experienceForm.organizationPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('organizationNameRaw')}
            />
          )}
        </Field>

        <Field
          label={frProfile.experienceForm.positionLabel}
          error={errorFor('positionTitle')}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="positionTitle"
              type="text"
              required
              defaultValue={experience?.positionTitle ?? ''}
              placeholder={frProfile.experienceForm.positionPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('positionTitle')}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={frProfile.experienceForm.startLabel} error={errorFor('startDate')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="startDate"
              type="date"
              required
              defaultValue={experience?.startDate ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('startDate')}
            />
          )}
        </Field>

        <Field label={frProfile.experienceForm.endLabel} error={errorFor('endDate')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="endDate"
              type="date"
              disabled={isCurrent}
              defaultValue={experience?.endDate ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('endDate')}
            />
          )}
        </Field>
      </div>

      <Checkbox
        name="isCurrent"
        value="on"
        label={frProfile.experienceForm.currentLabel}
        defaultChecked={experience?.isCurrent ?? false}
        onChange={(event) => {
          setIsCurrent(event.currentTarget.checked);
          clearField('endDate');
        }}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={frProfile.experienceForm.countryLabel} error={errorFor('countryCode')}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="countryCode"
              options={countries.map((country) => ({
                value: country.code,
                label: country.name,
              }))}
              placeholder={frProfile.header.countryPlaceholder}
              defaultValue={experience?.countryCode ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('countryCode')}
            />
          )}
        </Field>

        <Field label={frProfile.experienceForm.cityLabel} error={errorFor('city')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="city"
              type="text"
              defaultValue={experience?.city ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('city')}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={frProfile.experienceForm.sectorLabel} error={errorFor('sectorId')}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="sectorId"
              options={sectors.map((sector) => ({
                value: String(sector.id),
                label: sector.name,
              }))}
              placeholder={frProfile.experienceForm.sectorPlaceholder}
              defaultValue={experience?.sectorId === null ? '' : String(experience?.sectorId ?? '')}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('sectorId')}
            />
          )}
        </Field>

        <Field label={frProfile.experienceForm.functionLabel} error={errorFor('jobFunctionId')}>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="jobFunctionId"
              options={jobFunctions.map((jobFunction) => ({
                value: String(jobFunction.id),
                label: jobFunction.name,
              }))}
              placeholder={frProfile.experienceForm.functionPlaceholder}
              defaultValue={
                experience?.jobFunctionId === null ? '' : String(experience?.jobFunctionId ?? '')
              }
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('jobFunctionId')}
            />
          )}
        </Field>
      </div>

      <Field label={frProfile.experienceForm.descriptionLabel} error={errorFor('description')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="description"
            rows={6}
            maxLength={4000}
            defaultValue={experience?.description ?? ''}
            placeholder={frProfile.experienceForm.descriptionPlaceholder}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('description')}
          />
        )}
      </Field>

      <VisibilitySelect
        name="visibility"
        label={frProfile.common.visibilityLabel}
        hint={frProfile.common.visibilityHint}
        labels={frProfile.visibility}
        allowedLevels={visibilityRule.allowedLevels}
        defaultValue={
          (experience?.visibility ?? visibilityRule.defaultVisibility) as VisibilityLevelValue
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
        <Link href={PROFILE_ROUTES.experiences} className={LINK_CLASS}>
          {frProfile.common.cancel}
        </Link>
      </div>
    </form>
  );
}
