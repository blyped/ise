import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  PROFILE_DOCUMENTS_BUCKET,
  storageObjectName,
  type MyDocument,
} from '@/lib/profile-documents-view';

/**
 * Lecture des documents de profil du membre (migration 0127).
 *
 * Le bucket `profile-documents` est PRIVÉ (0027). Aucune URL publique
 * n'existe : chaque téléchargement passe par une URL SIGNÉE de courte
 * durée, exactement comme `signedAvatarUrl()` dans `member-profile.ts`.
 * L'URL est fabriquée au rendu de la page et n'est jamais stockée.
 *
 * Les constantes et le type `MyDocument` vivent dans
 * `lib/profile-documents-view.ts` : ce module-ci importe `next/headers`
 * par le client Supabase et ne peut donc pas être importé côté client.
 */

export * from '@/lib/profile-documents-view';

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

/** Durée de validité d'une URL signée de téléchargement, en secondes. */
const SIGNED_URL_TTL_SECONDS = 300;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * Mes documents, avec une URL signée par ligne.
 *
 * Une URL qui ne peut pas être signée ne fait pas échouer l'écran : la
 * ligne reste affichée, sans lien de téléchargement. Masquer le document
 * laisserait croire qu'il n'existe pas.
 */
export async function loadMyProfileDocuments(correlationId: string): Promise<Result<MyDocument[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_my_documents', { p_document_type: null });

  if (error) return { ok: false, error: toBusinessError(error, correlationId) };

  const rows = asArray(data).flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const item = entry as Record<string, unknown>;
    const documentId = str(item['document_id']);
    const storagePath = str(item['storage_path']);
    const filename = str(item['filename']);
    if (documentId === null || storagePath === null || filename === null) return [];
    return [
      {
        documentId,
        documentType: str(item['document_type']) ?? 'other',
        title: str(item['title']),
        filename,
        mimeType: str(item['mime_type']) ?? 'application/octet-stream',
        sizeBytes: num(item['size_bytes']),
        isPrimary: item['is_primary'] === true,
        createdAt: str(item['created_at']),
        storagePath,
      },
    ];
  });

  const documents = await Promise.all(
    rows.map(async (row): Promise<MyDocument> => {
      const signed = await supabase.storage
        .from(PROFILE_DOCUMENTS_BUCKET)
        .createSignedUrl(storageObjectName(row.storagePath), SIGNED_URL_TTL_SECONDS, {
          download: row.filename,
        });
      const url = signed.error ? null : (signed.data?.signedUrl ?? null);
      return { ...row, downloadUrl: url };
    }),
  );

  return { ok: true, data: documents };
}
