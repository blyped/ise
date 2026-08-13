'use client';

import { useActionState, useId, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@ise/ui-web';
import { frAdminNews } from '@/i18n/admin-news';
import { initialFormState } from '@/lib/form-state';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { NewsDetail } from '@/lib/content-view';
import { FIELD, TEXTAREA } from '../NewsForm';
import { updateNewsAction } from './actions';

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

/**
 * Redaction administrative — edition du contenu (0110, permission
 * content.publish).
 *
 * PORTEE VOLONTAIREMENT LIMITEE AU CONTENU : `NewsDetail` (`content-view.ts`)
 * ne projette que les LIBELLES resolus de la promotion/communaute
 * associee, jamais leurs identifiants bruts — aucun champ ne permet donc
 * de les preremplir surement. Reproposer une visibilite « promotion » ou
 * « communaute » sans l'identifiant reel risquerait d'ecraser le
 * rattachement existant (`admin_update_news` prend `p_promotion_id`/
 * `p_community_id` tels quels des que `p_visibility` est fourni). Ce
 * formulaire omet donc `visibility` : la portee (tous les membres /
 * promotion / communaute) se regle a la creation et reste stable ensuite.
 */
export function NewsEditForm({ news }: { news: NewsDetail }) {
  const [state, formAction, isPending] = useActionState(updateNewsAction, initialFormState);
  const base = useId();
  const [sourceType, setSourceType] = useState<string>(news.sourceType ?? '');

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[720px] flex-col gap-5">
      <input type="hidden" name="newsId" value={news.newsId} />

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-category`} className="text-body-sm text-text-primary font-medium">
          {frAdminNews.form.category}
        </label>
        <select id={`${base}-category`} name="categoryCode" defaultValue={news.categoryCode} className={FIELD}>
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
        <input
          id={`${base}-title`}
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={240}
          defaultValue={news.title}
          className={FIELD}
        />
        {fieldError('title') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('title')}
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
          defaultValue={news.summary}
          className={TEXTAREA}
        />
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
        <textarea id={`${base}-body`} name="body" rows={10} defaultValue={news.body ?? ''} className={TEXTAREA} />
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-event-date`} className="text-body-sm text-text-primary font-medium">
            {frAdminNews.form.eventDate}
          </label>
          <input
            id={`${base}-event-date`}
            name="eventDate"
            type="date"
            defaultValue={news.eventDate ?? ''}
            className={`${FIELD} w-[200px]`}
          />
        </div>

      </div>

      <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
        <p className="text-body-sm text-text-primary font-medium">{frAdminNews.form.coverTitle}</p>
        <p className="text-caption text-text-secondary">
          {news.cover !== null ? frAdminNews.form.coverDefined : frAdminNews.form.coverUndefined}
        </p>
        <Link
          href={CMS_ROUTES.news}
          className="text-body-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] w-fit items-center gap-2 font-medium"
        >
          <ArrowLeftRight size={16} aria-hidden="true" />
          {frAdminNews.form.coverManage}
        </Link>
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
            <input
              id={`${base}-source-url`}
              name="sourceUrl"
              type="url"
              defaultValue={news.sourceUrl ?? ''}
              className={FIELD}
            />
          </div>
        ) : null}
      </fieldset>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminNews.form.submitEdit}
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
