/**
 * Pieces jointes d'une remontee (migration 0131).
 *
 * CE MODULE EST PARTAGE entre le formulaire (client) et les Server
 * Actions : il ne contient que des constantes et des fonctions pures.
 * Les limites qu'il porte sont les MEMES qu'en base et sur le bucket —
 * proposer au navigateur un format que la base refuserait ensuite serait
 * un champ decoratif (MASTER PROMPT §113). Le controle qui compte reste
 * cote serveur :
 *   · le bucket prive `support-attachments` refuse au-dela de 10 Mo et
 *     hors de sa liste MIME (0027) ;
 *   · les politiques Storage refusent tout depot hors du prefixe du
 *     ticket (0027) ;
 *   · `public.attach_support_file()` reverifie l'auteur du message, le
 *     prefixe, l'existence reelle de l'objet, le type, la taille et la
 *     limite de trois fichiers par message (0131).
 *
 * ANALYSE ANTIVIRALE : AUCUNE, et rien ici ne pretend le contraire.
 * Aucun antivirus n'est disponible dans ce deploiement. La verification
 * de signature ci-dessous empeche de faire passer un executable pour un
 * PNG ; elle ne dit RIEN de l'innocuite du contenu. Un DOCX legitimement
 * forme peut porter des macros. C'est un manque explicite (meme
 * convention qu'en 0127).
 */

export const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments';

/** Miroir de `storage.buckets.file_size_limit` et du CHECK de 0016. */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10_485_760;

/** D-84 : trois fichiers par message, verifie en base par 0131. */
export const SUPPORT_ATTACHMENT_MAX_FILES = 3;

export const SUPPORT_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** Valeur de l'attribut `accept` : memes types, extensions incluses. */
export const SUPPORT_ATTACHMENT_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  'application/pdf',
  '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pptx',
].join(',');

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function supportAttachmentExtension(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}

export function isSupportAttachmentMime(mimeType: string): boolean {
  return (SUPPORT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * `storage.objects.name` ne porte PAS le prefixe du bucket, alors que
 * `support_message_attachments.storage_path` le porte (meme convention
 * qu'en 0127 pour les documents de profil). Cette fonction fait la
 * conversion dans le sens lecture.
 */
export function supportObjectName(storagePath: string): string {
  const prefix = `${SUPPORT_ATTACHMENTS_BUCKET}/`;
  return storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : storagePath;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function isAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/**
 * Le type declare par le navigateur est-il coherent avec les premiers
 * octets du fichier ?
 *
 * Les trois formats Office sont des archives ZIP : leur signature est
 * identique et ne permet PAS de les distinguer entre eux. On verifie
 * donc la FAMILLE, pas le format exact — le dire est plus honnete que
 * de laisser croire a un controle qui n'existe pas.
 */
export function supportSignatureMatches(mimeType: string, bytes: Uint8Array): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return startsWith(bytes, [0x50, 0x4b]); // PK — archive ZIP (OOXML)
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/webp':
      return isAscii(bytes, 0, 'RIFF') && isAscii(bytes, 8, 'WEBP');
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Vues                                                                */
/* ------------------------------------------------------------------ */

export interface SupportAttachment {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  storagePath: string;
  /** URL signee de courte duree, `null` si la signature a echoue. */
  href: string | null;
}

export interface SupportThreadMessage {
  messageId: string;
  authorKind: string;
  fromMe: boolean;
  body: string;
  createdAt: string | null;
  attachments: SupportAttachment[];
}

export interface SupportTicketView {
  ticketId: string;
  referenceCode: string;
  subject: string;
  description: string;
  categoryCode: string;
  categoryName: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  reopenedCount: number;
  canReply: boolean;
  canClose: boolean;
  canReopen: boolean;
  messages: SupportThreadMessage[];
}

/** Taille lisible, sans arrondi trompeur : Ko et Mo binaires. */
export function formatBytes(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} o`;
  if (byteSize < 1024 * 1024) return `${Math.round(byteSize / 1024)} Ko`;
  return `${(byteSize / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
