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
import { readSupportContextFromForm } from '@/lib/support-context';
import {
  SUPPORT_ATTACHMENTS_BUCKET,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MAX_FILES,
  isSupportAttachmentMime,
  supportAttachmentExtension,
  supportSignatureMatches,
} from '@/lib/support-attachments';

/**
 * Ecritures de l'AIDE & SUPPORT (ISE-100), volet « Remonter une
 * information » du module Communication.
 *
 * D-85 : aucune de ces actions ne pose, ne calcule ni n'affiche de delai
 * cible. `urgency` n'est pas transmis : la priorite initiale est posee
 * en base d'apres la NATURE de la remontee
 * (`support_categories.default_urgency`, 0131), avec
 * `urgency_source = 'system'`. Seule l'administration la requalifie.
 *
 * Toute transition de statut passe par `transition_support_ticket` : un
 * `update` direct de `status` est refuse par le trigger de 0049.
 *
 * PIECES JOINTES : le fichier est televerse dans le bucket PRIVE
 * `support-attachments` avec la session du membre, PUIS enregistre par
 * `attach_support_file()`. La securite n'est pas ici — elle est dans les
 * politiques Storage de 0027 et dans la RPC de 0131, qui reverifient
 * tout. AUCUNE ANALYSE ANTIVIRALE n'est faite, ni ici ni ailleurs :
 * aucun antivirus n'est disponible sur cette plateforme. La verification
 * de signature ci-dessous empeche de faire passer un executable pour une
 * image ; elle ne dit rien de l'innocuite du contenu.
 */

interface AttachmentOutcome {
  uploaded: number;
  failed: number;
}

/**
 * Client Supabase de la session en cours. Le type est DEDUIT de la
 * fabrique du projet plutot qu'importe de `@supabase/supabase-js` :
 * `apps/web` ne declare que `@supabase/ssr`, importer le paquet
 * sous-jacent serait une dependance implicite.
 */
type SessionClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Fichiers reellement choisis par le membre, dans la limite de D-84. */
function readAttachmentFiles(formData: FormData): File[] {
  return formData
    .getAll('attachments')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, SUPPORT_ATTACHMENT_MAX_FILES);
}

/**
 * Depose les fichiers puis enregistre les fiches.
 *
 * Un echec de piece jointe ne fait JAMAIS echouer la remontee : le
 * message est deja ecrit, le perdre serait pire que de perdre une
 * capture. L'appelant en informe le membre, qui peut rejoindre le
 * fichier dans une reponse.
 */
async function uploadSupportAttachments(
  supabase: SessionClient,
  ticketId: string,
  messageId: string,
  files: readonly File[],
): Promise<AttachmentOutcome> {
  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    const mimeType = file.type.toLowerCase();

    if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES || !isSupportAttachmentMime(mimeType)) {
      failed += 1;
      continue;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!supportSignatureMatches(mimeType, bytes)) {
      failed += 1;
      continue;
    }

    // Nom d'objet toujours NEUF : le nom d'origine peut contenir
    // n'importe quoi, il n'est conserve que comme metadonnee.
    const objectName = `${ticketId}/${globalThis.crypto.randomUUID()}.${supportAttachmentExtension(mimeType)}`;
    const storagePath = `${SUPPORT_ATTACHMENTS_BUCKET}/${objectName}`;
    const fileName =
      file.name.trim().slice(0, 255) || `piece.${supportAttachmentExtension(mimeType)}`;

    const stored = await supabase.storage
      .from(SUPPORT_ATTACHMENTS_BUCKET)
      .upload(objectName, bytes, { contentType: mimeType, upsert: false });

    if (stored.error) {
      failed += 1;
      continue;
    }

    const { error } = await supabase.rpc('attach_support_file', {
      p_message_id: messageId,
      p_storage_path: storagePath,
      p_file_name: fileName,
      p_mime_type: mimeType,
      p_byte_size: file.size,
    });

    if (error) {
      // Octets deposes mais rattaches a rien : on les retire plutot que
      // de laisser un orphelin dans le bucket.
      await supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).remove([objectName]);
      failed += 1;
      continue;
    }

    uploaded += 1;
  }

  return { uploaded, failed };
}

/** ISE-100 — creation d'une remontee. */
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
    fieldErrors['categoryCode'] = 'Choisissez la nature de votre remontée.';
  }
  if (typeof subject !== 'string' || subject.trim().length < 3 || subject.trim().length > 200) {
    fieldErrors['subject'] = 'L’objet doit contenir entre 3 et 200 caractères.';
  }
  if (typeof description !== 'string' || description.trim().length < 10) {
    fieldErrors['description'] = 'Décrivez le problème en au moins 10 caractères.';
  }

  const chosen = formData
    .getAll('attachments')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const files = chosen.slice(0, SUPPORT_ATTACHMENT_MAX_FILES);

  if (chosen.length > SUPPORT_ATTACHMENT_MAX_FILES) {
    fieldErrors['attachments'] = frSupport.attachments.tooMany;
  }
  if (files.some((file) => file.size > SUPPORT_ATTACHMENT_MAX_BYTES)) {
    fieldErrors['attachments'] = frSupport.attachments.tooLarge;
  }
  if (files.some((file) => !isSupportAttachmentMime(file.type.toLowerCase()))) {
    fieldErrors['attachments'] = frSupport.attachments.typeInvalid;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  /* Contexte technique [34 §124-125] : ecran d'origine, navigateur,
     systeme, type d'appareil, environnement. Liste blanche appliquee
     ici PUIS en base (`private.sanitize_support_context`). Aucune
     coordonnee, aucun secret, aucun contenu prive. Ce bloc n'est jamais
     renvoye au demandeur. */
  const technicalContext = readSupportContextFromForm(
    formData,
    typeof fromPath === 'string' && fromPath.length > 0 ? fromPath : SUPPORT_ROUTES.help,
  );

  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_category_code: categoryCode as string,
    p_subject: (subject as string).trim(),
    p_description: (description as string).trim(),
    p_technical_context: technicalContext,
    p_correlation_id: correlationId,
  });

  if (error) {
    console.error('[ISE] creation de remontee en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  const payload = (data ?? {}) as {
    ticket_id?: string;
    message_id?: string;
    reference_code?: string;
  };

  let outcome: AttachmentOutcome = { uploaded: 0, failed: 0 };
  if (files.length > 0 && payload.ticket_id && payload.message_id) {
    outcome = await uploadSupportAttachments(
      supabase,
      payload.ticket_id,
      payload.message_id,
      files,
    );
  }

  revalidatePath(SUPPORT_ROUTES.tickets);
  revalidatePath(NOTIFICATION_ROUTES.center);

  if (payload.ticket_id) {
    const suffix = outcome.failed > 0 ? '?cree=1&pj=partiel' : '?cree=1';
    redirect(`${ticketRoute(payload.ticket_id)}${suffix}`);
  }
  return success(tsup(frSupport.ticket.created, { reference: payload.reference_code ?? '' }));
}

/** ISE-100 — reponse du demandeur dans le fil de sa remontee. */
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

  const files = readAttachmentFiles(formData);
  if (files.some((file) => file.size > SUPPORT_ATTACHMENT_MAX_BYTES)) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, {
      attachments: frSupport.attachments.tooLarge,
    });
  }
  if (files.some((file) => !isSupportAttachmentMime(file.type.toLowerCase()))) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, {
      attachments: frSupport.attachments.typeInvalid,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('reply_to_support_ticket', {
    p_ticket_id: ticketId,
    p_body: body.trim(),
  });
  if (error) {
    console.error('[ISE] reponse a une remontee en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  const payload = (data ?? {}) as { message_id?: string };
  let outcome: AttachmentOutcome = { uploaded: 0, failed: 0 };
  if (files.length > 0 && payload.message_id) {
    outcome = await uploadSupportAttachments(supabase, ticketId, payload.message_id, files);
  }

  revalidatePath(ticketRoute(ticketId));
  return success(outcome.failed > 0 ? frSupport.attachments.partial : frSupport.ticket.replied);
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
    console.error('[ISE] transition de remontee en echec', { correlationId, code: error.code });
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
