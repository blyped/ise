'use server';

import { integer, runAdminActionWithPayload, text, requiredText } from '@/lib/admin/action-support';
import { frAdminDedup } from '@/i18n/admin-dedup';
import type { FormState } from '@/lib/form-state';

interface CreateProfilePayload {
  profile_id: string;
  potential_duplicates: Array<{ profileId: string; displayName: string; score: number }>;
}

/**
 * SA-007 — Cree un profil reference/unclaimed. Le message de succes
 * inclut, sans jamais bloquer la creation, les doublons potentiels
 * signales par `admin_create_referenced_profile` (0089) : seul un
 * humain confirme un doublon (SA-005).
 */
export async function createReferencedProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAdminActionWithPayload(
    ['profiles.edit'],
    'admin_create_referenced_profile',
    {
      p_first_name: requiredText(formData, 'firstName'),
      p_last_name: requiredText(formData, 'lastName'),
      p_promotion_id: integer(formData, 'promotionId'),
      p_middle_names: text(formData, 'middleNames'),
      p_current_position: text(formData, 'currentPosition'),
      p_current_organization_raw: text(formData, 'currentOrganizationRaw'),
      p_current_country_code: text(formData, 'currentCountryCode'),
      p_current_city: text(formData, 'currentCity'),
      p_primary_email: text(formData, 'primaryEmail'),
      p_secondary_email: text(formData, 'secondaryEmail'),
      p_phone_e164: text(formData, 'phoneE164'),
      p_secondary_phone_e164: text(formData, 'secondaryPhoneE164'),
    },
    (payload) => {
      const data = payload as CreateProfilePayload;
      const duplicates = data.potential_duplicates ?? [];
      if (duplicates.length === 0) return frAdminDedup.create.created;
      const names = duplicates.map((d) => `${d.displayName} (${d.score})`).join(', ');
      return `${frAdminDedup.create.created} ${frAdminDedup.create.duplicateWarning} ${names}`;
    },
  );
}
