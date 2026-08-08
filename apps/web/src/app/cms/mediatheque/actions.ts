'use server';

import { revalidatePath } from 'next/cache';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { failure, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { requiredText, runCmsAction, text } from '@/lib/cms/action-support';
import { requireCmsPermission } from '@/lib/cms/permissions';
import {
  recordMediaAsset,
  softDeleteMediaAsset,
  updateMediaMetadata,
  uploadMediaObject,
} from '@/lib/cms/mutations';
import {
  CMS_MEDIA_MAX_BYTES,
  DEFAULT_CMS_MEDIA_USAGE,
  inspectImage,
  isCmsMediaUsage,
  mediaStoragePath,
} from '@/lib/cms/image-metadata';

/**
 * Server Actions de la mediatheque (CMS-008, ADDENDUM §38 et §39).
 *
 * PIPELINE REELLEMENT EXECUTE, etape par etape :
 *   1. VALIDER   — type MIME lu dans le CONTENU du fichier (signature
 *                  binaire), poids borne a 5 Mo, texte alternatif exige,
 *                  emplacement de destination choisi par le redacteur ;
 *   2. STOCKER   — depot de l'original dans le bucket PUBLIC `landing-media`
 *                  (0068), sous le prefixe d'usage — `carousel/`,
 *                  `partners/`, `news/` ou `sections/`. La politique
 *                  `ise_landing_media_insert` refuse tout autre prefixe ;
 *   3. OPTIMISER — NON REALISE. Voir l'encadre ci-dessous ;
 *   4. VARIANTES — NON REALISEES. Idem ;
 *   5. METADONNEES — largeur, hauteur, poids, type, texte alternatif,
 *                  credit, auteur, enregistres dans `cms_media_assets`.
 *
 * CE QUI N'EST PAS FAIT, ET POURQUOI ON NE FAIT PAS SEMBLANT
 *   Les etapes 3 et 4 exigent un encodeur d'images cote serveur (sharp,
 *   libvips, une fonction d'imagerie). Aucun n'est present dans ce
 *   deploiement. Enregistrer trois lignes `variant_kind = 'desktop' |
 *   'mobile' | 'thumbnail'` pointant toutes le fichier ORIGINAL
 *   satisferait le schema et mentirait a tout le monde : la landing
 *   servirait une image pleine resolution en croyant servir une vignette.
 *   On n'enregistre donc que l'original, et le tableau de bord signale
 *   « média sans variante » tant que la generation n'est pas branchee.
 */

const ALT_MIN_LENGTH = 3;

export async function uploadMediaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await requireCmsPermission('cms.media.manage');
  if (access === null) return failure(frCms.common.forbidden, correlationId);

  const altText = requiredText(formData, 'altText');
  if (altText.length < ALT_MIN_LENGTH) {
    return failure(frCms.media.altRequired, correlationId, { altText: frCms.media.altRequired });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return failure(frCms.media.invalidImage, correlationId, { file: frCms.common.requiredField });
  }
  if (file.size > CMS_MEDIA_MAX_BYTES) {
    return failure(frCms.media.invalidSize, correlationId, { file: frCms.media.invalidSize });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectImage(bytes);
  if (!inspection.ok) {
    const message =
      inspection.error === 'invalid_size'
        ? frCms.media.invalidSize
        : inspection.error === 'invalid_type'
          ? frCms.media.invalidType
          : frCms.media.invalidImage;
    return failure(message, correlationId, { file: message });
  }

  const { mimeType, width, height } = inspection.metadata;
  const rawUsage = formData.get('usage');
  const usage = isCmsMediaUsage(rawUsage) ? rawUsage : DEFAULT_CMS_MEDIA_USAGE;
  const objectKey = globalThis.crypto.randomUUID();
  const storagePath = mediaStoragePath(usage, objectKey, mimeType, new Date());

  const uploaded = await uploadMediaObject(storagePath, bytes, mimeType, correlationId);
  if (!uploaded.ok) return failure(frCms.media.uploadFailed, correlationId);

  const recorded = await recordMediaAsset(
    {
      storagePath,
      filename: file.name.slice(0, 200),
      mimeType,
      width,
      height,
      sizeBytes: file.size,
      altText,
      credit: text(formData, 'credit'),
    },
    correlationId,
  );
  if (!recorded.ok) return failure(recorded.error.userMessage, correlationId);

  revalidatePath(CMS_ROUTES.media);
  return { status: 'success', message: frCms.media.uploaded, correlationId: null, fieldErrors: {} };
}

export async function updateMediaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const mediaId = requiredText(formData, 'mediaId');
  const altText = requiredText(formData, 'altText');
  if (altText.length < ALT_MIN_LENGTH) {
    return failure(frCms.media.altRequired, newCorrelationId(), {
      altText: frCms.media.altRequired,
    });
  }

  const state = await runCmsAction(
    'cms.media.manage',
    (correlationId) =>
      updateMediaMetadata(mediaId, altText, text(formData, 'credit'), correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.media);
  return state;
}

/**
 * Suppression logique. Refusee si le media est encore reference : un
 * visuel qui disparait d'une slide publiee produirait un trou sur la
 * landing, sans que personne ne l'ait demande.
 */
export async function deleteMediaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const mediaId = requiredText(formData, 'mediaId');
  const usageCount = Number.parseInt(requiredText(formData, 'usageCount') || '0', 10);
  if (Number.isFinite(usageCount) && usageCount > 0) {
    return failure(frCms.media.deleteBlocked, newCorrelationId());
  }

  const state = await runCmsAction(
    'cms.media.manage',
    (correlationId) => softDeleteMediaAsset(mediaId, correlationId),
    frCms.common.deleted,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.media);
  return state;
}
