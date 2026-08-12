'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { frAdminNews } from '@/i18n/admin-news';
import { ADMIN_ROUTES, adminNewsRoute } from '@/lib/routes/admin';
import { failure, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { integer, requiredText, runAdminAction, text } from '@/lib/admin/action-support';

/**
 * Redaction administrative — edition du contenu via `admin_update_news`
 * (0110). La categorie et le resume restent obligatoires ; le slug
 * n'est pas editable ici (immuable apres creation, meme convention que
 * les autres tranches admin).
 */
export async function updateNewsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['content.publish'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const newsId = requiredText(formData, 'newsId');
  const categoryCode = requiredText(formData, 'categoryCode');
  const title = requiredText(formData, 'title');
  const summary = requiredText(formData, 'summary');
  if (newsId.length === 0 || title.length < 3 || summary.length === 0) {
    return failure(frAdminNews.form.invalid, correlationId, {
      title: title.length < 3 ? frAdminNews.form.invalid : '',
      summary: summary.length === 0 ? frAdminNews.form.invalid : '',
    });
  }

  const result = await adminRpc(
    'admin_update_news',
    {
      p_news_id: newsId,
      p_category_code: categoryCode,
      p_title: title,
      p_summary: summary,
      p_body: text(formData, 'body'),
      p_event_date: text(formData, 'eventDate'),
      p_image_path: text(formData, 'imagePath'),
      p_source_type: text(formData, 'sourceType'),
      p_source_url: text(formData, 'sourceUrl'),
      p_visibility: text(formData, 'visibility'),
      p_promotion_id: integer(formData, 'promotionId'),
      p_community_id: text(formData, 'communityId'),
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(adminNewsRoute(newsId));
  revalidatePath(ADMIN_ROUTES.news);
  return { status: 'success', message: frAdminNews.form.edited, correlationId: null, fieldErrors: {} };
}

/**
 * Cycle editorial via `admin_set_news_status` (0110) : brouillon / publie
 * / archive uniquement — jamais l'exposition sur la landing (D-128).
 */
export async function setNewsStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const newsId = requiredText(formData, 'newsId');
  const status = requiredText(formData, 'status');

  const state = await runAdminAction(
    ['content.publish'],
    'admin_set_news_status',
    { p_news_id: newsId, p_status: status },
    frAdminNews.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminNewsRoute(newsId));
    revalidatePath(ADMIN_ROUTES.news);
  }
  return state;
}
