'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminCallRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction } from '@/lib/admin/action-support';

/**
 * SA-017 — Decision de moderation motivee sur un appel au reseau, via
 * `moderate_network_call` (0077) : permission `calls.moderate`, motif
 * >= 10 caracteres, action tracee dans `moderation_actions` ET
 * journalisee dans `private.audit_log`.
 */
export async function moderateCallAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const callId = requiredText(formData, 'callId');
  const decision = requiredText(formData, 'decision');
  const reason = requiredText(formData, 'reason');

  const state = await runAdminAction(
    ['calls.moderate'],
    'moderate_network_call',
    { p_call_id: callId, p_decision: decision, p_reason: reason },
    frAdmin.calls.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminCallRoute(callId));
    revalidatePath(ADMIN_ROUTES.calls);
  }
  return state;
}
