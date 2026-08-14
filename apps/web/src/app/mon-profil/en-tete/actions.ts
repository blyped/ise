'use server';

import { revalidatePath } from 'next/cache';
import { toBusinessError } from '@ise/domain';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { frProfile } from '@/i18n/profile';
import { inspectImage } from '@/lib/cms/image-metadata';

/**
 * Dépôt et retrait de la PHOTO DE PROFIL — révision de D-117 (14/08/2026).
 *
 * D-117 ne disait pas « impossible » : elle constatait qu'aucun écran de
 * téléversement n'était livré et refusait d'afficher un bouton décoratif
 * (MASTER PROMPT §113). Le mécanisme existe désormais — il a été livré pour
 * le portrait public (0120) — et il est ici transposé au bucket PRIVÉ
 * `avatars`. Le motif du refus a disparu, l'écart est donc levé.
 *
 * DEUX ACTES DISTINCTS, comme pour la vitrine publique :
 *   1. `uploadAvatarAction` — dépôt (ou remplacement) de la photo ;
 *   2. `removeAvatarAction` — retrait de la photo.
 * Ils sont séparés de `saveProfileHeaderAction` : enregistrer du texte ne
 * doit jamais emporter silencieusement une image, et réciproquement.
 *
 * LA SÉCURITÉ N'EST PAS ICI, elle est en base :
 *   · la politique Storage `ise_avatars_write` (0027) refuse tout dépôt hors
 *     de `avatars/<mon profile_id>/…` ;
 *   · la politique `ise_profiles_update_own` (0021) limite l'UPDATE à ma
 *     propre ligne, et le privilège colonne n'est accordé que sur les
 *     colonnes que le membre a le droit d'écrire ;
 *   · la contrainte `ise_profiles_avatar_path_scope` (0126) refuse
 *     d'enregistrer le chemin d'un AUTRE membre.
 * AUCUNE RPC dédiée n'a donc été écrite : un UPDATE direct est déjà
 * exactement encadré, une RPC n'ajouterait qu'une couche sans pouvoir.
 *
 * LE BUCKET RESTE PRIVÉ. Cette photo n'est jamais servie au web ouvert :
 * elle est lue par URL signée réservée aux membres actifs
 * (`signedAvatarUrl`). Le portrait PUBLIC est un objet différent, dans un
 * bucket différent, avec un consentement propre (0120) — les deux ne se
 * confondent pas.
 */

const AVATAR_BUCKET = 'avatars';

/**
 * 2 Mo : ce n'est pas une préférence d'écran, c'est le `file_size_limit`
 * réel du bucket `avatars` (0027). Un fichier plus lourd serait refusé par
 * Storage de toute façon ; autant le dire en français avant l'envoi.
 * Valeur redite dans `AvatarForm.tsx` : un fichier `'use server'` n'exporte
 * que des fonctions asynchrones (D-159), pas des constantes.
 */
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Le bucket n'accepte que ces trois types (`allowed_mime_types`, 0027).
 * `inspectImage` reconnaît aussi l'AVIF — accepté, lui, par le bucket
 * PUBLIC `landing-media` : il faut donc l'écarter explicitement ici plutôt
 * que de laisser Storage renvoyer une erreur illisible.
 */
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

/**
 * La photo pèse dans le score de complétion (bloc `photo`, poids 5/100) :
 * le déclencheur `trg_completion_ise_profiles` recalcule le score dès que
 * `avatar_path` change. On rafraîchit donc aussi les écrans qui l'affichent.
 */
function refreshProfileViews() {
  revalidatePath(PROFILE_ROUTES.header);
  revalidatePath(PROFILE_ROUTES.overview);
  revalidatePath(PROFILE_ROUTES.completion);
  revalidatePath(PROFILE_ROUTES.missingItems);
}

/** Chemin actuellement enregistré, ou `null` si aucune photo. */
async function readAvatarPath(profileId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('ise_profiles')
    .select('avatar_path')
    .eq('id', profileId)
    .maybeSingle();

  const row = (data ?? null) as { avatar_path?: unknown } | null;
  const path = typeof row?.avatar_path === 'string' ? row.avatar_path : null;
  return path !== null && path.length > 0 ? path : null;
}

/* ------------------------------------------------------------------ */
/* 1. Dépôt (ou remplacement) de la photo de profil                     */
/* ------------------------------------------------------------------ */

export async function uploadAvatarAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return failure(frProfile.header.photoInvalid, correlationId, {
      avatar: frProfile.header.photoInvalid,
    });
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return failure(frProfile.header.photoTooLarge, correlationId, {
      avatar: frProfile.header.photoTooLarge,
    });
  }

  // Le type est lu dans la SIGNATURE BINAIRE, pas dans l'en-tête déclaré par
  // le navigateur ni dans l'extension : un fichier renommé ne passe pas.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = inspectImage(bytes);
  if (!inspection.ok) {
    const message =
      inspection.error === 'invalid_size'
        ? frProfile.header.photoTooLarge
        : frProfile.header.photoInvalid;
    return failure(message, correlationId, { avatar: message });
  }

  const { mimeType } = inspection.metadata;
  if (!isAvatarMimeType(mimeType)) {
    return failure(frProfile.header.photoWrongType, correlationId, {
      avatar: frProfile.header.photoWrongType,
    });
  }

  // Chemin toujours NEUF : on ne réécrit jamais par-dessus un objet dont une
  // URL signée peut encore circuler. L'ancien est effacé plus bas, une fois
  // qu'il n'est plus référencé.
  const previousPath = await readAvatarPath(profileId);
  const storagePath = `${profileId}/${globalThis.crypto.randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;

  const supabase = await createSupabaseServerClient();

  const uploaded = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });

  if (uploaded.error) {
    // Le refus vient le plus souvent de la politique Storage : préfixe qui
    // n'est pas le sien, type ou poids refusés par le bucket.
    return failure(frProfile.header.photoUploadFailed, correlationId);
  }

  const { error } = await supabase
    .from('ise_profiles')
    .update({ avatar_path: storagePath })
    .eq('id', profileId);

  if (error) {
    // Le fichier vient d'être déposé mais n'est rattaché à rien : on le
    // retire plutôt que de laisser un objet orphelin dans le bucket.
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  // Remplacement : l'ancien objet n'est plus référencé, ses octets partent.
  // PostgreSQL n'a aucun accès aux octets stockés — seule l'API Storage les
  // efface, et seulement tant qu'on connaît le chemin. C'est le moment.
  if (previousPath !== null && previousPath !== storagePath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  refreshProfileViews();
  return success(frProfile.header.photoSaved);
}

/* ------------------------------------------------------------------ */
/* 2. Retrait de la photo de profil                                     */
/* ------------------------------------------------------------------ */

export async function removeAvatarAction(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;

  const currentPath = await readAvatarPath(profileId);
  if (currentPath === null) return success(frProfile.header.photoRemoved);

  const supabase = await createSupabaseServerClient();

  // Les octets d'abord, la colonne ensuite : une fois `avatar_path` remis à
  // NULL, plus personne ne saurait quel fichier effacer. Même ordre que
  // `withdrawPublicPhotoAction` (0120), pour la même raison.
  await supabase.storage.from(AVATAR_BUCKET).remove([currentPath]);

  const { error } = await supabase
    .from('ise_profiles')
    .update({ avatar_path: null })
    .eq('id', profileId);

  if (error) {
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  refreshProfileViews();
  return success(frProfile.header.photoRemoved);
}
