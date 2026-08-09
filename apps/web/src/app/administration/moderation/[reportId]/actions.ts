'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminReportRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction, text } from '@/lib/admin/action-support';

/**
 * SA-018 / SA-039 — Decisions sur un signalement.
 *
 * `transition_report` est la SEULE voie de changement d'etat (un trigger
 * en base refuse tout UPDATE direct de `status`) ; les actions a effet
 * reel (avertir, suspendre, lever, escalader) passent par
 * `admin_record_moderation_action`. Tout est journalise en base.
 */

function revalidateReport(reportId: string): void {
  revalidatePath(adminReportRoute(reportId));
  revalidatePath(ADMIN_ROUTES.moderation);
}

export async function transitionReportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const reportId = requiredText(formData, 'reportId');
  const toStatus = requiredText(formData, 'toStatus');
  const resolutionCode = text(formData, 'resolutionCode');
  const note = text(formData, 'reason');

  const state = await runAdminAction(
    ['profiles.moderate'],
    'transition_report',
    {
      p_report_id: reportId,
      p_to_status: toStatus,
      p_resolution_code: resolutionCode,
      p_note: note,
    },
    toStatus === 'reviewing'
      ? frAdmin.moderation.detail.startReviewDone
      : frAdmin.moderation.detail.done,
  );
  if (state.status === 'success') revalidateReport(reportId);
  return state;
}

export async function recordModerationActionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const reportId = requiredText(formData, 'reportId');
  const actionType = requiredText(formData, 'actionType');
  const reason = requiredText(formData, 'reason');

  const state = await runAdminAction(
    ['profiles.moderate'],
    'admin_record_moderation_action',
    {
      p_action_type: actionType,
      p_reason: reason,
      p_report_id: reportId,
      p_target_profile_id: null,
    },
    frAdmin.moderation.detail.done,
  );
  if (state.status === 'success') revalidateReport(reportId);
  return state;
}
