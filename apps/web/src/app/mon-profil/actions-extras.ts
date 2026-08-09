'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import {
  positioningSchema,
  profileGeographiesSchema,
  profileLanguagesSchema,
  profileProjectSchema,
  profileToolsSchema,
  recommendationAcceptSchema,
  recommendationDeclineSchema,
  recommendationModerationSchema,
  recommendationRequestSchema,
  recommendationWithdrawSchema,
  sectionRowIdSchema,
} from '@ise/validation';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { frProfile } from '@/i18n/profile';
import {
  toGeographiesInput,
  toLanguagesInput,
  toPositioningInput,
  toProjectInput,
  toRecommendationAcceptInput,
  toRecommendationRequestInput,
  toToolsInput,
} from './form-input-extras';

/**
 * Server Actions des ecrans ISE-024 -> ISE-031.
 *
 * Memes regles que `actions.ts` : le MEME schema Zod que le client est
 * rejoue ici (MASTER PROMPT §62) ; l'appartenance des lignes est
 * garantie par la RLS (0021, 0085) ; aucune erreur Postgres brute
 * n'atteint l'ecran (D-102).
 */

const EXTRA_PATHS = [
  PROFILE_ROUTES.overview,
  PROFILE_ROUTES.positioning,
  PROFILE_ROUTES.projects,
  PROFILE_ROUTES.languagesZones,
  PROFILE_ROUTES.recommendations,
  PROFILE_ROUTES.completion,
  PROFILE_ROUTES.missingItems,
];

function refreshExtraViews() {
  for (const path of EXTRA_PATHS) revalidatePath(path);
}

/**
 * Synchronise une table de liaison « (profile_id, cle) » avec la
 * selection recue : suppression de ce qui n'est plus choisi, upsert du
 * reste. La RLS `write_own` de 0021 borne l'ensemble au profil courant.
 */
async function syncJunction(
  table: string,
  keyColumn: string,
  profileId: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  correlationId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const keys = rows.map((row) => row[keyColumn]);

  let deletion = supabase.from(table).delete().eq('profile_id', profileId);
  if (keys.length > 0) {
    const list = keys
      .map((key) => (typeof key === 'number' ? String(key) : `"${String(key)}"`))
      .join(',');
    deletion = deletion.not(keyColumn, 'in', `(${list})`);
  }
  const { error: deleteError } = await deletion;
  if (deleteError) return toBusinessError(deleteError, correlationId).userMessage;

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(
      rows.map((row) => ({ ...row, profile_id: profileId })),
      { onConflict: `profile_id,${keyColumn}` },
    );
    if (upsertError) return toBusinessError(upsertError, correlationId).userMessage;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* ISE-024 — Secteurs, fonctions & expertises                           */
/* ------------------------------------------------------------------ */

export async function savePositioningAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = positioningSchema.safeParse(toPositioningInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const steps: Array<[string, string, Array<Record<string, unknown>>]> = [
    [
      'profile_sectors',
      'sector_id',
      input.sectorIds.map((sectorId) => ({
        sector_id: sectorId,
        is_primary: sectorId === input.primarySectorId,
      })),
    ],
    [
      'profile_functions',
      'job_function_id',
      input.functionIds.map((jobFunctionId) => ({ job_function_id: jobFunctionId })),
    ],
    [
      'profile_expertise_areas',
      'expertise_area_id',
      input.expertiseAreaIds.map((expertiseAreaId) => ({ expertise_area_id: expertiseAreaId })),
    ],
  ];

  for (const [table, keyColumn, rows] of steps) {
    const message = await syncJunction(
      table,
      keyColumn,
      context.profile.id,
      rows,
      context.correlationId,
    );
    if (message !== null) return failure(message, context.correlationId);
  }

  refreshExtraViews();
  return success(frProfile.positioning.saved);
}

/* ------------------------------------------------------------------ */
/* ISE-025 / ISE-026 — Projets & realisations                           */
/* ------------------------------------------------------------------ */

export async function saveProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = profileProjectSchema.safeParse(toProjectInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const rawId = formData.get('projectId');
  const supabase = await createSupabaseServerClient();

  const row = {
    profile_id: context.profile.id,
    title: input.title,
    organization_name_raw: input.organizationNameRaw ?? null,
    role: input.role ?? null,
    sector_id: input.sectorId ?? null,
    country_code: input.countryCode ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    summary: input.summary ?? null,
    outcome: input.outcome ?? null,
    link_url: input.linkUrl ?? null,
    visibility: input.visibility,
  };

  if (typeof rawId === 'string' && rawId.length > 0) {
    const id = sectionRowIdSchema.safeParse({ id: rawId });
    if (!id.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

    const { error } = await supabase
      .from('profile_projects')
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
    const { error } = await supabase.from('profile_projects').insert(row);
    if (error) {
      return failure(
        toBusinessError(error, context.correlationId).userMessage,
        context.correlationId,
      );
    }
  }

  refreshExtraViews();
  redirect(PROFILE_ROUTES.projects);
}

export async function deleteProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = sectionRowIdSchema.safeParse({ id: formData.get('projectId') });
  if (!parsed.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profile_projects')
    .delete()
    .eq('id', parsed.data.id)
    .eq('profile_id', context.profile.id);

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshExtraViews();
  return success(frProfile.projects.deleted);
}

/* ------------------------------------------------------------------ */
/* ISE-027 — Langues, zones d'experience, outils                        */
/* ------------------------------------------------------------------ */

export async function saveLanguagesZonesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const languages = profileLanguagesSchema.safeParse(toLanguagesInput(formData));
  const geographies = profileGeographiesSchema.safeParse(toGeographiesInput(formData));
  const tools = profileToolsSchema.safeParse(toToolsInput(formData));

  if (!languages.success || !geographies.success || !tools.success) {
    return failure(BUSINESS_ERRORS.validation_failed, context.correlationId);
  }

  const steps: Array<[string, string, Array<Record<string, unknown>>]> = [
    [
      'profile_languages',
      'language_code',
      languages.data.entries.map((entry) => ({
        language_code: entry.languageCode,
        proficiency: entry.proficiency,
      })),
    ],
    [
      'profile_geographies',
      'country_code',
      geographies.data.countryCodes.map((countryCode) => ({ country_code: countryCode })),
    ],
    [
      'profile_tools',
      'tool_id',
      tools.data.entries.map((entry) => ({
        tool_id: entry.toolId,
        proficiency: entry.proficiency ?? null,
      })),
    ],
  ];

  for (const [table, keyColumn, rows] of steps) {
    const message = await syncJunction(
      table,
      keyColumn,
      context.profile.id,
      rows,
      context.correlationId,
    );
    if (message !== null) return failure(message, context.correlationId);
  }

  refreshExtraViews();
  return success(frProfile.languagesZones.saved);
}

/* ------------------------------------------------------------------ */
/* ISE-029 — Demander une recommandation                                */
/* ------------------------------------------------------------------ */

export async function requestRecommendationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = recommendationRequestSchema.safeParse(toRecommendationRequestInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Une seule demande en attente par destinataire : pas de relance en
  // rafale (maquette ISE-029 : « pas de relance agressive »).
  const { data: existing, error: existingError } = await supabase
    .from('recommendation_requests')
    .select('id')
    .eq('requester_profile_id', context.profile.id)
    .eq('recipient_profile_id', input.recipientProfileId)
    .eq('status', 'pending')
    .limit(1);

  if (existingError) {
    return failure(
      toBusinessError(existingError, context.correlationId).userMessage,
      context.correlationId,
    );
  }
  if ((existing ?? []).length > 0) {
    return failure(
      'Une demande est déjà en attente auprès de ce membre. Attendez sa réponse avant d’en envoyer une autre.',
      context.correlationId,
    );
  }

  const relationshipLabel = frProfile.recommendationRequest.relationship[input.relationship];
  const contextText = [relationshipLabel, input.context].filter(Boolean).join(' — ');

  // `requester_profile_id` est impose par la politique INSERT de 0021 :
  // l'usurpation d'un autre demandeur est refusee par la base.
  const { error } = await supabase.from('recommendation_requests').insert({
    requester_profile_id: context.profile.id,
    recipient_profile_id: input.recipientProfileId,
    skill_id: input.skillId ?? null,
    context: contextText,
    message: input.message,
  });

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshExtraViews();
  redirect(PROFILE_ROUTES.recommendations);
}

/* ------------------------------------------------------------------ */
/* ISE-028 — repondre a une demande, moderer une recommandation         */
/* ------------------------------------------------------------------ */

export async function acceptRecommendationRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = recommendationAcceptSchema.safeParse(toRecommendationAcceptInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('respond_recommendation_request', {
    p_request_id: input.requestId,
    p_action: 'accept',
    p_body: input.body,
    p_relationship_context: input.relationshipContext,
    p_engagement_context: input.engagementContext ?? null,
    p_skill_id: input.skillId ?? null,
    p_visibility: input.visibility,
  });

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshExtraViews();
  return success(frProfile.recommendations.acceptSent);
}

export async function declineRecommendationRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = recommendationDeclineSchema.safeParse({ requestId: formData.get('requestId') });
  if (!parsed.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('respond_recommendation_request', {
    p_request_id: parsed.data.requestId,
    p_action: 'decline',
  });

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshExtraViews();
  return success(frProfile.recommendations.declined);
}

export async function withdrawRecommendationRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = recommendationWithdrawSchema.safeParse({ requestId: formData.get('requestId') });
  if (!parsed.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('respond_recommendation_request', {
    p_request_id: parsed.data.requestId,
    p_action: 'withdraw',
  });

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshExtraViews();
  return success(frProfile.recommendations.withdrawn);
}

/**
 * Le sujet valide (`publish`) ou masque (`hide`) une recommandation
 * recue. Le trigger de 0085 garantit en base qu'aucune autre colonne ne
 * peut changer : jamais de reecriture du temoignage d'un tiers.
 */
export async function moderateRecommendationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = recommendationModerationSchema.safeParse({
    recommendationId: formData.get('recommendationId'),
    action: formData.get('action'),
  });
  if (!parsed.success) return failure(BUSINESS_ERRORS.not_found, context.correlationId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('recommendations')
    .update({ status: parsed.data.action === 'publish' ? 'published' : 'hidden' })
    .eq('id', parsed.data.recommendationId)
    .eq('subject_profile_id', context.profile.id);

  if (error) {
    return failure(
      toBusinessError(error, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  refreshExtraViews();
  return success(
    parsed.data.action === 'publish'
      ? frProfile.recommendations.published
      : frProfile.recommendations.hidden,
  );
}
