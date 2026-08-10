'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminDedup } from '@/i18n/admin-dedup';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../../_components/ActionButton';

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

function Field({
  id,
  name,
  label,
  help,
  type = 'text',
  required = false,
  placeholder,
  maxLength,
}: {
  id: string;
  name: string;
  label: string;
  help?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body-sm text-text-primary font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className={FIELD}
      />
      {help !== undefined ? <p className="text-caption text-text-muted">{help}</p> : null}
    </div>
  );
}

/**
 * SA-007 — Formulaire de creation, meme convention que `PromotionForm`
 * (`useActionState` + `initialFormState`, HTML natif, aucun JS requis
 * pour la soumission de base).
 */
export function CreateProfileForm({ action }: { action: AdminAction }) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();

  return (
    <form action={formAction} className="flex max-w-[720px] flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field id={`${base}-prenom`} name="firstName" label={frAdminDedup.create.firstName} required />
        <Field id={`${base}-nom`} name="lastName" label={frAdminDedup.create.lastName} required />
        <Field id={`${base}-autres-prenoms`} name="middleNames" label={frAdminDedup.create.middleNames} />
        <Field
          id={`${base}-promotion`}
          name="promotionId"
          type="number"
          label={frAdminDedup.create.promotion}
          help={frAdminDedup.create.promotionHelp}
        />
        <Field id={`${base}-poste`} name="currentPosition" label={frAdminDedup.create.position} />
        <Field id={`${base}-organisation`} name="currentOrganizationRaw" label={frAdminDedup.create.organization} />
        <Field id={`${base}-pays`} name="currentCountryCode" label={frAdminDedup.create.country} placeholder="CI" maxLength={2} />
        <Field id={`${base}-ville`} name="currentCity" label={frAdminDedup.create.city} />
        <Field id={`${base}-email`} name="primaryEmail" type="email" label={frAdminDedup.create.primaryEmail} />
        <Field id={`${base}-email2`} name="secondaryEmail" type="email" label={frAdminDedup.create.secondaryEmail} />
        <Field id={`${base}-tel`} name="phoneE164" label={frAdminDedup.create.phone} placeholder="+225..." />
        <Field id={`${base}-tel2`} name="secondaryPhoneE164" label={frAdminDedup.create.secondaryPhone} placeholder="+225..." />
      </div>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Création…">
          {frAdminDedup.create.submit}
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
