import { toBusinessError, type BusinessError } from '@ise/domain';
import { frContentProposals } from '@/i18n/content-proposals';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { inspectImage } from '@/lib/cms/image-metadata';
import {
  CONTENT_PROPOSALS_BUCKET,
  PROPOSAL_COVER_EXTENSION,
  PROPOSAL_COVER_MAX_BYTES,
  isProposalCoverMimeType,
  toMyProposals,
  type MyProposal,
  type ProposalCoverMimeType,
  type ReferenceOption,
} from '@/lib/content-proposals';

/**
 * PROPOSITION DE CONTENU — lectures et dépôt d'image CÔTÉ MEMBRE (0132).
 *
 * Ce module importe le client Supabase serveur (donc `next/headers`) : il
 * n'est jamais importé côté client. Les constantes et types partagés
 * vivent dans `lib/content-proposals.ts`.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

/* ------------------------------------------------------------------ */
/* Traduction des codes propres à 0132                                 */
/* ------------------------------------------------------------------ */

/**
 * Même procédé que `toAdminError` (D-102) : 0132 lève des codes machine
 * (`event_online_url_required`, `media_alt_required`…) absents du
 * dictionnaire partagé. Sans cette table, tous retomberaient sur
 * `P0001 -> invalid_transition`, dont la phrase ne dit rien d'utile.
 */
export function proposalErrorMessage(raw: unknown, correlationId: string): string {
  const err = raw as { message?: string } | null;
  const local = frContentProposals.errors[err?.message ?? ''];
  if (typeof local === 'string') return local;
  return toBusinessError(raw, correlationId).userMessage;
}

/* ------------------------------------------------------------------ */
/* Listes de référence                                                 */
/* ------------------------------------------------------------------ */

export type { ReferenceOption };

function toOptions(data: unknown): ReferenceOption[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as Record<string, unknown>;
    const code = row['code'];
    const label = row['name'];
    if (typeof code !== 'string' || code.length === 0) return [];
    return [{ code, label: typeof label === 'string' && label.length > 0 ? label : code }];
  });
}

/**
 * Catégories d'actualité OUVERTES À LA PROPOSITION.
 *
 * Le filtre `is_submission_type` n'est pas une invention de cet écran :
 * la colonne existe depuis 0013 et distingue déjà les catégories qu'un
 * membre peut proposer de celles qui relèvent de la rédaction
 * (`ise_spotlight`, portrait choisi par l'administration). Elle attendait
 * simplement un écran qui la lise.
 *
 * La liste vient de la base, jamais d'une copie figée : `propose_news`
 * refuse tout code absent de `news_categories`, et un écran qui
 * proposerait autre chose ferait échouer l'envoi sans que l'auteur
 * comprenne pourquoi.
 */
export async function loadNewsCategoryOptions(): Promise<ReferenceOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('news_categories')
    .select('code, name, sort_order')
    .eq('is_active', true)
    .eq('is_submission_type', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return toOptions(data);
}

/** Types d'événement actifs — même raison que ci-dessus. */
export async function loadEventTypeOptions(): Promise<ReferenceOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('event_types')
    .select('code, name, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return toOptions(data);
}

/* ------------------------------------------------------------------ */
/* Mes propositions                                                    */
/* ------------------------------------------------------------------ */

export async function loadMyProposals(correlationId: string): Promise<Result<MyProposal[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_my_content_proposals', {});
  if (error) return { ok: false, error: toBusinessError(error, correlationId) };
  return { ok: true, data: toMyProposals(data) };
}

/* ------------------------------------------------------------------ */
/* Dépôt du visuel proposé                                             */
/* ------------------------------------------------------------------ */

export type CoverUploadResult =
  | { ok: true; path: string; mimeType: ProposalCoverMimeType }
  | { ok: false; message: string };

/**
 * Dépose l'image jointe dans le bucket PRIVÉ `content-proposals`, sous
 * `<profile_id>/<uuid>.<ext>`.
 *
 * MÊME PATRON QUE `uploadAvatarAction` (D-117 révisée) ET
 * `uploadProfileDocumentAction` (0127), pour les mêmes raisons :
 *   · le type est lu dans la SIGNATURE BINAIRE, pas dans l'en-tête envoyé
 *     par le navigateur ni dans l'extension — les deux se falsifient ;
 *   · le chemin est porté par le `profile_id`, ce que la politique Storage
 *     `ise_content_proposals_insert` impose de toute façon ;
 *   · le nom est toujours NEUF : on ne réécrit jamais par-dessus un objet
 *     dont une URL signée peut encore circuler.
 *
 * LA SÉCURITÉ N'EST PAS ICI. Elle est dans la politique Storage et dans la
 * contrainte `news_proposed_cover_scope` / `events_proposed_cover_scope`,
 * qui refusent d'enregistrer le chemin d'un autre membre.
 */
export async function uploadProposalCover(
  profileId: string,
  file: File,
): Promise<CoverUploadResult> {
  const labels = frContentProposals.member;

  if (file.size > PROPOSAL_COVER_MAX_BYTES) {
    return { ok: false, message: labels.coverTooLarge };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectImage(bytes);
  if (!inspection.ok) {
    return {
      ok: false,
      message: inspection.error === 'invalid_size' ? labels.coverTooLarge : labels.coverInvalid,
    };
  }

  const { mimeType } = inspection.metadata;
  if (!isProposalCoverMimeType(mimeType)) {
    return { ok: false, message: labels.coverWrongType };
  }

  const path = `${profileId}/${globalThis.crypto.randomUUID()}.${PROPOSAL_COVER_EXTENSION[mimeType]}`;
  const supabase = await createSupabaseServerClient();
  const uploaded = await supabase.storage
    .from(CONTENT_PROPOSALS_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });

  if (uploaded.error) {
    // Le refus vient le plus souvent de la politique Storage : préfixe qui
    // n'est pas le sien, type ou poids refusés par le bucket.
    return { ok: false, message: labels.coverUploadFailed };
  }

  return { ok: true, path, mimeType };
}

/**
 * Retire un objet du bucket privé. Appelé quand la RPC échoue APRÈS le
 * dépôt : le fichier n'est alors rattaché à rien, et laisser un orphelin
 * dans un bucket est une dette silencieuse.
 */
export async function removeProposalCover(path: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(CONTENT_PROPOSALS_BUCKET).remove([path]);
}
