'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Button, ErrorState, Field, OptionCardGroup, Textarea } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { applicationRoute } from '@/lib/routes/opportunities';
import { initialFormState } from '@/lib/form-state';
import type { ApplicationStatus } from '@/lib/opportunities-view';
import { updateApplicationAction } from '@/app/opportunites/actions';

/**
 * ISE-065 / ISE-066 — mise à jour d'une candidature.
 *
 * Les étapes proposées viennent de `allowed_transitions`, CALCULÉ EN BASE
 * selon la matrice de `transition_application_status` (0008). L'écran
 * n'affiche donc jamais une option que la base refuserait — et il n'en
 * cache aucune qu'elle accepterait.
 *
 * Sur une candidature auto-déclarée (D-55), le bandeau rappelle que ce
 * qui est enregistré est une DÉCLARATION du membre, pas un constat de la
 * plateforme.
 */
export function ApplicationUpdateForm({
  applicationId,
  allowed,
  selfDeclared,
  restrictTo,
}: {
  applicationId: string;
  allowed: readonly ApplicationStatus[];
  selfDeclared: boolean;
  /** Sous-ensemble à proposer (ISE-066 ne montre que les issues). */
  restrictTo?: readonly ApplicationStatus[];
}) {
  const [state, formAction, isPending] = useActionState(updateApplicationAction, initialFormState);

  const options = allowed.filter(
    (status) => restrictTo === undefined || restrictTo.includes(status),
  );

  if (options.length === 0) {
    return (
      <Alert variant="info" title={frOpportunities.update.noTransitionTitle}>
        {frOpportunities.update.noTransitionBody}
      </Alert>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="applicationId" value={applicationId} />

      {selfDeclared ? (
        <Alert variant="warning" title={frOpportunities.update.declarationTitle}>
          {frOpportunities.update.declarationBody}
        </Alert>
      ) : null}

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <OptionCardGroup
        type="radio"
        name="toStatus"
        legend={frOpportunities.update.statusLegend}
        columns={2}
        error={state.fieldErrors['toStatus']}
        items={options.map((status) => ({
          value: status,
          label: frOpportunities.applicationStatus[status] ?? status,
          description: frOpportunities.applicationStatusHint[status] ?? '',
        }))}
      />

      <Field label={frOpportunities.update.noteLabel} hint={frOpportunities.update.noteHint}>
        {({ id, describedBy }) => (
          <Textarea id={id} name="note" rows={3} maxLength={1000} aria-describedby={describedBy} />
        )}
      </Field>

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={applicationRoute(applicationId)}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frOpportunities.common.cancel}
        </Link>
        <Button
          type="submit"
          loading={isPending}
          loadingLabel={frOpportunities.update.submitPending}
        >
          {frOpportunities.update.submit}
        </Button>
      </div>
    </form>
  );
}
