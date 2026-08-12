'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminNews } from '@/i18n/admin-news';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../_components/ActionButton';

const CATEGORIES = [
  'network_life',
  'ise_spotlight',
  'appointment',
  'new_position',
  'distinction',
  'publication',
  'entrepreneurship',
  'project',
  'research',
  'international',
  'major_mission',
  'career_path',
  'network_achievement',
  'promotion_life',
  'community_life',
  'event_report',
  'other',
] as const;

const SOURCE_TYPES = [
  'internal',
  'linkedin_public',
  'organization_site',
  'media_article',
  'scientific_publication',
  'institutional_site',
  'other',
] as const;

const VISIBILITIES = ['members', 'promotion', 'community'] as const;

export const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

export const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue ' +
  'min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Redaction administrative — creation d'un article (0110, tache #83).
 * Toujours cree en brouillon (`admin_create_news`) : la publication
 * editoriale est une action separee sur la fiche, et l'exposition sur
 * la landing (visible / mis en avant) reste ensuite le role exclusif
 * de `/cms/actualites` (D-128) — jamais reglee ici.
 */
export function NewsForm({ action }: { action: AdminAction }) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();
  const [sourceType, setSourceType] = useState<string>('');
  const [visibility, setVisibility] = useState<string>('members');

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[720px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-category`} className="text-body-sm text-text-primary font-medium">
          {frAdminNews.form.category}
        </label>
        <select id={`${base}-category`} name="categoryCode" defaultValue="network_life" className={FIELD}>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {frAdminNews.category[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-title`} className="text-body-sm text-text-primary font-medium">
          {frAdminNews.form.title}
        </label>
        <input id={`${base}-title`} name="title" type="text" required minLength={3} maxLength={240} className={FIELD} />
        {fieldError('title') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('title')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-slug`} className="text-body-sm text-text-primary font-medium">
          {frAdminNews.form.slug}
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
          {frAdminNews.form.slugHelp}
        </p>
        {fieldError('slug') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('slug')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-summary`} className="text-body-sm text-text-primary font-medium">
          {frAdminNews.form.summary}
        </label>
        <textarea
          id={`${base}-summary`}
          name="summary"
          rows={2}
          required
          maxLength={400}
          aria-describedby={`${base}-summary-aide`}
          className={TEXTAREA}
        />
        <p id={`${base}-summary-aide`} className="text-caption text-text-muted">
          {frAdminNews.form.summaryHelp}
        </p>
        {fieldError('summary') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('summary')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-body`} className="text-body-sm text-text-primary font-medium">
          {frAdminNews.form.body}
        </label>
        <textarea id={`${base}-body`} name="body" rows={10} className={TEXTAREA} />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-event-date`} className="text-body-sm text-text-primary font-medium">
            {frAdminNews.form.eventDate}
          </label>
          <input id={`${base}-event-date`} name="eventDate" type="date" className={`${FIELD} w-[200px]`} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-image`} className="text-body-sm text-text-primary font-medium">
            {frAdminNews.form.imagePath}
          </label>
          <input
            id={`${base}-image`}
            name="imagePath"
            type="text"
            aria-describedby={`${base}-image-aide`}
            className={`${FIELD} w-[320px]`}
          />
          <p id={`${base}-image-aide`} className="text-caption text-text-muted">
            {frAdminNews.form.imagePathHelp}
          </p>
        </div>
      </div>

      <fieldset className="border-border flex flex-col gap-4 rounded-lg border p-4">
        <legend className="text-body-sm text-text-primary px-1 font-semibold">
          {frAdminNews.form.sourceType}
        </legend>
        <select
          id={`${base}-source-type`}
          name="sourceType"
          value={sourceType}
          onChange={(event) => setSourceType(event.target.value)}
          className={`${FIELD} w-[260px]`}
        >
          <option value="">—</option>
          {SOURCE_TYPES.map((value) => (
            <option key={value} value={value}>
              {frAdminNews.sourceType[value]}
            </option>
          ))}
        </select>
        {sourceType !== '' && sourceType !== 'internal' && sourceType !== 'other' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-source-url`} className="text-body-sm text-text-primary font-medium">
              {frAdminNews.form.sourceUrl}
            </label>
            <input id={`${base}-source-url`} name="sourceUrl" type="url" className={FIELD} />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="border-border flex flex-col gap-4 rounded-lg border p-4">
        <legend className="text-body-sm text-text-primary px-1 font-semibold">
          {frAdminNews.form.visibility}
        </legend>
        <select
          id={`${base}-visibility`}
          name="visibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          className={`${FIELD} w-[220px]`}
        >
          {VISIBILITIES.map((value) => (
            <option key={value} value={value}>
              {frAdminNews.visibility[value]}
            </option>
          ))}
        </select>
        {visibility === 'promotion' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-promotion`} className="text-body-sm text-text-primary font-medium">
              {frAdminNews.form.promotionId}
            </label>
            <input id={`${base}-promotion`} name="promotionId" type="number" min={1} className={`${FIELD} w-[160px]`} />
          </div>
        ) : null}
        {visibility === 'community' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${base}-community`} className="text-body-sm text-text-primary font-medium">
              {frAdminNews.form.communityId}
            </label>
            <input id={`${base}-community`} name="communityId" type="text" className={FIELD} />
          </div>
        ) : null}
      </fieldset>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminNews.form.submitCreate}
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
