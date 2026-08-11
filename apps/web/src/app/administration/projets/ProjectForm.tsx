'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminProjects } from '@/i18n/admin-projects';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../_components/ActionButton';

const PROJECT_TYPES = [
  'mission',
  'tender',
  'consortium',
  'study',
  'research',
  'entrepreneurial',
  'product',
  'publication',
  'working_group',
  'community_initiative',
  'other',
] as const;

const COMPENSATION_TYPES = [
  'to_be_defined',
  'paid',
  'conditional_on_award',
  'volunteer',
  'equity',
  'mixed',
] as const;

const VISIBILITIES = ['network', 'community', 'promotion', 'invitation_only', 'team_only'] as const;

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue ' +
  'min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-023 — Creation administrative d'un projet, pour le compte d'un
 * profil reference. Toujours cree en brouillon (`admin_create_project`,
 * 0094) : la publication (SA-024) est une action separee sur la fiche.
 */
export function ProjectForm({ action }: { action: AdminAction }) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-owner`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.ownerProfileId}
        </label>
        <input
          id={`${base}-owner`}
          name="ownerProfileId"
          type="text"
          required
          aria-describedby={`${base}-owner-aide`}
          className={FIELD}
        />
        <p id={`${base}-owner-aide`} className="text-caption text-text-muted">
          {frAdminProjects.form.ownerProfileHelp}
        </p>
        {fieldError('ownerProfileId') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('ownerProfileId')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-type`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.projectType}
        </label>
        <select id={`${base}-type`} name="projectType" defaultValue="mission" className={FIELD}>
          {PROJECT_TYPES.map((value) => (
            <option key={value} value={value}>
              {frAdminProjects.projectType[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-title`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.title}
        </label>
        <input id={`${base}-title`} name="title" type="text" required minLength={3} className={FIELD} />
        {fieldError('title') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('title')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-summary`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.summary}
        </label>
        <textarea id={`${base}-summary`} name="summary" rows={2} required className={TEXTAREA} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-outcome`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.expectedOutcome}
        </label>
        <textarea id={`${base}-outcome`} name="expectedOutcome" rows={2} required className={TEXTAREA} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-description`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.description}
        </label>
        <textarea id={`${base}-description`} name="description" rows={4} className={TEXTAREA} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-criteria`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.qualificationCriteria}
        </label>
        <textarea id={`${base}-criteria`} name="qualificationCriteria" rows={3} className={TEXTAREA} />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-comp`} className="text-body-sm text-text-primary font-medium">
            {frAdminProjects.form.compensationType}
          </label>
          <select id={`${base}-comp`} name="compensationType" defaultValue="to_be_defined" className={`${FIELD} w-[220px]`}>
            {COMPENSATION_TYPES.map((value) => (
              <option key={value} value={value}>
                {frAdminProjects.compensationType[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-visibility`} className="text-body-sm text-text-primary font-medium">
            {frAdminProjects.form.visibility}
          </label>
          <select id={`${base}-visibility`} name="visibility" defaultValue="network" className={`${FIELD} w-[200px]`}>
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {frAdminProjects.visibility[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-comp-statement`} className="text-body-sm text-text-primary font-medium">
          {frAdminProjects.form.compensationStatement}
        </label>
        <input id={`${base}-comp-statement`} name="compensationStatement" type="text" className={FIELD} />
      </div>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminProjects.form.submitCreate}
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
