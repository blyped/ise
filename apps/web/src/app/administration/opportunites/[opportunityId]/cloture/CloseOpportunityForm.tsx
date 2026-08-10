'use client';

import { useActionState, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  ErrorState,
  Field,
  OptionCardGroup,
  Select,
  Textarea,
} from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { frAdminOpportunities } from '@/i18n/admin-opportunities';
import { initialFormState } from '@/lib/form-state';
import {
  ATTRIBUTION_LEVELS,
  HIRING_OUTCOME_TYPES,
  OUTCOME_TYPES,
  type CandidateOption,
  type OutcomeType,
} from '@/lib/opportunities-view';
import { closeOpportunityAction } from '../actions';

/**
 * SA-022 — cloture d'une opportunite et resultat, cote admin. Reprend
 * exactement la logique du formulaire auteur ISE-061
 * (`components/opportunities/OpportunityClosureForm.tsx`) : les
 * questions d'impact n'apparaissent que pour les quatre resultats qui
 * comportent un recrutement, la base refusant toute autre combinaison
 * (`opportunity_outcomes_no_false_impact`, migration 0008).
 */
export function CloseOpportunityForm({
  opportunityId,
  candidates,
}: {
  opportunityId: string;
  candidates: readonly CandidateOption[];
}) {
  const [state, formAction, isPending] = useActionState(closeOpportunityAction, initialFormState);
  const [outcome, setOutcome] = useState<OutcomeType | null>(null);
  const hiring = outcome !== null && HIRING_OUTCOME_TYPES.includes(outcome);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="opportunityId" value={opportunityId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <div
        onChange={(event) => {
          const target = event.target as HTMLInputElement;
          if (target.name === 'outcomeType') setOutcome(target.value as OutcomeType);
        }}
      >
        <OptionCardGroup
          type="radio"
          name="outcomeType"
          legend={frOpportunities.closure.questionOutcome}
          columns={2}
          error={state.fieldErrors['outcomeType']}
          items={OUTCOME_TYPES.map((value) => ({
            value,
            label: frOpportunities.outcomeType[value] ?? value,
          }))}
        />
      </div>

      {hiring ? (
        <>
          {candidates.length > 0 ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="text-body-sm text-text-primary font-semibold">
                {frOpportunities.closure.beneficiariesLabel}
              </legend>
              <p className="text-caption text-text-muted">{frOpportunities.closure.beneficiariesHint}</p>
              {candidates.map((candidate) => (
                <Checkbox
                  key={candidate.profileId}
                  name="beneficiaryIds"
                  value={candidate.profileId}
                  label={candidate.profile?.displayName ?? candidate.profileId}
                  description={
                    frOpportunities.applicationStatus[candidate.status] ?? candidate.status
                  }
                />
              ))}
            </fieldset>
          ) : (
            <Alert variant="warning" title={frOpportunities.closure.beneficiariesLabel}>
              {frAdminOpportunities.closure.noCandidates}
            </Alert>
          )}
          <Checkbox name="facilitated" label={frOpportunities.closure.facilitatedLabel} />
          <p className="text-caption text-text-muted -mt-4">
            {frOpportunities.closure.facilitatedHint}
          </p>
          <Field label={frOpportunities.closure.attributionLabel}>
            {({ id }) => (
              <Select
                id={id}
                name="attributionLevel"
                defaultValue="partial"
                options={ATTRIBUTION_LEVELS.filter((value) => value !== 'unknown').map((value) => ({
                  value,
                  label: frOpportunities.attributionLevel[value] ?? value,
                }))}
              />
            )}
          </Field>
        </>
      ) : outcome !== null ? (
        <Alert variant="info" title={frOpportunities.closure.noImpactTitle}>
          {frOpportunities.closure.noImpactBody}
        </Alert>
      ) : null}

      <Field label={frOpportunities.closure.notesLabel} hint={frOpportunities.common.optional}>
        {({ id, describedBy }) => (
          <Textarea id={id} name="notes" rows={4} maxLength={2000} aria-describedby={describedBy} />
        )}
      </Field>

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div>
        <Button type="submit" loading={isPending} loadingLabel={frOpportunities.closure.submitPending}>
          {frOpportunities.closure.submit}
        </Button>
      </div>
    </form>
  );
}
