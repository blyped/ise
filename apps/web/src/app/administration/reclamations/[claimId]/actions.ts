'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminClaimRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction } from '@/lib/admin/action-support';

/**
 * Server Actions de la revue d'une reclamation (SA-006).
 *
 * L'approbation et le rejet passent par les fonctions ATOMIQUES
 * existantes (`approve_profile_claim` / `reject_profile_claim`, 0029) :
 * verrou de ligne, machine d'etats, rattachement compte <-> profil et
 * journalisation vivent dans la base, pas ici.
 */

function revalidateClaim(claimId: string): void {
  revalidatePath(adminClaimRoute(claimId));
  revalidatePath(ADMIN_ROUTES.claims);
}

export async function startClaimReviewAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const claimId = requiredText(formData, 'claimId');

  const state = await runAdminAction(
    ['profiles.verify'],
    'admin_start_claim_review',
    { p_claim_id: claimId },
    frAdmin.claims.detail.startReviewDone,
  );
  if (state.status === 'success') revalidateClaim(claimId);
  return state;
}

export async function approveClaimAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const claimId = requiredText(formData, 'claimId');

  const state = await runAdminAction(
    ['profiles.verify'],
    'approve_profile_claim',
    { p_claim_id: claimId },
    frAdmin.claims.detail.approveDone,
  );
  if (state.status === 'success') revalidateClaim(claimId);
  return state;
}

export async function rejectClaimAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const claimId = requiredText(formData, 'claimId');
  const reason = requiredText(formData, 'reason');

  const state = await runAdminAction(
    ['profiles.verify'],
    'reject_profile_claim',
    { p_claim_id: claimId, p_reason: reason },
    frAdmin.claims.detail.rejectDone,
  );
  if (state.status === 'success') revalidateClaim(claimId);
  return state;
}
