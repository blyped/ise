import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Scellement du curseur de pagination.
 *
 * POURQUOI CE MODULE EXISTE — defaut reel constate a la lecture des
 * migrations 0031 / 0034 :
 *
 *   `public.match_profiles()` renvoie un curseur construit ainsi :
 *       encode(convert_to(score::text || '|' || id::text, 'UTF8'), 'base64')
 *   soit, pour un profil a 48,50 : `NDguNTB8MDAwMC0uLi4=`, qui se decode
 *   en clair en « 48.50|<uuid> ». La base64 n'est pas un chiffrement.
 *
 *   Transmettre ce curseur tel quel au navigateur — en `href`, en champ
 *   cache ou en props serialisee — rendrait le SCORE CHIFFRE lisible par
 *   n'importe qui, et pas seulement pour la derniere ligne : en rejouant
 *   la pagination page par page on obtiendrait le score exact de chaque
 *   profil. C'est exactement ce que le MASTER PROMPT §15 interdit, et ce
 *   que 0031 revendique eviter (« le score n'existe que dans le curseur
 *   opaque »). Il n'etait opaque que de nom.
 *
 * CORRECTIF : le curseur brut ne quitte jamais le serveur. Il est
 * chiffre (AES-256-GCM, authentifie) avant d'etre remis au client, et
 * dechiffre au retour. Le client ne manipule qu'un jeton indechiffrable
 * et infalsifiable.
 *
 * CLE : derivee d'un secret purement serveur. Par ordre de preference
 *   1. `SEARCH_CURSOR_SECRET` — variable dediee, recommandee ;
 *   2. `SUPABASE_SERVICE_ROLE_KEY` — deja presente, jamais exposee au
 *      navigateur (D-100) ;
 *   3. a defaut, une cle aleatoire tiree au demarrage du processus.
 * Le cas 3 est sur, mais un curseur ne survit alors ni a un redemarrage
 * ni a une autre instance : `unsealCursor()` renvoie `null` et l'ecran
 * invite a relancer la recherche. Jamais de page blanche, jamais de
 * curseur devine.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function cursorKey(): Buffer {
  if (cachedKey !== null) return cachedKey;
  const secret =
    process.env.SEARCH_CURSOR_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    randomBytes(32).toString('hex');
  cachedKey = createHash('sha256').update(`ise:search-cursor:${secret}`).digest();
  return cachedKey;
}

/** Chiffre un curseur RPC. Le resultat ne contient aucune information lisible. */
export function sealCursor(rawCursor: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, cursorKey(), iv);
  const encrypted = Buffer.concat([cipher.update(rawCursor, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

/**
 * Dechiffre un curseur. Renvoie `null` — jamais une exception — si le
 * jeton est absent, tronque, falsifie, ou chiffre avec une autre cle.
 */
export function unsealCursor(sealed: string | null | undefined): string | null {
  if (typeof sealed !== 'string' || sealed.length === 0) return null;
  try {
    const buffer = Buffer.from(sealed, 'base64url');
    if (buffer.length <= IV_BYTES + TAG_BYTES) return null;

    const iv = buffer.subarray(0, IV_BYTES);
    const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const payload = buffer.subarray(IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, cursorKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
