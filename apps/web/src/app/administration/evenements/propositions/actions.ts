'use server';

import type { FormState } from '@/lib/form-state';
import { moderateProposal } from '@/lib/admin/moderate-proposal';

/**
 * Décision sur une proposition d'ÉVÉNEMENT (0132), permission
 * `events.manage`. Pendant strict du fichier d'actions des actualités ;
 * toute la logique est mutualisée dans `lib/admin/moderate-proposal.ts`.
 *
 * Une acceptation re-vérifie ici ce que la proposition avait relâché :
 * `moderate_content_proposal` refuse de publier un événement en ligne
 * sans lien de connexion, ou un présentiel sans lieu.
 */

export async function approveEventProposalAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return moderateProposal('event', 'approved', formData);
}

export async function rejectEventProposalAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return moderateProposal('event', 'rejected', formData);
}
