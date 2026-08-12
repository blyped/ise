'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { frAdmin } from '@/i18n/admin';
import { frAdminNews } from '@/i18n/admin-news';
import { ADMIN_ROUTES, adminNewsRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { failure } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { integer, requiredText, text, validationError } from '@/lib/admin/action-support';

/**
 * Redaction administrative des actualites (0110, tache #83) — creation
 * via `admin_create_news`. Toujours creee en brouillon : la publication
 * est une action separee sur la fiche (0110, `admin_set_news_status`).
 *
 * Frontiere D-128 : cette action n'ecrit jamais
 * `landing_visibility`/`landing_priority`/`is_featured` — ces trois
 * champs restent exclusivement pilotes par `/cms/actualites`, une fois
 * l'article publie ici.
 */
export async function createNewsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['content.publish'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const categoryCode = requiredText(formData, 'categoryCode');
  const title = requiredText(formData, 'title');
  const slug = requiredText(formData, 'slug');
  const summary = requiredText(formData, 'summary');

  if (title.length < 3 || slug.length === 0 || categoryCode.length === 0 || summary.length === 0) {
    return validationError(frAdminNews.form.invalid, {
      title: title.length < 3 ? frAdminNews.form.invalid : '',
      slug: slug.length === 0 ? frAdminNews.form.invalid : '',
      summary: summary.length === 0 ? frAdminNews.form.invalid : '',
    });
  }

  const result = await adminRpc(
    'admin_create_news',
    {
      p_category_code: categoryCode,
      p_title: title,
      p_slug: slug,
      p_summary: summary,
      p_body: text(formData, 'body'),
      p_event_date: text(formData, 'eventDate'),
      p_image_path: text(formData, 'imagePath'),
      p_source_type: text(formData, 'sourceType'),
      p_source_url: text(formData, 'sourceUrl'),
      p_visibility: requiredText(formData, 'visibility') || 'members',
      p_promotion_id: integer(formData, 'promotionId'),
      p_community_id: text(formData, 'communityId'),
    },
    correlationId,
    (payload) => payload as { id?: unknown } | null,
  );

  if (!result.ok) {
    return failure(result.error.userMessage, correlationId);
  }

  revalidatePath(ADMIN_ROUTES.news);
  const newId = result.data !== null && typeof result.data === 'object' ? result.data['id'] : null;
  if (typeof newId === 'string') {
    redirect(adminNewsRoute(newId));
  }
  return { status: 'success', message: frAdminNews.form.created, correlationId: null, fieldErrors: {} };
}
