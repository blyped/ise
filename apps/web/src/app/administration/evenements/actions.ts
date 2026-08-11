'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { frAdmin } from '@/i18n/admin';
import { frAdminEvents } from '@/i18n/admin-events';
import { ADMIN_ROUTES, adminEventRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { failure } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { integer, requiredText, text, validationError } from '@/lib/admin/action-support';

/**
 * SA-030 — Creation d'un evenement via `admin_create_event` (0100).
 * Toujours cree en brouillon : la publication (SA-031) est une action
 * separee sur la fiche, une fois le lieu ou le lien en ligne renseignes.
 * Erreurs metier traduites par `toAdminError` via le dictionnaire
 * partage `frAdmin.errors` (D-102) : les codes propres a cette tranche
 * (`event_missing_required_field`, `invalid_event_type`,
 * `event_organizer_target_required`, `event_dates_invalid`…) y ont ete
 * ajoutes.
 */
export async function createEventAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['events.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const title = requiredText(formData, 'title');
  const slug = requiredText(formData, 'slug');
  const eventTypeCode = requiredText(formData, 'eventTypeCode');
  const startsAt = requiredText(formData, 'startsAt');
  const timezone = requiredText(formData, 'timezone');
  const organizerType = requiredText(formData, 'organizerType') || 'profile';

  if (title.length < 3 || slug.length === 0 || eventTypeCode.length === 0 || startsAt.length === 0) {
    return validationError(frAdminEvents.form.invalid, {
      title: title.length < 3 ? frAdminEvents.form.invalid : '',
      slug: slug.length === 0 ? frAdminEvents.form.invalid : '',
    });
  }

  const result = await adminRpc(
    'admin_create_event',
    {
      p_event_type_code: eventTypeCode,
      p_title: title,
      p_slug: slug,
      p_starts_at: startsAt,
      p_timezone: timezone,
      p_organizer_type: organizerType,
      p_organizer_profile_id: text(formData, 'organizerProfileId'),
      p_organizer_promotion_id: integer(formData, 'organizerPromotionId'),
      p_organizer_community_id: text(formData, 'organizerCommunityId'),
      p_organizer_project_id: text(formData, 'organizerProjectId'),
      p_organizer_external_name: text(formData, 'organizerExternalName'),
      p_description: text(formData, 'description'),
      p_target_audience: text(formData, 'targetAudience'),
      p_format: requiredText(formData, 'format') || 'online',
      p_country_code: text(formData, 'countryCode')?.toUpperCase() ?? null,
      p_city: text(formData, 'city'),
      p_venue_name: text(formData, 'venueName'),
      p_address: text(formData, 'address'),
      p_online_url_private: text(formData, 'onlineUrlPrivate'),
      p_online_url_visibility: requiredText(formData, 'onlineUrlVisibility') || 'registered',
      p_ends_at: text(formData, 'endsAt'),
      p_capacity: integer(formData, 'capacity'),
      p_registration_policy: requiredText(formData, 'registrationPolicy') || 'required',
      p_attendee_list_visibility: requiredText(formData, 'attendeeListVisibility') || 'organizer',
      p_visibility: requiredText(formData, 'visibility') || 'members',
    },
    correlationId,
    (payload) => payload as { id?: unknown } | null,
  );

  if (!result.ok) {
    return failure(result.error.userMessage, correlationId);
  }

  revalidatePath(ADMIN_ROUTES.events);
  const newId = result.data !== null && typeof result.data === 'object' ? result.data['id'] : null;
  if (typeof newId === 'string') {
    redirect(adminEventRoute(newId));
  }
  return { status: 'success', message: frAdminEvents.form.created, correlationId: null, fieldErrors: {} };
}
