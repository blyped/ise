'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../_components/ActionButton';

export interface PromotionFormDefaults {
  promotionId: number | null;
  name: string;
  graduationYear: number | null;
  description: string;
  estimatedSize: number | null;
  status: string;
}

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-008 — Creation / edition d'une promotion. L'annee n'est pas
 * modifiable apres creation : elle identifie la promotion (unicite par
 * annee, verifiee en base — `promotion_already_exists`).
 */
export function PromotionForm({
  action,
  defaults,
}: {
  action: AdminAction;
  defaults: PromotionFormDefaults;
}) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const isEdit = defaults.promotionId !== null;

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[560px] flex-col gap-5">
      {isEdit ? (
        <input type="hidden" name="promotionId" value={String(defaults.promotionId)} />
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-nom`} className="text-body-sm text-text-primary font-medium">
          {frAdmin.promotions.form.name}
        </label>
        <input
          id={`${base}-nom`}
          name="name"
          type="text"
          required
          minLength={3}
          defaultValue={defaults.name}
          placeholder={frAdmin.promotions.form.namePlaceholder}
          aria-describedby={fieldError('name') !== null ? `${base}-nom-erreur` : undefined}
          className={FIELD}
        />
        {fieldError('name') !== null ? (
          <p id={`${base}-nom-erreur`} role="alert" className="text-caption text-error">
            {fieldError('name')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-annee`} className="text-body-sm text-text-primary font-medium">
          {frAdmin.promotions.form.year}
        </label>
        <input
          id={`${base}-annee`}
          name="year"
          type="number"
          required
          min={1960}
          max={2100}
          defaultValue={defaults.graduationYear ?? ''}
          readOnly={isEdit}
          aria-describedby={`${base}-annee-aide`}
          className={`${FIELD} ${isEdit ? 'bg-surface-muted text-text-muted' : ''}`}
        />
        <p id={`${base}-annee-aide`} className="text-caption text-text-muted">
          {frAdmin.promotions.form.yearHelp}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${base}-description`}
          className="text-body-sm text-text-primary font-medium"
        >
          {frAdmin.promotions.form.description}
        </label>
        <textarea
          id={`${base}-description`}
          name="description"
          rows={3}
          defaultValue={defaults.description}
          className="rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${base}-effectif`}
            className="text-body-sm text-text-primary font-medium"
          >
            {frAdmin.promotions.form.estimatedSize}
          </label>
          <input
            id={`${base}-effectif`}
            name="estimatedSize"
            type="number"
            min={1}
            max={10000}
            defaultValue={defaults.estimatedSize ?? ''}
            className={`${FIELD} w-[160px]`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-statut`} className="text-body-sm text-text-primary font-medium">
            {frAdmin.promotions.form.statusLabel}
          </label>
          <select
            id={`${base}-statut`}
            name="status"
            defaultValue={defaults.status}
            className={`${FIELD} w-[180px]`}
          >
            <option value="active">{frAdmin.promotions.status['active']}</option>
            <option value="archived">{frAdmin.promotions.status['archived']}</option>
          </select>
        </div>
      </div>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {isEdit ? frAdmin.promotions.form.submitEdit : frAdmin.promotions.form.submitCreate}
        </Button>
      </div>

      {state.status !== 'idle' && state.message !== null ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-body-sm ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </p>
      ) : null}
    </form>
  );
}
