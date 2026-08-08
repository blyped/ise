'use server';

import { revalidatePath } from 'next/cache';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { failure, success, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsPermission } from '@/lib/cms/permissions';
import { loadCarouselItems, loadSections } from '@/lib/cms/queries';
import { publishCmsContent } from '@/lib/cms/mutations';
import { revalidateLandingCache } from '@/lib/cms/revalidate';

/**
 * « Publier les changements » depuis l'apercu (CMS-010).
 *
 * UNE TRANSITION SERVEUR PAR ELEMENT. Il n'existe pas de fonction de
 * publication en lot, et on n'en fabrique pas ici : chaque appel a
 * `publish_cms_content()` verifie `cms.publish`, verrouille sa ligne, fige
 * son instantane et journalise. Une boucle preserve ces garanties ; un
 * `UPDATE ... WHERE status = 'draft'` les perdrait toutes.
 *
 * Le compte rendu est HONNETE : il dit combien d'elements ont ete publies
 * ET combien ont echoue. Aucun echec n'est avale.
 */
export async function publishDraftsAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await requireCmsPermission('cms.publish');
  if (access === null) return failure(frCms.common.forbidden, correlationId);

  const [sections, carousel] = await Promise.all([
    loadSections(correlationId),
    loadCarouselItems(null, correlationId),
  ]);
  if (!sections.ok) return failure(sections.error.userMessage, correlationId);
  if (!carousel.ok) return failure(carousel.error.userMessage, correlationId);

  const targets: { type: 'cms_section' | 'cms_carousel_item'; id: string }[] = [
    ...sections.data
      .filter((section) => section.status !== 'published' || section.hasUnpublishedChanges)
      .map((section) => ({ type: 'cms_section' as const, id: section.id })),
    ...carousel.data
      .filter(
        (item) =>
          item.status === 'draft' || (item.status === 'published' && item.hasUnpublishedChanges),
      )
      .map((item) => ({ type: 'cms_carousel_item' as const, id: item.id })),
  ];

  if (targets.length === 0) return success(frCms.preview.nothingToPublish);

  let published = 0;
  const failures: string[] = [];
  for (const target of targets) {
    const result = await publishCmsContent(target.type, target.id, correlationId);
    if (result.ok) published += 1;
    else failures.push(result.error.userMessage);
  }

  revalidatePath(CMS_ROUTES.preview);
  revalidatePath(CMS_ROUTES.sections);
  revalidatePath(CMS_ROUTES.carousel);

  if (published === 0) {
    return failure(failures[0] ?? frCms.common.forbidden, correlationId);
  }

  const outcome = await revalidateLandingCache(correlationId);
  const base = frCms.preview.publishAllDone(published);
  const cacheNote = outcome.revalidated ? '' : ` ${frCms.common.publishedNoCache}`;
  const failureNote =
    failures.length === 0 ? '' : ` ${failures.length} élément(s) refusé(s) par la base.`;

  return success(`${base}${cacheNote}${failureNote}`);
}
