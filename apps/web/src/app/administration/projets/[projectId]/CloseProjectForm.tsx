'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminProjects } from '@/i18n/admin-projects';
import { initialFormState } from '@/lib/form-state';
import { closeProjectAction } from './actions';

const OUTCOME_STATUSES = ['succeeded', 'partially_succeeded', 'cancelled', 'failed'] as const;
const OUTCOME_ACHIEVED = ['yes', 'partially', 'no'] as const;
const OUTCOME_CODES = [
  'contract_won',
  'contract_lost',
  'study_completed',
  'report_delivered',
  'publication_produced',
  'working_paper',
  'dataset_produced',
  'company_created',
  'product_launched',
  'prototype',
  'consortium_formed',
  'interrupted',
  'abandoned',
  'pending',
  'other',
] as const;
const NETWORK_ATTRIBUTIONS = ['mainly', 'partially', 'no'] as const;

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue ' +
  'min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-026 — Cloture d'un projet : issue declaree, livrable, attribution
 * au reseau et donnees financieres confidentielles. Cloture DEFINITIVE
 * (D-55) : aucun etat non constate n'est pose par defaut, chaque champ
 * reste vide tant que l'admin ne le renseigne pas explicitement.
 */
export function CloseProjectForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(closeProjectAction, initialFormState);
  const base = useId();

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-5">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-outcome-status`} className="text-body-sm text-text-primary font-medium">
            {frAdminProjects.closure.outcomeStatus}
          </label>
          <select id={`${base}-outcome-status`} name="outcomeStatus" required defaultValue="" className={`${FIELD} w-[220px]`}>
            <option value="" disabled>
              —
            </option>
            {OUTCOME_STATUSES.map((value) => (
              <option key={value} value={value}>
                {frAdminProjects.closure.outcomeStatusOptions[value]}
              </option>
            ))}
          </select>
          {fieldError('outcomeStatus') !== null ? (
            <p role="alert" className="text-caption text-error">
              {fieldError('outcomeStatus')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-outcome-achieved`} className="text-body-sm text-text-primary font-medium">
            {frAdminProjects.closure.expectedOutcomeAchieved}
          </label>
          <select id={`${base}-outcome-achieved`} name="expectedOutcomeAchieved" required defaultValue="" className={`${FIELD} w-[220px]`}>
            <option value="" disabled>
              —
            </option>
            {OUTCOME_ACHIEVED.map((value) => (
              <option key={value} value={value}>
                {frAdminProjects.closure.expectedOutcomeAchievedOptions[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-outcome-code`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.closure.outcomeCode}
        </label>
        <select id={`${base}-outcome-code`} name="outcomeCode" defaultValue="" className={`${FIELD} w-[260px]`}>
          <option value="">—</option>
          {OUTCOME_CODES.map((value) => (
            <option key={value} value={value}>
              {frAdminProjects.closure.outcomeCodeOptions[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-deliverable-title`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.closure.deliverableTitle}
        </label>
        <input id={`${base}-deliverable-title`} name="deliverableTitle" type="text" className={FIELD} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-deliverable-url`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.closure.deliverableUrl}
        </label>
        <input id={`${base}-deliverable-url`} name="deliverableUrl" type="url" className={FIELD} />
      </div>

      <label className="flex items-center gap-2 text-body-sm text-text-primary">
        <input type="checkbox" name="publicResultSheetAllowed" className="h-5 w-5" />
        {frAdminProjects.closure.publicResultSheetAllowed}
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-testimonial`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.closure.testimonial}
        </label>
        <textarea id={`${base}-testimonial`} name="testimonial" rows={3} className={TEXTAREA} />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-attribution`} className="text-body-sm text-text-primary font-medium">
            {frAdminProjects.closure.networkAttribution}
          </label>
          <select id={`${base}-attribution`} name="networkAttribution" defaultValue="" className={`${FIELD} w-[200px]`}>
            <option value="">—</option>
            {NETWORK_ATTRIBUTIONS.map((value) => (
              <option key={value} value={value}>
                {frAdminProjects.closure.networkAttributionOptions[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-collaborators`} className="text-body-sm text-text-primary font-medium">
            {frAdminProjects.closure.collaboratorsCount}
          </label>
          <input id={`${base}-collaborators`} name="collaboratorsCount" type="number" min={0} className={`${FIELD} w-[140px]`} />
        </div>
      </div>

      <fieldset className="border-border flex flex-col gap-4 rounded-lg border p-4">
        <legend className="text-body-sm text-text-primary px-1 font-semibold">
          {frAdminProjects.closure.financialNotes}
        </legend>

        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-client`} className="text-body-sm text-text-primary font-medium">
              {frAdminProjects.closure.clientName}
            </label>
            <input id={`${base}-client`} name="clientName" type="text" className={FIELD} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-funder`} className="text-body-sm text-text-primary font-medium">
              {frAdminProjects.closure.funderName}
            </label>
            <input id={`${base}-funder`} name="funderName" type="text" className={FIELD} />
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-budget`} className="text-body-sm text-text-primary font-medium">
              {frAdminProjects.closure.budgetEstimate}
            </label>
            <input id={`${base}-budget`} name="budgetEstimate" type="number" step="0.01" min={0} className={`${FIELD} w-[160px]`} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-budget-currency`} className="text-body-sm text-text-primary font-medium">
              {frAdminProjects.closure.budgetCurrency}
            </label>
            <input id={`${base}-budget-currency`} name="budgetCurrency" type="text" maxLength={3} placeholder="EUR" className={`${FIELD} w-[100px] uppercase`} />
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-revenue`} className="text-body-sm text-text-primary font-medium">
              {frAdminProjects.closure.revenueGenerated}
            </label>
            <input id={`${base}-revenue`} name="revenueGenerated" type="number" step="0.01" min={0} className={`${FIELD} w-[160px]`} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-revenue-currency`} className="text-body-sm text-text-primary font-medium">
              {frAdminProjects.closure.revenueCurrency}
            </label>
            <input id={`${base}-revenue-currency`} name="revenueCurrency" type="text" maxLength={3} placeholder="EUR" className={`${FIELD} w-[100px] uppercase`} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <textarea id={`${base}-financial-notes`} name="financialNotes" rows={3} className={TEXTAREA} />
        </div>
      </fieldset>

      <div>
        <Button type="submit" variant="danger" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminProjects.closure.submit}
        </Button>
      </div>

      {state.status !== 'idle' && state.message !== null ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-body-sm ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </p>
      ) : null}
    </form>
  );
}
