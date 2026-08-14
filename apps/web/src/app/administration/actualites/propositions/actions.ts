'use server';

import type { FormState } from '@/lib/form-state';
import { moderateProposal } from '@/lib/admin/moderate-proposal';

/**
 * Décision sur une proposition d'ACTUALITÉ (0132), permission
 * `content.publish`.
 *
 * Deux actions plutôt qu'une seule paramétrée : une Server Action est
 * liée à un `<form>`, et le choix d'accepter ou de refuser doit être
 * porté par le bouton qu'on presse, pas par un champ caché que l'on
 * pourrait laisser sur la mauvaise valeur.
 *
 * Toute la logique est dans `lib/admin/moderate-proposal.ts` : ce fichier
 * `'use server'` n'exporte que des fonctions asynchrones (D-159).
 */

export async function approveNewsProposalAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return moderateProposal('news', 'approved', formData);
}

export async function rejectNewsProposalAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return moderateProposal('news', 'rejected', formData);
}
