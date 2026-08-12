'use server';

import { claimSearchSchema } from '@ise/validation';
import { BUSINESS_ERRORS } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { searchClaimableProfiles, type ClaimableProfileSummary } from '@/lib/queries/claim';

/**
 * Etat de l'ecran ISE-005. Il porte les resultats en plus de l'etat de
 * formulaire commun : la recherche n'est pas une navigation, elle ne doit
 * donc pas changer d'URL ni recharger la page.
 */
export interface ClaimSearchState extends FormState {
  /** `null` tant qu'aucune recherche n'a abouti — a distinguer du tableau vide. */
  results: ClaimableProfileSummary[] | null;
}

/**
 * ISE-005 — Rechercher son profil reference.
 *
 * Le schema Zod partage est rejoue ici : la validation client n'a valeur que
 * de confort, le serveur reste l'autorite (MASTER PROMPT §62). La base
 * applique en plus l'authentification, la limitation de debit (D-103) et le
 * filtrage des profils deja reclames — l'application ne les reimplemente pas.
 */
export async function searchClaimAction(
  _previous: ClaimSearchState,
  formData: FormData,
): Promise<ClaimSearchState> {
  const correlationId = newCorrelationId();

  const parsed = claimSearchSchema.safeParse({
    lastName: formData.get('lastName'),
    firstName: formData.get('firstName'),
    graduationYear: formData.get('graduationYear'),
  });

  if (!parsed.success) {
    return {
      ...failure(
        BUSINESS_ERRORS.validation_failed,
        correlationId,
        fieldErrorsFromZod(parsed.error),
      ),
      results: null,
    };
  }

  const result = await searchClaimableProfiles(parsed.data, correlationId);

  if (!result.ok) {
    return { ...failure(result.error.userMessage, correlationId), results: null };
  }

  return {
    status: 'success',
    message: null,
    correlationId: null,
    fieldErrors: {},
    results: result.data,
  };
}
