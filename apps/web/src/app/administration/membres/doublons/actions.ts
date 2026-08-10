'use server';

import { revalidatePath } from 'next/cache';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requiredText, runAdminAction } from '@/lib/admin/action-support';
import { frAdminDedup } from '@/i18n/admin-dedup';
import type { FormState } from '@/lib/form-state';

export async function mergeProfilesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await runAdminAction(
    ['profiles.moderate'],
    'admin_merge_profiles',
    {
      p_keep_profile_id: requiredText(formData, 'keepProfileId'),
      p_merge_profile_id: requiredText(formData, 'mergeProfileId'),
      p_reason: requiredText(formData, 'reason'),
    },
    frAdminDedup.duplicates.merged,
  );
  revalidatePath(ADMIN_ROUTES.memberDuplicates);
  return result;
}

export async function dismissDuplicateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await runAdminAction(
    ['profiles.moderate'],
    'admin_dismiss_duplicate_candidate',
    {
      p_profile_id_a: requiredText(formData, 'profileIdA'),
      p_profile_id_b: requiredText(formData, 'profileIdB'),
      p_reason: requiredText(formData, 'reason'),
    },
    frAdminDedup.duplicates.dismissed,
  );
  revalidatePath(ADMIN_ROUTES.memberDuplicates);
  return result;
}
