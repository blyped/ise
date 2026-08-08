'use client';

import { useActionState } from 'react';
import { Alert, ErrorState, TokenPicker, type TokenOption } from '@ise/ui-web';
import { ONBOARDING_MAX_SECTORS, onboardingSectorsSchema } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { SectorOption } from '@/lib/queries/reference';
import { StepActions } from '@/components/onboarding/StepActions';
import { saveSectorsAction } from '../actions';

function toInput(formData: FormData) {
  return { sectorIds: formData.getAll('sectorIds') };
}

export interface SectorsFormProps {
  sectors: readonly SectorOption[];
  selectedIds: readonly number[];
  backHref: string;
}

/** ISE-011 — les 35 secteurs viennent de `public.sectors`. */
export function SectorsForm({ sectors, selectedIds, backHref }: SectorsFormProps) {
  const [state, formAction, isPending] = useActionState(saveSectorsAction, initialFormState);
  const { clientErrors, onSubmit } = useZodForm(onboardingSectorsSchema, toInput);

  const fieldError = clientErrors['sectorIds'] ?? state.fieldErrors['sectorIds'];
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  const options: TokenOption[] = sectors.map((sector) => ({
    value: String(sector.id),
    label: sector.name,
  }));

  const defaults = options.filter((option) => selectedIds.includes(Number(option.value)));

  return (
    <form
      id="formulaire-onboarding-secteurs"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-7"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <TokenPicker
        name="sectorIds"
        options={options}
        defaultSelected={defaults}
        max={ONBOARDING_MAX_SECTORS}
        browseLimit={sectors.length}
        error={fieldError}
        labels={{
          searchLabel: frOnboarding.sectors.searchLabel,
          searchPlaceholder: frOnboarding.sectors.searchPlaceholder,
          selectedLabel: frOnboarding.sectors.selectedLabel,
          counter: frOnboarding.sectors.counter,
          limitReached: frOnboarding.skills.limitReached,
          browseLabel: frOnboarding.sectors.listTitle,
          browseHint: frOnboarding.sectors.listHint,
          resultsLabel: frOnboarding.sectors.listTitle,
          add: frOnboarding.skills.add,
          remove: frOnboarding.skills.remove,
          emptyTitle: frOnboarding.sectors.emptyTitle,
          emptyBody: frOnboarding.sectors.emptyBody,
          loading: 'Chargement en cours…',
          noSelection: '—',
        }}
      />

      <Alert variant="success" title={frOnboarding.sectors.noAutoTitle}>
        {frOnboarding.sectors.noAutoBody}
      </Alert>

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <StepActions
        submitLabel={frOnboarding.sectors.submit}
        pendingLabel={frOnboarding.sectors.submitPending}
        isPending={isPending}
        backHref={backHref}
        skippable
      />
    </form>
  );
}
