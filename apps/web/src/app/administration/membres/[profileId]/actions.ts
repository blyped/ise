'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { adminMemberRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { requiredText, runAdminAction, text, validationError } from '@/lib/admin/action-support';
import { frMemberModeration } from '@/i18n/moderation-membre';

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

/**
 * SUPPRESSION DU COMPTE d'un membre par la moderation (migration 0130).
 *
 * D-19 — ce n'est PAS une suppression de profil. `auth.users` est
 * supprime, `ise_profiles.user_id` repasse a NULL par ON DELETE SET
 * NULL, et le profil redevient un profil REFERENCE non reclame de
 * l'annuaire. Le portrait public est purge du bucket public par le
 * declencheur `ise_profiles_public_photo_guard` (0120), qui se declenche
 * precisement sur ce passage a NULL.
 *
 * La confirmation « SUPPRIMER » est verifiee ici pour repondre en
 * francais, et REVALIDEE en base : `admin_delete_member_account()`
 * refuse toute autre saisie. Le motif (>= 10 caracteres), la permission
 * `profiles.moderate` et la journalisation `private.log_audit` sont
 * imposes en base, pas ici.
 */
export async function deleteMemberAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profileId = requiredText(formData, 'profileId');
  const reason = requiredText(formData, 'reason');
  const confirmation = requiredText(formData, 'confirmation');

  if (confirmation.toUpperCase() !== 'SUPPRIMER') {
    return validationError(frMemberModeration.adminDelete.wrongConfirmation, {
      confirmation: frMemberModeration.adminDelete.wrongConfirmation,
    });
  }

  const state = await runAdminAction(
    ['profiles.moderate'],
    'admin_delete_member_account',
    { p_profile_id: profileId, p_reason: reason, p_confirmation: 'SUPPRIMER' },
    frMemberModeration.adminDelete.done,
  );
  if (state.status === 'success') revalidatePath(adminMemberRoute(profileId));
  return state;
}
