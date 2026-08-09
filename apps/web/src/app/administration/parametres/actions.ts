'use server';

import { revalidatePath } from 'next/cache';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { checkAdminDataPermission } from '@/lib/admin-data/permissions';
import { adminErrorMessage } from '@/lib/admin-data/errors';
import { adminRpc } from '@/lib/admin-data/rpc';
import { ADMIN_DATA_ROUTES } from '@/lib/routes/admin-data';

/**
 * Server Actions des paramètres plateforme (SA-048). Chaque écriture
 * passe par une fonction SQL de 0082 / 0084 qui journalise l'ancienne et
 * la nouvelle valeur dans `private.audit_log` — dans la même transaction.
 * Le motif est demandé à l'écran et journalisé (MASTER PROMPT §40).
 */

const t = frAdminData.settings;

function refresh(): void {
  revalidatePath(ADMIN_DATA_ROUTES.settings);
}

function parseSettingValue(
  kind: string,
  raw: string,
): { ok: true; value: unknown } | { ok: false } {
  if (kind === 'string') return { ok: true, value: raw };
  if (kind === 'number') {
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false };
  }
  if (kind === 'boolean') {
    if (raw === 'true') return { ok: true, value: true };
    if (raw === 'false') return { ok: true, value: false };
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

export async function saveSettingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('settings.manage');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const key = String(formData.get('key') ?? '').trim();
  const valueKind = String(formData.get('valueKind') ?? 'json');
  const rawValue = String(formData.get('value') ?? '').trim();
  const scope = String(formData.get('scope') ?? 'admin');
  const description = String(formData.get('description') ?? '').trim() || null;
  const reason = String(formData.get('reason') ?? '').trim();

  if (key === '' || rawValue === '') {
    return failure(frAdminData.common.loadError, correlationId, {
      ...(key === '' ? { key: t.keyLabel } : {}),
      ...(rawValue === '' ? { value: t.valueLabel } : {}),
    });
  }
  if (reason === '') {
    return failure(frAdminData.common.requiredReason, correlationId, {
      reason: frAdminData.common.requiredReason,
    });
  }
  const parsed = parseSettingValue(valueKind, rawValue);
  if (!parsed.ok) {
    return failure(frAdminData.common.loadError, correlationId, { value: t.valueLabel });
  }

  const result = await adminRpc(
    'admin_upsert_platform_setting',
    {
      p_key: key,
      p_value: parsed.value,
      p_value_kind: valueKind,
      p_scope: scope,
      p_description: description,
      p_reason: reason,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh();
  return success(t.savedSetting);
}

export async function deleteSettingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('settings.manage');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const key = String(formData.get('key') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (key === '') return failure(frAdminData.common.loadError, correlationId);
  if (reason === '') {
    return failure(frAdminData.common.requiredReason, correlationId, {
      reason: frAdminData.common.requiredReason,
    });
  }

  const result = await adminRpc(
    'admin_delete_platform_setting',
    { p_key: key, p_reason: reason, p_correlation_id: correlationId },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh();
  return success(t.savedSetting);
}

export async function saveFlagAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('settings.manage');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const isEnabled = formData.get('isEnabled') === 'on';
  const strategy = String(formData.get('strategy') ?? 'off');
  const description = String(formData.get('description') ?? '').trim() || null;
  const targetRole = String(formData.get('targetRole') ?? '').trim() || null;
  const percentageRaw = String(formData.get('percentage') ?? '').trim();
  const percentage = percentageRaw === '' ? null : Number.parseInt(percentageRaw, 10);
  const reason = String(formData.get('reason') ?? '').trim();

  if (code === '' || name === '') {
    return failure(frAdminData.common.loadError, correlationId, {
      ...(code === '' ? { code: t.flagCode } : {}),
      ...(name === '' ? { name: t.flagName } : {}),
    });
  }
  if (reason === '') {
    return failure(frAdminData.common.requiredReason, correlationId, {
      reason: frAdminData.common.requiredReason,
    });
  }

  const result = await adminRpc(
    'admin_upsert_feature_flag',
    {
      p_code: code,
      p_name: name,
      p_is_enabled: isEnabled,
      p_rollout_strategy: strategy,
      p_description: description,
      p_target_role_code: targetRole,
      p_rollout_percentage: percentage,
      p_reason: reason,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh();
  return success(t.savedFlag);
}

export async function saveMaintenanceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('settings.manage');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const id = String(formData.get('id') ?? '').trim() || null;
  const title = String(formData.get('title') ?? '').trim();
  const startsAt = String(formData.get('startsAt') ?? '').trim();
  const endsAt = String(formData.get('endsAt') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const bannerMessage = String(formData.get('bannerMessage') ?? '').trim() || null;
  const scope = String(formData.get('scope') ?? 'all');
  const isReadOnly = formData.get('isReadOnly') === 'on';
  const reason = String(formData.get('reason') ?? '').trim();

  if (title === '' || startsAt === '' || endsAt === '') {
    return failure(frAdminData.common.loadError, correlationId, {
      ...(title === '' ? { title: t.maintenance.titleLabel } : {}),
      ...(startsAt === '' ? { startsAt: t.maintenance.startsLabel } : {}),
      ...(endsAt === '' ? { endsAt: t.maintenance.endsLabel } : {}),
    });
  }
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return failure(frAdminData.common.loadError, correlationId, {
      endsAt: t.maintenance.endsLabel,
    });
  }
  if (reason === '') {
    return failure(frAdminData.common.requiredReason, correlationId, {
      reason: frAdminData.common.requiredReason,
    });
  }

  const result = await adminRpc(
    'admin_upsert_maintenance_window',
    {
      p_id: id,
      p_title: title,
      p_starts_at: new Date(startsAt).toISOString(),
      p_ends_at: new Date(endsAt).toISOString(),
      p_description: description,
      p_banner_message: bannerMessage,
      p_affected_scope: scope,
      p_is_read_only: isReadOnly,
      p_reason: reason,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh();
  return success(t.maintenance.saved);
}

export async function transitionMaintenanceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('settings.manage');
  if (access === null) return failure(adminErrorMessage('not_authorized'), correlationId);

  const id = String(formData.get('id') ?? '').trim();
  const action = String(formData.get('transition') ?? '').trim();
  if (id === '' || !['start', 'complete', 'cancel'].includes(action)) {
    return failure(frAdminData.common.loadError, correlationId);
  }

  const result = await adminRpc(
    'admin_transition_maintenance_window',
    { p_id: id, p_action: action, p_correlation_id: correlationId },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  refresh();
  return success(t.maintenance.transitioned);
}
