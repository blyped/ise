'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Checkbox,
  ErrorState,
  Field,
  OptionCardGroup,
  Radio,
  RadioGroup,
  Textarea,
} from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { callTrackingRoute } from '@/lib/routes/calls';
import { initialFormState } from '@/lib/form-state';
import {
  CLOSURE_MISSING_REASONS,
  CLOSURE_RESULT_TYPES,
  RESOLUTIONS,
  type Resolution,
  type Respondent,
} from '@/lib/calls-view';
import { closeCallAction } from '@/app/appels/actions';

const RESULT_LABELS: Record<string, string> = {
  expert_found: 'Expert trouvé',
  consultant_found: 'Consultant trouvé',
  internship_found: 'Stage trouvé',
  job_found: 'Emploi trouvé',
  introduction_made: 'Introduction réalisée',
  advice_received: 'Conseil reçu',
  partner_found: 'Partenaire trouvé',
  collaborator_found: 'Collaborateur trouvé',
  team_formed: 'Équipe constituée',
  information_obtained: 'Information obtenue',
  funding_identified: 'Financement identifié',
  other: 'Autre résultat',
};

const MISSING_LABELS: Record<string, string> = {
  no_response: 'Pas de réponse',
  irrelevant_profiles: 'Profils non adaptés',
  deadline_too_short: 'Délai trop court',
  need_changed: 'Le besoin a changé',
  other: 'Autre',
};

/**
 * ISE-054 — clôture d'un appel, résultat TERNAIRE (D-52).
 *
 * Les questions suivantes s'affichent selon la réponse :
 *   résolu / partiellement → « quel résultat ? »
 *   partiellement / non    → « qu'est-ce qui a manqué ? »
 * Ce n'est pas cosmétique : la base REFUSE un `closure_result_type` sur
 * une clôture non résolue et un `closure_missing_reason` sur une clôture
 * pleinement résolue. L'écran n'envoie donc jamais un champ que la base
 * rejetterait — et surtout, il ne permet pas d'enregistrer un impact
 * positif sur un besoin non couvert.
 *
 * Le consentement au témoignage est SÉPARÉ (D6 §74) : sans lui, le
 * témoignage reste interne.
 */
export function ClosureForm({
  callId,
  respondents,
}: {
  callId: string;
  respondents: readonly Respondent[];
}) {
  const [state, formAction, isPending] = useActionState(closeCallAction, initialFormState);
  const [resolution, setResolution] = useState<Resolution | null>(null);

  const showResult = resolution === 'resolved' || resolution === 'partially_resolved';
  const showMissing = resolution === 'partially_resolved' || resolution === 'not_resolved';

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="callId" value={callId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <RadioGroup
        legend={frCalls.closure.questionResolution}
        hint={frCalls.closure.resolutionHint}
        error={state.fieldErrors['resolution']}
      >
        {RESOLUTIONS.map((value) => (
          <Radio
            key={value}
            name="resolution"
            value={value}
            checked={resolution === value}
            onChange={() => setResolution(value)}
            label={frCalls.closure[value]}
            description={
              value === 'resolved'
                ? frCalls.closure.resolvedHint
                : value === 'partially_resolved'
                  ? frCalls.closure.partiallyHint
                  : frCalls.closure.notResolvedHint
            }
          />
        ))}
      </RadioGroup>

      {showResult ? (
        <OptionCardGroup
          type="radio"
          name="resultType"
          legend={frCalls.closure.questionResult}
          columns={2}
          items={CLOSURE_RESULT_TYPES.map((value) => ({
            value,
            label: RESULT_LABELS[value] ?? value,
          }))}
        />
      ) : null}

      {showMissing ? (
        <OptionCardGroup
          type="radio"
          name="missingReason"
          legend={frCalls.closure.questionMissing}
          columns={2}
          items={CLOSURE_MISSING_REASONS.map((value) => ({
            value,
            label: MISSING_LABELS[value] ?? value,
          }))}
        />
      ) : null}

      {respondents.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-body-sm text-text-primary font-semibold">
            {frCalls.closure.questionContributors}
          </legend>
          <p className="text-caption text-text-muted">{frCalls.closure.contributorsHint}</p>
          {respondents.map((respondent) => (
            <Checkbox
              key={respondent.profileId}
              name="contributorIds"
              value={respondent.profileId}
              label={respondent.profile?.displayName ?? respondent.profileId}
              description={frCalls.responseType[respondent.responseType] ?? ''}
            />
          ))}
        </fieldset>
      ) : null}

      <Field label={frCalls.closure.notesLabel} hint={frCalls.common.optional}>
        {({ id, describedBy }) => (
          <Textarea id={id} name="notes" rows={4} maxLength={2000} aria-describedby={describedBy} />
        )}
      </Field>

      <Field label={frCalls.closure.testimonialLabel} hint={frCalls.closure.testimonialHint}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            name="testimonial"
            rows={3}
            maxLength={1000}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Checkbox
        name="testimonialConsent"
        label={frCalls.closure.consentLabel}
        description={frCalls.closure.consentHint}
      />

      {resolution === 'not_resolved' ? (
        <Alert variant="info" title={frCalls.closure.noImpactTitle}>
          {frCalls.closure.noImpactBody}
        </Alert>
      ) : null}

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={callTrackingRoute(callId)}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frCalls.common.cancel}
        </Link>
        <Button type="submit" loading={isPending} loadingLabel={frCalls.closure.submitPending}>
          {frCalls.closure.submit}
        </Button>
      </div>
    </form>
  );
}
