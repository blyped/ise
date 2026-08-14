'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Card, CardHeader, CardTitle, ErrorState, Field } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { initialFormState } from '@/lib/form-state';
import { FIELD, SELECT, TEXTAREA } from '@/components/collab/styles';
import type { ReferenceOption } from '@/lib/content-proposals';
import { ProposalCoverFields } from '@/components/proposals/ProposalCoverFields';
import { proposeEventAction } from './actions';

/**
 * PROPOSER UN ÉVÉNEMENT — formulaire membre (0132).
 *
 * Le bloc VISUEL est celui de la proposition d'actualité, importé tel
 * quel : c'est le même geste, la même contrainte de bucket et le même
 * texte alternatif obligatoire. Le dupliquer aurait garanti que les deux
 * copies divergent.
 *
 * Le format pilote l'AFFICHAGE des champs de lieu et de lien, mais pas la
 * règle : celle-ci est vérifiée par la Server Action ET par
 * `propose_event` (0132). Masquer un champ n'a jamais rien validé.
 */

const FORMATS = [
  { value: 'online', label: frContentProposals.member.formatOnline },
  { value: 'in_person', label: frContentProposals.member.formatInPerson },
  { value: 'hybrid', label: frContentProposals.member.formatHybrid },
] as const;

export interface ProposeEventFormProps {
  eventTypes: readonly ReferenceOption[];
  countries: readonly { code: string; label: string }[];
  /** Fuseau proposé par défaut, aligné sur `propose_event`. */
  defaultTimezone: string;
}

export function ProposeEventForm({
  eventTypes,
  countries,
  defaultTimezone,
}: ProposeEventFormProps) {
  const [state, action, isPending] = useActionState(proposeEventAction, initialFormState);
  const [format, setFormat] = useState<string>('online');
  const labels = frContentProposals.member;

  const needsUrl = format !== 'in_person';
  const needsPlace = format !== 'online';

  const globalError =
    state.status === 'error' &&
    state.correlationId !== null &&
    Object.keys(state.fieldErrors).length === 0;

  return (
    <form action={action} className="flex flex-col gap-7">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{labels.eventTitle}</CardTitle>
        </CardHeader>

        <div className="mt-5 flex flex-col gap-5">
          <Field
            label={labels.fieldEventType}
            error={state.fieldErrors['eventTypeCode']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <select
                id={id}
                name="eventTypeCode"
                required
                defaultValue=""
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={SELECT}
              >
                <option value="" disabled>
                  —
                </option>
                {eventTypes.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label={labels.fieldTitle}
            hint={labels.fieldTitleHint}
            error={state.fieldErrors['title']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="title"
                type="text"
                required
                minLength={3}
                maxLength={240}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={FIELD}
              />
            )}
          </Field>

          <Field label={labels.fieldDescription}>
            {({ id, describedBy }) => (
              <textarea
                id={id}
                name="description"
                rows={6}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={TEXTAREA}
              />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={labels.fieldStartsAt} error={state.fieldErrors['startsAt']} required>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="startsAt"
                  type="datetime-local"
                  required
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  className={FIELD}
                />
              )}
            </Field>

            <Field
              label={labels.fieldEndsAt}
              hint={labels.fieldEndsAtHint}
              error={state.fieldErrors['endsAt']}
            >
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="endsAt"
                  type="datetime-local"
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  className={FIELD}
                />
              )}
            </Field>
          </div>

          <Field label={labels.fieldTimezone} error={state.fieldErrors['timezone']} required>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="timezone"
                type="text"
                required
                defaultValue={defaultTimezone}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={FIELD}
              />
            )}
          </Field>

          <Field label={labels.fieldFormat} required>
            {({ id, describedBy }) => (
              <select
                id={id}
                name="format"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={SELECT}
              >
                {FORMATS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {needsUrl ? (
            <Field
              label={labels.fieldOnlineUrl}
              hint={labels.fieldOnlineUrlHint}
              error={state.fieldErrors['onlineUrl']}
              required
            >
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="onlineUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  className={FIELD}
                />
              )}
            </Field>
          ) : null}

          {needsPlace ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={labels.fieldCity}
                hint={labels.fieldPlaceHint}
                error={state.fieldErrors['city']}
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="city"
                    type="text"
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    className={FIELD}
                  />
                )}
              </Field>

              <Field label={labels.fieldVenue}>
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    name="venueName"
                    type="text"
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    className={FIELD}
                  />
                )}
              </Field>

              <Field label={labels.fieldCountry}>
                {({ id, describedBy }) => (
                  <select
                    id={id}
                    name="countryCode"
                    defaultValue=""
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    className={SELECT}
                  >
                    <option value="">—</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          ) : null}
        </div>
      </Card>

      <ProposalCoverFields
        fileError={state.fieldErrors['cover']}
        altError={state.fieldErrors['coverAlt']}
      />

      {globalError && state.correlationId !== null ? (
        <ErrorState
          title={frContentProposals.common.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      {state.status === 'error' && !globalError && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <div>
        <Button type="submit" loading={isPending} loadingLabel={labels.submitPending}>
          {labels.submitEvent}
        </Button>
      </div>
    </form>
  );
}
