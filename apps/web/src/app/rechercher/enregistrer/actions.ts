'use server';

import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS } from '@ise/domain';
import { frSearch } from '@/i18n/search';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { parseCriteriaFromQueryString } from '@/lib/search-criteria';
import { deleteSavedSearch, saveSearchWithAlert, setAlertStatus } from '@/lib/queries/saved-search';
import { saveSearchFormSchema, saveSearchInputFrom } from './schema';

export interface SaveSearchState extends FormState {
  /** `true` quand l'alerte vient d'etre reellement persistee. */
  alertPersisted: boolean;
}

export const initialSaveSearchState: SaveSearchState = {
  status: 'idle',
  message: null,
  correlationId: null,
  fieldErrors: {},
  alertPersisted: false,
};

/**
 * ISE-036 — enregistrer la recherche et son alerte.
 *
 * L'ecriture est atomique : `public.save_search_with_alert()` cree ou met
 * a jour la recherche ET l'alerte dans la meme transaction (migration
 * 0035). Il n'existe pas d'etat intermediaire « recherche enregistree,
 * alerte perdue ».
 *
 * Le message de succes n'annonce AUCUN delai d'envoi : le worker qui
 * parcourt l'annuaire n'existe pas encore, et l'ecran le dit (MASTER
 * PROMPT §27, §98, §113).
 */
export async function saveSearchAction(
  _previous: SaveSearchState,
  formData: FormData,
): Promise<SaveSearchState> {
  const correlationId = newCorrelationId();

  const form = saveSearchFormSchema.safeParse(saveSearchInputFrom(formData));
  if (!form.success) {
    return {
      ...failure(BUSINESS_ERRORS.validation_failed, correlationId, fieldErrorsFromZod(form.error)),
      alertPersisted: false,
    };
  }

  // Les criteres sont revalides par le meme schema qu'a l'aller
  // (MASTER PROMPT §62) : rien n'est enregistre sur la seule foi du client.
  const criteria = parseCriteriaFromQueryString(String(formData.get('criteres') ?? ''));
  if (!criteria.ok) {
    return {
      ...failure(frSearch.find.validationFailed, correlationId),
      alertPersisted: false,
    };
  }

  const result = await saveSearchWithAlert(
    {
      name: form.data.name,
      criteria: criteria.criteria,
      alertEnabled: form.data.alertEnabled,
      frequency: form.data.frequency,
      channel: form.data.channel,
      savedSearchId: form.data.savedSearchId ?? null,
    },
    correlationId,
  );

  if (!result.ok) {
    return { ...failure(result.error.userMessage, correlationId), alertPersisted: false };
  }

  revalidatePath(SEARCH_ROUTES.save);
  revalidatePath(SEARCH_ROUTES.find);

  return {
    status: 'success',
    message: form.data.alertEnabled
      ? frSearch.save.successWithAlert
      : frSearch.save.successWithoutAlert,
    correlationId: null,
    fieldErrors: {},
    alertPersisted: form.data.alertEnabled,
  };
}

/** ISE-036 — suspendre ou reactiver l'alerte d'une recherche existante. */
export async function toggleAlertAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const savedSearchId = String(formData.get('savedSearchId') ?? '');
  const status = formData.get('status') === 'paused' ? 'paused' : 'active';

  if (savedSearchId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const result = await setAlertStatus(savedSearchId, status, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(SEARCH_ROUTES.save);
  revalidatePath(SEARCH_ROUTES.find);
  return { status: 'success', message: null, correlationId: null, fieldErrors: {} };
}

/** ISE-036 — supprimer une recherche enregistree (alerte comprise, en cascade). */
export async function deleteSavedSearchAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const savedSearchId = String(formData.get('savedSearchId') ?? '');

  if (savedSearchId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const result = await deleteSavedSearch(savedSearchId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(SEARCH_ROUTES.save);
  revalidatePath(SEARCH_ROUTES.find);
  return { status: 'success', message: null, correlationId: null, fieldErrors: {} };
}
