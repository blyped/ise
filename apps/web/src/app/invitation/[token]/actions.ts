'use server';

import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import { errorUrl, requiredField } from '@/lib/collaborate-feedback';
import { redeemPromotionInvitation } from '@/lib/queries/promotions';
import { ROUTES, invitationRoute } from '@/lib/routes';

/**
 * ISE-070 (suite) — confirmation de reception par l'invite.
 *
 * Redirige vers le tableau de bord en cas de succes : c'est lui qui
 * envoie deja vers `/bienvenue` tant que l'onboarding n'est pas termine
 * (meme comportement que l'amorcage admin, migration 0086).
 */
export async function redeemInvitationAction(formData: FormData): Promise<void> {
  const token = requiredField(formData, 'token');
  const correlationId = newCorrelationId();

  if (token.length === 0) {
    redirect(ROUTES.dashboard);
  }

  const result = await redeemPromotionInvitation(token, correlationId);
  if (!result.ok) {
    redirect(errorUrl(invitationRoute(token), result.error.code, correlationId));
  }

  redirect(ROUTES.dashboard);
}
