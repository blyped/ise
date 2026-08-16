'use server';

import { revalidatePath } from 'next/cache';
import { toBusinessError } from '@ise/domain';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { revalidateLanding } from '@/lib/public/revalidate-landing';
import { frProfile } from '@/i18n/profile';
import { inspectImage } from '@/lib/cms/image-metadata';

/**
 * Dépôt, retrait et cadrage de la PHOTO DE PROFIL — révision de D-117
 * (14/08/2026), cadrage étendu par D-206 (0147), FUSIONNÉE avec l'ancienne
 * « photo publique » par D-211 (16/08/2026).
 *
 * D-211 — DEMANDE EXPLICITE DU PORTEUR : « je ne veux même pas qu'on mette
 * 2 photos pour chaque profil. la photo que l'ISE mettra pour son profil,
 * c'est elle qui sera affiché devant pour l'accueil ». Un seul fichier est
 * désormais déposé, dans le bucket PRIVÉ `avatars` (comme avant) ; s'il
 * autorise la publication (case « autoriser la publication », ex-consentement
 * `allowPublicPhoto` de la vitrine publique), les MÊMES octets sont
 * COPIÉS — jamais déplacés, même principe que D-185 pour les propositions
 * de contenu — vers le bucket PUBLIC `landing-media`, via les RPC déjà
 * existantes du portrait public (0120/0141) : `set_my_public_photo()`,
 * `clear_my_public_photo()`, `set_my_public_photo_crop()`. AUCUNE migration
 * SQL n'a été nécessaire pour cette fusion : elle orchestre, depuis
 * l'application, des mécanismes déjà en place — voir docs/decisions.md,
 * D-211, pour le détail de cette décision.
 *
 * QUATRE ACTES DISTINCTS :
 *   1. `uploadPhotoAction`     — dépôt (ou remplacement) du fichier ET/OU
 *      bascule de la case « autoriser la publication » (le fichier est
 *      OPTIONNEL sur ce formulaire : cocher/décocher la case sans changer
 *      de fichier resynchronise simplement la copie publique depuis la
 *      photo déjà déposée) ;
 *   2. `removePhotoAction`     — retrait complet (médaillon ET copie
 *      publique éventuelle) ;
 *   3. `updatePhotoCropAction` — cadrage des DEUX blocs (médaillon rond +
 *      rectangle « ISE du jour ») en UN SEUL enregistrement, comme demandé :
 *      « il voit exactement comment ça sera sur le deux pages. et il
 *      enregistre. s'il enregistre c'est bon pour les deux. »
 *
 * LA SÉCURITÉ N'EST PAS ICI, elle est en base :
 *   · bucket privé — mêmes politiques qu'avant (0027, 0126, 0147) ;
 *   · copie publique — mêmes politiques et RPC qu'avant (0120, 0141) :
 *     `ise_landing_media_member_photo_insert` exige `allow_public_photo`
 *     DÉJÀ posé à `true` en base au moment du dépôt Storage (d'où l'ordre :
 *     on écrit d'abord la colonne, puis on dépose l'objet) ; `set_my_public_
 *     photo()` revérifie tout (consentement, préfixe, texte alternatif,
 *     existence réelle du fichier) avant d'écrire `public_photo_path`.
 */

const AVATAR_BUCKET = 'avatars';
const PUBLIC_BUCKET = 'landing-media';

/** 2 Mo : `file_size_limit` réel du bucket `avatars` (0027) — la borne la
 * plus stricte des deux buckets, donc celle qui s'applique au dépôt unique. */
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Le bucket `avatars` n'accepte que ces trois types (`allowed_mime_types`,
 * 0027) — AVIF (accepté par `landing-media`) est donc exclu ici aussi,
 * puisqu'un seul fichier alimente désormais les deux. */
const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<AvatarMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function isAvatarMimeType(value: string): value is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(value);
}

const PHOTO_ALT_MIN = 3;
const PHOTO_ALT_MAX = 200;

/**
 * La photo pèse dans le score de complétion (bloc `photo`, poids 5/100) :
 * le déclencheur `trg_completion_ise_profiles` recalcule le score dès que
 * `avatar_path` change. On rafraîchit donc aussi les écrans qui l'affichent,
 * ainsi que la landing publique quand la copie publique a pu changer
 * (D-210 : purge tolérante à l'échec du cache serveur étiqueté).
 */
async function refreshProfileViews(): Promise<void> {
  revalidatePath(PROFILE_ROUTES.header);
  revalidatePath(PROFILE_ROUTES.overview);
  revalidatePath(PROFILE_ROUTES.completion);
  revalidatePath(PROFILE_ROUTES.missingItems);

  try {
    await revalidateLanding();
  } catch (error) {
    console.error('[ISE] invalidation du cache de la landing en echec (photo de profil)', {
      cause: error instanceof Error ? error.name : 'inconnue',
    });
  }
}

interface PhotoState {
  avatarPath: string | null;
  allowPublicPhoto: boolean;
  publicPhotoPath: string | null;
}

/** État actuel des deux colonnes de chemin, lu en un aller-retour. */
async function readPhotoState(profileId: string): Promise<PhotoState> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('ise_profiles')
    .select('avatar_path, allow_public_photo, public_photo_path')
    .eq('id', profileId)
    .maybeSingle();

  const row = (data ?? null) as {
    avatar_path?: unknown;
    allow_public_photo?: unknown;
    public_photo_path?: unknown;
  } | null;

  const avatarPath = typeof row?.avatar_path === 'string' ? row.avatar_path : null;
  const publicPhotoPath =
    typeof row?.public_photo_path === 'string' ? row.public_photo_path : null;

  return {
    avatarPath: avatarPath !== null && avatarPath.length > 0 ? avatarPath : null,
    allowPublicPhoto: row?.allow_public_photo === true,
    publicPhotoPath: publicPhotoPath !== null && publicPhotoPath.length > 0 ? publicPhotoPath : null,
  };
}

/**
 * Retire la copie publique : octets réellement effacés (l'API Storage,
 * jamais un accès direct de PostgreSQL aux octets S3 — même limite
 * documentée depuis D-135/0120), puis `clear_my_public_photo()` remet les
 * colonnes à NULL et journalise le retrait.
 */
async function withdrawPublicMirror(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  currentPublicPath: string | null,
): Promise<void> {
  if (currentPublicPath === null) return;
  await supabase.storage.from(PUBLIC_BUCKET).remove([currentPublicPath]);
  await supabase.rpc('clear_my_public_photo');
}

/* ------------------------------------------------------------------ */
/* 1. Dépôt (ou remplacement) de la photo, et/ou bascule de publication */
/* ------------------------------------------------------------------ */

export async function uploadPhotoAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;
  const supabase = await createSupabaseServerClient();

  const state = await readPhotoState(profileId);

  const allowPublicPhoto = formData.get('allowPublicPhoto') === 'on';
  const rawAlt = formData.get('photoAlt');
  const altText = typeof rawAlt === 'string' ? rawAlt.trim() : '';

  if (allowPublicPhoto && (altText.length < PHOTO_ALT_MIN || altText.length > PHOTO_ALT_MAX)) {
    return failure(frProfile.header.photoAltRequired, correlationId, {
      photoAlt: frProfile.header.photoAltRequired,
    });
  }

  // Le fichier est OPTIONNEL : sans nouveau fichier, on resynchronise
  // seulement la case de publication sur la photo déjà déposée.
  const file = formData.get('photo');
  const hasNewFile = file instanceof File && file.size > 0;

  let bytes: Uint8Array;
  let mimeType: AvatarMimeType;
  let width: number | null = null;
  let height: number | null = null;
  let avatarPath = state.avatarPath;

  if (hasNewFile) {
    const newFile = file as File;
    if (newFile.size > AVATAR_MAX_BYTES) {
      return failure(frProfile.header.photoTooLarge, correlationId, {
        photo: frProfile.header.photoTooLarge,
      });
    }

    // Le type est lu dans la SIGNATURE BINAIRE, pas dans l'en-tête déclaré
    // par le navigateur ni dans l'extension : un fichier renommé ne passe pas.
    bytes = new Uint8Array(await newFile.arrayBuffer());
    const inspection = inspectImage(bytes);
    if (!inspection.ok) {
      const message =
        inspection.error === 'invalid_size'
          ? frProfile.header.photoTooLarge
          : frProfile.header.photoInvalid;
      return failure(message, correlationId, { photo: message });
    }
    if (!isAvatarMimeType(inspection.metadata.mimeType)) {
      return failure(frProfile.header.photoWrongType, correlationId, {
        photo: frProfile.header.photoWrongType,
      });
    }
    mimeType = inspection.metadata.mimeType;
    width = inspection.metadata.width;
    height = inspection.metadata.height;

    // Chemin toujours NEUF : on ne réécrit jamais par-dessus un objet dont
    // une URL signée peut encore circuler.
    const storagePath = `${profileId}/${globalThis.crypto.randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;

    const uploaded = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (uploaded.error) {
      return failure(frProfile.header.photoUploadFailed, correlationId);
    }

    const { error: avatarUpdateError } = await supabase
      .from('ise_profiles')
      // 0152/D-212 : les dimensions naturelles voyagent avec le chemin,
      // deja calculees par inspectImage() ci-dessus — aucune mesure
      // supplementaire. Elles alimentent le wrapper de cadrage
      // (photoCropWrapperStyle) pour que l'apercu du medaillon montre la
      // photo entiere au zoom neutre, au lieu de la decouper au rapport
      // du cadre (D-212).
      .update({ avatar_path: storagePath, avatar_width: width, avatar_height: height })
      .eq('id', profileId);

    if (avatarUpdateError) {
      await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
      return failure(toBusinessError(avatarUpdateError, correlationId).userMessage, correlationId);
    }

    if (state.avatarPath !== null && state.avatarPath !== storagePath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([state.avatarPath]);
    }

    avatarPath = storagePath;
  } else {
    if (avatarPath === null) {
      return failure(frProfile.header.photoInvalid, correlationId, {
        photo: frProfile.header.photoInvalid,
      });
    }
    // Pas de nouveau fichier : on relit les octets déjà déposés pour
    // pouvoir, le cas échéant, en déposer une copie publique.
    const downloaded = await supabase.storage.from(AVATAR_BUCKET).download(avatarPath);
    if (downloaded.error || !downloaded.data) {
      return failure(frProfile.header.photoUploadFailed, correlationId);
    }
    bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const inspection = inspectImage(bytes);
    if (!inspection.ok || !isAvatarMimeType(inspection.metadata.mimeType)) {
      return failure(frProfile.header.photoUploadFailed, correlationId);
    }
    mimeType = inspection.metadata.mimeType;
    width = inspection.metadata.width;
    height = inspection.metadata.height;
  }

  // La case de publication : écrite AVANT tout dépôt dans le bucket public,
  // parce que la politique Storage `ise_landing_media_member_photo_insert`
  // (0120) exige `allow_public_photo = true` DÉJÀ en base au moment du
  // dépôt — pas après.
  const { error: consentError } = await supabase
    .from('ise_profiles')
    .update({ allow_public_photo: allowPublicPhoto })
    .eq('id', profileId);

  if (consentError) {
    return failure(toBusinessError(consentError, correlationId).userMessage, correlationId);
  }

  if (allowPublicPhoto) {
    const publicPath = `membres/${profileId}/${globalThis.crypto.randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;

    const publicUpload = await supabase.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, bytes, { contentType: mimeType, upsert: false });

    if (publicUpload.error) {
      // Le médaillon (avatar) est déjà enregistré à ce stade : ne pas le
      // remettre en cause pour un échec de la copie publique, mais le dire.
      return failure(frProfile.header.photoUploadFailed, correlationId);
    }

    const { error: publishError } = await supabase.rpc('set_my_public_photo', {
      p_storage_path: publicPath,
      p_alt_text: altText,
      p_width: width,
      p_height: height,
    });

    if (publishError) {
      await supabase.storage.from(PUBLIC_BUCKET).remove([publicPath]);
      return failure(toBusinessError(publishError, correlationId).userMessage, correlationId);
    }

    // L'ancien objet public (chemin différent) n'est plus référencé depuis
    // que `set_my_public_photo` a réécrit `public_photo_path` — sa ligne
    // `storage.objects` est déjà retirée par le déclencheur de 0120, mais
    // pas ses octets S3 : seule l'API Storage les efface.
    if (state.publicPhotoPath !== null && state.publicPhotoPath !== publicPath) {
      await supabase.storage.from(PUBLIC_BUCKET).remove([state.publicPhotoPath]);
    }
  } else if (state.publicPhotoPath !== null) {
    await withdrawPublicMirror(supabase, state.publicPhotoPath);
  }

  await refreshProfileViews();
  return success(hasNewFile ? frProfile.header.photoSaved : frProfile.header.photoConsentSaved);
}

/* ------------------------------------------------------------------ */
/* 2. Retrait complet de la photo (médaillon ET copie publique)         */
/* ------------------------------------------------------------------ */

export async function removePhotoAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;
  const supabase = await createSupabaseServerClient();

  const state = await readPhotoState(profileId);
  if (state.avatarPath === null) return success(frProfile.header.photoRemoved);

  // La copie publique d'abord (si elle existe), le médaillon ensuite : même
  // ordre que partout ailleurs dans ce projet — les octets avant la
  // colonne, tant que le chemin est encore connu.
  if (state.publicPhotoPath !== null) {
    await withdrawPublicMirror(supabase, state.publicPhotoPath);
  }

  await supabase.storage.from(AVATAR_BUCKET).remove([state.avatarPath]);

  const { error } = await supabase
    .from('ise_profiles')
    .update({ avatar_path: null })
    .eq('id', profileId);

  if (error) {
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  await refreshProfileViews();
  return success(frProfile.header.photoRemoved);
}

/* ------------------------------------------------------------------ */
/* 3. Cadrage des DEUX blocs (médaillon + rectangle) — D-206, D-211     */
/* ------------------------------------------------------------------ */

const CROP_FOCAL_MIN = 0;
const CROP_FOCAL_MAX = 100;
const CROP_ZOOM_MIN = 0.5;
const CROP_ZOOM_MAX = 3;

function validCropTriplet(focalX: number, focalY: number, zoom: number): boolean {
  return (
    Number.isFinite(focalX) &&
    focalX >= CROP_FOCAL_MIN &&
    focalX <= CROP_FOCAL_MAX &&
    Number.isFinite(focalY) &&
    focalY >= CROP_FOCAL_MIN &&
    focalY <= CROP_FOCAL_MAX &&
    Number.isFinite(zoom) &&
    zoom >= CROP_ZOOM_MIN &&
    zoom <= CROP_ZOOM_MAX
  );
}

/**
 * Enregistre EN UN SEUL GESTE le cadrage des deux blocs — demande explicite
 * du porteur : « il voit exactement comment ça sera sur le deux pages. et il
 * enregistre. s'il enregistre c'est bon pour les deux. » Le bloc médaillon
 * (`avatar_focal_*`) est un UPDATE direct, déjà exactement encadré par
 * `ise_profiles_update_own` et le privilège de colonne (0147). Le bloc
 * rectangle (`public_photo_focal_*`) passe par `set_my_public_photo_crop()`
 * (0141), en lecture seule pour le membre sinon — et n'est appliqué QUE si
 * une copie publique existe réellement (case cochée ET dépôt déjà fait) :
 * sans cela, le bloc rectangle n'est de toute façon pas affiché côté écran.
 */
export async function updatePhotoCropAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;

  const avatarFocalX = Number(formData.get('avatarFocalX'));
  const avatarFocalY = Number(formData.get('avatarFocalY'));
  const avatarZoom = Number(formData.get('avatarZoom'));
  const photoFocalX = Number(formData.get('photoFocalX'));
  const photoFocalY = Number(formData.get('photoFocalY'));
  const photoZoom = Number(formData.get('photoZoom'));

  if (!validCropTriplet(avatarFocalX, avatarFocalY, avatarZoom)) {
    return failure(frProfile.header.photoCropInvalid, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const state = await readPhotoState(profileId);

  if (state.avatarPath === null) {
    return failure(frProfile.header.photoCropInvalid, correlationId);
  }

  const { error: avatarError } = await supabase
    .from('ise_profiles')
    .update({
      avatar_focal_x: Math.round(avatarFocalX * 100) / 100,
      avatar_focal_y: Math.round(avatarFocalY * 100) / 100,
      avatar_zoom: Math.round(avatarZoom * 100) / 100,
    })
    .eq('id', profileId);

  if (avatarError) {
    return failure(toBusinessError(avatarError, correlationId).userMessage, correlationId);
  }

  // Bloc rectangle : seulement si une copie publique existe réellement.
  if (state.allowPublicPhoto && state.publicPhotoPath !== null) {
    if (!validCropTriplet(photoFocalX, photoFocalY, photoZoom)) {
      return failure(frProfile.header.photoCropInvalid, correlationId);
    }
    const { error: publicError } = await supabase.rpc('set_my_public_photo_crop', {
      p_focal_x: photoFocalX,
      p_focal_y: photoFocalY,
      p_zoom: photoZoom,
    });
    if (publicError) {
      return failure(toBusinessError(publicError, correlationId).userMessage, correlationId);
    }
  }

  await refreshProfileViews();
  return success(frProfile.header.photoCropSaved);
}
