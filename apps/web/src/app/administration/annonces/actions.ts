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
import { requiredText, text, validationError } from '@/lib/admin/action-support';

const PERMISSION = 'communication.announcements.manage' as const;

/**
 * Creation d'une annonce (0145, tache #188) via `admin_create_dashboard_announcement`.
 * Toujours creee en brouillon : la publication est une action separee
 * sur la fiche (`admin_set_dashboard_announcement_published`).
 */
export async function createAnnouncementAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny([PERMISSION])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const body = requiredText(formData, 'body');
  const severity = requiredText(formData, 'severity') || 'normal';
  const startsAt = text(formData, 'startsAt');
  const endsAt = text(formData, 'endsAt');

  if (body.length === 0) {
    return validationError(frAnnouncements.admin.form.invalid, { body: frAnnouncements.admin.form.invalid });
  }
  if (startsAt !== null && endsAt !== null && endsAt <= startsAt) {
    return validationError(frAnnouncements.admin.form.invalidWindow, {
      window: frAnnouncements.admin.form.invalidWindow,
    });
  }

  const result = await adminRpc(
    'admin_create_dashboard_announcement',
    {
      p_body: body,
      p_severity: severity,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    },
    correlationId,
    (payload) => payload as { id?: unknown } | null,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(ADMIN_ROUTES.announcements);
  const newId = result.data !== null && typeof result.data === 'object' ? result.data['id'] : null;
  if (typeof newId === 'string') {
    redirect(adminAnnouncementRoute(newId));
  }
  return {
    status: 'success',
    message: frAnnouncements.admin.form.created,
    correlationId: null,
    fieldErrors: {},
  };
}
