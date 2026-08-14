import { frContentProposals } from '@/i18n/content-proposals';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { inspectImage } from '@/lib/cms/image-metadata';
import {
  CONTENT_PROPOSALS_BUCKET,
  PROPOSAL_COVER_EXTENSION,
  isProposalCoverMimeType,
  landingMediaPrefix,
  toProposalDetail,
  toProposalQueue,
  type ProposalDetail,
  type ProposalKind,
  type ProposalQueueRow,
} from '@/lib/content-proposals';
import { adminRpc } from './rpc';
import { toAdminError, type AdminError } from './errors';

/**
 * FILE DE VALIDATION DES PROPOSITIONS (0132) — lectures administratives.
 *
 * Les deux natures partagent les mêmes RPC (`admin_list_content_proposals`,
 * `admin_get_content_proposal`, `moderate_content_proposal`), qui filtrent
 * elles-mêmes par permission : `content.publish` pour les actualités,
 * `events.manage` pour les événements. Les écrans, eux, restent séparés —
 * un écran commun montrerait une moitié vide à qui ne détient qu'une des
 * deux permissions.
 */

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: AdminError };

const LANDING_MEDIA_BUCKET = 'landing-media';

/** Durée de validité de l'URL signée d'aperçu, en secondes. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Traduction des codes propres à 0132, avant le repli sur `toAdminError`
 * (D-102). `reason_required` existe déjà dans `frAdmin.errors` ; les codes
 * d'événement (`event_online_url_required`, `event_place_required`) n'y
 * sont pas, et sans cette table ils s'afficheraient en « Cette action
 * n'est plus possible dans l'état actuel » — ce qui est faux : l'action
 * est possible, il manque une information.
 */
export function toProposalError(raw: unknown, correlationId: string): AdminError {
  const err = raw as { message?: string } | null;
  const local = frContentProposals.errors[err?.message ?? ''];
  if (typeof local === 'string') {
    return { code: err?.message ?? 'unknown', userMessage: local, correlationId };
  }
  return toAdminError(raw, correlationId);
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

export type QueueState = 'pending' | 'rejected';

export async function loadProposalQueue(
  kind: ProposalKind,
  state: QueueState,
  correlationId: string,
): Promise<AdminResult<ProposalQueueRow[]>> {
  const result = await adminRpc(
    'admin_list_content_proposals',
    { p_state: state },
    correlationId,
    (payload) => toProposalQueue(payload),
  );
  if (!result.ok) return result;
  // La RPC renvoie les deux natures d'un coup, selon les permissions
  // détenues. Chaque écran ne garde que la sienne.
  return { ok: true, data: result.data.filter((row) => row.kind === kind) };
}

export async function loadProposalDetail(
  kind: ProposalKind,
  id: string,
  correlationId: string,
): Promise<AdminResult<ProposalDetail | null>> {
  return adminRpc(
    'admin_get_content_proposal',
    { p_kind: kind, p_id: id },
    correlationId,
    (payload) => toProposalDetail(payload),
  );
}

/**
 * URL SIGNÉE de l'aperçu du visuel proposé.
 *
 * Le bucket `content-proposals` est PRIVÉ : il n'existe aucune URL
 * publique. L'administration voit donc l'image par une URL signée de
 * courte durée, fabriquée au rendu et jamais stockée — même mécanisme que
 * `signedAvatarUrl` (member-profile) et les documents de profil (0127).
 *
 * Une signature en échec ne fait pas échouer l'écran : la fiche reste
 * lisible, sans aperçu. Refuser d'afficher la proposition parce que
 * l'image ne se signe pas serait disproportionné.
 */
export async function signedProposalCoverUrl(path: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const signed = await supabase.storage
    .from(CONTENT_PROPOSALS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signed.error) return null;
  return signed.data?.signedUrl ?? null;
}

/* ------------------------------------------------------------------ */
/* Promotion du visuel : privé -> public                               */
/* ------------------------------------------------------------------ */

export interface PromotedMedia {
  path: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  filename: string;
}

export type PromotionResult = { ok: true; media: PromotedMedia } | { ok: false; message: string };

/**
 * RECOPIE le visuel accepté du bucket PRIVÉ vers `landing-media`.
 *
 * C'EST LE POINT DE BASCULE DE TOUTE LA TRANCHE. `landing-media` est
 * PUBLIC (D-134) : tout objet qu'on y dépose devient lisible par le web
 * ouvert. On n'y écrit donc qu'ici, une fois la décision d'acceptation
 * prise — jamais au moment de la proposition. Tant que l'administration
 * n'a pas tranché, l'image reste dans un bucket privé où seuls son auteur
 * et les administrateurs éditoriaux peuvent la lire.
 *
 * POURQUOI RECOPIER PLUTÔT QUE DÉPLACER : `move()` traverserait les deux
 * politiques Storage en une seule opération, et un déplacement raté
 * laisserait la proposition sans visuel ET sans média. Copier, enregistrer,
 * puis effacer l'original est réversible à chaque étape.
 *
 * Les octets sont réinspectés au passage : les dimensions réelles sont
 * exigées par `cms_media_assets`, et rien ne garantit que le fichier soit
 * celui que le formulaire croyait déposer.
 */
export async function promoteProposalCover(
  kind: ProposalKind,
  sourcePath: string,
): Promise<PromotionResult> {
  const supabase = await createSupabaseServerClient();

  const downloaded = await supabase.storage.from(CONTENT_PROPOSALS_BUCKET).download(sourcePath);
  if (downloaded.error || downloaded.data === null) {
    return { ok: false, message: frContentProposals.admin.coverPromoteFailed };
  }

  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const inspection = inspectImage(bytes);
  if (!inspection.ok) {
    return { ok: false, message: frContentProposals.admin.coverPromoteFailed };
  }

  const { mimeType, width, height } = inspection.metadata;
  if (!isProposalCoverMimeType(mimeType)) {
    return { ok: false, message: frContentProposals.admin.coverPromoteFailed };
  }

  const filename = `${globalThis.crypto.randomUUID()}.${PROPOSAL_COVER_EXTENSION[mimeType]}`;
  const targetPath = `${landingMediaPrefix(kind)}/${filename}`;

  const uploaded = await supabase.storage
    .from(LANDING_MEDIA_BUCKET)
    .upload(targetPath, bytes, { contentType: mimeType, upsert: false });

  if (uploaded.error) {
    // Refus le plus probable : la politique `ise_landing_media_insert_editorial`
    // (0132) exige `content.publish` ou `events.manage` ET un préfixe autorisé.
    return { ok: false, message: frContentProposals.admin.coverPromoteFailed };
  }

  return {
    ok: true,
    media: {
      path: targetPath,
      mimeType,
      width,
      height,
      sizeBytes: bytes.byteLength,
      filename,
    },
  };
}

/** Retire un objet de `landing-media` (repli si la RPC échoue ensuite). */
export async function removePromotedCover(path: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(LANDING_MEDIA_BUCKET).remove([path]);
}

/**
 * Efface l'objet PRIVÉ devenu orphelin après la décision.
 *
 * `moderate_content_proposal` remet `proposed_cover_path` à NULL et
 * renvoie l'ancien chemin dans `released_cover_path` : PostgreSQL n'a
 * aucun accès aux octets stockés, seul l'appelant peut les effacer, et
 * seulement tant qu'il connaît le chemin. C'est maintenant ou jamais.
 */
export async function releaseProposalCover(path: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(CONTENT_PROPOSALS_BUCKET).remove([path]);
}
