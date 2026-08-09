'use client';

import { useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Select,
  VisibilitySelect,
} from '@ise/ui-web';
import { availabilitySettingsSchema, AVAILABILITY_CHANNELS } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { AVAILABILITY_ROUTES } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { AvailabilityTypeOption } from '@/lib/queries/reference';
import type { AvailabilityDetail } from '@/lib/queries/profile-extras';
import { toAvailabilityInput } from '../../mon-profil/form-input-extras';
import { saveAvailabilityAction } from '../actions';

const t = frProfile.availabilityForm;

const VISIBILITY_LABELS = {
  private: frProfile.visibility.private,
  connections: frProfile.visibility.connections,
  promotion: frProfile.visibility.promotion,
  members: frProfile.visibility.members,
} as const;

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface AvailabilityFormProps {
  types: readonly AvailabilityTypeOption[];
  details: readonly AvailabilityDetail[];
}

/**
 * ISE-033 — Modifier ma disponibilite.
 * Les 14 formes d'aide viennent du referentiel ; les preferences
 * s'appliquent aux formes actives. La disponibilite ne vaut jamais
 * obligation d'accepter (MASTER PROMPT §20) : l'ecran le rappelle.
 */
export function AvailabilityForm({ types, details }: AvailabilityFormProps) {
  const [state, formAction, isPending] = useActionState(saveAvailabilityAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(
    availabilitySettingsSchema,
    toAvailabilityInput,
  );

  const activeRows = details.filter((detail) => detail.active);
  const first = activeRows[0] ?? null;

  const [activeCodes, setActiveCodes] = useState<string[]>(activeRows.map((row) => row.code));

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
      {state.status === 'error' && state.message ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          description={state.message}
          correlationId={state.correlationId ?? ''}
        />
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert variant="success" title={state.message} />
      ) : null}

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-7">
          <Card>
            <fieldset>
              <legend className="text-body text-text-primary font-semibold">{t.typesLegend}</legend>
              <p className="text-caption text-text-secondary mt-1">
                {t.typesHint.replace('{count}', String(types.length))}
              </p>
              <ul className="mt-5 flex flex-col gap-4">
                {types.map((type) => {
                  const checked = activeCodes.includes(type.code);
                  return (
                    <li
                      key={type.code}
                      className="border-border rounded-base flex flex-wrap items-center justify-between gap-4 border px-4 py-3"
                    >
                      <Checkbox
                        label={type.name}
                        {...(type.description ? { description: type.description } : {})}
                        checked={checked}
                        onChange={() =>
                          setActiveCodes((current) =>
                            checked
                              ? current.filter((code) => code !== type.code)
                              : [...current, type.code],
                          )
                        }
                      />
                      <span
                        className={
                          checked
                            ? 'text-caption font-semibold text-[#15803D]'
                            : 'text-caption text-text-muted'
                        }
                      >
                        {checked ? frProfile.availability.active : frProfile.availability.inactive}
                      </span>
                      {checked ? (
                        <input type="hidden" name="activeTypes" value={type.code} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{t.preferencesTitle}</CardTitle>
              <p className="text-caption text-text-secondary">{t.preferencesHint}</p>
            </CardHeader>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t.frequencyLabel} error={errorFor('maxPerMonth')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="maxPerMonth"
                    type="number"
                    min={1}
                    max={60}
                    defaultValue={first?.maxPerMonth ?? ''}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('maxPerMonth')}
                  />
                )}
              </Field>

              <Field label={t.delayLabel} error={errorFor('idealDelayDays')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="idealDelayDays"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={first?.idealDelayDays ?? ''}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('idealDelayDays')}
                  />
                )}
              </Field>

              <Field label={t.channelLabel} error={errorFor('preferredChannel')}>
                {({ id, describedBy, invalid }) => (
                  <Select
                    id={id}
                    name="preferredChannel"
                    defaultValue={first?.preferredChannel ?? ''}
                    placeholder={t.channelPlaceholder}
                    options={AVAILABILITY_CHANNELS.map((channel) => ({
                      value: channel,
                      label: frProfile.availability.channel[channel],
                    }))}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('preferredChannel')}
                  />
                )}
              </Field>
            </div>

            <div className="mt-5 flex flex-col gap-5">
              <Field label={t.noteLabel} error={errorFor('notes')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="notes"
                    type="text"
                    maxLength={300}
                    defaultValue={first?.notes ?? ''}
                    placeholder={t.notePlaceholder}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={() => clearField('notes')}
                  />
                )}
              </Field>

              <VisibilitySelect
                name="visibility"
                label={t.visibilityLabel}
                hint={frProfile.common.visibilityHint}
                labels={VISIBILITY_LABELS}
                allowedLevels={['private', 'connections', 'promotion', 'members']}
                defaultValue={first?.visibility ?? 'members'}
                error={errorFor('visibility')}
              />
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{t.publicTitle}</CardTitle>
            </CardHeader>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {t.publicItems.map((item) => (
                <li key={item} className="text-body-sm text-text-secondary">
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-body-sm mt-3 font-semibold text-[#A16207]">{t.publicPrivate}</p>
          </Card>

          <Alert variant="success" title={t.lastWordTitle}>
            {t.lastWordBody}
          </Alert>

          <div className="flex flex-wrap gap-4">
            <Link href={AVAILABILITY_ROUTES.overview} className={LINK_CLASS}>
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
