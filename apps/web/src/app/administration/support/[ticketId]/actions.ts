'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminTicketRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction } from '@/lib/admin/action-support';

/**
 * SA-038 / SA-039 — Server Actions du ticket support.
 *
 * Les transitions passent EXCLUSIVEMENT par la fonction atomique
 * `transition_support_ticket` (0016, remplacee en 0076 pour journaliser
 * et notifier) : un trigger refuse tout UPDATE direct de `status`.
 */

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
    frAdmin.support.detail.sent,
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
    frAdmin.support.detail.assigned,
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

  const state = await runAdminAction(
    ['support.manage'],
    'transition_support_ticket',
    { p_ticket_id: ticketId, p_to_status: toStatus },
    frAdmin.support.detail.transitionDone,
  );
  if (state.status === 'success') revalidateTicket(ticketId);
  return state;
}
