'use server';

import { revalidatePath } from 'next/cache';
import { toBusinessError } from '@ise/domain';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { frDocuments, fillDocuments } from '@/i18n/profile-documents';
import {
  PROFILE_DOCUMENTS_BUCKET,
  PROFILE_DOCUMENT_MAX_BYTES,
  PROFILE_DOCUMENT_MIME_TYPES,
  PROFILE_DOCUMENT_TYPES,
  storageObjectName,
} from '@/lib/profile-documents-view';

/**
 * Server Actions du dépôt de documents de profil (migration 0127).
 *
 * Même architecture que `vitrine-publique/actions.ts` : le fichier est
 * televersé dans le bucket par le client Storage du membre, PUIS une RPC
 * enregistre la fiche. Ce n'est pas ici que se trouve la sécurité —
 * elle est en base :
 *   · la politique `ise_profile_documents_write` refuse tout dépôt hors
 *     de `profile-documents/<mon profile_id>/` ;
 *   · le bucket refuse au-delà de 10 Mo et hors de sa liste MIME ;
 *   · `record_my_document()` revérifie propriétaire, type, taille et
 *     l'existence réelle de l'objet avant d'écrire la ligne.
 * Ce fichier n'offre que le chemin normal, avec des messages lisibles.
 *
 * ANALYSE ANTIVIRALE : AUCUNE, et rien ici ne prétend le contraire.
 * Aucun antivirus n'est disponible dans ce déploiement. Ce qui est fait
 * ci-dessous est une vérification de FORMAT (signature binaire), qui
 * empêche de faire passer un exécutable pour un PDF mais ne dit
 * strictement rien de l'innocuité du contenu. Un document Office
 * légitimement formé peut porter des macros. Brancher un service
 * d'analyse externe reste un manque explicite (même convention que D-133
 * sur les variantes d'images non générées).
 */

const TYPE_VALUES: readonly string[] = PROFILE_DOCUMENT_TYPES;
const MIME_VALUES: readonly string[] = PROFILE_DOCUMENT_MIME_TYPES;

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshDocuments(): void {
  revalidatePath(PROFILE_ROUTES.documents);
  revalidatePath(PROFILE_ROUTES.overview);
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function isAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/**
 * Le type déclaré par le navigateur est-il cohérent avec les premiers
 * octets du fichier ?
 *
 * Les trois formats Office (.docx, .xlsx, .pptx) sont des archives ZIP :
 * leur signature est identique et ne permet PAS de les distinguer entre
 * eux. On vérifie donc la FAMILLE, pas le format exact — le dire est plus
 * honnête que de laisser croire à un contrôle qui n'existe pas.
 */
function signatureMatches(mimeType: string, bytes: Uint8Array): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return startsWith(bytes, [0x50, 0x4b]); // PK — archive ZIP (OOXML)
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/webp':
      return isAscii(bytes, 0, 'RIFF') && isAscii(bytes, 8, 'WEBP');
    default:
      return false;
  }
}

/** Extension réelle du fichier, déduite du type MIME et non du nom saisi. */
function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}

/* ------------------------------------------------------------------ */
/* 1. Dépôt d'un document                                              */
/* ------------------------------------------------------------------ */

export async function uploadProfileDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;

  const rawType = formData.get('documentType');
  const documentType = typeof rawType === 'string' ? rawType.trim() : '';
  if (!TYPE_VALUES.includes(documentType)) {
    return failure(frDocuments.typeRequired, correlationId, {
      documentType: frDocuments.typeRequired,
    });
  }

  const rawTitle = formData.get('title');
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (title.length > 200) {
    return failure(frDocuments.titleTooLong, correlationId, {
      title: frDocuments.titleTooLong,
    });
  }

  const isPrimary = formData.get('isPrimary') === 'on';

  const file = formData.get('document');
  if (!(file instanceof File) || file.size === 0) {
    return failure(frDocuments.fileRequired, correlationId, {
      document: frDocuments.fileRequired,
    });
  }
  if (file.size > PROFILE_DOCUMENT_MAX_BYTES) {
    return failure(frDocuments.fileTooLarge, correlationId, {
      document: frDocuments.fileTooLarge,
    });
  }

  const mimeType = file.type.toLowerCase();
  if (!MIME_VALUES.includes(mimeType)) {
    return failure(frDocuments.fileTypeInvalid, correlationId, {
      document: frDocuments.fileTypeInvalid,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatureMatches(mimeType, bytes)) {
    return failure(frDocuments.fileContentMismatch, correlationId, {
      document: frDocuments.fileContentMismatch,
    });
  }

  // Nom d'objet toujours NEUF : le nom d'origine n'est jamais utilisé comme
  // chemin (il peut contenir n'importe quoi) — il est seulement conservé
  // comme métadonnée pour l'affichage et le téléchargement.
  const objectName = `${profileId}/${globalThis.crypto.randomUUID()}.${extensionFor(mimeType)}`;
  const storagePath = `${PROFILE_DOCUMENTS_BUCKET}/${objectName}`;
  const originalFilename = file.name.trim().slice(0, 255) || `document.${extensionFor(mimeType)}`;

  const supabase = await createSupabaseServerClient();

  const uploaded = await supabase.storage
    .from(PROFILE_DOCUMENTS_BUCKET)
    .upload(objectName, bytes, { contentType: mimeType, upsert: false });

  if (uploaded.error) {
    return failure(frDocuments.uploadFailed, correlationId, {
      document: frDocuments.uploadFailed,
    });
  }

  const { error } = await supabase.rpc('record_my_document', {
    p_storage_path: storagePath,
    p_document_type: documentType,
    p_original_filename: originalFilename,
    p_mime_type: mimeType,
    p_size_bytes: file.size,
    p_title: title.length > 0 ? title : null,
    p_is_primary: isPrimary,
  });

  if (error) {
    // Le fichier vient d'être déposé mais n'est rattaché à rien : on le
    // retire plutôt que de laisser un objet orphelin dans le bucket.
    await supabase.storage.from(PROFILE_DOCUMENTS_BUCKET).remove([objectName]);
    const business = toBusinessError(error, correlationId);
    return failure(business.userMessage, correlationId);
  }

  refreshDocuments();
  return success(frDocuments.saved);
}

/* ------------------------------------------------------------------ */
/* 2. Suppression d'un document                                        */
/* ------------------------------------------------------------------ */

/**
 * Supprime la LIGNE puis l'OBJET, dans cet ordre.
 *
 * La RPC renvoie le chemin de stockage : c'est la seule information qui
 * permet ensuite d'effacer les octets. L'ordre inverse (octets d'abord)
 * laisserait, en cas d'échec de la base, une fiche pointant vers un
 * fichier disparu — un lien de téléchargement mort dans l'écran.
 * Si c'est le retrait Storage qui échoue, il reste des octets orphelins
 * dans un bucket PRIVÉ, inaccessibles : moins grave, mais réel, et le
 * nettoyage périodique de Storage n'est toujours pas branché (cf. 0120).
 */
export async function deleteProfileDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;

  const rawId = formData.get('documentId');
  const documentId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!UUID_RE.test(documentId)) {
    return failure(frDocuments.documentMissing, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('delete_my_document', {
    p_document_id: documentId,
  });

  if (error) {
    const business = toBusinessError(error, correlationId);
    return failure(business.userMessage, correlationId);
  }

  const payload = (typeof data === 'object' && data !== null ? data : {}) as Record<
    string,
    unknown
  >;
  const storagePath = typeof payload['storage_path'] === 'string' ? payload['storage_path'] : null;
  const detached =
    typeof payload['detached_applications'] === 'number' ? payload['detached_applications'] : 0;

  if (storagePath !== null) {
    await supabase.storage.from(PROFILE_DOCUMENTS_BUCKET).remove([storageObjectName(storagePath)]);
  }

  refreshDocuments();
  return success(
    detached > 0
      ? fillDocuments(frDocuments.removedDetached, { count: detached })
      : frDocuments.removed,
  );
}

/* ------------------------------------------------------------------ */
/* 3. Document principal de son type                                   */
/* ------------------------------------------------------------------ */

export async function setPrimaryProfileDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;

  const rawId = formData.get('documentId');
  const documentId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!UUID_RE.test(documentId)) {
    return failure(frDocuments.documentMissing, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_my_primary_document', { p_document_id: documentId });

  if (error) {
    const business = toBusinessError(error, correlationId);
    return failure(business.userMessage, correlationId);
  }

  refreshDocuments();
  return success(frDocuments.primarySet);
}
