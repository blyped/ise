'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { CALL_ROUTES, callRoute } from '@/lib/routes/calls';
import {
  closeCall,
  loadMyNetworkCalls,
  loadNetworkCalls,
  publishCall,
  respondToCall,
  saveCallDraft,
  setResponseStatus,
  toggleSavedCall,
  transitionCall,
  type CallCard,
  type CallListFilters,
} from '@/lib/queries/calls';
import { toCallScope, toMyCallGroup } from '@/lib/calls-view';
import { failure, success, type FormState } from '@/lib/form-state';

/**
 * Server Actions de la tranche APPELS AU RESEAU.
 *
 * Aucune ne fabrique de donnee : chacune relaie un geste explicite vers
 * une fonction atomique de la base (0007 / 0052) et rend le message
 * metier traduit par `BusinessError`, jamais le message PostgreSQL brut
 * (D-102).
 */

/* ------------------------------------------------------------------ */
/* Enregistrer / retirer                                              */
/* ------------------------------------------------------------------ */

export interface SaveState {
  status: 'idle' | 'error' | 'success';
  isSaved: boolean;
  message: string | null;
}

export async function toggleSavedCallAction(
  previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const callId = String(formData.get('callId') ?? '');
  const saved = formData.get('saved') === 'true';
  if (callId.length === 0) return { ...previous, status: 'error', message: 'Appel introuvable.' };

  const correlationId = newCorrelationId();
  const result = await toggleSavedCall(callId, saved, correlationId);

  if (!result.ok) {
    return { status: 'error', isSaved: previous.isSaved, message: result.error.userMessage };
  }
  revalidatePath(CALL_ROUTES.list);
  return { status: 'success', isSaved: result.data, message: null };
}

/* ------------------------------------------------------------------ */
/* Pagination par curseur (D-44)                                      */
/* ------------------------------------------------------------------ */

export interface LoadMoreCallsState {
  status: 'idle' | 'error' | 'success';
  rows: CallCard[];
  nextCursor: string | null;
  message: string | null;
  correlationId: string | null;
}

function readFilters(formData: FormData): CallListFilters {
  const text = (key: string): string | null => {
    const value = formData.get(key);
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  };
  const number = (key: string): number | null => {
    const value = text(key);
    if (value === null) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };
  return {
    scope: toCallScope(formData.get('scope')),
    query: text('recherche'),
    callType: text('type'),
    skillId: number('competence'),
    sectorId: number('secteur'),
    countryCode: text('pays'),
    urgency: text('urgence'),
    status: formData.get('statut') === 'all' ? 'all' : 'open',
  };
}

export async function loadMoreCallsAction(
  previous: LoadMoreCallsState,
  formData: FormData,
): Promise<LoadMoreCallsState> {
  const correlationId = newCorrelationId();
  const sealed = formData.get('curseur');
  const cursor = unsealCursor(typeof sealed === 'string' ? sealed : null);

  const result = await loadNetworkCalls(readFilters(formData), cursor, correlationId);
  if (!result.ok) {
    return {
      status: 'error',
      rows: previous.rows,
      nextCursor: previous.nextCursor,
      message: result.error.userMessage,
      correlationId,
    };
  }
  return {
    status: 'success',
    rows: [...previous.rows, ...result.data.rows],
    nextCursor: result.data.nextCursor,
    message: null,
    correlationId: null,
  };
}

export async function loadMoreMyCallsAction(
  previous: LoadMoreCallsState,
  formData: FormData,
): Promise<LoadMoreCallsState> {
  const correlationId = newCorrelationId();
  const sealed = formData.get('curseur');
  const cursor = unsealCursor(typeof sealed === 'string' ? sealed : null);

  const result = await loadMyNetworkCalls(
    toMyCallGroup(formData.get('groupe')),
    cursor,
    correlationId,
  );
  if (!result.ok) {
    return {
      status: 'error',
      rows: previous.rows,
      nextCursor: previous.nextCursor,
      message: result.error.userMessage,
      correlationId,
    };
  }
  return {
    status: 'success',
    rows: [...previous.rows, ...result.data.rows],
    nextCursor: result.data.nextCursor,
    message: null,
    correlationId: null,
  };
}

/* ------------------------------------------------------------------ */
/* Assistant de creation (ISE-049 -> ISE-052)                         */
/* ------------------------------------------------------------------ */

const text = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const list = (formData: FormData, key: string): string[] =>
  formData
    .getAll(key)
    .flatMap((value) => (typeof value === 'string' && value.length > 0 ? [value] : []));

/** ISE-049 — etape 1 : le besoin. */
export async function saveNeedAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const correlationId = newCorrelationId();
  const callId = text(formData, 'callId');

  const title = text(formData, 'title');
  const description = text(formData, 'description');
  const fieldErrors: Record<string, string> = {};

  if (title === null || title.length < 3 || title.length > 120) {
    fieldErrors['title'] = 'Le titre doit contenir entre 3 et 120 caractères.';
  }
  if (description === null || description.length < 20 || description.length > 5000) {
    fieldErrors['description'] = 'La description doit contenir entre 20 et 5 000 caractères.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return failure('Certaines informations sont incomplètes.', correlationId, fieldErrors);
  }

  const result = await saveCallDraft(
    callId,
    {
      call_family: text(formData, 'callFamily'),
      call_type: text(formData, 'callType') ?? 'other',
      title,
      description,
      context: text(formData, 'context') ?? '',
      // L'urgence n'est pas transmise : la base la DEDUIT de l'echeance (D6 §38).
      deadline: text(formData, 'deadline') ?? '',
      visibility: text(formData, 'visibility') ?? 'members',
      hide_author_organization: formData.get('hideOrganization') === 'on',
    },
    correlationId,
  );

  if (!result.ok) {
    return failure(result.error.userMessage, correlationId);
  }
  redirect(`${callRoute(result.data)}/profil-recherche`);
}

/** ISE-050 — etape 2 : profil recherche et criteres. */
export async function saveWantedProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const callId = text(formData, 'callId');
  if (callId === null) return failure('Appel introuvable.', correlationId);

  const requiredSkills = list(formData, 'requiredSkillIds');
  const preferredSkills = list(formData, 'preferredSkillIds');
  const languageCode = text(formData, 'languageCode');

  const result = await saveCallDraft(
    callId,
    {
      wanted_profile: text(formData, 'wantedProfile') ?? '',
      sector_id: text(formData, 'sectorId') ?? '',
      sector_importance: formData.get('sectorRequired') === 'on' ? 'required' : 'preferred',
      country_code: text(formData, 'countryCode') ?? '',
      min_experience_years: text(formData, 'minExperienceYears') ?? '',
      promotion_year_from: text(formData, 'promotionYearFrom') ?? '',
      promotion_year_to: text(formData, 'promotionYearTo') ?? '',
      skills: [
        ...requiredSkills.map((id) => ({ skill_id: id, importance: 'required' })),
        ...preferredSkills
          .filter((id) => !requiredSkills.includes(id))
          .map((id) => ({ skill_id: id, importance: 'preferred' })),
      ],
      tools: list(formData, 'toolIds').map((id) => ({ tool_id: id, importance: 'preferred' })),
      languages:
        languageCode === null
          ? []
          : [
              {
                language_code: languageCode,
                min_proficiency: text(formData, 'languageLevel') ?? 'professional',
                importance: formData.get('languageRequired') === 'on' ? 'required' : 'preferred',
              },
            ],
      countries: list(formData, 'experienceCountries').map((code) => ({
        country_code: code,
        scope: 'experience',
        importance: 'preferred',
      })),
      help_types: list(formData, 'helpTypes'),
    },
    correlationId,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);
  redirect(`${callRoute(callId)}/ciblage`);
}

/** ISE-051 — etape 3 : ciblage d'audience. */
export async function saveAudienceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const callId = text(formData, 'callId');
  if (callId === null) return failure('Appel introuvable.', correlationId);

  const result = await saveCallDraft(
    callId,
    {
      visibility: text(formData, 'visibility') ?? 'members',
      hide_author_organization: formData.get('hideOrganization') === 'on',
      audience_promotion_ids: list(formData, 'audiencePromotionIds'),
    },
    correlationId,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);
  redirect(`${callRoute(callId)}/apercu`);
}

/** ISE-052 — publication. */
export async function publishCallAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const callId = text(formData, 'callId');
  if (callId === null) return failure('Appel introuvable.', correlationId);

  const result = await publishCall(callId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  redirect(`${callRoute(callId)}/suivi?publie=1`);
}

/* ------------------------------------------------------------------ */
/* Reponses, transitions, cloture                                     */
/* ------------------------------------------------------------------ */

export async function respondToCallAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const callId = text(formData, 'callId');
  const responseType = text(formData, 'responseType');
  if (callId === null || responseType === null) {
    return failure('Cette réponse est incomplète.', correlationId);
  }

  const message = text(formData, 'message');
  const recommendedProfileId = text(formData, 'recommendedProfileId');
  const externalPersonName = text(formData, 'externalPersonName');

  if (
    responseType === 'knows_someone' &&
    recommendedProfileId === null &&
    externalPersonName === null
  ) {
    return failure('Indiquez qui vous recommandez.', correlationId, {
      recommendedProfileId: 'Un profil ISE ou un nom est nécessaire.',
    });
  }
  if (message !== null && message.length > 4000) {
    return failure('Votre message est trop long.', correlationId, {
      message: '4 000 caractères au maximum.',
    });
  }

  const result = await respondToCall(
    {
      callId,
      responseType,
      message,
      sharesContact: formData.get('sharesContact') === 'on',
      recommendedProfileId,
      externalPersonName,
      externalPersonContext: text(formData, 'externalPersonContext'),
      rationale: text(formData, 'rationale'),
      offersIntroduction: formData.get('offersIntroduction') === 'on',
      consentConfirmed: formData.get('consentConfirmed') === 'on',
    },
    correlationId,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);
  redirect(`${callRoute(callId)}?reponse=1`);
}

export async function setResponseStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const responseId = text(formData, 'responseId');
  const status = text(formData, 'status');
  const callId = text(formData, 'callId');
  if (responseId === null || status === null) {
    return failure('Statut introuvable.', correlationId);
  }

  const result = await setResponseStatus(responseId, status, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  if (callId !== null) revalidatePath(`${callRoute(callId)}/suivi`);
  return success('Statut enregistré.');
}

export async function transitionCallAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const callId = text(formData, 'callId');
  const to = text(formData, 'toStatus');
  if (callId === null || (to !== 'paused' && to !== 'active' && to !== 'cancelled')) {
    return failure('Cette action n’est pas disponible.', correlationId);
  }

  const result = await transitionCall(callId, to, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(`${callRoute(callId)}/suivi`);
  return success('Statut de l’appel mis à jour.');
}

/** ISE-054 — cloture TERNAIRE (D-52). */
export async function closeCallAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const callId = text(formData, 'callId');
  const resolution = text(formData, 'resolution');
  if (callId === null) return failure('Appel introuvable.', correlationId);
  if (
    resolution !== 'resolved' &&
    resolution !== 'partially_resolved' &&
    resolution !== 'not_resolved'
  ) {
    return failure('Indiquez si votre besoin a été résolu.', correlationId, {
      resolution: 'Ce choix est nécessaire pour clôturer.',
    });
  }

  const testimonial = text(formData, 'testimonial');
  const result = await closeCall(
    {
      callId,
      resolution,
      // La base ignore deja ces champs hors de leur perimetre ; l'ecran
      // ne les envoie pas non plus, pour ne pas laisser croire qu'un
      // resultat existe quand le besoin n'a pas ete couvert.
      resultType: resolution === 'not_resolved' ? null : text(formData, 'resultType'),
      missingReason: resolution === 'resolved' ? null : text(formData, 'missingReason'),
      notes: text(formData, 'notes'),
      testimonial,
      testimonialConsent: testimonial !== null && formData.get('testimonialConsent') === 'on',
      contributorIds: list(formData, 'contributorIds'),
    },
    correlationId,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);
  redirect(`${callRoute(callId)}/suivi?cloture=${resolution}`);
}
