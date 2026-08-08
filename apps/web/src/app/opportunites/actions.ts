'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import {
  OPPORTUNITY_ROUTES,
  applicationRoute,
  opportunityApplyRoute,
  opportunityRoute,
} from '@/lib/routes/opportunities';
import {
  closeOpportunity,
  declareExternalApplication,
  loadMyApplications,
  loadMyOpportunities,
  loadOpportunities,
  publishOpportunity,
  recordOutboundClick,
  saveOpportunityDraft,
  submitApplication,
  toggleSavedOpportunity,
  transitionApplication,
  transitionOpportunity,
  type ApplicationRow,
  type OpportunityCard,
  type OpportunityFilters,
} from '@/lib/queries/opportunities';
import {
  toMyApplicationGroup,
  toMyOpportunityGroup,
  toOpportunityScope,
} from '@/lib/opportunities-view';
import { failure, success, type FormState } from '@/lib/form-state';

/**
 * Server Actions de la tranche OPPORTUNITES.
 *
 * REGLE CARDINALE (MASTER PROMPT §27, D-55) : trois actions distinctes,
 * jamais confondues.
 *   `submitApplicationAction`  → depot d'une candidature INTERNE ;
 *   `declareApplicationAction` → DECLARATION du membre pour une offre
 *                                externe, sur un geste explicite ;
 *   `openExternalOfferAction`  → journalise un CLIC et renvoie l'adresse.
 *                                Elle n'ecrit aucune candidature et le dit.
 */

const text = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const list = (formData: FormData, key: string): string[] =>
  formData
    .getAll(key)
    .flatMap((value) => (typeof value === 'string' && value.length > 0 ? [value] : []));

/* ------------------------------------------------------------------ */
/* Enregistrer / retirer                                              */
/* ------------------------------------------------------------------ */

export interface SaveOpportunityState {
  status: 'idle' | 'error' | 'success';
  isSaved: boolean;
  message: string | null;
}

export const initialSaveOpportunityState: SaveOpportunityState = {
  status: 'idle',
  isSaved: false,
  message: null,
};

export async function toggleSavedOpportunityAction(
  previous: SaveOpportunityState,
  formData: FormData,
): Promise<SaveOpportunityState> {
  const opportunityId = String(formData.get('opportunityId') ?? '');
  const saved = formData.get('saved') === 'true';
  if (opportunityId.length === 0) {
    return { ...previous, status: 'error', message: 'Opportunité introuvable.' };
  }

  const correlationId = newCorrelationId();
  const result = await toggleSavedOpportunity(opportunityId, saved, correlationId);
  if (!result.ok) {
    return { status: 'error', isSaved: previous.isSaved, message: result.error.userMessage };
  }
  revalidatePath(OPPORTUNITY_ROUTES.list);
  return { status: 'success', isSaved: result.data, message: null };
}

/* ------------------------------------------------------------------ */
/* Pagination par curseur (D-44)                                      */
/* ------------------------------------------------------------------ */

export interface LoadMoreOpportunitiesState {
  status: 'idle' | 'error' | 'success';
  rows: OpportunityCard[];
  nextCursor: string | null;
  message: string | null;
  correlationId: string | null;
}

export const initialLoadMoreOpportunitiesState: LoadMoreOpportunitiesState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  message: null,
  correlationId: null,
};

function readFilters(formData: FormData): OpportunityFilters {
  const number = (key: string): number | null => {
    const value = text(formData, key);
    if (value === null) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };
  return {
    scope: toOpportunityScope(formData.get('scope')),
    query: text(formData, 'recherche'),
    opportunityType: text(formData, 'type'),
    sectorId: number('secteur'),
    countryCode: text(formData, 'pays'),
    experienceLevel: text(formData, 'niveau'),
    remoteOnly: formData.get('remote') === 'on' || formData.get('remote') === 'true',
    newGraduates: formData.get('debutants') === 'on' || formData.get('debutants') === 'true',
    status: formData.get('statut') === 'all' ? 'all' : 'open',
  };
}

export async function loadMoreOpportunitiesAction(
  previous: LoadMoreOpportunitiesState,
  formData: FormData,
): Promise<LoadMoreOpportunitiesState> {
  const correlationId = newCorrelationId();
  const sealed = formData.get('curseur');
  const cursor = unsealCursor(typeof sealed === 'string' ? sealed : null);

  const result = await loadOpportunities(readFilters(formData), cursor, correlationId);
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

export async function loadMoreMyOpportunitiesAction(
  previous: LoadMoreOpportunitiesState,
  formData: FormData,
): Promise<LoadMoreOpportunitiesState> {
  const correlationId = newCorrelationId();
  const sealed = formData.get('curseur');
  const cursor = unsealCursor(typeof sealed === 'string' ? sealed : null);

  const result = await loadMyOpportunities(
    toMyOpportunityGroup(formData.get('groupe')),
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

export interface LoadMoreApplicationsState {
  status: 'idle' | 'error' | 'success';
  rows: ApplicationRow[];
  nextCursor: string | null;
  message: string | null;
  correlationId: string | null;
}

export const initialLoadMoreApplicationsState: LoadMoreApplicationsState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  message: null,
  correlationId: null,
};

export async function loadMoreApplicationsAction(
  previous: LoadMoreApplicationsState,
  formData: FormData,
): Promise<LoadMoreApplicationsState> {
  const correlationId = newCorrelationId();
  const sealed = formData.get('curseur');
  const cursor = unsealCursor(typeof sealed === 'string' ? sealed : null);

  const result = await loadMyApplications(
    toMyApplicationGroup(formData.get('groupe')),
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
/* Assistant de publication (ISE-057 -> ISE-059)                      */
/* ------------------------------------------------------------------ */

export async function saveOfferAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');

  const title = text(formData, 'title');
  const description = text(formData, 'description');
  const mode = text(formData, 'applicationMode') ?? 'internal';
  const fieldErrors: Record<string, string> = {};

  if (title === null || title.length < 3 || title.length > 160) {
    fieldErrors['title'] = 'L’intitulé doit contenir entre 3 et 160 caractères.';
  }
  if (description === null || description.length < 20) {
    fieldErrors['description'] = 'La description doit contenir au moins 20 caractères.';
  }
  if (mode === 'external_url' && text(formData, 'externalApplicationUrl') === null) {
    fieldErrors['externalApplicationUrl'] = 'Une adresse est nécessaire pour ce mode.';
  }
  if (mode === 'external_email' && text(formData, 'externalApplicationEmail') === null) {
    fieldErrors['externalApplicationEmail'] = 'Une adresse e-mail est nécessaire pour ce mode.';
  }
  if (mode === 'contact_recruiter' && text(formData, 'contactProfileId') === null) {
    fieldErrors['contactProfileId'] = 'Un profil référent est nécessaire pour ce mode.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return failure('Certaines informations sont incomplètes.', correlationId, fieldErrors);
  }

  const result = await saveOpportunityDraft(
    opportunityId,
    {
      opportunity_type: text(formData, 'opportunityType') ?? 'job',
      contract_type: text(formData, 'contractType') ?? '',
      title,
      summary: text(formData, 'summary') ?? '',
      description,
      organization_id: text(formData, 'organizationId') ?? '',
      organization_name_raw: text(formData, 'organizationName') ?? '',
      country_code: text(formData, 'countryCode') ?? '',
      city: text(formData, 'city') ?? '',
      remote_mode: text(formData, 'remoteMode') ?? '',
      remote_allowed: ['hybrid', 'remote'].includes(text(formData, 'remoteMode') ?? ''),
      start_date: text(formData, 'startDate') ?? '',
      duration_days: text(formData, 'durationDays') ?? '',
      deadline: text(formData, 'deadline') ?? '',
      positions_count: text(formData, 'positionsCount') ?? '1',
      compensation_min: text(formData, 'compensationMin') ?? '',
      compensation_max: text(formData, 'compensationMax') ?? '',
      currency: text(formData, 'currency') ?? '',
      compensation_disclosed: formData.get('compensationDisclosed') === 'on',
      application_mode: mode,
      external_application_url: text(formData, 'externalApplicationUrl') ?? '',
      external_application_email: text(formData, 'externalApplicationEmail') ?? '',
      contact_profile_id: text(formData, 'contactProfileId') ?? '',
      suitable_for_new_graduates: formData.get('newGraduates') === 'on',
      visibility: text(formData, 'visibility') ?? 'members',
    },
    correlationId,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);
  redirect(`${opportunityRoute(result.data)}/ciblage`);
}

export async function saveTargetingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');
  if (opportunityId === null) return failure('Opportunité introuvable.', correlationId);

  const requiredSkills = list(formData, 'requiredSkillIds');
  const preferredSkills = list(formData, 'preferredSkillIds');
  const languageCode = text(formData, 'languageCode');
  const questions = list(formData, 'questions').filter((q) => q.trim().length >= 5);

  const result = await saveOpportunityDraft(
    opportunityId,
    {
      sector_id: text(formData, 'sectorId') ?? '',
      sector_importance: formData.get('sectorRequired') === 'on' ? 'required' : 'preferred',
      job_function_id: text(formData, 'jobFunctionId') ?? '',
      experience_level: text(formData, 'experienceLevel') ?? '',
      min_experience_years: text(formData, 'minExperienceYears') ?? '',
      ideal_experience_years: text(formData, 'idealExperienceYears') ?? '',
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
      audience_promotion_ids: list(formData, 'audiencePromotionIds'),
      visibility: text(formData, 'visibility') ?? 'members',
      questions: questions.map((question) => ({ question, is_required: false })),
    },
    correlationId,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);
  redirect(`${opportunityRoute(opportunityId)}/apercu`);
}

export async function publishOpportunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');
  if (opportunityId === null) return failure('Opportunité introuvable.', correlationId);

  const result = await publishOpportunity(opportunityId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  redirect(
    `${opportunityRoute(opportunityId)}/suivi?publie=1&moderation=${result.data.moderationStatus}`,
  );
}

export async function transitionOpportunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');
  const to = text(formData, 'toStatus');
  if (opportunityId === null || (to !== 'paused' && to !== 'cancelled')) {
    return failure('Cette action n’est pas disponible.', correlationId);
  }

  const result = await transitionOpportunity(opportunityId, to, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(`${opportunityRoute(opportunityId)}/suivi`);
  return success('Statut de l’offre mis à jour.');
}

export async function closeOpportunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');
  const outcomeType = text(formData, 'outcomeType');
  if (opportunityId === null) return failure('Opportunité introuvable.', correlationId);
  if (outcomeType === null) {
    return failure('Indiquez le résultat de cette offre.', correlationId, {
      outcomeType: 'Ce choix est nécessaire pour clôturer.',
    });
  }

  const beneficiaryIds = list(formData, 'beneficiaryIds');
  const hiring = ['ise_hired', 'mission_awarded', 'intern_selected', 'multiple_selected'].includes(
    outcomeType,
  );
  const facilitated = hiring && formData.get('facilitated') === 'on';

  const result = await closeOpportunity(
    {
      opportunityId,
      outcomeType,
      // Aucun faux impact : hors recrutement, la base impose 0 et
      // `attribution_level = 'unknown'`. L'ecran envoie donc exactement
      // cela plutot que de laisser l'auteur croire le contraire.
      hiresCount: hiring ? Math.max(beneficiaryIds.length, 1) : 0,
      facilitated,
      attributionLevel: facilitated ? (text(formData, 'attributionLevel') ?? 'partial') : 'unknown',
      notes: text(formData, 'notes'),
      beneficiaryIds: hiring ? beneficiaryIds : [],
    },
    correlationId,
  );

  if (!result.ok) return failure(result.error.userMessage, correlationId);
  redirect(`${opportunityRoute(opportunityId)}/suivi?cloture=1`);
}

/* ------------------------------------------------------------------ */
/* Candidatures — trois chemins strictement distincts (D-55)          */
/* ------------------------------------------------------------------ */

/** Candidature INTERNE : le seul cas ou la plateforme constate le depot. */
export async function submitApplicationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');
  if (opportunityId === null) return failure('Opportunité introuvable.', correlationId);

  const message = text(formData, 'message');
  if (message !== null && message.length > 2000) {
    return failure('Votre message est trop long.', correlationId, {
      message: '2 000 caractères au maximum.',
    });
  }

  const result = await submitApplication(
    opportunityId,
    message,
    text(formData, 'cvDocumentId'),
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  redirect(`${applicationRoute(result.data)}?envoyee=1`);
}

/**
 * DECLARATION du membre pour une offre externe.
 *
 * C'est le SEUL chemin qui cree une candidature externe. Aucun clic, ni
 * aucune ouverture de lien, ne peut produire cet enregistrement
 * (MASTER PROMPT §27, D-55).
 */
export async function declareApplicationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');
  const declaredAt = text(formData, 'declaredAt');
  if (opportunityId === null) return failure('Opportunité introuvable.', correlationId);
  if (declaredAt === null) {
    return failure('Indiquez la date à laquelle vous avez postulé.', correlationId, {
      declaredAt: 'Cette date est nécessaire.',
    });
  }

  const result = await declareExternalApplication(
    opportunityId,
    declaredAt,
    text(formData, 'note'),
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  redirect(`${applicationRoute(result.data)}?declaree=1`);
}

/**
 * Ouverture d'une offre externe. Journalise un CLIC, rien d'autre : la
 * fonction de base renvoie `is_application: false` et l'ecran l'affiche.
 */
export async function openExternalOfferAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const opportunityId = text(formData, 'opportunityId');
  if (opportunityId === null) return failure('Opportunité introuvable.', correlationId);

  const result = await recordOutboundClick(opportunityId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(opportunityApplyRoute(opportunityId));
  return success('Consultation enregistrée. Ce n’est pas une candidature.');
}

/** ISE-065 / ISE-066 — etape suivante d'une candidature. */
export async function updateApplicationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const applicationId = text(formData, 'applicationId');
  const toStatus = text(formData, 'toStatus');
  if (applicationId === null || toStatus === null) {
    return failure('Cette mise à jour est incomplète.', correlationId, {
      toStatus: 'Sélectionnez une étape.',
    });
  }

  const result = await transitionApplication(
    applicationId,
    toStatus,
    text(formData, 'note'),
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  redirect(`${applicationRoute(applicationId)}?maj=1`);
}
