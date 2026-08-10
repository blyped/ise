'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminOpportunityRoute } from '@/lib/routes/admin';
import { failure, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
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

const HIRING_OUTCOME_TYPES = [
  'ise_hired',
  'mission_awarded',
  'intern_selected',
  'multiple_selected',
] as const;

/**
 * SA-022 — Cloture d'une opportunite et declaration de son resultat, via
 * la fonction atomique existante `close_opportunity` (0008) : le meme
 * chemin que l'auteur (ISE-061), la base autorisant deja l'auteur OU
 * `opportunities.manage`. Aucun faux impact : hors recrutement, la base
 * impose `hires_count = 0` et `attribution_level = 'unknown'` (contrainte
 * `opportunity_outcomes_no_false_impact`) ; l'ecran envoie donc
 * exactement cela plutot que de laisser croire le contraire.
 */
export async function closeOpportunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['opportunities.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? 'Action non autorisee.', correlationId);
  }

  const opportunityId = requiredText(formData, 'opportunityId');
  const outcomeType = text(formData, 'outcomeType');
  if (opportunityId.length === 0) {
    return failure('Opportunite introuvable.', correlationId);
  }
  if (outcomeType === null) {
    return failure('Indiquez le resultat de cette offre.', correlationId, {
      outcomeType: 'Ce choix est necessaire pour cloturer.',
    });
  }

  const beneficiaryIds = formData
    .getAll('beneficiaryIds')
    .flatMap((value) => (typeof value === 'string' && value.length > 0 ? [value] : []));
  const hiring = (HIRING_OUTCOME_TYPES as readonly string[]).includes(outcomeType);
  const facilitated = hiring && formData.get('facilitated') === 'on';

  const result = await adminRpc(
    'close_opportunity',
    {
      p_opportunity_id: opportunityId,
      p_outcome_type: outcomeType,
      p_hires_count: hiring ? Math.max(beneficiaryIds.length, 1) : 0,
      p_facilitated: facilitated,
      p_attribution_level: facilitated ? (text(formData, 'attributionLevel') ?? 'partial') : 'unknown',
      p_notes: text(formData, 'notes'),
      p_beneficiary_ids: hiring ? beneficiaryIds : [],
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(adminOpportunityRoute(opportunityId));
  redirect(`${adminOpportunityRoute(opportunityId)}/cloture?cloture=1`);
}
