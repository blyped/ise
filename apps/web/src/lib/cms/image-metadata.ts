/**
 * PIPELINE D'IMAGE — ETAPES 1 ET 5 (ADDENDUM §39).
 *
 * Le pipeline demande : valider -> stocker -> optimiser -> variantes
 * Desktop / Mobile / vignette -> metadonnees.
 *
 * CE QUI EST FAIT ICI, REELLEMENT
 *   * validation du type MIME par le CONTENU du fichier, pas par son
 *     extension ni par l'en-tete envoye par le navigateur — les deux se
 *     falsifient ;
 *   * validation du poids (5 Mo, la borne du bucket `landing-media` posee
 *     en 0068 et repetee par la contrainte `cms_media_assets_size_bytes_check`) ;
 *   * lecture des dimensions dans l'en-tete binaire, sans aucune
 *     dependance : PNG (IHDR), JPEG (SOFn), WebP (VP8 / VP8L / VP8X),
 *     AVIF (boite `ispe` de l'ISOBMFF).
 *
 * CE QUI N'EST PAS FAIT, ET POURQUOI
 *   L'optimisation et la generation des variantes exigent un encodeur
 *   d'images (sharp, libvips, une Edge Function d'imagerie...). Aucun
 *   n'est deploye ici. Plutot que d'enregistrer des lignes
 *   `variant_kind = 'desktop'` pointant le fichier original — ce qui
 *   ferait croire a une variante inexistante —, on n'enregistre que
 *   l'original, et le tableau de bord SIGNALE les medias sans variante.
 *   Voir `frCms.media.pipelineGap`.
 */

export const CMS_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export const CMS_MEDIA_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
] as const;
export type CmsMediaMimeType = (typeof CMS_MEDIA_MIME_TYPES)[number];

/**
 * Emplacements de la vitrine, et donc prefixes de chemin dans le bucket
 * `landing-media` (0068). La politique `ise_landing_media_insert` REFUSE tout
 * depot hors de ces quatre prefixes : la liste ci-dessous n'est pas une
 * convention de nommage, c'est le miroir d'une regle appliquee en base.
 */
export const CMS_MEDIA_USAGES = ['carousel', 'partners', 'news', 'sections'] as const;
export type CmsMediaUsage = (typeof CMS_MEDIA_USAGES)[number];

export const DEFAULT_CMS_MEDIA_USAGE: CmsMediaUsage = 'sections';

export function isCmsMediaUsage(value: unknown): value is CmsMediaUsage {
  return typeof value === 'string' && (CMS_MEDIA_USAGES as readonly string[]).includes(value);
}

export interface ImageMetadata {
  mimeType: CmsMediaMimeType;
  width: number;
  height: number;
}

export type ImageValidationError =
  'invalid_type' | 'invalid_size' | 'invalid_image' | 'unreadable_dimensions';

export type ImageInspection =
  { ok: true; metadata: ImageMetadata } | { ok: false; error: ImageValidationError };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

/** PNG : la taille est dans le chunk IHDR, toujours en premier. */
function inspectPng(bytes: Uint8Array): ImageInspection {
  if (bytes.length < 24) return { ok: false, error: 'unreadable_dimensions' };
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  if (width < 1 || height < 1) return { ok: false, error: 'unreadable_dimensions' };
  return { ok: true, metadata: { mimeType: 'image/png', width, height } };
}

/**
 * JPEG : parcours des segments jusqu'a un marqueur SOFn. Les marqueurs
 * SOF4 (0xC4), SOF8 (0xC8) et SOF12 (0xCC) ne sont PAS des SOF : ce sont
 * DHT, JPG et DAC. Les confondre lit des dimensions fantaisistes.
 */
function inspectJpeg(bytes: Uint8Array): ImageInspection {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Marqueurs sans charge utile.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = readUint16BE(bytes, offset + 2);
    if (length < 2) return { ok: false, error: 'unreadable_dimensions' };

    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 >= bytes.length) return { ok: false, error: 'unreadable_dimensions' };
      const height = readUint16BE(bytes, offset + 5);
      const width = readUint16BE(bytes, offset + 7);
      if (width < 1 || height < 1) return { ok: false, error: 'unreadable_dimensions' };
      return { ok: true, metadata: { mimeType: 'image/jpeg', width, height } };
    }
    offset += 2 + length;
  }
  return { ok: false, error: 'unreadable_dimensions' };
}

/** WebP : trois encodages possibles, trois emplacements differents. */
function inspectWebp(bytes: Uint8Array): ImageInspection {
  if (bytes.length < 30) return { ok: false, error: 'unreadable_dimensions' };
  const format = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);

  if (format === 'VP8 ') {
    // Bitstream simple : 3 octets de tag, 3 octets de signature, puis les tailles.
    const width = readUint16LE(bytes, 26) & 0x3fff;
    const height = readUint16LE(bytes, 28) & 0x3fff;
    if (width < 1 || height < 1) return { ok: false, error: 'unreadable_dimensions' };
    return { ok: true, metadata: { mimeType: 'image/webp', width, height } };
  }

  if (format === 'VP8L') {
    // 14 bits de largeur, 14 bits de hauteur, empaquetes sur 4 octets.
    const packed = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    const width = (packed & 0x3fff) + 1;
    const height = ((packed >> 14) & 0x3fff) + 1;
    return { ok: true, metadata: { mimeType: 'image/webp', width, height } };
  }

  if (format === 'VP8X') {
    const width = readUint24LE(bytes, 24) + 1;
    const height = readUint24LE(bytes, 27) + 1;
    return { ok: true, metadata: { mimeType: 'image/webp', width, height } };
  }

  return { ok: false, error: 'unreadable_dimensions' };
}

/**
 * AVIF : conteneur ISOBMFF. Les dimensions vivent dans la boite `ispe`
 * (« image spatial extents »), enfouie sous `meta > iprp > ipco`. Plutot que
 * de derouler l'arbre de boites — beaucoup de code pour deux entiers —, on
 * cherche la premiere occurrence du type `ispe` dans les premiers kilo-octets
 * et on lit les deux `uint32` qui suivent le champ version/flags.
 *
 * La recherche est BORNEE (64 ko) : un fichier construit pour faire boucler
 * l'analyseur ne le peut pas. Et elle n'est tentee qu'apres reconnaissance de
 * la marque `ftyp` : ce n'est pas un scan a l'aveugle.
 */
const AVIF_ISPE_SCAN_LIMIT = 65536;

function isAvif(bytes: Uint8Array): boolean {
  // `....ftyp` puis une marque contenant 'avif' ou 'avis'.
  if (!startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return false;
  const brands = String.fromCharCode(...bytes.slice(8, Math.min(bytes.length, 32)));
  return brands.includes('avif') || brands.includes('avis');
}

function inspectAvif(bytes: Uint8Array): ImageInspection {
  const limit = Math.min(bytes.length, AVIF_ISPE_SCAN_LIMIT);
  for (let offset = 0; offset + 20 <= limit; offset += 1) {
    if (
      bytes[offset] === 0x69 && // i
      bytes[offset + 1] === 0x73 && // s
      bytes[offset + 2] === 0x70 && // p
      bytes[offset + 3] === 0x65 // e
    ) {
      // 4 octets de version/flags, puis largeur et hauteur.
      const width = readUint32BE(bytes, offset + 8);
      const height = readUint32BE(bytes, offset + 12);
      if (width < 1 || height < 1 || width > 20000 || height > 20000) {
        return { ok: false, error: 'unreadable_dimensions' };
      }
      return { ok: true, metadata: { mimeType: 'image/avif', width, height } };
    }
  }
  return { ok: false, error: 'unreadable_dimensions' };
}

/**
 * Valide le fichier et en lit les dimensions. Le type MIME retenu est
 * celui du CONTENU : un `.png` renomme en `.webp` est refuse, et un
 * `Content-Type` menteur n'a aucun effet.
 *
 * Pas de SVG, jamais : le bucket `landing-media` est PUBLIC (0068) et un SVG
 * est un document XML capable de porter du script. Il serait servi sur le
 * domaine Supabase, donc dans son contexte d'origine. Le bucket le refuse
 * par `allowed_mime_types` ; cette fonction le refuse avant lui.
 */
export function inspectImage(bytes: Uint8Array): ImageInspection {
  if (bytes.length === 0) return { ok: false, error: 'invalid_image' };
  if (bytes.length > CMS_MEDIA_MAX_BYTES) return { ok: false, error: 'invalid_size' };

  if (startsWith(bytes, PNG_SIGNATURE)) return inspectPng(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return inspectJpeg(bytes);
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return inspectWebp(bytes);
  }
  if (isAvif(bytes)) return inspectAvif(bytes);
  return { ok: false, error: 'invalid_type' };
}

const EXTENSIONS: Record<CmsMediaMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Chemin de stockage d'un media dans le bucket public `landing-media`.
 *
 * PREMIER SEGMENT = L'USAGE, et ce n'est pas cosmetique : la politique
 * `ise_landing_media_insert` (0068) refuse tout depot dont le premier
 * segment n'est pas `carousel`, `partners`, `news` ou `sections`. Un chemin
 * mal forme est rejete par la base, pas seulement mal range.
 *
 * Les deux segments suivants — annee, mois — evitent qu'un bucket a plat
 * devienne illisible des la premiere centaine de fichiers.
 */
export function mediaStoragePath(
  usage: CmsMediaUsage,
  mediaId: string,
  mimeType: CmsMediaMimeType,
  at: Date,
): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `${usage}/${year}/${month}/${mediaId}.${EXTENSIONS[mimeType]}`;
}

/** Poids lisible, sans dependance de formatage. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
