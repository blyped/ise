'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { adminMemberRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction, text } from '@/lib/admin/action-support';

/**
 * Server Actions de la fiche administrative d'un membre (SA-003 / SA-004).
 *
 * Chaque action appelle une fonction `admin_*` (0076 / 0077) qui
 * revalide la permission en base, exige le motif et JOURNALISE dans
 * `private.audit_log` — y compris les tentatives refusees. La
 * verification faite ici ne sert qu'a repondre en francais.
 */

export async function profileStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profileId = requiredText(formData, 'profileId');
  const action = requiredText(formData, 'action');
  const reason = requiredText(formData, 'reason');

  const state = await runAdminAction(
    ['profiles.moderate'],
    'admin_set_profile_status',
    { p_profile_id: profileId, p_action: action, p_reason: reason },
    frAdmin.members.actions.done,
  );
  if (state.status === 'success') revalidatePath(adminMemberRoute(profileId));
  return state;
}

export async function profileRoleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profileId = requiredText(formData, 'profileId');
  const role = requiredText(formData, 'role');
  const grant = requiredText(formData, 'grant') === 'true';
  const reason = requiredText(formData, 'reason');

  const state = await runAdminAction(
    ['roles.manage'],
    'admin_set_profile_role',
    { p_profile_id: profileId, p_role_code: role, p_grant: grant, p_reason: reason },
    frAdmin.roles.done,
  );
  if (state.status === 'success') revalidatePath(adminMemberRoute(profileId));
  return state;
}

export async function addProfileNoteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profileId = requiredText(formData, 'profileId');
  const body = text(formData, 'body') ?? '';

  const state = await runAdminAction(
    ['profiles.moderate'],
    'admin_add_profile_note',
    { p_profile_id: profileId, p_body: body },
    frAdmin.notes.added,
  );
  if (state.status === 'success') revalidatePath(adminMemberRoute(profileId));
  return state;
}
