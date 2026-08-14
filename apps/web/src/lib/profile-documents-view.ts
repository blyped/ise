/**
 * Vocabulaire PARTAGÉ du dépôt de documents de profil (migration 0127).
 *
 * Ce module ne dépend de RIEN côté serveur : ni `next/headers`, ni le
 * client Supabase. C'est indispensable — les composants clients
 * (`DocumentUploadForm`, `DocumentsList`) en ont besoin, et importer
 * `lib/queries/*` depuis un composant client casse le build de Next.
 * Même séparation que `lib/opportunities-view.ts` / `lib/queries/opportunities.ts`.
 */

export const PROFILE_DOCUMENTS_BUCKET = 'profile-documents';

/**
 * Contraintes RÉELLES du bucket, relevées en base le 14/08/2026 :
 *   select id, file_size_limit, allowed_mime_types
 *     from storage.buckets where id = 'profile-documents';
 *   -> 10485760 octets, et exactement les sept types MIME ci-dessous.
 *
 * Elles sont recopiées ici ET dans la RPC `record_my_document()` : le
 * service Storage refuserait de toute façon, mais un refus expliqué au
 * moment du formulaire vaut mieux qu'une erreur de téléversement brute.
 * Si le bucket change, ces trois endroits changent ensemble.
 */
export const PROFILE_DOCUMENT_MAX_BYTES = 10_485_760;

export const PROFILE_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** Contrainte CHECK `profile_documents_document_type_check` (0008). */
export const PROFILE_DOCUMENT_TYPES = [
  'cv',
  'cover_letter',
  'certificate',
  'diploma',
  'portfolio',
  'publication',
  'technical_proposal',
  'financial_proposal',
  'other',
] as const;

export type ProfileDocumentType = (typeof PROFILE_DOCUMENT_TYPES)[number];

export interface MyDocument {
  documentId: string;
  documentType: string;
  title: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  createdAt: string | null;
  /** `profile-documents/<profile_id>/<fichier>` (contrainte de 0008). */
  storagePath: string;
  /** URL signée, ou `null` si Storage n'a pas su la produire. */
  downloadUrl: string | null;
}

/**
 * `profile-documents/<pid>/<fichier>` -> `<pid>/<fichier>`.
 *
 * DEUX REPRÉSENTATIONS DU MÊME CHEMIN coexistent, et les confondre produit
 * des erreurs silencieuses : la colonne `storage_path` porte le nom du
 * bucket (contrainte `profile_documents_storage_path_scope`), alors que
 * `storage.objects.name` ne le porte pas — la politique Storage lit
 * `private.storage_segment_uuid(name, 1)`, donc le premier segment de
 * `name` est déjà le profile_id.
 */
export function storageObjectName(storagePath: string): string {
  const prefix = `${PROFILE_DOCUMENTS_BUCKET}/`;
  return storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : storagePath;
}
