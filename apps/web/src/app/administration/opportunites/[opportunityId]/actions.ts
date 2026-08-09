'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminOpportunityRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction, text } from '@/lib/admin/action-support';

/**
 * SA-020 — Decision de validation d'une opportunite via la fonction
 * atomique existante `moderate_opportunity` (0056, remplacee en 0077
 * pour exiger un motif au rejet et journaliser dans private.audit_log).
 */
export async function moderateOpportunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const opportunityId = requiredText(formData, 'opportunityId');
  const decision = requiredText(formData, 'decision');
  const note = text(formData, 'reason');

  const state = await runAdminAction(
    ['opportunities.manage'],
    'moderate_opportunity',
    { p_opportunity_id: opportunityId, p_decision: decision, p_note: note },
    frAdmin.opportunities.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminOpportunityRoute(opportunityId));
    revalidatePath(ADMIN_ROUTES.opportunities);
  }
  return state;
}
