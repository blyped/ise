'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, CardHeader, CardTitle, ErrorState, Field } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { initialFormState } from '@/lib/form-state';
import { FIELD, SELECT, TEXTAREA } from '@/components/collab/styles';
import type { ReferenceOption } from '@/lib/content-proposals';
import { ProposalCoverFields } from '@/components/proposals/ProposalCoverFields';
import { proposeNewsAction } from './actions';

/**
 * PROPOSER UNE ACTUALITÉ — formulaire membre (0132).
 *
 * Un seul formulaire, un seul envoi : le texte et l'image partent
 * ensemble. C'est le point explicite de la demande du porteur — « leur
 * donner la possibilité d'ajouter les images en même temps pour que je
 * n'aie pas à faire toutes les images à la validation ».
 *
 * Il n'y a NI brouillon, NI enregistrement intermédiaire : proposer est
 * un geste unique. Un brouillon supposerait un écran de reprise et un
 * état de plus, pour un formulaire de six champs.
 */
export function ProposeNewsForm({ categories }: { categories: readonly ReferenceOption[] }) {
  const [state, action, isPending] = useActionState(proposeNewsAction, initialFormState);
  const labels = frContentProposals.member;

  const globalError =
    state.status === 'error' &&
    state.correlationId !== null &&
    Object.keys(state.fieldErrors).length === 0;

  return (
    <form action={action} className="flex flex-col gap-7">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{labels.newsTitle}</CardTitle>
        </CardHeader>

        <div className="mt-5 flex flex-col gap-5">
          <Field
            label={labels.fieldCategory}
            hint={labels.fieldCategoryHint}
            error={state.fieldErrors['categoryCode']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <select
                id={id}
                name="categoryCode"
                required
                defaultValue=""
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={SELECT}
              >
                <option value="" disabled>
                  —
                </option>
                {categories.map((option) => (
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

          <Field
            label={labels.fieldSummary}
            hint={labels.fieldSummaryHint}
            error={state.fieldErrors['summary']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <textarea
                id={id}
                name="summary"
                required
                rows={3}
                maxLength={400}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={TEXTAREA}
              />
            )}
          </Field>

          <Field label={labels.fieldBody} hint={labels.fieldBodyHint}>
            {({ id, describedBy }) => (
              <textarea
                id={id}
                name="body"
                rows={8}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={TEXTAREA}
              />
            )}
          </Field>

          <Field label={labels.fieldEventDate} hint={labels.fieldEventDateHint}>
            {({ id, describedBy }) => (
              <input
                id={id}
                name="eventDate"
                type="date"
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={FIELD}
              />
            )}
          </Field>

          <Field label={labels.fieldSourceUrl} hint={labels.fieldSourceUrlHint}>
            {({ id, describedBy }) => (
              <input
                id={id}
                name="sourceUrl"
                type="url"
                inputMode="url"
                placeholder="https://"
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className={FIELD}
              />
            )}
          </Field>
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
          {labels.submitNews}
        </Button>
      </div>
    </form>
  );
}
