'use server';

import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NOTIFICATION_ROUTES } from '@/lib/routes/notifications';

/**
 * Ecritures du CENTRE DE NOTIFICATIONS (ISE-098).
 *
 * Il n'existe AUCUNE action de creation : `public.notifications` n'a pas
 * de politique INSERT (0048). Une notification est emise par le serveur,
 * jamais fabriquee par un client — sinon un membre pourrait se forger
 * une alerte, ou en adresser une a un tiers.
 */

export async function setNotificationReadAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const notificationId = formData.get('notificationId');
  const read = formData.get('read') !== 'false';

  if (typeof notificationId !== 'string' || notificationId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_notification_read', {
    p_notification_id: notificationId,
    p_read: read,
  });
  if (error) {
    console.error('[ISE] marquage de notification en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(NOTIFICATION_ROUTES.center);
  return success(read ? 'Notification marquée comme lue.' : 'Notification marquée comme non lue.');
}

export async function markAllNotificationsReadAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('mark_all_notifications_read', {});
  if (error) {
    console.error('[ISE] marquage global en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  const marked = ((data ?? {}) as { marked?: number }).marked ?? 0;
  revalidatePath(NOTIFICATION_ROUTES.center);
  return success(
    marked === 0
      ? 'Aucune notification n’était non lue.'
      : `${marked} notification${marked > 1 ? 's' : ''} marquée${marked > 1 ? 's' : ''} comme lue${marked > 1 ? 's' : ''}.`,
  );
}

export async function archiveReadNotificationsAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('archive_read_notifications', {});
  if (error) {
    console.error('[ISE] archivage de notifications en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  const archived = ((data ?? {}) as { archived?: number }).archived ?? 0;
  revalidatePath(NOTIFICATION_ROUTES.center);
  return success(
    archived === 0
      ? 'Aucune notification lue à archiver.'
      : `${archived} notification${archived > 1 ? 's' : ''} archivée${archived > 1 ? 's' : ''}.`,
  );
}
