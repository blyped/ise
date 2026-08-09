'use client';

import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Card, CardHeader, CardTitle, ErrorState, Select } from '@ise/ui-web';
import { positioningSchema } from '@ise/validation';
import { useActionState } from 'react';
import { frProfile } from '@/i18n/profile';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { JobFunctionOption, SectorOption } from '@/lib/queries/reference';
import type { ExpertiseAreaOption, PositioningState } from '@/lib/queries/profile-extras';
import { toPositioningInput } from '../form-input-extras';
import { savePositioningAction } from '../actions-extras';

interface NamedOption {
  id: number;
  name: string;
}

/**
 * Editeur d'une des trois listes : selection par menu deroulant (les
 * referentiels viennent de la base), retrait par bouton. Les valeurs
 * choisies sont postees en champs caches repetes.
 */
function ListEditor({
  title,
  hint,
  fieldName,
  options,
  selected,
  onAdd,
  onRemove,
  addPlaceholder,
  primarySectorId,
  onPrimaryChange,
}: {
  title: string;
  hint: string;
  fieldName: string;
  options: readonly NamedOption[];
  selected: readonly number[];
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  addPlaceholder: string;
  /** Present uniquement pour les secteurs : marquage du secteur principal. */
  primarySectorId?: number | null;
  onPrimaryChange?: (id: number | null) => void;
}) {
  const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const remaining = options.filter((option) => !selected.includes(option.id));
  const t = frProfile.positioning;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-4">
          <CardTitle as="h2">{title}</CardTitle>
          <span className="text-caption text-text-muted">
            {t.selectedCount.replace('{count}', String(selected.length))}
          </span>
        </div>
        <p className="text-caption text-text-secondary">{hint}</p>
      </CardHeader>

      <ul className="flex flex-col gap-3">
        {selected.map((id) => (
          <li
            key={id}
            className="border-border bg-surface rounded-base flex items-center justify-between gap-3 border px-4 py-3"
          >
            <span className="text-body-sm text-text-primary min-w-0">
              {byId.get(id)?.name ?? id}
              {primarySectorId === id ? (
                <span className="text-caption text-primary ml-2 font-semibold">
                  {t.primaryBadge}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {onPrimaryChange ? (
                <label className="text-caption text-text-secondary flex items-center gap-2">
                  <input
                    type="radio"
                    name="primarySectorChoice"
                    checked={primarySectorId === id}
                    onChange={() => onPrimaryChange(id)}
                  />
                  {t.primaryLegend}
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-text-muted hover:text-text-primary focus-visible:outline-active-blue rounded-sm px-2 py-1 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                ×
                <span className="sr-only">
                  {' '}
                  {t.removeLabel} — {byId.get(id)?.name ?? id}
                </span>
              </button>
            </span>
            <input type="hidden" name={fieldName} value={id} />
          </li>
        ))}
      </ul>

      {remaining.length > 0 ? (
        <div className="mt-4">
          <label className="sr-only" htmlFor={`ajout-${fieldName}`}>
            {addPlaceholder}
          </label>
          <Select
            id={`ajout-${fieldName}`}
            value=""
            onChange={(event) => {
              const id = Number(event.target.value);
              if (Number.isFinite(id) && id > 0) onAdd(id);
            }}
            options={[
              { value: '', label: `+ ${addPlaceholder}` },
              ...remaining.map((option) => ({ value: String(option.id), label: option.name })),
            ]}
          />
        </div>
      ) : null}
    </Card>
  );
}

export interface PositioningFormProps {
  sectors: readonly SectorOption[];
  jobFunctions: readonly JobFunctionOption[];
  expertiseAreas: readonly ExpertiseAreaOption[];
  initial: PositioningState;
}

/** ISE-024 — edition des trois listes + marquage du secteur principal. */
export function PositioningForm({
  sectors,
  jobFunctions,
  expertiseAreas,
  initial,
}: PositioningFormProps) {
  const [state, formAction, isPending] = useActionState(savePositioningAction, initialFormState);
  const { clientErrors, onSubmit } = useZodForm(positioningSchema, toPositioningInput);

  const [sectorIds, setSectorIds] = useState<number[]>(initial.sectors.map((s) => s.sectorId));
  const [primarySectorId, setPrimarySectorId] = useState<number | null>(
    initial.sectors.find((s) => s.isPrimary)?.sectorId ?? null,
  );
  const [functionIds, setFunctionIds] = useState<number[]>(
    initial.functions.map((f) => f.jobFunctionId),
  );
  const [expertiseAreaIds, setExpertiseAreaIds] = useState<number[]>(
    initial.expertiseAreas.map((a) => a.expertiseAreaId),
  );

  const removeSector = useCallback((id: number) => {
    setSectorIds((current) => current.filter((value) => value !== id));
    setPrimarySectorId((current) => (current === id ? null : current));
  }, []);

  const t = frProfile.positioning;
  const primaryError = clientErrors['primarySectorId'] ?? state.fieldErrors['primarySectorId'];

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

      {primarySectorId !== null ? (
        <input type="hidden" name="primarySectorId" value={primarySectorId} />
      ) : null}

      <div className="grid items-start gap-7 lg:grid-cols-3">
        <ListEditor
          title={t.sectorsTitle}
          hint={t.sectorsHint}
          fieldName="sectorIds"
          options={sectors}
          selected={sectorIds}
          onAdd={(id) => setSectorIds((current) => [...current, id])}
          onRemove={removeSector}
          addPlaceholder={t.addSectorPlaceholder}
          primarySectorId={primarySectorId}
          onPrimaryChange={setPrimarySectorId}
        />
        <ListEditor
          title={t.functionsTitle}
          hint={t.functionsHint}
          fieldName="functionIds"
          options={jobFunctions}
          selected={functionIds}
          onAdd={(id) => setFunctionIds((current) => [...current, id])}
          onRemove={(id) => setFunctionIds((current) => current.filter((value) => value !== id))}
          addPlaceholder={t.addFunctionPlaceholder}
        />
        <ListEditor
          title={t.expertiseTitle}
          hint={t.expertiseHint}
          fieldName="expertiseAreaIds"
          options={expertiseAreas}
          selected={expertiseAreaIds}
          onAdd={(id) => setExpertiseAreaIds((current) => [...current, id])}
          onRemove={(id) =>
            setExpertiseAreaIds((current) => current.filter((value) => value !== id))
          }
          addPlaceholder={t.addExpertisePlaceholder}
        />
      </div>

      {primaryError ? <Alert variant="error" title={primaryError} /> : null}

      <Alert variant="info" title={t.searchImpactTitle}>
        {t.searchImpactBody} {t.primaryHint}
      </Alert>

      <div className="flex flex-wrap gap-4">
        <Button type="submit" loading={isPending} loadingLabel={frProfile.common.savePending}>
          {frProfile.common.save}
        </Button>
      </div>
    </form>
  );
}
