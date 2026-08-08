'use client';

import { useActionState, useState } from 'react';
import { Alert, Badge, Button, Select } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { initialFormState } from '@/lib/form-state';
import type { NotificationPreferenceRow } from '@/lib/messaging-view';
import { setNotificationPreferenceAction } from '@/app/parametres/actions';

const EMAIL_MODES = ['immediate', 'daily_digest', 'weekly_digest', 'off'] as const;

/**
 * ISE-099 — preference pour UN type de notification (D-80).
 *
 * Le catalogue borde les canaux : un type dont `is_push_allowed` est
 * faux n'affiche AUCUN interrupteur push — pas un interrupteur grise
 * qu'on pourrait croire activable. De meme pour l'e-mail. Et un type non
 * configurable (securite du compte, annulation d'evenement) n'affiche
 * aucun controle du tout, avec la raison ecrite.
 */
export function NotificationPreferenceForm({ row }: { row: NotificationPreferenceRow }) {
  const [state, formAction, isPending] = useActionState(
    setNotificationPreferenceAction,
    initialFormState,
  );
  const [inApp, setInApp] = useState(row.inApp);
  const [emailMode, setEmailMode] = useState(row.emailMode);
  const [push, setPush] = useState(row.push);
  const base = `pref-${row.typeCode}`;

  if (!row.configurable) {
    return (
      <div className="border-border flex flex-col gap-2 border-b py-4 last:border-b-0">
        <p className="text-body-sm text-text-primary font-medium">{row.label}</p>
        <Badge tone="neutral">{frSettings.notifications.notConfigurable}</Badge>
        <p className="text-caption text-text-muted">
          {frSettings.notifications.notConfigurableHint}
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="border-border flex flex-col gap-4 border-b py-4 last:border-b-0"
    >
      <input type="hidden" name="typeCode" value={row.typeCode} />
      <input type="hidden" name="inApp" value={inApp ? 'true' : 'false'} />
      <input type="hidden" name="push" value={push ? 'true' : 'false'} />

      <div className="flex flex-col gap-1">
        <p className="text-body-sm text-text-primary font-medium">{row.label}</p>
        {row.description !== null ? (
          <p className="text-caption text-text-muted">{row.description}</p>
        ) : null}
        {row.isDefault ? (
          <p className="text-caption text-text-muted">{frSettings.notifications.isDefault}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex items-center gap-3">
          <input
            id={`${base}-inapp`}
            type="checkbox"
            checked={inApp}
            onChange={(event) => setInApp(event.target.checked)}
            className="focus-visible:outline-active-blue h-5 w-5 rounded border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <label htmlFor={`${base}-inapp`} className="text-body-sm text-text-primary">
            {frSettings.notifications.inApp}
          </label>
        </div>

        {row.emailAllowed ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-email`} className="text-caption text-text-muted">
              {frSettings.notifications.email}
            </label>
            <Select
              id={`${base}-email`}
              name="emailMode"
              value={emailMode}
              onChange={(event) => setEmailMode(event.target.value)}
              options={EMAIL_MODES.map((mode) => ({
                value: mode,
                label: frSettings.notifications.emailModes[mode] ?? mode,
              }))}
            />
          </div>
        ) : (
          <p className="text-caption text-text-muted">{frSettings.notifications.emailNotAllowed}</p>
        )}

        {row.pushAllowed ? (
          <div className="flex items-center gap-3">
            <input
              id={`${base}-push`}
              type="checkbox"
              checked={push}
              onChange={(event) => setPush(event.target.checked)}
              className="focus-visible:outline-active-blue h-5 w-5 rounded border-[#CBD5E1] focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <label htmlFor={`${base}-push`} className="text-body-sm text-text-primary">
              {frSettings.notifications.push}
            </label>
          </div>
        ) : (
          <p className="text-caption text-text-muted">{frSettings.notifications.pushNotAllowed}</p>
        )}

        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          {frSettings.save}
        </Button>
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {state.message ?? ''}
      </p>
      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frSettings.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}
    </form>
  );
}
