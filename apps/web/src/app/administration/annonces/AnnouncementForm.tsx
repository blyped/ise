'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAnnouncements } from '@/i18n/announcements';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../_components/ActionButton';

export const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

export const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue min-h-[140px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

const SEVERITIES = ['normal', 'urgent'] as const;

export interface AnnouncementFormDefaults {
  body?: string;
  severity?: 'normal' | 'urgent';
  startsAt?: string;
  endsAt?: string;
}

/**
 * Formulaire commun de creation/edition d'une annonce (0145, tache #188).
 * Toujours cree en brouillon : la publication est une action separee sur
 * la fiche, meme principe que `NewsForm`/`EventForm`.
 */
export function AnnouncementForm({
  action,
  submitLabel,
  defaults,
  hiddenFields,
}: {
  action: AdminAction;
  submitLabel: string;
  defaults?: AnnouncementFormDefaults;
  /** Champs caches supplementaires (ex. l'identifiant en edition). */
  hiddenFields?: Readonly<Record<string, string>>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[720px] flex-col gap-5">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-body`} className="text-body-sm text-text-primary font-medium">
          {frAnnouncements.admin.form.bodyLabel}
        </label>
        <textarea
          id={`${base}-body`}
          name="body"
          required
          maxLength={2000}
          placeholder={frAnnouncements.admin.form.bodyPlaceholder}
          defaultValue={defaults?.body ?? ''}
          aria-describedby={`${base}-body-aide`}
          className={TEXTAREA}
        />
        <p id={`${base}-body-aide`} className="text-caption text-text-muted">
          {frAnnouncements.admin.form.bodyHint}
        </p>
        {fieldError('body') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('body')}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm text-text-primary font-medium">
          {frAnnouncements.admin.form.severityLegend}
        </legend>
        <div className="flex flex-wrap gap-4">
          {SEVERITIES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-body-sm text-text-primary">
              <input
                type="radio"
                name="severity"
                value={value}
                defaultChecked={(defaults?.severity ?? 'normal') === value}
              />
              {frAnnouncements.admin.severity[value]}
            </label>
          ))}
        </div>
        <p className="text-caption text-text-muted">{frAnnouncements.admin.form.severityHint}</p>
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-starts`} className="text-body-sm text-text-primary font-medium">
            {frAnnouncements.admin.form.startsAtLabel}
          </label>
          <input
            id={`${base}-starts`}
            name="startsAt"
            type="datetime-local"
            defaultValue={defaults?.startsAt ?? ''}
            className={FIELD}
          />
          <p className="text-caption text-text-muted">{frAnnouncements.admin.form.startsAtHint}</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-ends`} className="text-body-sm text-text-primary font-medium">
            {frAnnouncements.admin.form.endsAtLabel}
          </label>
          <input
            id={`${base}-ends`}
            name="endsAt"
            type="datetime-local"
            defaultValue={defaults?.endsAt ?? ''}
            className={FIELD}
          />
          <p className="text-caption text-text-muted">{frAnnouncements.admin.form.endsAtHint}</p>
        </div>
      </div>
      {fieldError('window') !== null ? (
        <p role="alert" className="text-caption text-error">
          {fieldError('window')}
        </p>
      ) : null}

      <div>
        <Button type="submit" loading={isPending} loadingLabel="Enregistrement…">
          {submitLabel}
        </Button>
      </div>

      {state.status !== 'idle' && state.message !== null ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-caption ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </p>
      ) : null}
    </form>
  );
}
