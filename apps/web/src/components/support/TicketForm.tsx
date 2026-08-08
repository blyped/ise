'use client';

import { useActionState } from 'react';
import { Alert, Button, Select } from '@ise/ui-web';
import { frSupport } from '@/i18n/support';
import { initialFormState } from '@/lib/form-state';
import type { SupportCategory } from '@/lib/messaging-view';
import { createSupportTicketAction } from '@/app/aide/actions';

/**
 * ISE-100 — creation d'une demande.
 *
 * D-85 — aucun champ d'urgence n'est propose et aucun delai n'est
 * annonce : l'urgence est attribuee par l'equipe (la politique
 * d'insertion de 0049 impose `urgency_source = 'system'`), et aucun
 * engagement de traitement n'existe dans les documents.
 *
 * Aucun bouton de piece jointe n'est rendu : le televersement n'est pas
 * livre. Le texte le dit plutot que de laisser croire le contraire.
 */
export function TicketForm({
  categories,
  defaultCategory,
  fromPath,
}: {
  categories: readonly SupportCategory[];
  defaultCategory: string | null;
  fromPath: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createSupportTicketAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="fromPath" value={fromPath} />

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {isPending ? frSupport.ticket.submitting : (state.message ?? '')}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frSupport.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="categorie-demande" className="text-body-sm text-text-primary font-medium">
          {frSupport.ticket.categoryLabel}
        </label>
        <Select
          id="categorie-demande"
          name="categoryCode"
          required
          defaultValue={defaultCategory ?? ''}
          placeholder={frSupport.ticket.categoryPlaceholder}
          aria-invalid={state.fieldErrors['categoryCode'] !== undefined}
          aria-describedby={state.fieldErrors['categoryCode'] ? 'categorie-erreur' : undefined}
          options={categories.map((category) => ({
            value: category.code,
            label: category.name,
          }))}
        />
        {state.fieldErrors['categoryCode'] ? (
          <p id="categorie-erreur" className="text-caption text-error">
            {state.fieldErrors['categoryCode']}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="objet-demande" className="text-body-sm text-text-primary font-medium">
          {frSupport.ticket.subjectLabel}
        </label>
        <input
          id="objet-demande"
          name="subject"
          type="text"
          required
          minLength={3}
          maxLength={200}
          placeholder={frSupport.ticket.subjectPlaceholder}
          aria-invalid={state.fieldErrors['subject'] !== undefined}
          aria-describedby={state.fieldErrors['subject'] ? 'objet-erreur' : 'objet-aide'}
          className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {state.fieldErrors['subject'] ? (
          <p id="objet-erreur" className="text-caption text-error">
            {state.fieldErrors['subject']}
          </p>
        ) : (
          <p id="objet-aide" className="text-caption text-text-muted">
            {frSupport.ticket.subjectHint}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description-demande" className="text-body-sm text-text-primary font-medium">
          {frSupport.ticket.descriptionLabel}
        </label>
        <textarea
          id="description-demande"
          name="description"
          rows={6}
          required
          minLength={10}
          maxLength={5000}
          placeholder={frSupport.ticket.descriptionPlaceholder}
          aria-invalid={state.fieldErrors['description'] !== undefined}
          aria-describedby={
            state.fieldErrors['description'] ? 'description-erreur' : 'description-aide'
          }
          className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue border border-[#CBD5E1] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {state.fieldErrors['description'] ? (
          <p id="description-erreur" className="text-caption text-error">
            {state.fieldErrors['description']}
          </p>
        ) : (
          <p id="description-aide" className="text-caption text-text-muted">
            {frSupport.ticket.descriptionHint}
          </p>
        )}
      </div>

      <div className="rounded-base border-border bg-surface-muted flex flex-col gap-2 border p-4">
        <p className="text-body-sm text-text-primary font-medium">
          {frSupport.ticket.technicalContextTitle}
        </p>
        <p className="text-caption text-text-muted">{frSupport.ticket.technicalContextBody}</p>
      </div>

      <p className="text-caption text-text-muted">{frSupport.ticket.urgencyNotice}</p>
      <p className="text-caption text-text-muted">{frSupport.ticket.attachmentsUnavailable}</p>

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={frSupport.ticket.submitting}
        className="self-start"
      >
        {frSupport.ticket.submit}
      </Button>
    </form>
  );
}
