'use server';

import { revalidatePath } from 'next/cache';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { FormState } from '@/lib/form-state';
import {
  checkbox,
  integer,
  requiredText,
  runCmsAction,
  runCmsPublishAction,
  text,
  timestamp,
} from '@/lib/cms/action-support';
import {
  createScheduleOrder,
  setLandingExposure,
  setNewsCoverMedia,
  setNewsFeatured,
} from '@/lib/cms/mutations';

/**
 * Server Actions des actualites (CMS-004, ADDENDUM §34).
 *
 * FRONTIERE ASSUMEE (D-128) : ces actions ne touchent QUE l'exposition sur
 * la landing. Elles ne modifient jamais `news.editorial_status`, ni le
 * corps de l'article, ni sa visibilite dans le reseau. Le circuit
 * editorial du module Actualites (permission `content.publish`, workflow
 * de revue) reste seul maitre de la publication interne. Confondre les
 * deux permettrait de publier un article non relu en programmant une date.
 *
 * Aucune table n'est creee : `news` est reutilisee telle quelle (§34).
 */

export async function setNewsLandingVisibilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const newsId = requiredText(formData, 'newsId');
  const visible = requiredText(formData, 'visible') === 'true';

  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) =>
      setLandingExposure('news', newsId, visible ? 'visible' : 'hidden', null, correlationId),
    visible ? frCms.common.published : frCms.common.unpublished,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.news);
  return state;
}

export async function setNewsFeaturedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const newsId = requiredText(formData, 'newsId');
  const featured = requiredText(formData, 'featured') === 'true';

  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) => setNewsFeatured(newsId, featured, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.news);
  return state;
}

/**
 * 0117 — visuel de couverture, choisi dans la mediatheque publique
 * (comme evenements/opportunites). Ne touche pas `cover_has_text` : le
 * reglage existant est preserve (`set_news_cover_media` avec
 * `p_has_text = null`), pour que ce formulaire reste EXACTEMENT celui
 * reutilise tel quel sur /cms/evenements et /cms/opportunites.
 */
export async function setNewsCoverMediaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const newsId = requiredText(formData, 'newsId');
  const mediaId = text(formData, 'mediaId');

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) => setNewsCoverMedia(newsId, mediaId, null, correlationId),
    frCms.news.coverDone,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.news);
  return state;
}

/**
 * 0117 — bascule `cover_has_text`, a cote du selecteur de visuel. Le
 * visuel courant est transmis tel quel (champ cache `mediaId`, prerempli
 * par la ligne du tableau) : cette action ne modifie jamais la
 * couverture elle-meme, uniquement le reglage « texte deja incruste ».
 */
export async function setNewsCoverHasTextAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const newsId = requiredText(formData, 'newsId');
  const mediaId = text(formData, 'mediaId');
  const hasText = checkbox(formData, 'hasText');

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) => setNewsCoverMedia(newsId, mediaId, hasText, correlationId),
    frCms.news.coverDone,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.news);
  return state;
}

/** Priorite editoriale : simple ordonnancement, `cms.edit` suffit. */
export async function setNewsPriorityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const newsId = requiredText(formData, 'newsId');
  const priority = integer(formData, 'priority', 0);
  if (priority < 0 || priority > 1000) {
    return {
      status: 'error',
      message: 'La priorité doit être comprise entre 0 et 1000.',
      correlationId: null,
      fieldErrors: { priority: 'Entre 0 et 1000.' },
    };
  }

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) => setLandingExposure('news', newsId, null, priority, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.news);
  return state;
}

/**
 * Programmation de l'exposition (§34). L'ordre est traite par
 * `private.publish_scheduled_cms_content()` : a `publish_at` il bascule
 * `landing_visibility` a `visible`, a `unpublish_at` il la remet a
 * `hidden`. Rien d'autre (D-128).
 */
export async function scheduleNewsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const newsId = requiredText(formData, 'newsId');
  const publishAt = timestamp(formData, 'publishAt');
  const unpublishAt = timestamp(formData, 'unpublishAt');

  if (publishAt === null && unpublishAt === null) {
    return {
      status: 'error',
      message: 'Indiquez au moins une date de publication ou de dépublication.',
      correlationId: null,
      fieldErrors: { publishAt: frCms.common.requiredField },
    };
  }
  if (
    publishAt !== null &&
    unpublishAt !== null &&
    Date.parse(unpublishAt) <= Date.parse(publishAt)
  ) {
    return {
      status: 'error',
      message: 'La date de fin doit suivre la date de début.',
      correlationId: null,
      fieldErrors: { unpublishAt: 'La fin doit suivre le début.' },
    };
  }

  const state = await runCmsAction(
    'cms.schedule',
    (correlationId) => createScheduleOrder('news', newsId, publishAt, unpublishAt, correlationId),
    frCms.schedule.created,
  );
  if (state.status === 'success') {
    revalidatePath(CMS_ROUTES.news);
    revalidatePath(CMS_ROUTES.schedule);
  }
  return state;
}
