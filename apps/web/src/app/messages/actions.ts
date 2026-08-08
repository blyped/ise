'use server';

import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { unsealCursor } from '@/lib/opaque-cursor';
import { loadMessages } from '@/lib/queries/messaging';
import type { MessageRow } from '@/lib/messaging-view';
import { MESSAGING_ROUTES, conversationRoute } from '@/lib/routes/messaging';
import { NOTIFICATION_ROUTES } from '@/lib/routes/notifications';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';

/**
 * Ecritures de la tranche MESSAGERIE (ISE-097).
 *
 * TOUT passe par les fonctions atomiques de 0052. Aucun `insert` direct
 * depuis le client : l'envoi doit, dans la MEME transaction, verifier le
 * blocage, consommer la limitation de debit, poser le message et mettre
 * a jour les compteurs de non-lus. Un `insert` client laisserait des
 * compteurs faux et contournerait le blocage.
 *
 * D-83 — `sendMessageAction` ne renvoie « envoye » que lorsque la base a
 * accuse reception. Tant que la promesse n'est pas resolue, l'interface
 * affiche « Envoi en cours… », jamais « Envoyé ».
 */

export interface SendMessageResult {
  ok: boolean;
  /** Identifiant serveur du message persiste. `null` en cas d'echec. */
  messageId: string | null;
  createdAt: string | null;
  /** Message metier en francais, jamais une trace technique (D-102). */
  message: string | null;
  correlationId: string | null;
}

/**
 * ISE-097 — envoi d'un message.
 *
 * `clientMessageId` porte l'IDEMPOTENCE : si le reseau coupe apres
 * l'ecriture mais avant la reponse, rejouer l'envoi avec le meme
 * identifiant renvoie le message deja enregistre au lieu d'en creer un
 * second (contrainte unique `messages(conversation_id, client_message_id)`).
 */
export async function sendMessageAction(
  conversationId: string,
  body: string,
  clientMessageId: string,
): Promise<SendMessageResult> {
  const correlationId = newCorrelationId();
  const trimmed = body.trim();

  if (conversationId.length === 0 || trimmed.length === 0 || trimmed.length > 5000) {
    return {
      ok: false,
      messageId: null,
      createdAt: null,
      message: BUSINESS_ERRORS.validation_failed,
      correlationId,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: trimmed,
    p_client_message_id: clientMessageId,
  });

  if (error) {
    console.error('[ISE] envoi de message en echec', { correlationId, code: error.code });
    const business = toBusinessError(error, correlationId);
    return {
      ok: false,
      messageId: null,
      createdAt: null,
      message: business.userMessage,
      correlationId,
    };
  }

  const payload = (data ?? {}) as { message_id?: string; created_at?: string };
  revalidatePath(MESSAGING_ROUTES.inbox);
  revalidatePath(conversationRoute(conversationId));

  return {
    ok: true,
    messageId: payload.message_id ?? null,
    createdAt: payload.created_at ?? null,
    message: null,
    correlationId: null,
  };
}

/** ISE-097 — ouverture d'une conversation depuis un profil. */
export async function startConversationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const targetProfileId = formData.get('targetProfileId');
  const reason = formData.get('reason');
  const body = formData.get('body');
  const clientMessageId = formData.get('clientMessageId');

  if (
    typeof targetProfileId !== 'string' ||
    targetProfileId.length === 0 ||
    typeof body !== 'string' ||
    body.trim().length === 0
  ) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, {
      body: 'Écrivez votre message avant de l’envoyer.',
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('start_conversation', {
    p_target_profile_id: targetProfileId,
    p_body: body.trim(),
    p_initiation_reason: typeof reason === 'string' && reason.length > 0 ? reason : 'other',
    p_context_type: 'profile',
    p_context_id: null,
    p_context_label: null,
    p_client_message_id:
      typeof clientMessageId === 'string' && clientMessageId.length > 0 ? clientMessageId : null,
  });

  if (error) {
    console.error('[ISE] ouverture de conversation en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  const payload = (data ?? {}) as { conversation_id?: string };
  revalidatePath(MESSAGING_ROUTES.inbox);
  if (payload.conversation_id) revalidatePath(conversationRoute(payload.conversation_id));
  return success('Votre message est enregistré.');
}

/** ISE-097 — accuse de lecture. */
export async function markConversationReadAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const conversationId = formData.get('conversationId');
  if (typeof conversationId !== 'string' || conversationId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) {
    console.error('[ISE] marquage lu en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(MESSAGING_ROUTES.inbox);
  revalidatePath(conversationRoute(conversationId));
  return success('Conversation marquée comme lue.');
}

/** ISE-097 — archivage PAR PARTICIPANT (D-82). */
export async function setConversationArchivedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const conversationId = formData.get('conversationId');
  const archived = formData.get('archived') === 'true';
  if (typeof conversationId !== 'string' || conversationId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_conversation_archived', {
    p_conversation_id: conversationId,
    p_archived: archived,
  });
  if (error) {
    console.error('[ISE] archivage en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(MESSAGING_ROUTES.inbox);
  revalidatePath(conversationRoute(conversationId));
  return success(
    archived
      ? 'Conversation archivée. Elle reste visible pour votre interlocuteur.'
      : 'Conversation sortie de l’archive.',
  );
}

/**
 * ISE-097 — blocage. Le membre bloque n'en est jamais informe
 * (DIGEST E2 §A.10) : aucune notification n'est emise ici.
 */
export async function blockProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const profileId = formData.get('profileId');
  const conversationId = formData.get('conversationId');
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('block_profile', {
    p_profile_id: profileId,
    p_reason: null,
  });
  if (error) {
    console.error('[ISE] blocage en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(MESSAGING_ROUTES.inbox);
  revalidatePath(SETTINGS_ROUTES.blocked);
  if (typeof conversationId === 'string' && conversationId.length > 0) {
    revalidatePath(conversationRoute(conversationId));
  }
  return success('Ce membre ne peut plus vous solliciter. Il n’en est pas informé.');
}

/**
 * ISE-097 / ISE-100 — signalement d'un message. C'est le SEUL element
 * d'une conversation privee qui parvient a la moderation, et c'est le
 * signalant qui decide de ce qui en sort (MASTER PROMPT §24).
 */
export async function reportMessageAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const messageId = formData.get('messageId');
  const reasonCode = formData.get('reasonCode');
  const description = formData.get('description');
  const conversationId = formData.get('conversationId');

  if (
    typeof messageId !== 'string' ||
    messageId.length === 0 ||
    typeof reasonCode !== 'string' ||
    reasonCode.length === 0
  ) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId, {
      reasonCode: 'Choisissez un motif.',
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('report_message', {
    p_message_id: messageId,
    p_reason_code: reasonCode,
    p_description: typeof description === 'string' && description.length > 0 ? description : null,
  });
  if (error) {
    console.error('[ISE] signalement de message en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  if (typeof conversationId === 'string' && conversationId.length > 0) {
    revalidatePath(conversationRoute(conversationId));
  }
  revalidatePath(NOTIFICATION_ROUTES.center);
  return success('Votre signalement est transmis à la modération.');
}

/* ------------------------------------------------------------------ */
/* Pagination du fil (D-44)                                            */
/* ------------------------------------------------------------------ */

export interface OlderMessagesResult {
  ok: boolean;
  rows: MessageRow[];
  nextCursor: string | null;
  message: string | null;
  correlationId: string | null;
}

/**
 * ISE-097 — charge la page de messages PRECEDENTE. Le curseur recu du
 * navigateur est scelle : il est descelle ici et ne redevient jamais
 * lisible cote client (`lib/opaque-cursor.ts`).
 */
export async function loadOlderMessagesAction(
  conversationId: string,
  sealedCursor: string | null,
): Promise<OlderMessagesResult> {
  const correlationId = newCorrelationId();
  const cursor = unsealCursor(sealedCursor);

  if (cursor === null) {
    return {
      ok: false,
      rows: [],
      nextCursor: null,
      message: BUSINESS_ERRORS.validation_failed,
      correlationId,
    };
  }

  const result = await loadMessages(conversationId, cursor, correlationId);
  if (!result.ok) {
    return {
      ok: false,
      rows: [],
      nextCursor: null,
      message: result.error.userMessage,
      correlationId,
    };
  }
  return {
    ok: true,
    rows: result.data.rows,
    nextCursor: result.data.nextCursor,
    message: null,
    correlationId: null,
  };
}

/**
 * ISE-097 — accuse de lecture pose a l'OUVERTURE du fil.
 *
 * Une Server Action separee de `markConversationReadAction` : celle-ci
 * est appelee par un effet client au montage, sans formulaire ni
 * message de retour. Elle ne fait rien d'autre que remettre le compteur
 * du LECTEUR a zero — jamais celui d'un autre participant.
 */
export async function markConversationReadOnOpenAction(conversationId: string): Promise<void> {
  if (conversationId.length === 0) return;
  const correlationId = newCorrelationId();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) {
    console.error('[ISE] accuse de lecture a l ouverture en echec', {
      correlationId,
      code: error.code,
    });
    return;
  }
  revalidatePath(MESSAGING_ROUTES.inbox);
}
