'use client';

import { useActionState } from 'react';
import { Alert, Button, Select } from '@ise/ui-web';
import { frSupport } from '@/i18n/support';
import { initialFormState } from '@/lib/form-state';
import type { ReportReason } from '@/lib/messaging-view';
import { createReportAction } from '@/app/aide/actions';

/**
 * ISE-100 — signalement d'un profil ou d'un contenu (D-66).
 *
 * Les motifs proposes sont ceux de `public.report_reasons` dont
 * `applies_to` contient le type d'objet signale. La base refait le meme
 * filtrage : proposer « Faux profil » sur un message serait refuse
 * cote serveur, pas seulement absent du menu.
 */
export function ReportForm({
  targetType,
  targetId,
  targetLabel,
  reasons,
}: {
  targetType: string;
  targetId: string;
  targetLabel: string;
  reasons: readonly ReportReason[];
}) {
  const [state, formAction, isPending] = useActionState(createReportAction, initialFormState);

  if (state.status === 'success') {
    return <Alert variant="success" title={state.message ?? frSupport.report.created} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {isPending ? frSupport.report.submitting : (state.message ?? '')}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frSupport.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <dl className="rounded-base border-border bg-surface-muted flex flex-col gap-1 border p-4">
        <dt className="text-caption text-text-muted">{frSupport.report.targetTypeLabel}</dt>
        <dd className="text-body-sm text-text-primary font-medium">
          {frSupport.report.targetType[targetType] ?? targetType}
        </dd>
        <dt className="text-caption text-text-muted mt-2">{frSupport.report.targetLabel}</dt>
        <dd className="text-body-sm text-text-secondary break-all">{targetLabel}</dd>
      </dl>

      <div className="flex flex-col gap-2">
        <label htmlFor="motif-signalement" className="text-body-sm text-text-primary font-medium">
          {frSupport.report.reasonLabel}
        </label>
        <Select
          id="motif-signalement"
          name="reasonCode"
          required
          placeholder={frSupport.report.reasonPlaceholder}
          aria-invalid={state.fieldErrors['reasonCode'] !== undefined}
          aria-describedby={state.fieldErrors['reasonCode'] ? 'motif-erreur' : 'motif-aide'}
          options={reasons.map((reason) => ({ value: reason.code, label: reason.name }))}
        />
        {state.fieldErrors['reasonCode'] ? (
          <p id="motif-erreur" className="text-caption text-error">
            {state.fieldErrors['reasonCode']}
          </p>
        ) : (
          <p id="motif-aide" className="text-caption text-text-muted">
            {frSupport.report.reasonHint}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="precisions" className="text-body-sm text-text-primary font-medium">
          {frSupport.report.descriptionLabel}
        </label>
        <textarea
          id="precisions"
          name="description"
          rows={5}
          maxLength={2000}
          placeholder={frSupport.report.descriptionPlaceholder}
          aria-describedby="precisions-aide"
          className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue border border-[#CBD5E1] px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <p id="precisions-aide" className="text-caption text-text-muted">
          {frSupport.report.descriptionHint}
        </p>
      </div>

      <p className="text-caption text-text-muted">{frSupport.report.noEvidence}</p>
      <p className="text-caption text-text-muted">{frSupport.report.blockDistinction}</p>

      <Button
        type="submit"
        loading={isPending}
        loadingLabel={frSupport.report.submitting}
        className="self-start"
      >
        {frSupport.report.submit}
      </Button>
    </form>
  );
}
