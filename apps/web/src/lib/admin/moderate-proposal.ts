import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { frContentProposals } from '@/i18n/content-proposals';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { CONTENT_ROUTES } from '@/lib/routes/content';
import { failure, success, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess, type AdminPermission } from '@/lib/admin/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ProposalKind } from '@/lib/content-proposals';
import {
  loadProposalDetail,
  promoteProposalCover,
  releaseProposalCover,
  removePromotedCover,
  toProposalError,
} from '@/lib/admin/queries-proposals';

/**
 * DÉCISION SUR UNE PROPOSITION (0132) — logique commune aux deux natures.
 *
 * Ce module n'est PAS marqué `'use server'` : les deux fichiers d'actions
 * (`administration/actualites/propositions/actions.ts` et son pendant
 * événements) l'importent. Même procédé que `lib/admin/action-support.ts`
 * — un fichier `'use server'` n'exporte que des fonctions asynchrones
 * appelables depuis le client (D-159), pas des helpers partagés.
 *
 * L'ORDRE DES ÉCRITURES EST LE CŒUR DE LA CHOSE :
 *   1. recopier le visuel vers `landing-media` (PUBLIC) — réversible ;
 *   2. appeler `moderate_content_proposal`, qui enregistre le média,
 *      publie, journalise et notifie dans UNE SEULE transaction ;
 *   3. effacer l'original privé, désormais orphelin.
 * Si (2) échoue, (1) est défait : on ne laisse pas une image publique
 * rattachée à rien. Si (3) échoue, il reste un fichier privé inutile —
 * la moins grave des trois issues, et la seule qui ne trompe personne.
 */

const PERMISSION: Record<ProposalKind, AdminPermission> = {
  news: 'content.publish',
  event: 'events.manage',
};

function queueRoute(kind: ProposalKind): string {
  return kind === 'news' ? ADMIN_ROUTES.newsProposals : ADMIN_ROUTES.eventProposals;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export type ProposalDecision = 'approved' | 'rejected';

export async function moderateProposal(
  kind: ProposalKind,
  decision: ProposalDecision,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const labels = frContentProposals.admin;

  const access = await readAdminAccess();
  if (access === null || !access.can(PERMISSION[kind])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const id = text(formData, 'id');
  if (id.length === 0) {
    return failure(labels.notFound, correlationId);
  }

  const reason = text(formData, 'reason');
  if (decision === 'rejected' && reason.length < 10) {
    return failure(labels.reasonRequired, correlationId, { reason: labels.reasonRequired });
  }

  /* --------------------------------------------------------------- */
  /* 1. Le visuel, s'il est retenu                                     */
  /* --------------------------------------------------------------- */

  const keepCover = formData.get('keepCover') === 'on';
  const coverAlt = text(formData, 'coverAlt');

  let mediaArgs: Record<string, unknown> = {
    p_media_path: null,
    p_media_alt: null,
    p_media_mime: null,
    p_media_width: null,
    p_media_height: null,
    p_media_size: null,
    p_media_name: null,
  };
  let promotedPath: string | null = null;

  if (decision === 'approved' && keepCover) {
    // Le chemin source est RELU en base, jamais pris dans le formulaire :
    // un chemin de stockage transmis par le navigateur n'est pas une
    // source de vérité, même derrière une permission.
    const detail = await loadProposalDetail(kind, id, correlationId);
    if (!detail.ok) return failure(detail.error.userMessage, correlationId);
    if (detail.data === null) return failure(labels.notFound, correlationId);

    const sourcePath = detail.data.coverPath;
    if (sourcePath !== null) {
      if (coverAlt.length < 3) {
        return failure(frContentProposals.errors['media_alt_required'] ?? '', correlationId, {
          coverAlt: frContentProposals.errors['media_alt_required'] ?? '',
        });
      }

      const promoted = await promoteProposalCover(kind, sourcePath);
      if (!promoted.ok) return failure(promoted.message, correlationId);

      promotedPath = promoted.media.path;
      mediaArgs = {
        p_media_path: promoted.media.path,
        p_media_alt: coverAlt,
        p_media_mime: promoted.media.mimeType,
        p_media_width: promoted.media.width,
        p_media_height: promoted.media.height,
        p_media_size: promoted.media.sizeBytes,
        p_media_name: promoted.media.filename,
      };
    }
  }

  /* --------------------------------------------------------------- */
  /* 2. La décision                                                    */
  /* --------------------------------------------------------------- */

  // Appel DIRECT plutôt que par `adminRpc` : ce dernier traduit l'erreur
  // avec `toAdminError`, qui écrase le message machine par le repli
  // `P0001 -> invalid_transition` dès qu'il ne le connaît pas. Or les
  // codes de 0132 doivent arriver intacts jusqu'à `toProposalError` pour
  // que l'administrateur lise « il manque un lien de connexion » plutôt
  // que « cette action n'est plus possible ».
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('moderate_content_proposal', {
    p_kind: kind,
    p_id: id,
    p_decision: decision,
    p_reason: reason.length > 0 ? reason : null,
    ...mediaArgs,
  });

  if (error) {
    // L'image publique vient d'être déposée mais n'est rattachée à rien :
    // on la retire plutôt que de laisser un objet public orphelin.
    if (promotedPath !== null) await removePromotedCover(promotedPath);
    console.error('[ISE] decision sur proposition en echec', {
      correlationId,
      kind,
      code: error.code,
    });
    return failure(toProposalError(error, correlationId).userMessage, correlationId);
  }

  /* --------------------------------------------------------------- */
  /* 3. L'original privé, devenu orphelin                              */
  /* --------------------------------------------------------------- */

  const payload = (typeof data === 'object' && data !== null ? data : {}) as Record<
    string,
    unknown
  >;
  const released = payload['released_cover_path'];
  if (typeof released === 'string' && released.length > 0) {
    await releaseProposalCover(released);
  }

  revalidatePath(queueRoute(kind));
  revalidatePath(kind === 'news' ? ADMIN_ROUTES.news : ADMIN_ROUTES.events);
  revalidatePath(CONTENT_ROUTES.myProposals);

  return success(decision === 'approved' ? labels.approved : labels.rejected);
}
