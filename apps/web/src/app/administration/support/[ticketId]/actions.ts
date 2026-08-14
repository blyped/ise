'use server';

import { revalidatePath } from 'next/cache';
import { frAdminSupport } from '@/i18n/admin-support';
import { ADMIN_ROUTES, adminTicketRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction, text, validationError } from '@/lib/admin/action-support';

/**
 * SA-038 / SA-039 — Server Actions du cockpit des remontees.
 *
 * Les transitions passent EXCLUSIVEMENT par la fonction atomique
 * `transition_support_ticket` (0016, refondue en 0076 puis en 0131 pour
 * les six statuts) : un trigger refuse tout UPDATE direct de `status`.
 *
 * La priorite passe par `admin_set_support_ticket_urgency` (0131), qui
 * enregistre QUI l'a changee (`urgency_source = 'agent'`) — c'est
 * exactement ce que D-85 impose : l'urgence n'est pas choisie par le
 * demandeur, elle est attribuee et cette attribution est tracee.
 */

const URGENCIES = ['low', 'standard', 'high', 'critical'];
const STATUSES = ['acknowledged', 'in_progress', 'waiting_user', 'resolved', 'closed'];

function revalidateTicket(ticketId: string): void {
  revalidatePath(adminTicketRoute(ticketId));
  revalidatePath(ADMIN_ROUTES.support);
}

export async function replyTicketAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const ticketId = requiredText(formData, 'ticketId');
  const body = requiredText(formData, 'body');
  const isInternal = formData.get('isInternal') === 'on';

  const state = await runAdminAction(
    ['support.manage'],
    'admin_reply_support_ticket',
    { p_ticket_id: ticketId, p_body: body, p_is_internal: isInternal },
    frAdminSupport.detail.sent,
  );
  if (state.status === 'success') revalidateTicket(ticketId);
  return state;
}

export async function assignTicketToMeAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const ticketId = requiredText(formData, 'ticketId');

  const state = await runAdminAction(
    ['support.manage'],
    'admin_assign_support_ticket',
    { p_ticket_id: ticketId, p_agent_profile_id: null },
    frAdminSupport.detail.assigned,
  );
  if (state.status === 'success') revalidateTicket(ticketId);
  return state;
}

export async function transitionTicketAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const ticketId = requiredText(formData, 'ticketId');
  const toStatus = requiredText(formData, 'toStatus');

  // Le formulaire ne propose que des transitions REELLEMENT possibles,
  // mais la Server Action ne fait pas confiance au formulaire : la base
  // refuserait de toute facon, autant le dire en francais.
  if (!STATUSES.includes(toStatus)) {
    return validationError(frAdminSupport.detail.transitionInvalid);
  }

  const state = await runAdminAction(
    ['support.manage'],
    'transition_support_ticket',
    { p_ticket_id: ticketId, p_to_status: toStatus },
    frAdminSupport.detail.transitionDone,
  );
  if (state.status === 'success') revalidateTicket(ticketId);
  return state;
}

/** SA-039 — requalification de la priorite par l'administration (D-85). */
export async function setTicketUrgencyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const ticketId = requiredText(formData, 'ticketId');
  const urgency = requiredText(formData, 'urgency');
  const reason = text(formData, 'reason');

  if (!URGENCIES.includes(urgency)) {
    return validationError(frAdminSupport.detail.urgencyInvalid, {
      urgency: frAdminSupport.detail.urgencyInvalid,
    });
  }

  const state = await runAdminAction(
    ['support.manage'],
    'admin_set_support_ticket_urgency',
    { p_ticket_id: ticketId, p_urgency: urgency, p_reason: reason },
    frAdminSupport.detail.urgencyDone,
  );
  if (state.status === 'success') revalidateTicket(ticketId);
  return state;
}
