'use client';

import { useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Select,
  Textarea,
  VisibilitySelect,
} from '@ise/ui-web';
import { profileProjectSchema } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { CountryOption, SectorOption } from '@/lib/queries/reference';
import type { ProjectRow } from '@/lib/queries/profile-extras';
import { toProjectInput } from '../form-input-extras';
import { saveProjectAction } from '../actions-extras';

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const VISIBILITY_LABELS = {
  private: frProfile.visibility.private,
  connections: frProfile.visibility.connections,
  promotion: frProfile.visibility.promotion,
  members: frProfile.visibility.members,
} as const;

export interface ProjectFormProps {
  project: ProjectRow | null;
  sectors: readonly SectorOption[];
  countries: readonly CountryOption[];
}

/** ISE-026 — ajout et modification partagent le meme formulaire. */
export function ProjectForm({ project, sectors, countries }: ProjectFormProps) {
  const [state, formAction, isPending] = useActionState(saveProjectAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(profileProjectSchema, toProjectInput);
  const [summaryLength, setSummaryLength] = useState(project?.summary?.length ?? 0);
  const [outcomeLength, setOutcomeLength] = useState(project?.outcome?.length ?? 0);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const t = frProfile.projectForm;
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {project ? <input type="hidden" name="projectId" value={project.id} /> : null}

      {state.status === 'error' && state.message && !hasFieldErrors ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          description={state.message}
          correlationId={state.correlationId ?? ''}
        />
      ) : state.status === 'error' && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <div className="flex flex-col gap-5">
            <Field label={t.titleLabel} error={errorFor('title')} required>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="title"
                  type="text"
                  required
                  defaultValue={project?.title ?? ''}
                  placeholder={t.titlePlaceholder}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('title')}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.organizationLabel} error={errorFor('organizationNameRaw')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="organizationNameRaw"
                    type="text"
                    defaultValue={project?.organizationNameRaw ?? ''}
                    placeholder={t.organizationPlaceholder}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('organizationNameRaw')}
                  />
                )}
              </Field>

              <Field label={t.roleLabel} error={errorFor('role')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="role"
                    type="text"
                    defaultValue={project?.role ?? ''}
                    placeholder={t.rolePlaceholder}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('role')}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t.startLabel} error={errorFor('startDate')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="startDate"
                    type="date"
                    defaultValue={project?.startDate ?? ''}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('startDate')}
                  />
                )}
              </Field>
              <Field label={t.endLabel} error={errorFor('endDate')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="endDate"
                    type="date"
                    defaultValue={project?.endDate ?? ''}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('endDate')}
                  />
                )}
              </Field>
              <Field label={t.countryLabel} error={errorFor('countryCode')}>
                {({ id, describedBy, invalid }) => (
                  <Select
                    id={id}
                    name="countryCode"
                    defaultValue={project?.countryCode ?? ''}
                    placeholder={frProfile.header.countryPlaceholder}
                    options={countries.map((country) => ({
                      value: country.code,
                      label: country.name,
                    }))}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('countryCode')}
                  />
                )}
              </Field>
            </div>

            <Field label={t.sectorLabel} error={errorFor('sectorId')}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  name="sectorId"
                  defaultValue={project?.sectorId === null ? '' : String(project?.sectorId ?? '')}
                  placeholder={t.sectorPlaceholder}
                  options={sectors.map((sector) => ({
                    value: String(sector.id),
                    label: sector.name,
                  }))}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('sectorId')}
                />
              )}
            </Field>

            <Field
              label={t.summaryLabel}
              hint={frProfile.common.counter
                .replace('{current}', String(summaryLength))
                .replace('{max}', '600')}
              error={errorFor('summary')}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  name="summary"
                  rows={4}
                  maxLength={600}
                  defaultValue={project?.summary ?? ''}
                  placeholder={t.summaryPlaceholder}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={(event) => {
                    setSummaryLength(event.currentTarget.value.length);
                    clearField('summary');
                  }}
                />
              )}
            </Field>

            <Field
              label={t.outcomeLabel}
              hint={frProfile.common.counter
                .replace('{current}', String(outcomeLength))
                .replace('{max}', '400')}
              error={errorFor('outcome')}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  name="outcome"
                  rows={3}
                  maxLength={400}
                  defaultValue={project?.outcome ?? ''}
                  placeholder={t.outcomePlaceholder}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={(event) => {
                    setOutcomeLength(event.currentTarget.value.length);
                    clearField('outcome');
                  }}
                />
              )}
            </Field>

            <Field label={t.linkLabel} error={errorFor('linkUrl')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="linkUrl"
                  type="url"
                  defaultValue={project?.linkUrl ?? ''}
                  placeholder={t.linkPlaceholder}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('linkUrl')}
                />
              )}
            </Field>

            {/* D-73 : visibilite PAR ENTREE, appliquee par la base. */}
            <VisibilitySelect
              name="visibility"
              label={frProfile.common.visibilityLabel}
              hint={frProfile.common.visibilityHint}
              labels={VISIBILITY_LABELS}
              allowedLevels={['private', 'connections', 'promotion', 'members']}
              defaultValue={project?.visibility ?? 'members'}
              error={errorFor('visibility')}
            />
          </div>
        </Card>

        <aside className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{t.questionsTitle}</CardTitle>
            </CardHeader>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {t.questions.map((question) => (
                <li key={question} className="text-body-sm text-text-secondary">
                  {question}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{t.usefulTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{t.usefulBody}</p>
            <p className="text-body-sm mt-3 font-semibold text-[#15803D]">{t.usefulNoScore}</p>
          </Card>

          <div className="flex flex-wrap gap-4">
            <Link href={PROFILE_ROUTES.projects} className={LINK_CLASS}>
              {frProfile.common.cancel}
            </Link>
            <Button type="submit" loading={isPending} loadingLabel={frProfile.common.savePending}>
              {frProfile.common.save}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}
