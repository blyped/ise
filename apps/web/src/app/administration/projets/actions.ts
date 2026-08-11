'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { frAdmin } from '@/i18n/admin';
import { frAdminProjects } from '@/i18n/admin-projects';
import { ADMIN_ROUTES, adminProjectRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { failure } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { requiredText, text, validationError } from '@/lib/admin/action-support';

/**
 * SA-023 — Creation d'un projet via `admin_create_project` (0094/0095).
 * Toujours cree en brouillon, au nom du profil porteur indique. Erreurs
 * metier traduites par `toAdminError` via le dictionnaire partage
 * `frAdmin.errors` (D-102) : `profile_not_found`, `owner_not_eligible`,
 * `missing_required_field` y ont ete ajoutees pour cette tranche.
 */
export async function createProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['projects.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const ownerProfileId = requiredText(formData, 'ownerProfileId');
  const title = requiredText(formData, 'title');
  const summary = requiredText(formData, 'summary');
  const expectedOutcome = requiredText(formData, 'expectedOutcome');

  if (ownerProfileId.length === 0 || title.length < 3 || summary.length === 0 || expectedOutcome.length === 0) {
    return validationError(frAdminProjects.form.invalid, {
      ownerProfileId: ownerProfileId.length === 0 ? frAdminProjects.form.invalid : '',
      title: title.length < 3 ? frAdminProjects.form.invalid : '',
    });
  }

  const result = await adminRpc(
    'admin_create_project',
    {
      p_owner_profile_id: ownerProfileId,
      p_project_type: requiredText(formData, 'projectType') || 'mission',
      p_title: title,
      p_summary: summary,
      p_expected_outcome: expectedOutcome,
      p_description: text(formData, 'description'),
      p_qualification_criteria: text(formData, 'qualificationCriteria'),
      p_sector_id: null,
      p_compensation_type: requiredText(formData, 'compensationType') || 'to_be_defined',
      p_compensation_statement: text(formData, 'compensationStatement'),
      p_visibility: requiredText(formData, 'visibility') || 'network',
    },
    correlationId,
    (payload) => payload as { id?: unknown } | null,
  );

  if (!result.ok) {
    return failure(result.error.userMessage, correlationId);
  }

  revalidatePath(ADMIN_ROUTES.projects);
  const newId = result.data !== null && typeof result.data === 'object' ? result.data['id'] : null;
  if (typeof newId === 'string') {
    redirect(adminProjectRoute(newId));
  }
  return { status: 'success', message: frAdminProjects.form.created, correlationId: null, fieldErrors: {} };
}
