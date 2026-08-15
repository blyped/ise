'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { frAdmin } from '@/i18n/admin';
import { frAnnouncements } from '@/i18n/announcements';
import { ADMIN_ROUTES, adminAnnouncementRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { failure } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { requiredText, runAdminAction, text, validationError } from '@/lib/admin/action-support';

const PERMISSION = 'communication.announcements.manage' as const;

/** Edition du contenu via `admin_update_dashboard_announcement` (0145). */
export async function updateAnnouncementAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny([PERMISSION])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const announcementId = requiredText(formData, 'announcementId');
  const body = requiredText(formData, 'body');
  const severity = requiredText(formData, 'severity') || 'normal';
  const startsAt = text(formData, 'startsAt');
  const endsAt = text(formData, 'endsAt');

  if (announcementId.length === 0 || body.length === 0) {
    return validationError(frAnnouncements.admin.form.invalid, { body: frAnnouncements.admin.form.invalid });
  }
  if (startsAt !== null && endsAt !== null && endsAt <= startsAt) {
    return validationError(frAnnouncements.admin.form.invalidWindow, {
      window: frAnnouncements.admin.form.invalidWindow,
    });
  }

  const result = await adminRpc(
    'admin_update_dashboard_announcement',
    {
      p_id: announcementId,
      p_body: body,
      p_severity: severity,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(adminAnnouncementRoute(announcementId));
  revalidatePath(ADMIN_ROUTES.announcements);
  return {
    status: 'success',
    message: frAnnouncements.admin.form.updated,
    correlationId: null,
    fieldErrors: {},
  };
}

/** Publie ou depublie une annonce via `admin_set_dashboard_announcement_published`. */
export async function setAnnouncementPublishedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const announcementId = requiredText(formData, 'announcementId');
  const published = requiredText(formData, 'published') === 'true';

  const state = await runAdminAction(
    [PERMISSION],
    'admin_set_dashboard_announcement_published',
    { p_id: announcementId, p_published: published },
    frAnnouncements.admin.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminAnnouncementRoute(announcementId));
    revalidatePath(ADMIN_ROUTES.announcements);
  }
  return state;
}

/** Suppression douce via `admin_delete_dashboard_announcement`. Redirige vers la liste. */
export async function deleteAnnouncementAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny([PERMISSION])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const announcementId = requiredText(formData, 'announcementId');
  if (announcementId.length === 0) {
    return failure(frAdmin.common.errorTitle, correlationId);
  }

  const result = await adminRpc(
    'admin_delete_dashboard_announcement',
    { p_id: announcementId },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(ADMIN_ROUTES.announcements);
  redirect(ADMIN_ROUTES.announcements);
}
