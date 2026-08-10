'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { t } from '@/i18n/fr';
import { frPromotions } from '@/i18n/promotions';
import { frAdmin } from '@/i18n/admin';
import { batchSentMessage, frAdminCampaigns } from '@/i18n/admin-campaigns';
import { newCorrelationId } from '@/lib/correlation';
import { serverEnv } from '@/lib/env';
import { sendEmail } from '@/lib/email/resend';
import { invitationRoute } from '@/lib/routes';
import { adminCampaignRoute, adminCampaignsRoute } from '@/lib/routes/admin';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import {
  integer,
  requiredText,
  runAdminAction,
  text,
  validationError,
} from '@/lib/admin/action-support';
import { failure, success, type FormState } from '@/lib/form-state';

/** Echappement minimal avant interpolation dans un corps d'e-mail HTML (memes regles que promotions/actions.ts). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * SA-012 -- Cree une campagne (draft) puis redirige vers sa fiche.
 * Ne passe pas par `runAdminActionWithPayload` (qui ne renvoie qu'un
 * message) : il faut ici recuperer l'identifiant cree pour rediriger.
 */
export async function createCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['promotions.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? 'Action non autorisee.', correlationId);
  }
  const promotionId = integer(formData, 'promotionId');
  const name = requiredText(formData, 'name');
  const dailyQuota = integer(formData, 'dailyQuota') ?? 20;
  if (promotionId === null || name.length < 3) {
    return validationError(frAdminCampaigns.create.invalid, {
      name: name.length < 3 ? frAdminCampaigns.create.invalid : '',
    });
  }
  const result = await adminRpc(
    'admin_create_campaign',
    {
      p_promotion_id: promotionId,
      p_name: name,
      p_objective: text(formData, 'objective'),
      p_channel: text(formData, 'channel') ?? 'email',
      p_daily_quota: dailyQuota,
      p_total_quota: integer(formData, 'totalQuota'),
      p_starts_at: null,
      p_ends_at: null,
    },
    correlationId,
    (payload) => payload as { campaign_id: string },
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);
  revalidatePath(adminCampaignsRoute(promotionId));
  redirect(adminCampaignRoute(promotionId, result.data.campaign_id));
}

/**
 * SA-013/SA-014 -- Lance un lot d'invitations puis envoie les e-mails
 * correspondants. Les jetons en clair ne quittent JAMAIS cette fonction
 * (contrairement au flux individuel ISE-070, ou l'emetteur est aussi le
 * destinataire de l'affichage) : ici, l'admin n'est pas le destinataire,
 * donc le jeton n'a aucune raison de transiter jusqu'a l'ecran.
 */
export async function launchCampaignBatchAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['promotions.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? 'Action non autorisee.', correlationId);
  }
  const campaignId = requiredText(formData, 'campaignId');
  const promotionId = integer(formData, 'promotionId');
  const promotionLabel = text(formData, 'promotionLabel') ?? '';

  const result = await adminRpc(
    'admin_launch_campaign_batch',
    { p_campaign_id: campaignId },
    correlationId,
    (payload) =>
      payload as {
        sent_count: number;
        invitations: Array<{
          invitationId: string;
          profileId: string;
          firstName: string | null;
          primaryEmail: string | null;
          token: string;
        }>;
      },
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  let emailFailures = 0;
  for (const invitation of result.data.invitations) {
    if (invitation.primaryEmail === null) {
      emailFailures += 1;
      continue;
    }
    try {
      const link = `${serverEnv().NEXT_PUBLIC_SITE_URL}${invitationRoute(invitation.token)}`;
      const bodyText = t(frPromotions.invite.previewBody, {
        name: invitation.firstName ?? '',
        promotion: promotionLabel,
      });
      const sent = await sendEmail({
        to: invitation.primaryEmail,
        subject: t(frPromotions.invite.emailSubject, { promotion: promotionLabel }),
        html:
          `<p>${escapeHtml(bodyText)}</p>` +
          `<p><a href="${link}">${escapeHtml(frPromotions.invite.previewCta)}</a></p>`,
        text: `${bodyText}\n\n${frPromotions.invite.previewCta} : ${link}`,
      });
      if (!sent.ok) emailFailures += 1;
    } catch (error) {
      console.error('[ISE] campagne -- envoi e-mail en erreur', {
        correlationId,
        message: error instanceof Error ? error.message : 'inconnu',
      });
      emailFailures += 1;
    }
  }

  if (promotionId !== null) revalidatePath(adminCampaignRoute(promotionId, campaignId));

  return success(batchSentMessage(result.data.sent_count, emailFailures));
}

export async function pauseCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const promotionId = integer(formData, 'promotionId');
  const reason = requiredText(formData, 'reason');
  const result = await runAdminAction(
    ['promotions.manage'],
    'admin_pause_campaign',
    { p_campaign_id: campaignId, p_reason: reason },
    frAdminCampaigns.detail.paused,
  );
  if (promotionId !== null) revalidatePath(adminCampaignRoute(promotionId, campaignId));
  return result;
}

export async function resumeCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const promotionId = integer(formData, 'promotionId');
  const result = await runAdminAction(
    ['promotions.manage'],
    'admin_resume_campaign',
    { p_campaign_id: campaignId },
    frAdminCampaigns.detail.resumed,
  );
  if (promotionId !== null) revalidatePath(adminCampaignRoute(promotionId, campaignId));
  return result;
}

export async function closeCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const promotionId = integer(formData, 'promotionId');
  const reason = requiredText(formData, 'reason');
  const result = await runAdminAction(
    ['promotions.manage'],
    'admin_close_campaign',
    { p_campaign_id: campaignId, p_reason: reason },
    frAdminCampaigns.detail.closed,
  );
  if (promotionId !== null) revalidatePath(adminCampaignRoute(promotionId, campaignId));
  return result;
}
