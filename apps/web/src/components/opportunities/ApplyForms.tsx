'use client';

import { useActionState } from 'react';
import { Alert, Button, ErrorState, Field, Input, Select, Textarea } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { initialFormState } from '@/lib/form-state';
import type { ProfileDocument } from '@/lib/opportunities-view';
import {
  declareApplicationAction,
  openExternalOfferAction,
  submitApplicationAction,
} from '@/app/opportunites/actions';

/**
 * CANDIDATURE INTERNE (mode `internal` uniquement).
 *
 * C'est le seul formulaire de la tranche qui produit une candidature que
 * la plateforme a réellement constatée. Il n'est rendu que lorsque
 * `can_apply_internally` est vrai : la base refuserait tout autre cas.
 */
export function InternalApplyForm({
  opportunityId,
  documents,
}: {
  opportunityId: string;
  documents: readonly ProfileDocument[];
}) {
  const [state, formAction, isPending] = useActionState(submitApplicationAction, initialFormState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="opportunityId" value={opportunityId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Field
        label={frOpportunities.apply.messageLabel}
        hint={frOpportunities.apply.messageHint}
        error={state.fieldErrors['message']}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="message"
            rows={6}
            maxLength={2000}
            placeholder={frOpportunities.apply.messagePlaceholder}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      {documents.length > 0 ? (
        <Field label={frOpportunities.apply.cvLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="cvDocumentId"
              defaultValue=""
              placeholder={frOpportunities.apply.cvNone}
              options={documents.map((document) => ({
                value: document.documentId,
                label: document.title ?? document.filename,
              }))}
            />
          )}
        </Field>
      ) : (
        <Alert variant="info" title={frOpportunities.apply.cvEmptyTitle}>
          {frOpportunities.apply.cvEmptyBody}
        </Alert>
      )}

      <Alert variant="info" title={frOpportunities.apply.cvPrivacyTitle}>
        {frOpportunities.apply.cvPrivacyBody}
      </Alert>

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <Button type="submit" loading={isPending} loadingLabel={frOpportunities.apply.submitPending}>
        {frOpportunities.apply.submit}
      </Button>
    </form>
  );
}

/**
 * OUVERTURE d'une offre externe.
 *
 * L'action journalise un CLIC et renvoie `is_application: false`. Le
 * lien n'est révélé qu'après ce geste, et le message qui l'accompagne
 * dit explicitement que consulter n'est pas candidater (D-55).
 */
export function ExternalOfferForm({
  opportunityId,
  url,
  email,
}: {
  opportunityId: string;
  url: string | null;
  email: string | null;
}) {
  const [state, formAction, isPending] = useActionState(openExternalOfferAction, initialFormState);

  return (
    <div className="flex flex-col gap-5">
      <Alert variant="warning" title={frOpportunities.apply.externalNoticeTitle}>
        {frOpportunities.apply.externalNoticeBody}
      </Alert>

      {url !== null ? (
        <p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frOpportunities.apply.openExternal}
          </a>
        </p>
      ) : null}

      {email !== null ? (
        <p className="text-body-sm text-text-secondary">
          {frOpportunities.apply.openExternalEmail} :{' '}
          <span className="text-text-primary font-medium">{email}</span>
        </p>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <Button
          type="submit"
          variant="secondary"
          loading={isPending}
          loadingLabel={frOpportunities.common.loadMorePending}
        >
          {frOpportunities.apply.clickRecordedTitle}
        </Button>
      </form>

      {state.status === 'success' ? (
        <Alert variant="info" title={frOpportunities.apply.clickRecordedTitle}>
          {frOpportunities.apply.clickRecordedBody}
        </Alert>
      ) : null}
      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * DÉCLARATION du membre (MASTER PROMPT §27, D-55).
 *
 * Seul chemin qui crée une candidature externe. La date est SAISIE par
 * la personne : la plateforme n'en devine aucune, et le libellé du
 * bouton dit « je déclare », jamais « envoyer ».
 */
export function DeclareApplicationForm({ opportunityId }: { opportunityId: string }) {
  const [state, formAction, isPending] = useActionState(declareApplicationAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="opportunityId" value={opportunityId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Field
        label={frOpportunities.apply.declareDateLabel}
        hint={frOpportunities.apply.declareDateHint}
        required
        error={state.fieldErrors['declaredAt']}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="declaredAt"
            type="date"
            max={today}
            defaultValue={today}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      <Field
        label={frOpportunities.apply.declareNoteLabel}
        hint={frOpportunities.apply.declareNoteHint}
      >
        {({ id, describedBy }) => (
          <Textarea id={id} name="note" rows={3} maxLength={2000} aria-describedby={describedBy} />
        )}
      </Field>

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <Button type="submit" loading={isPending} loadingLabel={frOpportunities.apply.declarePending}>
        {frOpportunities.apply.declareSubmit}
      </Button>
    </form>
  );
}
