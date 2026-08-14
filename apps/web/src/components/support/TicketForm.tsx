'use client';

import { useActionState, useEffect, useState } from 'react';
import { Alert, Button, Select } from '@ise/ui-web';
import { frSupport } from '@/i18n/support';
import { initialFormState } from '@/lib/form-state';
import type { SupportCategory } from '@/lib/messaging-view';
import { collectSupportContext } from '@/lib/support-context';
import {
  SUPPORT_ATTACHMENT_ACCEPT,
  SUPPORT_ATTACHMENT_MAX_FILES,
} from '@/lib/support-attachments';
import { createSupportTicketAction } from '@/app/aide/actions';

/**
 * ISE-100 — « Remonter une information ».
 *
 * D-85 — aucun champ de priorite n'est propose et aucun delai n'est
 * annonce : la priorite initiale est posee en base d'apres la NATURE de
 * la remontee (`support_categories.default_urgency`, 0131), puis ajustee
 * par l'administration. Le texte le dit au demandeur plutot que de
 * laisser croire a un arbitrage silencieux.
 *
 * CONTEXTE TECHNIQUE — collecte dans un effet, jamais au rendu :
 * `navigator` et `window` n'existent pas au rendu serveur, et lire un
 * contexte different entre serveur et client produirait une discordance
 * d'hydratation. Tant que l'effet n'a pas tourne, seuls la page et la
 * surface partent — c'est exactement ce qui existait avant 0131.
 *
 * PIECES JOINTES — le champ est reellement branche depuis 0131 (bucket
 * `support-attachments`, RPC `attach_support_file`). Aucune analyse
 * antivirale n'est faite : le texte le dit, il ne le laisse pas croire.
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
  const [context, setContext] = useState<Record<string, string>>({});

  useEffect(() => {
    setContext(collectSupportContext(fromPath));
  }, [fromPath]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="fromPath" value={fromPath} />
      {Object.entries(context).map(([key, value]) => (
        <input key={key} type="hidden" name={`ctx_${key}`} value={value} />
      ))}

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

      <div className="flex flex-col gap-2">
        <label htmlFor="pieces-demande" className="text-body-sm text-text-primary font-medium">
          {frSupport.attachments.label}
        </label>
        <input
          id="pieces-demande"
          name="attachments"
          type="file"
          multiple
          accept={SUPPORT_ATTACHMENT_ACCEPT}
          aria-invalid={state.fieldErrors['attachments'] !== undefined}
          aria-describedby={
            state.fieldErrors['attachments'] ? 'pieces-erreur' : 'pieces-aide pieces-scan'
          }
          className="text-body-sm text-text-primary file:border-border file:bg-surface-muted file:text-body-sm file:mr-4 file:rounded-md file:border file:px-4 file:py-2"
        />
        {state.fieldErrors['attachments'] ? (
          <p id="pieces-erreur" className="text-caption text-error">
            {state.fieldErrors['attachments']}
          </p>
        ) : (
          <p id="pieces-aide" className="text-caption text-text-muted">
            {frSupport.attachments.hint}
          </p>
        )}
        <p id="pieces-scan" className="text-caption text-text-muted">
          {frSupport.attachments.noScan}
        </p>
        <p className="sr-only">{SUPPORT_ATTACHMENT_MAX_FILES} fichiers au maximum par message.</p>
      </div>

      <div className="rounded-base border-border bg-surface-muted flex flex-col gap-2 border p-4">
        <p className="text-body-sm text-text-primary font-medium">
          {frSupport.ticket.technicalContextTitle}
        </p>
        <p className="text-caption text-text-muted">{frSupport.ticket.technicalContextBody}</p>
      </div>

      <p className="text-caption text-text-muted">{frSupport.ticket.urgencyNotice}</p>

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
