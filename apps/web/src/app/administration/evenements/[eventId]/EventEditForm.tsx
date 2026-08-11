'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminEvents } from '@/i18n/admin-events';
import { initialFormState } from '@/lib/form-state';
import type { EventDetail } from '@/lib/content-view';
import { updateEventAction } from './actions';

const FORMATS = ['online', 'in_person', 'hybrid'] as const;
const REGISTRATION_POLICIES = ['required', 'optional', 'none', 'approval_required'] as const;
const ATTENDEE_LIST_VISIBILITIES = ['organizer', 'registered', 'members'] as const;
const ONLINE_URL_VISIBILITIES = ['registered', 'all_viewers'] as const;
const VISIBILITIES = ['members', 'promotion', 'community', 'selected_members', 'invitation_only'] as const;

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue ' +
  'min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

/** ISO -> valeur `datetime-local` (troncature a la minute, meme convention que la saisie de creation). */
function toLocalInput(value: string | null): string {
  if (value === null || value.length < 16) return '';
  return value.slice(0, 16);
}

/**
 * SA-031 — Edition du contenu et de la logistique. Le type d'evenement,
 * le slug et l'ORGANISATEUR ne sont pas editables ici (immuables apres
 * creation, comme le type/slug d'une communaute dans `CommunityEditForm`) :
 * `admin_update_event` (0100) preserve l'organisateur existant tant que
 * `organizerType` n'est pas transmis. Le lien de connexion prive est
 * prerempli via `loadAdminEventOnlineUrl` (page serveur) : il n'est
 * jamais projete par `get_event`/`toEventDetail` (D-150).
 */
export function EventEditForm({ event, onlineUrl }: { event: EventDetail; onlineUrl: string | null }) {
  const [state, formAction, isPending] = useActionState(updateEventAction, initialFormState);
  const base = useId();
  const [format, setFormat] = useState<string>(event.format);

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-5">
      <input type="hidden" name="eventId" value={event.eventId} />

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-title`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.title}
        </label>
        <input
          id={`${base}-title`}
          name="title"
          type="text"
          required
          minLength={3}
          defaultValue={event.title}
          className={FIELD}
        />
        {fieldError('title') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('title')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-description`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.description}
        </label>
        <textarea
          id={`${base}-description`}
          name="description"
          rows={3}
          defaultValue={event.description ?? ''}
          className={TEXTAREA}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-audience`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.targetAudience}
        </label>
        <input
          id={`${base}-audience`}
          name="targetAudience"
          type="text"
          defaultValue={event.targetAudience ?? ''}
          className={FIELD}
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-starts`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.startsAt}
          </label>
          <input
            id={`${base}-starts`}
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event.startsAt)}
            className={`${FIELD} w-[240px]`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-ends`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.endsAt}
          </label>
          <input
            id={`${base}-ends`}
            name="endsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event.endsAt)}
            className={`${FIELD} w-[240px]`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-timezone`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.timezone}
          </label>
          <input
            id={`${base}-timezone`}
            name="timezone"
            type="text"
            defaultValue={event.timezone}
            aria-describedby={`${base}-timezone-aide`}
            className={`${FIELD} w-[200px]`}
          />
          <p id={`${base}-timezone-aide`} className="text-caption text-text-muted">
            {frAdminEvents.form.timezoneHelp}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-format`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.format}
        </label>
        <select
          id={`${base}-format`}
          name="format"
          value={format}
          onChange={(event_) => setFormat(event_.target.value)}
          className={`${FIELD} w-[200px]`}
        >
          {FORMATS.map((value) => (
            <option key={value} value={value}>
              {frAdminEvents.format[value]}
            </option>
          ))}
        </select>
      </div>

      {format !== 'online' ? (
        <fieldset className="border-border flex flex-col gap-4 rounded-lg border p-4">
          <legend className="text-body-sm text-text-primary px-1 font-semibold">
            {frAdminEvents.form.venueName}
          </legend>
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${base}-country`} className="text-body-sm text-text-primary font-medium">
                {frAdminEvents.form.countryCode}
              </label>
              <input
                id={`${base}-country`}
                name="countryCode"
                type="text"
                maxLength={2}
                defaultValue={event.countryCode ?? ''}
                className={`${FIELD} w-[120px] uppercase`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${base}-city`} className="text-body-sm text-text-primary font-medium">
                {frAdminEvents.form.city}
              </label>
              <input id={`${base}-city`} name="city" type="text" defaultValue={event.city ?? ''} className={FIELD} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-venue`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.venueName}
            </label>
            <input
              id={`${base}-venue`}
              name="venueName"
              type="text"
              defaultValue={event.venueName ?? ''}
              className={FIELD}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-address`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.address}
            </label>
            <input
              id={`${base}-address`}
              name="address"
              type="text"
              defaultValue={event.address ?? ''}
              className={FIELD}
            />
          </div>
        </fieldset>
      ) : null}

      {format !== 'in_person' ? (
        <fieldset className="border-border flex flex-col gap-4 rounded-lg border p-4">
          <legend className="text-body-sm text-text-primary px-1 font-semibold">
            {frAdminEvents.form.onlineUrlPrivate}
          </legend>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-url`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.onlineUrlPrivate}
            </label>
            <input
              id={`${base}-url`}
              name="onlineUrlPrivate"
              type="url"
              defaultValue={onlineUrl ?? ''}
              className={FIELD}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-url-visibility`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.onlineUrlVisibility}
            </label>
            <select
              id={`${base}-url-visibility`}
              name="onlineUrlVisibility"
              defaultValue={event.onlineUrlVisibility}
              className={`${FIELD} w-[220px]`}
            >
              {ONLINE_URL_VISIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {frAdminEvents.onlineUrlVisibility[value]}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-capacity`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.capacity}
          </label>
          <input
            id={`${base}-capacity`}
            name="capacity"
            type="number"
            min={1}
            defaultValue={event.capacity ?? ''}
            className={`${FIELD} w-[140px]`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-reg-policy`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.registrationPolicy}
          </label>
          <select
            id={`${base}-reg-policy`}
            name="registrationPolicy"
            defaultValue={event.registrationPolicy}
            className={`${FIELD} w-[220px]`}
          >
            {REGISTRATION_POLICIES.map((value) => (
              <option key={value} value={value}>
                {frAdminEvents.registrationPolicy[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-attendee-vis`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.attendeeListVisibility}
          </label>
          <select
            id={`${base}-attendee-vis`}
            name="attendeeListVisibility"
            defaultValue={event.attendeeListVisibility}
            className={`${FIELD} w-[220px]`}
          >
            {ATTENDEE_LIST_VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {frAdminEvents.attendeeListVisibility[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-visibility`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.visibility}
          </label>
          <select
            id={`${base}-visibility`}
            name="visibility"
            defaultValue={event.visibility}
            className={`${FIELD} w-[220px]`}
          >
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {frAdminEvents.visibility[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminEvents.form.submitEdit}
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
