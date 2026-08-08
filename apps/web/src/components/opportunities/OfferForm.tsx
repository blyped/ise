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
  OptionCardGroup,
  Radio,
  RadioGroup,
  Select,
  Textarea,
} from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { initialFormState } from '@/lib/form-state';
import {
  APPLICATION_MODES,
  MVP_OPPORTUNITY_TYPES,
  type ApplicationMode,
  type OpportunityDetail,
} from '@/lib/opportunities-view';
import type { CountryOption } from '@/lib/queries/reference';
import { saveOfferAction } from '@/app/opportunites/actions';

const CONTRACT_TYPES = [
  'permanent',
  'fixed_term',
  'local_contract',
  'international_contract',
  'public_service',
  'graduate_program',
  'consultancy',
  'short_term_expert',
  'long_term_expert',
  'team_leader',
  'key_expert',
  'technical_assistance',
  'academic_internship',
  'professional_internship',
  'final_year_internship',
  'research_internship',
  'pre_employment_internship',
  'other',
] as const;

/**
 * ISE-057 — étape 1 : l'offre.
 *
 * Le mode de candidature commande la suite du parcours (D-55) : seul
 * `internal` permettra à la plateforme de constater un résultat. L'écran
 * l'annonce AVANT le choix, pas après, pour que l'annonceur sache ce
 * qu'il perd en renvoyant les candidats ailleurs.
 */
export function OfferForm({
  opportunity,
  countries,
}: {
  opportunity: OpportunityDetail | null;
  countries: readonly CountryOption[];
}) {
  const [state, formAction, isPending] = useActionState(saveOfferAction, initialFormState);
  const [mode, setMode] = useState<ApplicationMode>(opportunity?.applicationMode ?? 'internal');

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      {opportunity !== null ? (
        <input type="hidden" name="opportunityId" value={opportunity.opportunityId} />
      ) : null}

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <OptionCardGroup
        type="radio"
        name="opportunityType"
        legend={frOpportunities.wizard.typeLegend}
        hint={frOpportunities.wizard.typeHint}
        columns={3}
        defaultValues={[opportunity?.opportunityType ?? 'job']}
        items={MVP_OPPORTUNITY_TYPES.map((type) => ({
          value: type,
          label: frOpportunities.type[type] ?? type,
        }))}
      />

      <Field label={frOpportunities.wizard.titleLabel} required error={state.fieldErrors['title']}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="title"
            maxLength={160}
            defaultValue={opportunity?.title ?? ''}
            placeholder={frOpportunities.wizard.titlePlaceholder}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      <Field
        label={frOpportunities.wizard.organizationLabel}
        hint={frOpportunities.wizard.organizationHint}
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            name="organizationName"
            defaultValue={opportunity?.organization ?? ''}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Field
        label={frOpportunities.wizard.descriptionLabel}
        hint={frOpportunities.wizard.descriptionHint}
        required
        error={state.fieldErrors['description']}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="description"
            rows={10}
            maxLength={20000}
            defaultValue={opportunity?.description ?? ''}
            placeholder={frOpportunities.wizard.descriptionPlaceholder}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      <Field label={frOpportunities.wizard.summaryLabel} hint={frOpportunities.wizard.summaryHint}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            name="summary"
            rows={3}
            maxLength={400}
            defaultValue={opportunity?.summary ?? ''}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={frOpportunities.wizard.contractLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="contractType"
              defaultValue={opportunity?.contractType ?? ''}
              placeholder={frOpportunities.common.optional}
              options={CONTRACT_TYPES.map((value) => ({
                value,
                label: frOpportunities.contractType[value] ?? value,
              }))}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.countryLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="countryCode"
              defaultValue=""
              placeholder={frOpportunities.common.optional}
              options={countries.map((country) => ({ value: country.code, label: country.name }))}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.cityLabel}>
          {({ id }) => <Input id={id} name="city" defaultValue={opportunity?.city ?? ''} />}
        </Field>

        <Field label={frOpportunities.wizard.remoteLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="remoteMode"
              defaultValue={opportunity?.remoteMode ?? ''}
              placeholder={frOpportunities.common.optional}
              options={(['onsite', 'hybrid', 'remote'] as const).map((value) => ({
                value,
                label: frOpportunities.remoteMode[value] ?? value,
              }))}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.startLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="startDate"
              type="date"
              defaultValue={opportunity?.startDate ?? ''}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.durationLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="durationDays"
              type="number"
              min={1}
              defaultValue={opportunity?.durationDays ?? ''}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.deadlineLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="deadline"
              type="date"
              defaultValue={opportunity?.deadline?.slice(0, 10) ?? ''}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.positionsLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="positionsCount"
              type="number"
              min={1}
              defaultValue={opportunity?.positionsCount ?? 1}
            />
          )}
        </Field>
      </div>

      <fieldset className="rounded-base border-border flex flex-col gap-4 border p-5">
        <legend className="text-body-sm text-text-primary px-2 font-semibold">
          {frOpportunities.wizard.compensationTitle}
        </legend>
        <p className="text-caption text-text-muted">{frOpportunities.wizard.compensationHint}</p>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label={frOpportunities.wizard.compensationMinLabel}>
            {({ id }) => <Input id={id} name="compensationMin" type="number" min={0} />}
          </Field>
          <Field label={frOpportunities.wizard.compensationMaxLabel}>
            {({ id }) => <Input id={id} name="compensationMax" type="number" min={0} />}
          </Field>
          <Field label={frOpportunities.wizard.currencyLabel}>
            {({ id }) => <Input id={id} name="currency" maxLength={3} />}
          </Field>
        </div>
        <Checkbox
          name="compensationDisclosed"
          label={frOpportunities.wizard.compensationDisclosedLabel}
        />
      </fieldset>

      <RadioGroup
        legend={frOpportunities.wizard.applicationModeLegend}
        hint={frOpportunities.wizard.applicationModeHint}
      >
        {APPLICATION_MODES.map((value) => (
          <Radio
            key={value}
            name="applicationMode"
            value={value}
            checked={mode === value}
            onChange={() => setMode(value)}
            label={frOpportunities.applicationMode[value] ?? value}
            description={frOpportunities.applicationModeHint[value] ?? ''}
          />
        ))}
      </RadioGroup>

      {mode === 'external_url' ? (
        <Field
          label={frOpportunities.wizard.externalUrlLabel}
          required
          error={state.fieldErrors['externalApplicationUrl']}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="externalApplicationUrl"
              type="url"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      ) : null}

      {mode === 'external_email' ? (
        <Field
          label={frOpportunities.wizard.externalEmailLabel}
          required
          error={state.fieldErrors['externalApplicationEmail']}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="externalApplicationEmail"
              type="email"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      ) : null}

      {mode === 'contact_recruiter' ? (
        <Field
          label={frOpportunities.wizard.contactLabel}
          required
          error={state.fieldErrors['contactProfileId']}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="contactProfileId"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      ) : null}

      <Checkbox
        name="newGraduates"
        label={frOpportunities.wizard.newGraduatesLabel}
        description={frOpportunities.wizard.newGraduatesHint}
        defaultChecked={opportunity?.suitableForNewGraduates ?? false}
      />

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={OPPORTUNITY_ROUTES.list}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frOpportunities.common.cancel}
        </Link>
        <Button type="submit" loading={isPending} loadingLabel={frOpportunities.common.savePending}>
          {frOpportunities.common.save}
        </Button>
      </div>
    </form>
  );
}
