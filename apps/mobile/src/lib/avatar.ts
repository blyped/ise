import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { getSupabaseClient } from './supabase/client';

/**
 * PHOTO DE PROFIL — dépôt depuis le mobile (révision de D-117, 14/08/2026).
 *
 * D-117 constatait qu'aucun écran de téléversement n'était livré. Le web l'a
 * ouvert (`apps/web/src/app/mon-profil/en-tete/actions.ts`) ; le mobile suit
 * ici, avec en plus l'APPAREIL PHOTO — prendre la photo depuis le téléphone
 * est souvent plus simple que de la transférer sur un ordinateur.
 *
 * MÊME SÉQUENCE QUE LE WEB, dans cet ordre exact :
 *   1. téléverser le nouvel objet sous `<profile_id>/<uuid>.<ext>` ;
 *   2. mettre à jour `ise_profiles.avatar_path` ;
 *   3. SEULEMENT ENSUITE effacer l'ancien objet, qui n'est alors plus
 *      référencé par personne.
 * Si l'UPDATE échoue, l'objet neuf est retiré : on ne laisse pas d'orphelin
 * dans le bucket. Et on n'écrase jamais un objet existant (`upsert: false`,
 * chemin toujours neuf) : une URL signée émise plus tôt peut encore circuler.
 *
 * LA SÉCURITÉ N'EST PAS ICI, elle est en base — exactement comme sur le web :
 *   · la politique Storage `ise_avatars_write` (0027) refuse tout dépôt hors
 *     de `avatars/<mon profile_id>/…` ;
 *   · `ise_profiles_update_own` (0021) limite l'UPDATE à ma propre ligne ;
 *   · la contrainte `ise_profiles_avatar_path_scope` (0126) refuse
 *     d'enregistrer le chemin d'un AUTRE membre.
 * Les vérifications ci-dessous ne sont qu'une politesse : dire non en
 * français avant d'envoyer 5 Mo sur un réseau mobile, plutôt que de laisser
 * Storage renvoyer une erreur illisible.
 *
 * LE BUCKET RESTE PRIVÉ. Cette photo n'est jamais servie au web ouvert : elle
 * est lue par URL signée de courte durée. Le portrait PUBLIC est un objet
 * différent, dans un bucket différent, avec un consentement propre (0120).
 */

/** Bucket PRIVÉ de la photo de profil (0027). */
export const AVATAR_BUCKET = 'avatars';

/**
 * 5 Mo : `file_size_limit` du bucket `avatars` (0027, relevé à 5 Mo par
 * 0153/D-213), et la même borne qu'annonce le web.
 */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Miroir exact d'`allowed_mime_types` du bucket `avatars` (0027).
 * L'AVIF en est ABSENT : il est accepté par le bucket PUBLIC
 * `landing-media`, pas par celui-ci. Il faut donc l'écarter nommément —
 * d'autant qu'un iPhone rend volontiers du HEIC, lui aussi refusé.
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

/* ==================================================================== */
/* Lecture du type réel : la SIGNATURE BINAIRE, pas l'extension          */
/* ==================================================================== */

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Quatre octets ASCII lus tels quels (marques de conteneur ISOBMFF/RIFF). */
function ascii4(bytes: Uint8Array, offset: number): string {
  if (bytes.length < offset + 4) return '';
  let out = '';
  for (let index = offset; index < offset + 4; index += 1) {
    out += String.fromCharCode(bytes[index] ?? 0);
  }
  return out;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38];

/**
 * Le type est lu dans le CONTENU, jamais dans l'extension ni dans le
 * `mimeType` annoncé par le sélecteur : un fichier renommé ne passe pas, et
 * un HEIC déguisé en `.jpg` non plus. Même principe que `inspectImage` côté
 * web, réduit ici à ce qui sert : reconnaître, et savoir refuser.
 */
function detectImageMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  if (ascii4(bytes, 0) === 'RIFF' && ascii4(bytes, 8) === 'WEBP') return 'image/webp';
  if (ascii4(bytes, 4) === 'ftyp') {
    const brand = ascii4(bytes, 8);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1' || brand === 'msf1') {
      return 'image/heic';
    }
    return null;
  }
  if (startsWith(bytes, GIF_SIGNATURE)) return 'image/gif';
  return null;
}

/* ==================================================================== */
/* Base64 -> octets                                                      */
/* ==================================================================== */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_INDEX: Record<string, number> = (() => {
  const table: Record<string, number> = {};
  for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
    table[BASE64_ALPHABET.charAt(index)] = index;
  }
  return table;
})();

/**
 * `expo-file-system` ne sait rendre un fichier binaire qu'en base64 : il faut
 * donc le décoder nous-mêmes. Décodeur écrit à la main plutôt qu'une
 * dépendance de plus (`base64-arraybuffer`) pour quinze lignes, et plutôt que
 * `atob`, dont la présence n'est pas garantie sur toutes les cibles Hermes.
 * Rend `null` si la chaîne n'est pas du base64 valide.
 */
function base64ToBytes(value: string): Uint8Array | null {
  const clean = value.replace(/[\s\r\n]/g, '');
  if (clean.length === 0 || clean.length % 4 !== 0) return null;

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);
  let cursor = 0;

  for (let block = 0; block < clean.length; block += 4) {
    let chunk = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      const char = clean.charAt(block + offset);
      if (char === '=') {
        chunk = chunk << 6;
        continue;
      }
      const index = BASE64_INDEX[char];
      if (index === undefined) return null;
      chunk = (chunk << 6) | index;
    }
    if (cursor < bytes.length) bytes[cursor++] = (chunk >> 16) & 0xff;
    if (cursor < bytes.length) bytes[cursor++] = (chunk >> 8) & 0xff;
    if (cursor < bytes.length) bytes[cursor++] = chunk & 0xff;
  }

  return bytes;
}

/* ==================================================================== */
/* 1. Choix de l'image : appareil photo ou galerie                       */
/* ==================================================================== */

/**
 * Recadrage carré proposé nativement (`allowsEditing`) : la photo est
 * affichée en médaillon partout dans l'application, autant laisser le membre
 * cadrer son visage lui-même plutôt que de rogner au centre après coup.
 * `aspect` n'agit que sur Android — iOS impose déjà un carré.
 *
 * `quality: 0.85` n'est pas cosmétique : une photo prise au téléphone dépasse
 * facilement les 5 Mo du bucket. La borne reste vérifiée sur les octets réels
 * plus bas ; ceci évite seulement de la heurter pour rien.
 */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  allowsMultipleSelection: false,
  aspect: [1, 1],
  quality: 0.85,
  exif: false,
};

export type AvatarPick =
  /** Une image a été choisie : `uri` pointe le fichier local (déjà recadré). */
  | { readonly status: 'picked'; readonly uri: string }
  /** Le membre a fermé le sélecteur : ce n'est pas une erreur, on se tait. */
  | { readonly status: 'canceled' }
  /** Autorisation système refusée : l'écran doit le DIRE, pas rester muet. */
  | { readonly status: 'denied' };

function fromPickerResult(result: ImagePicker.ImagePickerResult): AvatarPick {
  if (result.canceled) return { status: 'canceled' };
  const first = result.assets[0];
  if (first === undefined) return { status: 'canceled' };
  return { status: 'picked', uri: first.uri };
}

/**
 * Appareil photo. L'autorisation est demandée À L'USAGE, jamais au démarrage :
 * un membre qui n'ajoute pas de photo n'a aucune raison d'être interrogé.
 * Si elle est refusée (ou déjà refusée définitivement, auquel cas le système
 * ne redemande rien), on rend `denied` — à l'écran de proposer les réglages.
 */
export async function pickAvatarFromCamera(): Promise<AvatarPick> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return fromPickerResult(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
}

/**
 * Galerie. Sur iOS 14+ et Android 14+, l'accès peut être « limité » à une
 * sélection : c'est suffisant ici, `granted` vaut alors `true` et le membre
 * choisit parmi les photos qu'il a lui-même autorisées.
 */
export async function pickAvatarFromLibrary(): Promise<AvatarPick> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return fromPickerResult(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
}

/* ==================================================================== */
/* 2. Dépôt (ou remplacement) de la photo                                */
/* ==================================================================== */

export type AvatarUploadFailure =
  /** Fichier illisible, vide, ou format non reconnu. */
  | 'unreadable'
  /** Image reconnue mais refusée par le bucket (AVIF, HEIC, GIF…). */
  | 'wrong_type'
  /** Au-delà des 5 Mo du bucket. */
  | 'too_large'
  /** Storage a refusé le dépôt (politique, réseau…). */
  | 'upload_failed'
  /** L'objet est déposé mais `avatar_path` n'a pas pu être écrit. */
  | 'save_failed';

export type AvatarUploadOutcome =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: AvatarUploadFailure };

/**
 * Dépose l'image locale `localUri` comme photo de profil de `profileId`.
 *
 * `previousPath` est le chemin actuellement enregistré (ou `null`) : il n'est
 * effacé qu'APRÈS que la nouvelle photo est enregistrée et référencée.
 */
export async function uploadAvatar(
  profileId: string,
  localUri: string,
  previousPath: string | null,
): Promise<AvatarUploadOutcome> {
  let encoded: string;
  try {
    encoded = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const bytes = base64ToBytes(encoded);
  if (bytes === null || bytes.length === 0) return { ok: false, reason: 'unreadable' };

  // Le poids est mesuré sur les octets RÉELLEMENT obtenus après recadrage et
  // recompression, pas sur le `fileSize` annoncé par le sélecteur, qui décrit
  // parfois encore l'original.
  if (bytes.length > AVATAR_MAX_BYTES) return { ok: false, reason: 'too_large' };

  const mimeType = detectImageMimeType(bytes);
  if (mimeType === null) return { ok: false, reason: 'unreadable' };
  if (!isAvatarMimeType(mimeType)) return { ok: false, reason: 'wrong_type' };

  // Chemin toujours NEUF : on ne réécrit jamais par-dessus un objet dont une
  // URL signée peut encore circuler.
  const storagePath = `${profileId}/${Crypto.randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;
  const supabase = getSupabaseClient();

  const uploaded = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, bytes.buffer as ArrayBuffer, { contentType: mimeType, upsert: false });

  if (uploaded.error) return { ok: false, reason: 'upload_failed' };

  const { error } = await supabase
    .from('ise_profiles')
    .update({ avatar_path: storagePath })
    .eq('id', profileId);

  if (error) {
    // Déposé mais rattaché à rien : on le retire plutôt que de laisser un
    // objet orphelin que plus aucune ligne ne désigne.
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath]);
    return { ok: false, reason: 'save_failed' };
  }

  // Remplacement : l'ancien objet n'est plus référencé, ses octets partent.
  // PostgreSQL n'a aucun accès aux octets de Storage — seule l'API les
  // efface, et seulement tant qu'on connaît le chemin. C'est le moment.
  if (previousPath !== null && previousPath !== storagePath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  return { ok: true, path: storagePath };
}
