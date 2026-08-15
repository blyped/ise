'use server';

import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { publicShowcaseSchema } from '@ise/validation';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { frShowcase } from '@/i18n/profile-showcase';
import { inspectImage, CMS_MEDIA_MAX_BYTES } from '@/lib/cms/image-metadata';
import { toPublicShowcaseInput } from '../form-input';

/**
 * Server Actions de la vitrine publique (révision de D-135, migration 0120 ;
 * cadrage 0141).
 *
 * QUATRE ACTES DISTINCTS, et c'est volontaire :
 *   1. `savePublicShowcaseAction`     — brève description + les deux consentements ;
 *   2. `publishPublicPhotoAction`     — dépôt du portrait dans le bucket public ;
 *   3. `withdrawPublicPhotoAction`    — retrait du portrait ;
 *   4. `updatePublicPhotoCropAction`  — cadrage d'affichage (position/zoom) du
 *      portrait déjà déposé, sans toucher au fichier.
 * Séparer 1 et 2 évite qu'un enregistrement de texte emporte silencieusement
 * une publication d'image. Séparer 4 des deux évite qu'un simple ajustement
 * de cadrage rejoue tout le circuit d'upload.
 *
 * LA SÉCURITÉ N'EST PAS ICI. Elle est en base :
 *   · la politique `ise_landing_media_member_photo_insert` refuse tout dépôt
 *     hors de `membres/<mon profile_id>/` et tout dépôt sans consentement ;
 *   · `set_my_public_photo()` revérifie le consentement, le préfixe, le texte
 *     alternatif et l'existence réelle du fichier ;
 *   · `set_my_public_photo_crop()` (0141) revérifie les bornes du cadrage et
 *     refuse l'appel s'il n'existe aucun portrait à cadrer ;
 *   · un déclencheur retire l'objet public et réinitialise le cadrage dès que
 *     le consentement tombe, que le compte est supprimé (D-19) ou que le
 *     portrait est remplacé.
 * Ce fichier ne fait qu'offrir le chemin normal ; il ne constitue pas la garde.
 */

const PUBLIC_BUCKET = 'landing-media';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** 0141 — bornes du cadrage, alignées sur les CHECK de la migration. */
const CROP_FOCAL_MIN = 0;
const CROP_FOCAL_MAX = 100;
const CROP_ZOOM_MIN = 1;
const CROP_ZOOM_MAX = 3;

function refreshShowcase() {
  revalidatePath(PROFILE_ROUTES.publicShowcase);
  revalidatePath(PROFILE_ROUTES.overview);
}

/**
 * Efface REELLEMENT les octets du portrait dans le bucket public.
 *
 * Le déclencheur de 0120 supprime la ligne `storage.objects` — ce qui suffit
 * à rendre l'URL publique inaccessible (404) — mais PostgreSQL n'a aucun
 * accès aux octets stockés dans S3. Seule l'API Storage les efface. On la
 * sollicite donc AVANT l'écriture en base, tant que le chemin est connu et
 * que la session du membre existe : c'est le seul moment où l'effacement
 * physique est possible.
 *
 * La politique `ise_landing_media_member_photo_delete` n'autorise que le
 * préfixe du membre lui-même, et n'exige aucun consentement : retirer doit
 * rester possible après révocation.
 */
async function erasePublicPhotoBytes(profileId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('ise_profiles')
    .select('public_photo_path')
    .eq('id', profileId)
    .maybeSingle();

  const row = (data ?? null) as { public_photo_path?: unknown } | null;
  const path = typeof row?.public_photo_path === 'string' ? row.public_photo_path : null;
  if (path === null || path.length === 0) return;

  // Un échec ici n'interrompt rien : la base retirera de toute façon l'objet
  // du service. On ne masque pas pour autant le fait que les octets peuvent
  // survivre — c'est la limite documentée dans la migration 0120.
  await supabase.storage.from(PUBLIC_BUCKET).remove([path]);
}

/* ------------------------------------------------------------------ */
/* 1. Brève description et consentements                               */
/* ------------------------------------------------------------------ */

export async function savePublicShowcaseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = publicShowcaseSchema.safeParse(toPublicShowcaseInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;

  // Révocation du consentement photo : on efface les octets AVANT, tant que
  // le chemin est encore lisible. La base fera le reste (retrait du service
  // et remise à NULL des colonnes) même si cet appel échoue.
  if (!input.allowPublicPhoto) await erasePublicPhotoBytes(context.profile.id);

  const supabase = await createSupabaseServerClient();

  // `public_photo_*` n'est PAS écrit ici : ces colonnes ne sont pas
  // GRANT-ées en UPDATE au membre. Retirer le consentement suffit — le
  // déclencheur de 0120 supprime l'objet public et remet les colonnes à NULL.
  const { error } = await supabase
    .from('ise_profiles')
    .update({
      public_summary: input.publicSummary ?? null,
      allow_public_feature: input.allowPublicFeature,
      allow_public_photo: input.allowPublicPhoto,
    })
    .eq('id', context.profile.id);

  if (error) {
    const business = toBusinessError(error, context.correlationId);
    return failure(business.userMessage, context.correlationId);
  }

  refreshShowcase();
  return success(frShowcase.saved);
}

/* ------------------------------------------------------------------ */
/* 2. Dépôt du portrait public                                         */
/* ------------------------------------------------------------------ */

export async function publishPublicPhotoAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;

  const rawAlt = formData.get('photoAlt');
  const altText = typeof rawAlt === 'string' ? rawAlt.trim() : '';
  if (altText.length < 3) {
    return failure(frShowcase.photoAltRequired, correlationId, {
      photoAlt: frShowcase.photoAltRequired,
    });
  }

  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return failure(frShowcase.photoInvalid, correlationId, {
      photo: frShowcase.photoInvalid,
    });
  }
  if (file.size > CMS_MEDIA_MAX_BYTES) {
    return failure(frShowcase.photoTooLarge, correlationId, {
      photo: frShowcase.photoTooLarge,
    });
  }

  // Le type est lu dans la SIGNATURE BINAIRE, pas dans l'en-tête déclaré par
  // le navigateur : un fichier renommé ne passe pas.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectImage(bytes);
  if (!inspection.ok) {
    const message =
      inspection.error === 'invalid_size'
        ? frShowcase.photoTooLarge
        : frShowcase.photoInvalid;
    return failure(message, correlationId, { photo: message });
  }

  const { mimeType, width, height } = inspection.metadata;
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'jpg';
  // Chemin toujours NEUF : on ne réécrit jamais par-dessus une URL déjà
  // servie, sinon les caches continueraient de diffuser l'ancienne image.
  const storagePath = `membres/${profileId}/${globalThis.crypto.randomUUID()}.${extension}`;

  const supabase = await createSupabaseServerClient();

  const uploaded = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });

  if (uploaded.error) {
    // Le refus vient le plus souvent de la politique : consentement non
    // donné, ou préfixe qui n'est pas le sien.
    return failure(frShowcase.photoUploadFailed, correlationId);
  }

  const { error } = await supabase.rpc('set_my_public_photo', {
    p_storage_path: storagePath,
    p_alt_text: altText,
    p_width: width,
    p_height: height,
  });

  if (error) {
    // Le fichier vient d'être déposé mais n'est rattaché à rien : on le
    // retire plutôt que de laisser un objet public orphelin.
    await supabase.storage.from(PUBLIC_BUCKET).remove([storagePath]);
    const business = toBusinessError(error, correlationId);
    return failure(business.userMessage, correlationId);
  }

  refreshShowcase();
  return success(frShowcase.photoPublished);
}

/* ------------------------------------------------------------------ */
/* 3. Retrait du portrait public                                       */
/* ------------------------------------------------------------------ */

export async function withdrawPublicPhotoAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  // Les octets d'abord, la base ensuite : une fois le chemin remis à NULL,
  // plus personne ne saurait quel fichier effacer.
  await erasePublicPhotoBytes(context.profile.id);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('clear_my_public_photo');

  if (error) {
    const business = toBusinessError(error, context.correlationId);
    return failure(business.userMessage, context.correlationId);
  }

  refreshShowcase();
  return success(frShowcase.photoRemoved);
}

/* ------------------------------------------------------------------ */
/* 4. Cadrage du portrait déjà publié (position/zoom) — migration 0141 */
/* ------------------------------------------------------------------ */

/**
 * Enregistre le cadrage du portrait DÉJÀ publié — position focale et zoom,
 * appliqués en CSS (`object-position` / `transform`) partout où la vignette
 * est affichée. AUCUN recadrage serveur : l'image déposée par
 * `publishPublicPhotoAction` n'est jamais modifiée, seules trois coordonnées
 * changent. `set_my_public_photo_crop()` refuse l'appel s'il n'existe aucun
 * portrait à cadrer.
 */
export async function updatePublicPhotoCropAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;

  const focalX = Number(formData.get('focalX'));
  const focalY = Number(formData.get('focalY'));
  const zoom = Number(formData.get('zoom'));

  const valid =
    Number.isFinite(focalX) &&
    focalX >= CROP_FOCAL_MIN &&
    focalX <= CROP_FOCAL_MAX &&
    Number.isFinite(focalY) &&
    focalY >= CROP_FOCAL_MIN &&
    focalY <= CROP_FOCAL_MAX &&
    Number.isFinite(zoom) &&
    zoom >= CROP_ZOOM_MIN &&
    zoom <= CROP_ZOOM_MAX;

  if (!valid) {
    return failure(frShowcase.photoCropInvalid, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_my_public_photo_crop', {
    p_focal_x: focalX,
    p_focal_y: focalY,
    p_zoom: zoom,
  });

  if (error) {
    const business = toBusinessError(error, correlationId);
    return failure(business.userMessage, correlationId);
  }

  refreshShowcase();
  return success(frShowcase.photoCropSaved);
}
