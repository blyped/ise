'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import { checkbox, errorUrl, field, requiredField, successUrl } from '@/lib/collaborate-feedback';
import {
  createPromotionInvitation,
  revokePromotionInvitation,
  suggestMissingMember,
} from '@/lib/queries/promotions';
import {
  promotionInvitationsRoute,
  promotionInviteRoute,
  promotionReferencedMemberRoute,
} from '@/lib/routes/promotions';

/**
 * Server Actions de la tranche PROMOTIONS.
 *
 * Elles ne renvoient pas d'etat React : chaque action redirige vers
 * l'ecran d'origine en portant son resultat dans l'URL
 * (`lib/collaborate-feedback.ts`). Une erreur emporte toujours son
 * `correlation_id` (D-93, D-102).
 *
 * TROIS PRECAUTIONS PORTEES ICI.
 *   * `suggestMissingMemberAction` transmet l'indice de contact au
 *     serveur et ne le relit jamais : la reponse ne contient que le fait
 *     qu'il a ete enregistre.
 *   * `createInvitationAction` renvoie le jeton A L'ECRAN une seule fois
 *     et ne le journalise nulle part.
 *   * Aucune action ne cree de compte a la place d'un tiers.
 */

export async function suggestMissingMemberAction(formData: FormData): Promise<void> {
  const promotionId = Number.parseInt(requiredField(formData, 'promotionId'), 10);
  const profileId = requiredField(formData, 'profileId');
  const back = promotionReferencedMemberRoute(promotionId, profileId);

  const firstName = field(formData, 'firstName');
  const lastName = field(formData, 'lastName');
  const correlationId = newCorrelationId();

  if (Number.isNaN(promotionId) || firstName === null || lastName === null) {
    redirect(errorUrl(back, 'validation_failed', correlationId));
  }

  const result = await suggestMissingMember(
    promotionId,
    {
      firstName: firstName as string,
      lastName: lastName as string,
      countryCode: field(formData, 'countryCode'),
      contactHint: field(formData, 'contactHint'),
    },
    correlationId,
  );

  if (!result.ok) {
    redirect(errorUrl(back, result.error.code, correlationId));
  }

  revalidatePath(back);
  redirect(successUrl(back, 'suggested'));
}

export async function createInvitationAction(formData: FormData): Promise<void> {
  const promotionId = Number.parseInt(requiredField(formData, 'promotionId'), 10);
  const profileId = requiredField(formData, 'profileId');
  const back = promotionInviteRoute(promotionId, profileId);
  const correlationId = newCorrelationId();

  const channel = formData.get('channel') === 'email' ? 'email' : 'link';
  const email = channel === 'email' ? field(formData, 'email') : null;

  if (Number.isNaN(promotionId) || profileId.length === 0) {
    redirect(errorUrl(back, 'validation_failed', correlationId));
  }

  const result = await createPromotionInvitation(profileId, channel, email, correlationId);
  if (!result.ok) {
    redirect(errorUrl(back, result.error.code, correlationId));
  }

  revalidatePath(back);
  // Le jeton ne transite que par l'URL de retour, une seule fois, vers
  // l'emetteur lui-meme. Il n'est ecrit dans aucun journal.
  const token = result.data.token ?? '';
  redirect(`${back}?etat=ok&msg=invited&jeton=${encodeURIComponent(token)}`);
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const promotionId = Number.parseInt(requiredField(formData, 'promotionId'), 10);
  const invitationId = requiredField(formData, 'invitationId');
  const back = promotionInvitationsRoute(promotionId);
  const correlationId = newCorrelationId();

  const result = await revokePromotionInvitation(invitationId, correlationId);
  if (!result.ok) {
    redirect(errorUrl(back, result.error.code, correlationId));
  }

  revalidatePath(back);
  redirect(successUrl(back, 'revoked'));
}

/** Conserve pour la case « je partagerai le lien moi-meme » d'ISE-070. */
export async function acknowledgeManualShareAction(formData: FormData): Promise<void> {
  const promotionId = Number.parseInt(requiredField(formData, 'promotionId'), 10);
  const profileId = requiredField(formData, 'profileId');
  const shared = checkbox(formData, 'shared');
  if (!shared) {
    redirect(promotionInviteRoute(promotionId, profileId));
  }
  redirect(successUrl(promotionInvitationsRoute(promotionId), 'invited'));
}
