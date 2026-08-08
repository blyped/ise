'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Select } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { initialFormState } from '@/lib/form-state';
import type { FieldVisibilityRow } from '@/lib/messaging-view';
import { setFieldVisibilityAction } from '@/app/parametres/actions';

/**
 * ISE-099 — visibilite d'UN champ (D-73, D-74).
 *
 * Les options proposees sont exactement `allowed_levels`, tel que le
 * referentiel `profile_visibility_defaults` le definit. Le formulaire
 * n'invente aucun niveau, et la base refuse de toute facon celui qui n'y
 * figure pas : la regle est appliquee cote serveur, pas cote affichage
 * (CA-SET-01).
 *
 * Le libelle est en clair — « Mes relations », jamais
 * « visibility_level_2 » (regle UX 6, [14 §135]).
 */
export function FieldVisibilityForm({ row }: { row: FieldVisibilityRow }) {
  const [state, formAction, isPending] = useActionState(setFieldVisibilityAction, initialFormState);
  const [level, setLevel] = useState(row.level);
  const controlId = `visibilite-${row.fieldKey}`;

  return (
    <form
      action={formAction}
      className="border-border flex flex-col gap-3 border-b py-4 last:border-b-0 md:flex-row md:items-end md:justify-between md:gap-6"
    >
      <input type="hidden" name="fieldKey" value={row.fieldKey} />
      <input type="hidden" name="label" value={row.label} />

      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={controlId} className="text-body-sm text-text-primary font-medium">
          {row.label}
        </label>
        {row.isDefault ? (
          <span className="text-caption text-text-muted">
            {frSettings.visibility[row.defaultLevel] ?? row.defaultLevel} —{' '}
            {frSettings.privacy.defaultSuffix}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          id={controlId}
          name="visibility"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          options={row.allowedLevels.map((allowed) => ({
            value: allowed,
            label: frSettings.visibility[allowed] ?? allowed,
          }))}
          className="min-w-[220px]"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={isPending}
          loadingLabel={frSettings.saving}
          disabled={level === row.level && state.status === 'idle'}
        >
          {frSettings.save}
        </Button>
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {state.message ?? ''}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message} className="md:col-span-2">
          {frSettings.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}
      {state.status === 'success' && state.message !== null ? (
        <Alert variant="success" title={state.message} className="md:col-span-2" />
      ) : null}
    </form>
  );
}
