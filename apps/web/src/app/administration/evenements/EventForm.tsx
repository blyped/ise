'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminEvents } from '@/i18n/admin-events';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../_components/ActionButton';

const EVENT_TYPES = [
  'conference',
  'webinar',
  'workshop',
  'training',
  'afterwork',
  'promotion_meetup',
  'networking',
  'roundtable',
  'panel',
  'working_group',
  'publication_presentation',
  'mentoring_session',
  'sector_meetup',
  'international_event',
  'ensea_event',
  'other',
] as const;

const ORGANIZER_TYPES = ['profile', 'promotion', 'community', 'project', 'platform', 'partner'] as const;
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

/**
 * SA-030 — Creation administrative d'un evenement. Toujours cree en
 * brouillon (`admin_create_event`, 0100) : le lieu (presentiel/hybride)
 * ou le lien en ligne (en ligne/hybride) peuvent etre completes plus
 * tard depuis la fiche, avant la publication (SA-031).
 */
export function EventForm({ action }: { action: AdminAction }) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const [organizerType, setOrganizerType] = useState<string>('profile');
  const [format, setFormat] = useState<string>('online');

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-title`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.title}
        </label>
        <input id={`${base}-title`} name="title" type="text" required minLength={3} className={FIELD} />
        {fieldError('title') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('title')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-slug`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.slug}
        </label>
        <input
          id={`${base}-slug`}
          name="slug"
          type="text"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby={`${base}-slug-aide`}
          className={FIELD}
        />
        <p id={`${base}-slug-aide`} className="text-caption text-text-muted">
          {frAdminEvents.form.slugHelp}
        </p>
        {fieldError('slug') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('slug')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-type`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.eventTypeCode}
        </label>
        <select id={`${base}-type`} name="eventTypeCode" defaultValue="conference" className={FIELD}>
          {EVENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {frAdminEvents.eventType[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-description`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.description}
        </label>
        <textarea id={`${base}-description`} name="description" rows={3} className={TEXTAREA} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-audience`} className="text-body-sm text-text-primary font-medium">
          {frAdminEvents.form.targetAudience}
        </label>
        <input id={`${base}-audience`} name="targetAudience" type="text" className={FIELD} />
      </div>

      <fieldset className="border-border flex flex-col gap-4 rounded-lg border p-4">
        <legend className="text-body-sm text-text-primary px-1 font-semibold">
          {frAdminEvents.form.organizerType}
        </legend>

        <select
          id={`${base}-organizer-type`}
          name="organizerType"
          value={organizerType}
          onChange={(event) => setOrganizerType(event.target.value)}
          className={`${FIELD} w-[220px]`}
        >
          {ORGANIZER_TYPES.map((value) => (
            <option key={value} value={value}>
              {frAdminEvents.organizerType[value]}
            </option>
          ))}
        </select>

        {organizerType === 'profile' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-organizer-profile`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.organizerProfileId}
            </label>
            <input id={`${base}-organizer-profile`} name="organizerProfileId" type="text" className={FIELD} />
          </div>
        ) : null}
        {organizerType === 'promotion' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-organizer-promotion`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.organizerPromotionId}
            </label>
            <input id={`${base}-organizer-promotion`} name="organizerPromotionId" type="number" min={1} className={FIELD} />
          </div>
        ) : null}
        {organizerType === 'community' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-organizer-community`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.organizerCommunityId}
            </label>
            <input id={`${base}-organizer-community`} name="organizerCommunityId" type="text" className={FIELD} />
          </div>
        ) : null}
        {organizerType === 'project' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-organizer-project`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.organizerProjectId}
            </label>
            <input id={`${base}-organizer-project`} name="organizerProjectId" type="text" className={FIELD} />
          </div>
        ) : null}
        {organizerType === 'platform' || organizerType === 'partner' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-organizer-external`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.organizerExternalName}
            </label>
            <input id={`${base}-organizer-external`} name="organizerExternalName" type="text" className={FIELD} />
          </div>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-starts`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.startsAt}
          </label>
          <input id={`${base}-starts`} name="startsAt" type="datetime-local" required className={`${FIELD} w-[240px]`} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-ends`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.endsAt}
          </label>
          <input id={`${base}-ends`} name="endsAt" type="datetime-local" className={`${FIELD} w-[240px]`} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-timezone`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.timezone}
          </label>
          <input
            id={`${base}-timezone`}
            name="timezone"
            type="text"
            required
            defaultValue="Africa/Abidjan"
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
          onChange={(event) => setFormat(event.target.value)}
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
              <input id={`${base}-country`} name="countryCode" type="text" maxLength={2} className={`${FIELD} w-[120px] uppercase`} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${base}-city`} className="text-body-sm text-text-primary font-medium">
                {frAdminEvents.form.city}
              </label>
              <input id={`${base}-city`} name="city" type="text" className={FIELD} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-venue`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.venueName}
            </label>
            <input id={`${base}-venue`} name="venueName" type="text" className={FIELD} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-address`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.address}
            </label>
            <input id={`${base}-address`} name="address" type="text" className={FIELD} />
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
            <input id={`${base}-url`} name="onlineUrlPrivate" type="url" className={FIELD} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-url-visibility`} className="text-body-sm text-text-primary font-medium">
              {frAdminEvents.form.onlineUrlVisibility}
            </label>
            <select id={`${base}-url-visibility`} name="onlineUrlVisibility" defaultValue="registered" className={`${FIELD} w-[220px]`}>
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
          <input id={`${base}-capacity`} name="capacity" type="number" min={1} className={`${FIELD} w-[140px]`} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-reg-policy`} className="text-body-sm text-text-primary font-medium">
            {frAdminEvents.form.registrationPolicy}
          </label>
          <select id={`${base}-reg-policy`} name="registrationPolicy" defaultValue="required" className={`${FIELD} w-[220px]`}>
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
          <select id={`${base}-attendee-vis`} name="attendeeListVisibility" defaultValue="organizer" className={`${FIELD} w-[220px]`}>
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
          <select id={`${base}-visibility`} name="visibility" defaultValue="members" className={`${FIELD} w-[220px]`}>
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
          {frAdminEvents.form.submitCreate}
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
