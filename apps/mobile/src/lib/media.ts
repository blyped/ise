import { publicEnv } from './env';

/**
 * Medias editoriaux servis depuis le SEUL bucket public de la plateforme
 * (`landing-media`, migration 0068, D-134).
 *
 * Portage mobile de `apps/web/src/lib/public/landing-data.ts`
 * (`LandingMedia`, `parseMedia`, `landingMediaUrl`), avec exactement les
 * memes refus. Le module est duplique plutot qu'importe : le web passe par
 * `next/cache` et `NEXT_PUBLIC_*`, le mobile par `EXPO_PUBLIC_*`.
 *
 * TROIS REGLES, IDENTIQUES AU WEB
 *
 *  1. **Alternative textuelle obligatoire.** Un media sans `alt_text` d'au
 *     moins 3 caracteres n'est pas un media incomplet : c'est un media NON
 *     PUBLIABLE (ADDENDUM §52). Il est ecarte, et l'ecran s'affiche sans
 *     image plutot qu'avec une image que personne ne peut decrire.
 *
 *  2. **Bucket public uniquement.** Fabriquer une URL publique pour un
 *     bucket prive produirait un 400 et une image cassee.
 *
 *  3. **Une seule image par contenu.** Aucun champ « image mobile »
 *     n'existe : le mobile affiche le MEME fichier que le web et que
 *     l'encart d'accueil, redimensionne a l'affichage (D-172).
 */

/** Le seul bucket Storage reellement public (D-73, D-134). */
const PUBLIC_MEDIA_BUCKET = 'landing-media';

/** Longueur minimale d'une alternative textuelle, alignee sur la contrainte SQL. */
const MEDIA_ALT_MIN_LENGTH = 3;

export interface PublicMedia {
  readonly bucket: string;
  readonly path: string;
  readonly alt: string;
  readonly credit: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

/**
 * Lit la forme projetee par `private.landing_media()` :
 * `{ bucket, path, alt_text, credit, width, height }`.
 *
 * Renvoie `null` des qu'une garantie manque — jamais un objet partiel.
 */
export function parsePublicMedia(value: unknown): PublicMedia | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const bucket = typeof raw['bucket'] === 'string' ? raw['bucket'] : null;
  const path = typeof raw['path'] === 'string' ? raw['path'] : null;
  const alt = typeof raw['alt_text'] === 'string' ? raw['alt_text'].trim() : '';

  if (bucket !== PUBLIC_MEDIA_BUCKET) return null;
  if (path === null || path.trim().length === 0) return null;
  if (alt.length < MEDIA_ALT_MIN_LENGTH) return null;

  return {
    bucket,
    path,
    alt,
    credit: typeof raw['credit'] === 'string' ? raw['credit'] : null,
    width: typeof raw['width'] === 'number' ? raw['width'] : null,
    height: typeof raw['height'] === 'number' ? raw['height'] : null,
  };
}

/**
 * URL publique reelle d'un media, ou `null`.
 *
 * Forme servie par Supabase Storage pour un bucket public :
 *   {SUPABASE_URL}/storage/v1/object/public/{bucket}/{chemin}
 *
 * Chaque segment est encode separement : `encodeURIComponent` sur le chemin
 * entier transformerait les `/` en `%2F` et casserait la route.
 */
export function publicMediaUrl(media: PublicMedia | null): string | null {
  if (media === null) return null;
  if (media.bucket !== PUBLIC_MEDIA_BUCKET) return null;

  const base = publicEnv().EXPO_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
  const path = media.path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join('/');
  if (path.length === 0) return null;

  return `${base}/storage/v1/object/public/${encodeURIComponent(media.bucket)}/${path}`;
}
