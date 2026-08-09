'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { t } from '@/i18n/fr';
import { frPromotions } from '@/i18n/promotions';
import { newCorrelationId } from '@/lib/correlation';
import { checkbox, errorUrl, field, requiredField, successUrl } from '@/lib/collaborate-feedback';
import { serverEnv } from '@/lib/env';
import { sendEmail } from '@/lib/email/resend';
import {
  createPromotionInvitation,
  revokePromotionInvitation,
  suggestMissingMember,
} from '@/lib/queries/promotions';
import { invitationRoute } from '@/lib/routes';
import {
  promotionInvitationsRoute,
  promotionInviteRoute,
  promotionReferencedMemberRoute,
} from '@/lib/routes/promotions';

/** Echappement minimal avant interpolation dans un corps d'e-mail HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

  const token = result.data.token ?? '';

  // Envoi reel (ADDENDUM email) : uniquement en mode « e-mail », et sans
  // jamais faire echouer l'action si Resend est indisponible — le jeton
  // reste affiche a l'inviteur juste apres, qui garde la main (mode lien).
  if (channel === 'email' && email !== null && token.length > 0) {
    try {
      const invitedFirstName = field(formData, 'invitedFirstName') ?? '';
      const promotionLabel = field(formData, 'promotionLabel') ?? '';
      const link = `${serverEnv().NEXT_PUBLIC_SITE_URL}${invitationRoute(token)}`;
      const bodyText = t(frPromotions.invite.previewBody, {
        name: invitedFirstName,
        promotion: promotionLabel,
      });
      const sent = await sendEmail({
        to: email,
        subject: t(frPromotions.invite.emailSubject, { promotion: promotionLabel }),
        html:
          `<p>${escapeHtml(bodyText)}</p>` +
          `<p><a href="${link}">${escapeHtml(frPromotions.invite.previewCta)}</a></p>`,
        text: `${bodyText}\n\n${frPromotions.invite.previewCta} : ${link}`,
      });
      if (!sent.ok) {
        console.error('[ISE] invitation — envoi e-mail en echec', { correlationId });
      }
    } catch (error) {
      // L'invitation existe deja en base : un souci d'environnement sur
      // l'e-mail ne doit jamais faire perdre le jeton a l'inviteur, qui
      // reste affiche juste apres (mode lien de secours).
      console.error('[ISE] invitation — envoi e-mail en erreur', {
        correlationId,
        message: error instanceof Error ? error.message : 'inconnu',
      });
    }
  }

  revalidatePath(back);
  // Le jeton ne transite que par l'URL de retour, une seule fois, vers
  // l'emetteur lui-meme. Il n'est ecrit dans aucun journal.
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
