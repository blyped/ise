'use server';

import { revalidatePath } from 'next/cache';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { checkAdminDataPermission } from '@/lib/admin-data/permissions';
import { adminErrorMessage } from '@/lib/admin-data/errors';
import { adminRpc } from '@/lib/admin-data/rpc';
import { importDetailRoute, importDuplicatesRoute } from '@/lib/routes/admin-data';

/**
 * SA-042 — Revue humaine des doublons. Ces actions sont la SEULE voie de
 * bascule d'un candidat : la contrainte `duplicate_candidates_human_review`
 * (0017) exige un réviseur identifié, et `admin_decide_import_row` (0080)
 * refuse une fusion sans candidat confirmé. Aucune fusion automatique.
 */

const t = frAdminData.imports.duplicates;

function refresh(batchId: string): void {
  revalidatePath(importDuplicatesRoute(batchId));
  revalidatePath(importDetailRoute(batchId));
}

export async function reviewCandidateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('imports.review');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const batchId = String(formData.get('batchId') ?? '');
  const candidateId = String(formData.get('candidateId') ?? '');
  const status = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim() || null;

  if (batchId === '' || candidateId === '') {
    return failure(frAdminData.common.loadError, correlationId);
  }
  if (!['confirmed_duplicate', 'not_duplicate', 'deferred'].includes(status)) {
    return failure(frAdminData.common.loadError, correlationId);
  }

  const result = await adminRpc(
    'admin_review_duplicate_candidate',
    {
      p_candidate_id: candidateId,
      p_status: status,
      p_note: note,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh(batchId);
  return success(t.statusLabel[status] ?? status);
}

export async function decideRowAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('imports.review');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const batchId = String(formData.get('batchId') ?? '');
  const rowIdRaw = String(formData.get('rowId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const matchedProfileId = String(formData.get('matchedProfileId') ?? '') || null;

  const rowId = Number.parseInt(rowIdRaw, 10);
  if (batchId === '' || Number.isNaN(rowId)) {
    return failure(frAdminData.common.loadError, correlationId);
  }
  if (!['create_new', 'merge', 'ignore', 'review_later'].includes(decision)) {
    return failure(frAdminData.common.loadError, correlationId);
  }

  const result = await adminRpc(
    'admin_decide_import_row',
    {
      p_row_id: rowId,
      p_decision: decision,
      p_matched_profile_id: matchedProfileId,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh(batchId);
  return success(frAdminData.imports.detail.decision[decision] ?? decision);
}
