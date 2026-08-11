'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { frAdminProjects } from '@/i18n/admin-projects';
import { ADMIN_ROUTES, adminProjectRoute } from '@/lib/routes/admin';
import { failure, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { requiredText, runAdminAction, text } from '@/lib/admin/action-support';

/**
 * SA-024 — Transition de statut non terminale via `admin_set_project_status`
 * (0094). Le formulaire n'expose que les cibles autorisees depuis le
 * statut courant (calculees cote page) ; la base revalide de toute
 * facon la transition (`invalid_transition`).
 */
export async function setProjectStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = requiredText(formData, 'projectId');
  const status = requiredText(formData, 'status');

  const state = await runAdminAction(
    ['projects.manage'],
    'admin_set_project_status',
    { p_project_id: projectId, p_status: status },
    frAdminProjects.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminProjectRoute(projectId));
    revalidatePath(ADMIN_ROUTES.projects);
  }
  return state;
}

/**
 * SA-025 — Decision administrative sur une demande de consortium via
 * `admin_review_consortium_request` (0094).
 */
export async function reviewConsortiumRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const requestId = requiredText(formData, 'requestId');
  const projectId = requiredText(formData, 'projectId');
  const status = requiredText(formData, 'status');

  const state = await runAdminAction(
    ['projects.manage'],
    'admin_review_consortium_request',
    { p_request_id: requestId, p_status: status, p_note: null },
    frAdminProjects.detail.done,
  );
  if (state.status === 'success') revalidatePath(adminProjectRoute(projectId));
  return state;
}

function decimal(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === null) return null;
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * SA-026 — Cloture d'un projet via `admin_close_project` (0094/0097/0098) :
 * issue declaree, livrable, attribution au reseau et donnees financieres
 * confidentielles (`private.project_confidential_details`). Cloture
 * definitive : la base refuse toute nouvelle cloture ou transition non
 * terminale une fois le projet dans un statut terminal.
 */
export async function closeProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['projects.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const projectId = requiredText(formData, 'projectId');
  const outcomeStatus = text(formData, 'outcomeStatus');
  const expectedOutcomeAchieved = text(formData, 'expectedOutcomeAchieved');
  if (projectId.length === 0 || outcomeStatus === null || expectedOutcomeAchieved === null) {
    return failure(frAdminProjects.closure.invalid, correlationId, {
      outcomeStatus: outcomeStatus === null ? frAdminProjects.closure.invalid : '',
    });
  }

  const result = await adminRpc(
    'admin_close_project',
    {
      p_project_id: projectId,
      p_outcome_status: outcomeStatus,
      p_expected_outcome_achieved: expectedOutcomeAchieved,
      p_outcome_code: text(formData, 'outcomeCode'),
      p_deliverable_title: text(formData, 'deliverableTitle'),
      p_deliverable_url: text(formData, 'deliverableUrl'),
      p_public_result_sheet_allowed: formData.get('publicResultSheetAllowed') === 'on',
      p_testimonial: text(formData, 'testimonial'),
      p_network_attribution: text(formData, 'networkAttribution'),
      p_collaborators_count: integer(formData, 'collaboratorsCount'),
      p_client_name: text(formData, 'clientName'),
      p_funder_name: text(formData, 'funderName'),
      p_budget_estimate: decimal(formData, 'budgetEstimate'),
      p_budget_currency: text(formData, 'budgetCurrency'),
      p_financial_notes: text(formData, 'financialNotes'),
      p_revenue_generated: decimal(formData, 'revenueGenerated'),
      p_revenue_currency: text(formData, 'revenueCurrency'),
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(adminProjectRoute(projectId));
  revalidatePath(ADMIN_ROUTES.projects);
  return { status: 'success', message: frAdminProjects.closure.done, correlationId: null, fieldErrors: {} };
}
