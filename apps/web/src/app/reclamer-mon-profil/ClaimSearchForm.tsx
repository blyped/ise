'use client';

import { useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
} from '@ise/ui-web';
import { claimSearchSchema } from '@ise/validation';
import { fr, t } from '@/i18n/fr';
import { claimConfirmRoute } from '@/lib/routes';
import { useZodForm } from '@/lib/use-zod-form';
import type { ClaimableProfileSummary } from '@/lib/queries/claim';
import { searchClaimAction } from './actions';
import { initialClaimSearchState } from './states';

function toInput(formData: FormData) {
  return {
    lastName: formData.get('lastName'),
    firstName: formData.get('firstName'),
    graduationYear: formData.get('graduationYear'),
  };
}

/** Squelette calque sur une carte de resultat (D-93). */
function ResultSkeleton() {
  return (
    <Card padding="sm">
      <Skeleton shape="line" className="w-[180px]" />
      <Skeleton shape="line" className="mt-3 w-[120px]" />
      <Skeleton shape="line" className="mt-3 w-[220px]" />
    </Card>
  );
}

function ResultCard({ profile }: { profile: ClaimableProfileSummary }) {
  const promotion =
    profile.graduationYear === null
      ? fr.claim.search.promotionUnknown
      : t(fr.claim.search.promotionLabel, { year: profile.graduationYear });

  return (
    <Card as="li" padding="sm" interactive>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-body text-text-primary font-semibold">{profile.displayName}</p>
          <p className="text-body-sm text-text-secondary mt-1">{promotion}</p>
          <p className="text-body-sm text-text-secondary mt-1">
            {profile.currentOrganization ?? fr.claim.search.organizationUnknown}
          </p>
          <p className="text-caption text-text-muted mt-2">
            {fr.claim.search.emailHintLabel} :{' '}
            {profile.emailHint === null ? (
              fr.claim.search.emailHintUnknown
            ) : (
              <>
                <span className="font-mono">{profile.emailHint}</span>{' '}
                <span>({fr.claim.search.emailHintMasked})</span>
              </>
            )}
          </p>
        </div>

        <Link
          href={claimConfirmRoute(profile.profileId)}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[40px] shrink-0 items-center justify-center border border-[#CBD5E1] px-5 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="sr-only">{profile.displayName} — </span>
          {fr.claim.search.select}
        </Link>
      </div>
    </Card>
  );
}

export function ClaimSearchForm({ graduationYears }: { graduationYears: readonly number[] }) {
  const [state, formAction, isPending] = useActionState(searchClaimAction, initialClaimSearchState);
  const { clientErrors, clearField, onSubmit } = useZodForm(claimSearchSchema, toInput);
  const [missingOpen, setMissingOpen] = useState(false);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const yearOptions = graduationYears.map((year) => ({
    value: String(year),
    label: String(year),
  }));

  const results = state.results;
  const count = results?.length ?? 0;

  // Une erreur de saisie se dit au-dessus du champ concerne ; une erreur de
  // chargement se dit dans la zone de resultats, avec son `correlation_id`
  // et un bouton « Reessayer » (D-93, D-102).
  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const loadFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  return (
    <div className="flex flex-col gap-7">
      <form
        id="formulaire-reclamation-recherche"
        action={formAction}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-5"
      >
        {state.status === 'error' && hasFieldErrors && state.message ? (
          <Alert variant="error" title={state.message} />
        ) : null}

        <Field label={fr.claim.search.lastNameLabel} error={errorFor('lastName')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder={fr.claim.search.lastNamePlaceholder}
              required
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('lastName')}
            />
          )}
        </Field>

        <Field label={fr.claim.search.firstNameLabel} error={errorFor('firstName')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder={fr.claim.search.firstNamePlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('firstName')}
            />
          )}
        </Field>

        {yearOptions.length > 0 ? (
          <Field
            label={fr.claim.search.graduationYearLabel}
            hint={fr.claim.search.graduationYearHint}
            error={errorFor('graduationYear')}
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="graduationYear"
                options={yearOptions}
                placeholder={fr.claim.search.graduationYearAll}
                defaultValue=""
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={() => clearField('graduationYear')}
              />
            )}
          </Field>
        ) : null}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isPending}
          loadingLabel={fr.claim.search.submitPending}
        >
          {fr.claim.search.submit}
        </Button>
      </form>

      {/*
        Trois etats distincts (D-93) : chargement -> squelette, resultats ->
        liste, aucun resultat -> etat vide avec une action de sortie.
        Tant qu'aucune recherche n'a ete lancee, la zone reste absente : on
        n'affiche pas « aucun resultat » avant d'avoir cherche.
      */}
      <section aria-live="polite" aria-busy={isPending} className="flex flex-col gap-4">
        {isPending ? (
          <>
            <span className="sr-only">{fr.common.loading}</span>
            <ResultSkeleton />
            <ResultSkeleton />
          </>
        ) : null}

        {!isPending && results !== null && count > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-h4 text-text-primary font-semibold">
                {fr.claim.search.resultsTitle}
              </h2>
              <p className="text-caption text-text-muted">
                {t(count > 1 ? fr.claim.search.resultsCountPlural : fr.claim.search.resultsCount, {
                  count,
                })}
              </p>
            </div>
            <p className="text-caption text-text-muted">{fr.claim.search.resultsHint}</p>
            <ul className="flex flex-col gap-4">
              {results.map((profile) => (
                <ResultCard key={profile.profileId} profile={profile} />
              ))}
            </ul>
          </>
        ) : null}

        {!isPending && results !== null && count === 0 ? (
          <EmptyState
            title={fr.claim.search.emptyTitle}
            description={fr.claim.search.emptyBody}
            action={
              <Button
                variant="secondary"
                aria-expanded={missingOpen}
                onClick={() => setMissingOpen((open) => !open)}
              >
                {fr.claim.search.emptyAction}
              </Button>
            }
          />
        ) : null}

        {missingOpen && !isPending && count === 0 ? (
          <Alert variant="info" title={fr.claim.search.missingTitle}>
            {fr.claim.search.missingBody}
          </Alert>
        ) : null}

        {loadFailed && state.correlationId !== null ? (
          <ErrorState
            title={fr.claim.search.errorTitle}
            correlationId={state.correlationId}
            {...(state.message ? { description: state.message } : {})}
            action={
              <Button
                type="submit"
                variant="secondary"
                form="formulaire-reclamation-recherche"
                loading={isPending}
              >
                {fr.common.retry}
              </Button>
            }
          />
        ) : null}
      </section>
    </div>
  );
}
