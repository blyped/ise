'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SUPPORT_ROUTES, ticketRoute } from '@/lib/routes/support';
import { NOTIFICATION_ROUTES } from '@/lib/routes/notifications';
import { frSupport, tsup } from '@/i18n/support';

/**
 * Ecritures de l'AIDE & SUPPORT (ISE-100).
 *
 * D-85 : aucune de ces actions ne pose, ne calcule ni n'affiche de delai
 * cible. `urgency` n'est pas transmis : la politique d'insertion de 0049
 * impose `urgency_source = 'system'`, l'urgence est attribuee par
 * l'equipe, jamais choisie par le demandeur.
 *
 * Toute transition de statut passe par `transition_support_ticket` : un
 * `update` direct de `status` est refuse par le trigger de 0049.
 */

/** ISE-100 — creation d'une demande. */
export async function createSupportTicketAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const categoryCode = formData.get('categoryCode');
  const subject = formData.get('subject');
  const description = formData.get('description');
  const fromPath = formData.get('fromPath');

  const fieldErrors: Record<string, string> = {};
  if (typeof categoryCode !== 'string' || categoryCode.length === 0) {
    fieldErrors['categoryCode'] = 'Choisissez une catégorie.';
  }
  if (typeof subject !== 'string' || subject.trim().length < 3 || subject.trim().length > 200) {
    fieldErrors['subject'] = 'L’objet doit contenir entre 3 et 200 caractères.';
  }
  if (typeof description !== 'string' || description.trim().length < 10) {
    fieldErrors['description'] = 'Décrivez le problème en au moins 10 caractères.';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_category_code: categoryCode as string,
    p_subject: (subject as string).trim(),
    p_description: (description as string).trim(),
    /* Contexte technique MINIMAL [34 §124-125] : la page concernee et la
       reference d'incident. Aucune coordonnee, aucun secret, aucun
       contenu de message prive. */
    p_technical_context: {
      page: typeof fromPath === 'string' && fromPath.length > 0 ? fromPath : SUPPORT_ROUTES.help,
      surface: 'web',
    },
    p_correlation_id: correlationId,
  });

  if (error) {
    console.error('[ISE] creation de ticket en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  const payload = (data ?? {}) as { ticket_id?: string; reference_code?: string };
  revalidatePath(SUPPORT_ROUTES.tickets);
  revalidatePath(NOTIFICATION_ROUTES.center);
  if (payload.ticket_id) {
    redirect(`${ticketRoute(payload.ticket_id)}?cree=1`);
  }
  return success(tsup(frSupport.ticket.created, { reference: payload.reference_code ?? '' }));
}

/** ISE-100 — reponse du demandeur dans le fil de sa demande. */
export async function replyToSupportTicketAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const ticketId = formData.get('ticketId');
  const body = formData.get('body');

  if (typeof ticketId !== 'string' || ticketId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }
  if (typeof body !== 'string' || body.trim().length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, {
      body: 'Écrivez votre réponse avant de l’envoyer.',
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('reply_to_support_ticket', {
    p_ticket_id: ticketId,
    p_body: body.trim(),
  });
  if (error) {
    console.error('[ISE] reponse a un ticket en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(ticketRoute(ticketId));
  return success(frSupport.ticket.replied);
}

/**
 * ISE-100 — cloture ou reouverture par le demandeur.
 * Passe par la fonction atomique : un `update` direct de `status` leve
 * `invalid_transition` (trigger de 0049).
 */
export async function transitionSupportTicketAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const ticketId = formData.get('ticketId');
  const toStatus = formData.get('toStatus');

  if (
    typeof ticketId !== 'string' ||
    ticketId.length === 0 ||
    (toStatus !== 'closed' && toStatus !== 'open')
  ) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_support_ticket', {
    p_ticket_id: ticketId,
    p_to_status: toStatus,
  });
  if (error) {
    console.error('[ISE] transition de ticket en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(ticketRoute(ticketId));
  revalidatePath(SUPPORT_ROUTES.tickets);
  return success(toStatus === 'closed' ? frSupport.ticket.closed : frSupport.ticket.reopened);
}

/** ISE-100 — signalement d'un profil ou d'un contenu (D-66). */
export async function createReportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const targetType = formData.get('targetType');
  const targetId = formData.get('targetId');
  const reasonCode = formData.get('reasonCode');
  const description = formData.get('description');

  if (
    typeof targetType !== 'string' ||
    targetType.length === 0 ||
    typeof targetId !== 'string' ||
    targetId.length === 0
  ) {
    return failure(frSupport.report.missingTarget, correlationId);
  }
  if (typeof reasonCode !== 'string' || reasonCode.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, {
      reasonCode: 'Choisissez un motif.',
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('create_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason_code: reasonCode,
    p_description:
      typeof description === 'string' && description.trim().length > 0 ? description.trim() : null,
  });
  if (error) {
    console.error('[ISE] signalement en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(SUPPORT_ROUTES.report);
  return success(frSupport.report.created);
}
