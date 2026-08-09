'use server';

import { revalidatePath } from 'next/cache';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { checkAdminDataPermission } from '@/lib/admin-data/permissions';
import { adminErrorMessage } from '@/lib/admin-data/errors';
import { adminRpc } from '@/lib/admin-data/rpc';
import { isImportTargetField, isImportTransform } from '@/lib/admin-data/mapping';
import { importDetailRoute, importDuplicatesRoute } from '@/lib/routes/admin-data';

/**
 * Server Actions du détail d'un lot (SA-041). Chaque action appelle la
 * fonction SQL de l'étape correspondante (0080) : c'est la base qui
 * détient la machine d'états du §37 — ces actions ne la contournent
 * jamais, elles la déclenchent.
 */

function refresh(batchId: string): void {
  revalidatePath(importDetailRoute(batchId));
  revalidatePath(importDuplicatesRoute(batchId));
}

const t = frAdminData.imports.detail;

export async function saveMappingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('imports.execute');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const batchId = String(formData.get('batchId') ?? '');
  const columnsRaw = formData.getAll('sourceColumn').map(String);
  if (batchId === '' || columnsRaw.length === 0) {
    return failure(frAdminData.common.loadError, correlationId);
  }

  const mappings = columnsRaw.map((sourceColumn, index) => {
    const target = String(formData.get(`target:${sourceColumn}`) ?? '');
    const transform = String(formData.get(`transform:${sourceColumn}`) ?? 'none');
    const ignored = target === '__ignore__' || target === '';
    return {
      source_column: sourceColumn,
      source_position: index + 1,
      target_field: !ignored && isImportTargetField(target) ? target : null,
      transform: isImportTransform(transform) ? transform : 'none',
      is_ignored: ignored,
    };
  });

  const result = await adminRpc(
    'admin_set_import_mapping',
    { p_batch_id: batchId, p_mappings: mappings, p_correlation_id: correlationId },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh(batchId);
  return success(t.mappingSave);
}

async function runStep(
  rpcName: string,
  batchId: string,
  successMessage: string,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('imports.execute');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);
  if (batchId === '') return failure(frAdminData.common.loadError, correlationId);

  const result = await adminRpc(
    rpcName,
    { p_batch_id: batchId, p_correlation_id: correlationId },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh(batchId);
  return success(successMessage);
}

export async function runValidationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runStep(
    'admin_validate_import_batch',
    String(formData.get('batchId') ?? ''),
    t.runValidation,
  );
}

export async function runNormalizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runStep(
    'admin_normalize_import_batch',
    String(formData.get('batchId') ?? ''),
    t.runNormalization,
  );
}

export async function runDuplicateDetectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runStep(
    'admin_detect_import_duplicates',
    String(formData.get('batchId') ?? ''),
    t.runDuplicates,
  );
}

export async function executeImportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runStep('admin_execute_import_batch', String(formData.get('batchId') ?? ''), t.runImport);
}

export async function cancelBatchAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('imports.execute');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const batchId = String(formData.get('batchId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (batchId === '' || reason.length === 0) {
    return failure(frAdminData.common.requiredReason, correlationId, {
      reason: frAdminData.common.requiredReason,
    });
  }

  const result = await adminRpc(
    'admin_transition_import_batch',
    {
      p_batch_id: batchId,
      p_to_status: 'cancelled',
      p_note: reason,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh(batchId);
  return success(t.cancelBatch);
}
