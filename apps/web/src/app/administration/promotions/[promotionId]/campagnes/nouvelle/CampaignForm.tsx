'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminCampaigns } from '@/i18n/admin-campaigns';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../../../../_components/ActionButton';

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-012 -- Formulaire de creation d'une campagne. Modele sur
 * `PromotionForm.tsx` (memes conventions : useActionState, useId,
 * `Button` avec `loading`/`loadingLabel`). La planification
 * (`startsAt`/`endsAt`) n'est pas exposee ici : elle reste facultative
 * cote API et le premier lancement de lot fixe de fait le debut reel.
 */
export function CampaignForm({
  action,
  promotionId,
}: {
  action: AdminAction;
  promotionId: number;
}) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[560px] flex-col gap-5">
      <input type="hidden" name="promotionId" value={String(promotionId)} />

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-nom`} className="text-body-sm text-text-primary font-medium">
          {frAdminCampaigns.create.name}
        </label>
        <input
          id={`${base}-nom`}
          name="name"
          type="text"
          required
          minLength={3}
          placeholder={frAdminCampaigns.create.namePlaceholder}
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
        <label htmlFor={`${base}-objectif`} className="text-body-sm text-text-primary font-medium">
          {frAdminCampaigns.create.objective}
        </label>
        <textarea
          id={`${base}-objectif`}
          name="objective"
          rows={3}
          className="rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-canal`} className="text-body-sm text-text-primary font-medium">
          {frAdminCampaigns.create.channel}
        </label>
        <select id={`${base}-canal`} name="channel" defaultValue="email" className={`${FIELD} w-[220px]`}>
          <option value="email">{frAdminCampaigns.list.channel['email']}</option>
          <option value="in_app">{frAdminCampaigns.list.channel['in_app']}</option>
        </select>
        <p className="text-caption text-text-muted">{frAdminCampaigns.create.channelHelp}</p>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-quota-jour`} className="text-body-sm text-text-primary font-medium">
            {frAdminCampaigns.create.dailyQuota}
          </label>
          <input
            id={`${base}-quota-jour`}
            name="dailyQuota"
            type="number"
            min={1}
            max={200}
            required
            defaultValue={20}
            aria-describedby={`${base}-quota-jour-aide`}
            className={`${FIELD} w-[160px]`}
          />
          <p id={`${base}-quota-jour-aide`} className="text-caption text-text-muted">
            {frAdminCampaigns.create.dailyQuotaHelp}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-quota-total`} className="text-body-sm text-text-primary font-medium">
            {frAdminCampaigns.create.totalQuota}
          </label>
          <input
            id={`${base}-quota-total`}
            name="totalQuota"
            type="number"
            min={1}
            aria-describedby={`${base}-quota-total-aide`}
            className={`${FIELD} w-[160px]`}
          />
          <p id={`${base}-quota-total-aide`} className="text-caption text-text-muted">
            {frAdminCampaigns.create.totalQuotaHelp}
          </p>
        </div>
      </div>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Création…">
          {frAdminCampaigns.create.submit}
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
