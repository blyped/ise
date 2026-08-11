'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { frAdminEvents } from '@/i18n/admin-events';
import { ADMIN_ROUTES, adminEventRoute } from '@/lib/routes/admin';
import { failure, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { integer, requiredText, runAdminAction, text } from '@/lib/admin/action-support';

/**
 * SA-031 — Edition du contenu et de la logistique d'un evenement via
 * `admin_update_event` (0100). Le type d'evenement et le slug ne sont
 * pas editables ici (immuables apres creation, comme pour une
 * communaute) : seuls le contenu, l'organisateur et la logistique le
 * sont.
 */
export async function updateEventAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['events.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const eventId = requiredText(formData, 'eventId');
  const title = requiredText(formData, 'title');
  if (eventId.length === 0 || title.length < 3) {
    return failure(frAdminEvents.form.invalid, correlationId, {
      title: title.length < 3 ? frAdminEvents.form.invalid : '',
    });
  }

  const organizerType = text(formData, 'organizerType');

  const result = await adminRpc(
    'admin_update_event',
    {
      p_event_id: eventId,
      p_title: title,
      p_description: text(formData, 'description'),
      p_target_audience: text(formData, 'targetAudience'),
      p_organizer_type: organizerType,
      p_organizer_profile_id: text(formData, 'organizerProfileId'),
      p_organizer_promotion_id: integer(formData, 'organizerPromotionId'),
      p_organizer_community_id: text(formData, 'organizerCommunityId'),
      p_organizer_project_id: text(formData, 'organizerProjectId'),
      p_organizer_external_name: text(formData, 'organizerExternalName'),
      p_format: text(formData, 'format'),
      p_country_code: text(formData, 'countryCode')?.toUpperCase() ?? null,
      p_city: text(formData, 'city'),
      p_venue_name: text(formData, 'venueName'),
      p_address: text(formData, 'address'),
      p_online_url_private: text(formData, 'onlineUrlPrivate'),
      p_online_url_visibility: text(formData, 'onlineUrlVisibility'),
      p_starts_at: text(formData, 'startsAt'),
      p_ends_at: text(formData, 'endsAt'),
      p_timezone: text(formData, 'timezone'),
      p_capacity: integer(formData, 'capacity'),
      p_registration_policy: text(formData, 'registrationPolicy'),
      p_attendee_list_visibility: text(formData, 'attendeeListVisibility'),
      p_visibility: text(formData, 'visibility'),
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(adminEventRoute(eventId));
  revalidatePath(ADMIN_ROUTES.events);
  return { status: 'success', message: frAdminEvents.form.edited, correlationId: null, fieldErrors: {} };
}

/**
 * SA-031 — Transition de cycle de vie via `admin_set_event_status`
 * (0100) : draft/pending_review/published/full/completed/archived.
 * L'annulation ('cancelled') passe par `cancelEventAction`, qui exige
 * un motif.
 */
export async function setEventStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');
  const status = requiredText(formData, 'status');

  const state = await runAdminAction(
    ['events.manage'],
    'admin_set_event_status',
    { p_event_id: eventId, p_status: status, p_cancellation_reason: null },
    frAdminEvents.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminEventRoute(eventId));
    revalidatePath(ADMIN_ROUTES.events);
  }
  return state;
}

/**
 * SA-031 — Annulation d'un evenement via `admin_set_event_status`
 * (0100, p_status = 'cancelled'). Motif obligatoire (>= 5 caracteres,
 * revalide en base).
 */
export async function cancelEventAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');
  const reason = requiredText(formData, 'reason');

  const state = await runAdminAction(
    ['events.manage'],
    'admin_set_event_status',
    { p_event_id: eventId, p_status: 'cancelled', p_cancellation_reason: reason },
    frAdminEvents.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminEventRoute(eventId));
    revalidatePath(ADMIN_ROUTES.events);
  }
  return state;
}

/**
 * SA-032 — Constate la presence, l'absence ou l'annulation d'une
 * inscription via `admin_set_event_registration_status` (0100). D-55 :
 * la presence se constate, elle n'est jamais auto-declaree par le
 * participant.
 */
export async function setRegistrationStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');
  const profileId = requiredText(formData, 'profileId');
  const status = requiredText(formData, 'status');

  const state = await runAdminAction(
    ['events.manage'],
    'admin_set_event_registration_status',
    { p_event_id: eventId, p_profile_id: profileId, p_status: status },
    frAdminEvents.detail.registrationDone,
  );
  if (state.status === 'success') revalidatePath(adminEventRoute(eventId));
  return state;
}

/**
 * SA-033 — Redaction et publication du bilan organisateur via
 * `admin_upsert_event_followup` (0100).
 */
export async function upsertEventFollowupAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');

  const state = await runAdminAction(
    ['events.manage'],
    'admin_upsert_event_followup',
    {
      p_event_id: eventId,
      p_summary: text(formData, 'summary'),
      p_conclusions: text(formData, 'conclusions'),
      p_decisions: text(formData, 'decisions'),
      p_next_steps: text(formData, 'nextSteps'),
      p_replay_url: text(formData, 'replayUrl'),
      p_publish: formData.get('publish') === 'on',
    },
    frAdminEvents.detail.followupDone,
  );
  if (state.status === 'success') revalidatePath(adminEventRoute(eventId));
  return state;
}

/**
 * SA-033 — Capture un instantane d'impact via
 * `admin_record_event_impact_snapshot` (0100) : aucune valeur saisie a
 * la main, tout est recalcule en base (MASTER PROMPT §98).
 */
export async function recordEventImpactSnapshotAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');

  const state = await runAdminAction(
    ['events.manage'],
    'admin_record_event_impact_snapshot',
    { p_event_id: eventId },
    frAdminEvents.detail.done,
  );
  if (state.status === 'success') revalidatePath(adminEventRoute(eventId));
  return state;
}
