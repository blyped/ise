'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import {
  educationSchema,
  experienceSchema,
  profileHeaderSchema,
  profileSkillSchema,
  profileVisibilityBatchSchema,
  sectionRowIdSchema,
  profileSkillIdSchema,
} from '@ise/validation';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { loadVisibilityRules, type VisibilityLevel } from '@/lib/queries/reference';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { frProfile } from '@/i18n/profile';
import {
  toEducationInput,
  toExperienceInput,
  toHeaderInput,
  toProfileSkillInput,
} from './form-input';

/**
 * Server Actions du profil membre ISE-016 -> ISE-023.
 *
 * Regles communes :
 *  · le MEME schema Zod que le client est rejoue ici (MASTER PROMPT §62) ;
 *  · la visibilite par champ (D-73) est verifiee contre
 *    `profile_visibility_defaults.allowed_levels` : une valeur refusee par
 *    la base ne passe pas, meme si le formulaire a ete modifie ;
 *  · l'appartenance des lignes est garantie par la RLS de 0021, pas par le
 *    filtre `profile_id` present ici, qui n'est qu'une precision ;
 *  · aucune erreur Postgres brute n'atteint l'ecran (D-102).
 */

const VISIBILITY_PATHS = [
  PROFILE_ROUTES.overview,
  PROFILE_ROUTES.header,
  PROFILE_ROUTES.experiences,
  PROFILE_ROUTES.educations,
  PROFILE_ROUTES.skills,
];

function refreshProfileViews() {
  for (const path of VISIBILITY_PATHS) revalidatePath(path);
}

/**
 * Applique un lot de choix de visibilite APRES verification contre le
 * referentiel. Renvoie `null` si tout s'est bien passe, un message metier
 * sinon.
 */
async function applyVisibility(
  profileId: string,
  entries: ReadonlyArray<{ fieldKey: string; visibility: VisibilityLevel }>,
  correlationId: string,
): Promise<string | null> {
  if (entries.length === 0) return null;

  const parsed = profileVisibilityBatchSchema.safeParse({ entries });
  if (!parsed.success) return BUSINESS_ERRORS.validation_failed;

  const rules = await loadVisibilityRules(correlationId);
  if (!rules.ok) return rules.error.userMessage;

  const allowed = new Map(rules.data.map((rule) => [rule.fieldKey, rule.allowedLevels]));

  for (const entry of parsed.data.entries) {
    const levels = allowed.get(entry.fieldKey);
    // Un champ inconnu du referentiel, ou un niveau non autorise pour ce
    // champ, est refuse cote serveur (D-73, D-74).
    if (!levels || !levels.includes(entry.visibility)) return BUSINESS_ERRORS.not_authorized;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('profile_visibility').upsert(
    parsed.data.entries.map((entry) => ({
      profile_id: profileId,
      field_key: entry.fieldKey,
      visibility: entry.visibility,
    })),
    { onConflict: 'profile_id,field_key' },
  );

  if (error) return toBusinessError(error, correlationId).userMessage;
  return null;
}

/** Lit les couples champ/visibilite postes par un formulaire. */
function visibilityEntries(formData: FormData, fieldKeys: readonly string[]) {
  const entries: Array<{ fieldKey: string; visibility: VisibilityLevel }> = [];
  for (const fieldKey of fieldKeys) {
    const value = formData.get(`visibility.${fieldKey}`);
    if (typeof value === 'string' && value.length > 0) {
      entries.push({ fieldKey, visibility: value as VisibilityLevel });
    }
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* ISE-017 — En-tete et A propos                                       */
/* ------------------------------------------------------------------ */

const HEADER_VISIBILITY_FIELDS = [
  'headline',
  'bio',
  'current_position',
  'current_organization',
  'city',
  'country',
  'linkedin_url',
  'website_url',
] as const;

export async function saveProfileHeaderAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = profileHeaderSchema.safeParse(toHeaderInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('ise_profiles')
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      headline: input.headline ?? null,
      bio: input.bio ?? null,
      current_position: input.currentPosition ?? null,
      // D-166 : l'organisation choisie dans la liste (referentiel
      // `public.organizations`) prime sur le texte libre, qui ne sert que
      // de repli pour une organisation absente de la liste.
      current_organization_id: input.currentOrganizationId ?? null,
      current_organization_raw:
        input.currentOrganizationId !== undefined ? null : (input.currentOrganizationRaw ?? null),
      current_country_code: input.currentCountryCode ?? null,
      current_city: input.currentCity ?? null,
      linkedin_url: input.linkedinUrl === '' ? null : (input.linkedinUrl ?? null),
      website_url: input.websiteUrl === '' ? null : (input.websiteUrl ?? null),
    })
    .eq('id', context.profile.id);

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  const visibilityError = await applyVisibility(
    context.profile.id,
    visibilityEntries(formData, HEADER_VISIBILITY_FIELDS),
    context.correlationId,
  );
  if (visibilityError !== null) return failure(visibilityError, context.correlationId);

  refreshProfileViews();
  redirect(PROFILE_ROUTES.overview);
}

/* ------------------------------------------------------------------ */
/* ISE-019 — Experience                                                 */
/* ------------------------------------------------------------------ */

export async function saveExperienceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = experienceSchema.safeParse(toExperienceInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const rawId = formData.get('experienceId');
  const supabase = await createSupabaseServerClient();

  const row = {
    profile_id: context.profile.id,
    // D-166 : meme repli que l'en-tete (`saveProfileHeaderAction`) — la
    // fiche `public.organizations` choisie dans la liste prime sur le
    // texte libre, qui ne sert que pour une organisation absente de la liste.
    organization_id: input.organizationId ?? null,
    organization_name_raw: input.organizationId !== undefined ? null : (input.organizationNameRaw ?? null),
    position_title: input.positionTitle,
    sector_id: input.sectorId ?? null,
    job_function_id: input.jobFunctionId ?? null,
    country_code: input.countryCode ?? null,
    city: input.city ?? null,
    start_date: input.startDate,
    end_date: input.isCurrent ? null : (input.endDate ?? null),
    is_current: input.isCurrent,
    description: input.description ?? null,
    visibility: input.visibility,
  };

  if (typeof rawId === 'string' && rawId.length > 0) {
    const id = sectionRowIdSchema.safeParse({ id: rawId });
    if (!id.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

    const { error } = await supabase
      .from('experiences')
      .update(row)
      .eq('id', id.data.id)
      .eq('profile_id', context.profile.id);

    if (error) {
      return failure(
        toBusinessError(error, context.correlationId).userMessage,
        context.correlationId,
      );
    }
  } else {
    const { error } = await supabase.from('experiences').insert(row);
    if (error) {
      return failure(
        toBusinessError(error, context.correlationId).userMessage,
        context.correlationId,
      );
    }
  }

  refreshProfileViews();
  redirect(PROFILE_ROUTES.experiences);
}

export async function deleteExperienceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = sectionRowIdSchema.safeParse({ id: formData.get('experienceId') });
  if (!parsed.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('experiences')
    .delete()
    .eq('id', parsed.data.id)
    .eq('profile_id', context.profile.id);

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshProfileViews();
  return success(frProfile.experiences.deleted);
}

/* ------------------------------------------------------------------ */
/* ISE-021 — Formation                                                  */
/* ------------------------------------------------------------------ */

export async function saveEducationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = educationSchema.safeParse(toEducationInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const rawId = formData.get('educationId');
  const supabase = await createSupabaseServerClient();

  const row = {
    profile_id: context.profile.id,
    education_type: input.educationType,
    institution: input.institution,
    degree: input.degree,
    field_of_study: input.fieldOfStudy === '' ? null : (input.fieldOfStudy ?? null),
    country_code: input.countryCode === '' ? null : (input.countryCode ?? null),
    city: input.city === '' ? null : (input.city ?? null),
    start_year:
      input.startYear === '' || input.startYear === undefined ? null : Number(input.startYear),
    end_year: input.endYear === '' || input.endYear === undefined ? null : Number(input.endYear),
    credential_url: input.credentialUrl === '' ? null : (input.credentialUrl ?? null),
    description: input.description === '' ? null : (input.description ?? null),
    visibility: input.visibility,
  };

  if (typeof rawId === 'string' && rawId.length > 0) {
    const id = sectionRowIdSchema.safeParse({ id: rawId });
    if (!id.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

    const { error } = await supabase
      .from('educations')
      .update(row)
      .eq('id', id.data.id)
      .eq('profile_id', context.profile.id);

    if (error) {
      return failure(
        toBusinessError(error, context.correlationId).userMessage,
        context.correlationId,
      );
    }
  } else {
    const { error } = await supabase.from('educations').insert(row);
    if (error) {
      return failure(
        toBusinessError(error, context.correlationId).userMessage,
        context.correlationId,
      );
    }
  }

  refreshProfileViews();
  redirect(PROFILE_ROUTES.educations);
}

export async function deleteEducationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = sectionRowIdSchema.safeParse({ id: formData.get('educationId') });
  if (!parsed.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('educations')
    .delete()
    .eq('id', parsed.data.id)
    .eq('profile_id', context.profile.id);

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshProfileViews();
  return success(frProfile.educations.deleted);
}

/* ------------------------------------------------------------------ */
/* ISE-023 — Competence declaree                                        */
/* ------------------------------------------------------------------ */

export async function saveProfileSkillAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = profileSkillSchema.safeParse(toProfileSkillInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  // `upsert` plutot que `insert` : ajouter une competence deja declaree
  // met a jour sa fiche au lieu de renvoyer une violation d'unicite que
  // l'utilisateur ne comprendrait pas.
  const { error } = await supabase.from('profile_skills').upsert(
    {
      profile_id: context.profile.id,
      skill_id: input.skillId,
      level: input.level ?? null,
      years_experience: input.yearsExperience ?? null,
      is_primary: input.isPrimary,
      context: input.context ?? null,
    },
    { onConflict: 'profile_id,skill_id' },
  );

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshProfileViews();
  redirect(PROFILE_ROUTES.skills);
}

export async function deleteProfileSkillAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = profileSkillIdSchema.safeParse({ skillId: formData.get('skillId') });
  if (!parsed.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profile_skills')
    .delete()
    .eq('skill_id', parsed.data.skillId)
    .eq('profile_id', context.profile.id);

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshProfileViews();
  return success(frProfile.skillForm.deleted);
}

/* ------------------------------------------------------------------ */
/* ISE-022 — Visibilite du bloc « competences »                        */
/* ------------------------------------------------------------------ */

export async function saveSkillsVisibilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const message = await applyVisibility(
    context.profile.id,
    visibilityEntries(formData, ['skills']),
    context.correlationId,
  );
  if (message !== null) return failure(message, context.correlationId);

  refreshProfileViews();
  return success(frProfile.common.saved);
}
