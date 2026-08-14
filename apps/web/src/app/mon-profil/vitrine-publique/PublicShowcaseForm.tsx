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
  Textarea,
} from '@ise/ui-web';
import { publicShowcaseSchema, PUBLIC_SUMMARY_MAX, PUBLIC_SUMMARY_MIN } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { fillShowcase, frShowcase } from '@/i18n/profile-showcase';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { PublicShowcase } from '@/lib/queries/public-showcase';
import { toPublicShowcaseInput } from '../form-input';
import { savePublicShowcaseAction } from './actions';

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Brève description publique et DEUX consentements distincts.
 *
 * Le second consentement dit sans détour que l'image sera visible par
 * n'importe quel visiteur, y compris non connecté, et qu'une image publiée
 * peut être reprise par les moteurs de recherche. Aucune formulation ne
 * minimise : c'est la condition posée par la révision de D-135.
 */
export function PublicShowcaseForm({ showcase }: { showcase: PublicShowcase }) {
  const [state, formAction, isPending] = useActionState(
    savePublicShowcaseAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(
    publicShowcaseSchema,
    toPublicShowcaseInput,
  );

  const [summaryLength, setSummaryLength] = useState(showcase.publicSummary?.length ?? 0);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const remaining = PUBLIC_SUMMARY_MAX - summaryLength;
  const missing = PUBLIC_SUMMARY_MIN - summaryLength;
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  return (
    <form
      id="formulaire-vitrine-publique"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-7"
    >
      {state.status === 'success' && state.message ? (
        <Alert variant="success" title={state.message} />
      ) : null}
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frShowcase.summaryTitle}</CardTitle>
        </CardHeader>

        <Field
          label={frShowcase.summaryLabel}
          hint={fillShowcase(frShowcase.summaryHint, {
            min: PUBLIC_SUMMARY_MIN,
            max: PUBLIC_SUMMARY_MAX,
          })}
          error={errorFor('publicSummary')}
        >
          {({ id, describedBy, invalid }) => (
            <div className="flex flex-col gap-2">
              <Textarea
                id={id}
                name="publicSummary"
                rows={4}
                maxLength={PUBLIC_SUMMARY_MAX}
                defaultValue={showcase.publicSummary ?? ''}
                placeholder={frShowcase.summaryPlaceholder}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={(event) => {
                  setSummaryLength(event.currentTarget.value.length);
                  clearField('publicSummary');
                }}
              />
              {/* Compteur annoncé aux lecteurs d'écran seulement près de la
                  limite : une annonce à chaque frappe serait inutilisable. */}
              <p
                className="text-caption text-text-muted self-end"
                aria-live={remaining <= 40 ? 'polite' : 'off'}
              >
                {summaryLength > 0 && missing > 0
                  ? fillShowcase(frShowcase.summaryTooShort, {
                      count: missing,
                      min: PUBLIC_SUMMARY_MIN,
                    })
                  : fillShowcase(frShowcase.summaryCounter, { count: remaining })}
              </p>
            </div>
          )}
        </Field>

        <p className="text-caption text-text-muted mt-3">
          {frShowcase.summaryExample}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frShowcase.consentTitle}</CardTitle>
        </CardHeader>
        <p className="text-body-sm text-text-secondary mb-5">
          {frShowcase.consentHint}
        </p>

        <div className="flex flex-col gap-6">
          <Checkbox
            name="allowPublicFeature"
            defaultChecked={showcase.allowPublicFeature}
            label={frShowcase.featureLabel}
            description={frShowcase.featureDescription}
            onChange={() => clearField('publicSummary')}
          />

          <Checkbox
            name="allowPublicPhoto"
            defaultChecked={showcase.allowPublicPhoto}
            label={frShowcase.photoLabel}
            description={
              <>
                {frShowcase.photoDescription}
                <br />
                {frShowcase.photoRevokeNote}
              </>
            }
            onChange={() => clearField('publicSummary')}
          />
        </div>
      </Card>

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="border-border flex flex-wrap items-center gap-5 border-t pt-6">
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frProfile.common.savePending}
        >
          {frProfile.common.save}
        </Button>
        <Link href={PROFILE_ROUTES.overview} className={LINK_CLASS}>
          {frProfile.common.cancel}
        </Link>
      </div>
    </form>
  );
}
