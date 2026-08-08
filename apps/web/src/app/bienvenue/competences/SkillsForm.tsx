'use client';

import { useActionState, useState } from 'react';
import { Alert, ErrorState, TokenPicker, type TokenOption } from '@ise/ui-web';
import { ONBOARDING_MAX_SKILLS, onboardingSkillsSchema } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { SelectedSkill } from '@/lib/queries/onboarding';
import type { SkillSearchResult } from '@/lib/queries/reference';
import { StepActions } from '@/components/onboarding/StepActions';
import { saveSkillsAction, searchSkillsAction } from '../actions';

function toInput(formData: FormData) {
  return { skillIds: formData.getAll('skillIds') };
}

export interface SkillsFormProps {
  selected: readonly SelectedSkill[];
  referential: readonly SkillSearchResult[];
  backHref: string;
}

/**
 * ISE-010 — selection des competences.
 *
 * La recherche est faite EN BASE (`public.search_skills`, migration 0035) :
 * 543 competences, alias resolus par la base (D-46), regroupement par
 * domaine. Aucune liste n'est embarquee dans le bundle client.
 */
export function SkillsForm({ selected, referential, backHref }: SkillsFormProps) {
  const [state, formAction, isPending] = useActionState(saveSkillsAction, initialFormState);
  const { clientErrors, onSubmit } = useZodForm(onboardingSkillsSchema, toInput);
  const [count, setCount] = useState(selected.length);

  const fieldError = clientErrors['skillIds'] ?? state.fieldErrors['skillIds'];
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  const defaults: TokenOption[] = selected.map((skill) => ({
    value: String(skill.skillId),
    label: skill.name,
    group: skill.domainName,
  }));

  const options: TokenOption[] = referential.map((skill) => ({
    value: String(skill.skillId),
    label: skill.name,
    group: skill.domainName,
    hint: skill.categoryName,
  }));

  return (
    <form
      id="formulaire-onboarding-competences"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-7"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <TokenPicker
        name="skillIds"
        options={options}
        defaultSelected={defaults}
        max={ONBOARDING_MAX_SKILLS}
        search={searchSkillsAction}
        error={fieldError}
        onSelectionChange={(values) => setCount(values.length)}
        labels={{
          searchLabel: frOnboarding.skills.searchLabel,
          searchPlaceholder: frOnboarding.skills.searchPlaceholder,
          searchHint: frOnboarding.skills.searchHint,
          selectedLabel: frOnboarding.skills.selectedLabel,
          counter: frOnboarding.skills.counter,
          limitReached: frOnboarding.skills.limitReached,
          browseLabel: frOnboarding.skills.browseTitle,
          browseHint: frOnboarding.skills.browseHint,
          resultsLabel: frOnboarding.skills.resultsTitle,
          add: frOnboarding.skills.add,
          remove: frOnboarding.skills.remove,
          emptyTitle: frOnboarding.skills.emptyTitle,
          emptyBody: frOnboarding.skills.emptyBody,
          loading: 'Chargement en cours…',
          noSelection: frOnboarding.skills.required,
        }}
      />

      <p className="sr-only" aria-live="polite">
        {frOnboarding.skills.counter
          .replace('{count}', String(count))
          .replace('{max}', String(ONBOARDING_MAX_SKILLS))}
      </p>

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frOnboarding.shell.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <StepActions
        submitLabel={frOnboarding.skills.submit}
        pendingLabel={frOnboarding.skills.submitPending}
        isPending={isPending}
        backHref={backHref}
      />
    </form>
  );
}
