import {
  AUTH_ROUTE_PREFIXES,
  MEMBER_ROUTE_PREFIXES,
  ROUTES,
  matchesRoutePrefix,
} from '@/lib/routes';

/**
 * ADDENDUM §5 — Protection contre les redirections ouvertes.
 *
 * `redirectTo` est une valeur entierement controlee par l'appelant : elle
 * arrive dans l'URL de `/connexion`. Elle ne peut donc jamais etre utilisee
 * telle quelle. Ce module est le seul point du code autorise a transformer
 * une valeur brute en cible de redirection.
 *
 * Principes retenus :
 *  1. liste blanche, jamais liste noire : une cible inconnue est refusee ;
 *  2. defense en profondeur : trois portes independantes (analyse lexicale de
 *     chaque couche d'encodage, analyse WHATWG, liste blanche de routes).
 *     Chacune suffirait ; les trois sont posees quand meme ;
 *  3. refus, jamais nettoyage : on ne « repare » pas une valeur hostile, on la
 *     jette. Nettoyer, c'est offrir a l'attaquant une deuxieme chance ;
 *  4. echec silencieux cote utilisateur, bruyant cote serveur.
 */

/** Cible de repli : le tableau de bord membre (ADDENDUM §5). */
export const REDIRECT_FALLBACK: string = ROUTES.dashboard;

/** Au-dela, la valeur n'est plus une route : c'est une charge utile. */
const MAX_LENGTH = 512;

/** Nombre maximal de decodages successifs avant de conclure a un piege. */
const MAX_DECODE_PASSES = 5;

/**
 * Origine fictive servant de base a l'analyseur d'URL. Le TLD `.invalid` est
 * reserve par la RFC 2606 : il ne peut jamais correspondre a un hote reel.
 */
const SENTINEL_HOST = 'redirect-base.invalid';
const SENTINEL_ORIGIN = `https://${SENTINEL_HOST}`;

export type RedirectRefusal =
  /** Parametre absent (`undefined` / `null`). */
  | 'absent'
  /** Type inattendu : tableau (parametre repete dans l'URL), objet, nombre. */
  | 'type-invalide'
  /** Chaine vide. */
  | 'vide'
  /** Longueur deraisonnable. */
  | 'trop-long'
  /** Caractere de controle, espace, tabulation, retour chariot, U+0000. */
  | 'caractere-interdit'
  /** Sequence `%` invalide : `decodeURIComponent` echoue des le premier passage. */
  | 'encodage-invalide'
  /** Encodage empile au-dela de ce qu'une route legitime peut porter. */
  | 'encodage-imbrique'
  /** Antislash : `\\/evil`, `/\evil`, `%5C`. */
  | 'antislash'
  /** Protocole explicite : `https:`, `javascript:`, `data:`, `file:`... */
  | 'protocole-externe'
  /** Chemin protocole-relatif : `//evil.example`, `///evil.example`. */
  | 'chemin-protocole-relatif'
  /** Ne commence pas par `/` : chemin relatif, ou hote nu. */
  | 'chemin-non-absolu'
  /** Segment `..` : tentative de sortie de l'espace de routes. */
  | 'traversee'
  /** L'analyseur WHATWG resout la valeur hors de l'origine. */
  | 'hote-externe'
  /** La racine publique n'est pas une destination d'apres-connexion utile. */
  | 'racine-publique'
  /** La cible est un ecran d'authentification : boucle. */
  | 'boucle-authentification'
  /** Chemin interne syntaxiquement valide, mais hors liste blanche. */
  | 'route-non-autorisee';

export type RedirectInspection =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly refusal: RedirectRefusal };

/** Journal de refus. Injectable pour les tests. */
export type RedirectLogger = (message: string, details: Record<string, unknown>) => void;

export interface SafeRedirectContext {
  /** Ecran ou action a l'origine de l'appel, pour la lecture des journaux. */
  readonly source?: string;
  /** Identifiant de correlation deja emis par l'appelant (D-102). */
  readonly correlationId?: string;
  readonly logger?: RedirectLogger;
}

function refuse(refusal: RedirectRefusal): RedirectInspection {
  return { ok: false, refusal };
}

/**
 * Controle C0, DEL, controle C1 — et l'espace sur la couche brute.
 *
 * Les navigateurs retirent silencieusement tabulation, saut de ligne et
 * retour chariot d'une URL : `/<TAB>/evil.example` deviendrait
 * `//evil.example`. Un `%0d%0a` decode servirait, lui, a injecter un en-tete
 * dans la reponse `Location`. Les deux sont refuses avant toute autre analyse.
 *
 * L'espace est refuse sur la couche brute (une URL n'en contient pas) mais
 * tolere sur les couches decodees : `/profil/a%20b` est une route legitime.
 * Un espace decode n'est pas structurant — il ne permet de fabriquer ni un
 * hote, ni un protocole.
 *
 * Ecrit en boucle plutot qu'en expression reguliere : le fichier reste ainsi
 * entierement lisible en ASCII, sans caractere de controle litteral.
 */
function hasForbiddenCharacter(layer: string, allowSpace: boolean): boolean {
  for (const character of layer) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0x20) {
      if (!allowSpace) return true;
      continue;
    }
    if (code < 0x20) return true;
    if (code >= 0x7f && code <= 0x9f) return true;
  }
  return false;
}

/** Un protocole explicite en tete de chaine, quelle que soit sa casse. */
const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Un segment de chemin exactement egal a `..`. */
const PARENT_SEGMENT = /(^|\/)\.\.(\/|$)/;

/**
 * Analyse lexicale d'une couche. Retourne le motif de refus, ou `null` si la
 * couche est acceptable. L'ordre des tests fixe le motif rapporte : il va du
 * plus specifique au plus general, pour que le journal serveur nomme le
 * vecteur reel plutot qu'un symptome.
 */
function inspectLayer(layer: string, isRawLayer: boolean): RedirectRefusal | null {
  if (hasForbiddenCharacter(layer, !isRawLayer)) return 'caractere-interdit';
  if (layer.includes('\\')) return 'antislash';
  if (EXPLICIT_SCHEME.test(layer)) return 'protocole-externe';
  if (layer.includes('://')) return 'protocole-externe';
  if (!layer.startsWith('/')) return 'chemin-non-absolu';
  if (layer.startsWith('//')) return 'chemin-protocole-relatif';
  if (PARENT_SEGMENT.test(layer)) return 'traversee';
  return null;
}

type DecodeResult = { readonly layers: readonly string[] } | { readonly refusal: RedirectRefusal };

/**
 * Deplie toutes les couches d'encodage pourcent.
 *
 * `%2F%2Fevil.example` et son double encodage `%252F%252Fevil.example`
 * designent la meme cible une fois traversee la couche qui les decode ; il
 * faut donc controler chaque couche, pas seulement la surface.
 *
 * Un echec de decodage au **premier** passage signale une valeur malformee et
 * la fait refuser. Aux passages suivants, il signale simplement que le
 * depliage est termine (un `%` litteral legitime, par exemple `?q=100%25`).
 */
function decodeLayers(value: string): DecodeResult {
  const layers: string[] = [value];
  let current = value;

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return pass === 0 ? { refusal: 'encodage-invalide' } : { layers };
    }
    if (next === current) return { layers };
    layers.push(next);
    current = next;
  }

  return { refusal: 'encodage-imbrique' };
}

function withoutTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '') || '/';
  }
  return pathname;
}

/**
 * Verdict complet sur une valeur `redirectTo`, motif de refus compris.
 * `safeRedirect` en est l'enveloppe qui journalise et retombe sur le tableau
 * de bord ; les tests, eux, ont besoin du motif.
 */
export function inspectRedirect(value: unknown): RedirectInspection {
  if (value === undefined || value === null) return refuse('absent');
  if (typeof value !== 'string') return refuse('type-invalide');
  if (value.length === 0) return refuse('vide');
  if (value.length > MAX_LENGTH) return refuse('trop-long');

  // Porte 1 — analyse lexicale de chaque couche d'encodage.
  const decoded = decodeLayers(value);
  if ('refusal' in decoded) return refuse(decoded.refusal);
  for (const [index, layer] of decoded.layers.entries()) {
    const refusal = inspectLayer(layer, index === 0);
    if (refusal !== null) return refuse(refusal);
  }

  // Porte 2 — analyse par l'implementation WHATWG, independante de la
  // precedente. Elle rattrape ce qu'une expression reguliere ignore.
  let url: URL;
  try {
    url = new URL(value, `${SENTINEL_ORIGIN}/`);
  } catch {
    return refuse('chemin-non-absolu');
  }
  if (url.protocol !== 'https:') return refuse('protocole-externe');
  if (url.origin !== SENTINEL_ORIGIN) return refuse('hote-externe');
  if (url.host !== SENTINEL_HOST) return refuse('hote-externe');
  if (url.username !== '' || url.password !== '') return refuse('hote-externe');

  // Porte 3 — liste blanche de routes.
  const pathname = withoutTrailingSlash(url.pathname);
  if (pathname === '/' || pathname === '') return refuse('racine-publique');
  if (matchesRoutePrefix(pathname, AUTH_ROUTE_PREFIXES)) return refuse('boucle-authentification');
  if (!matchesRoutePrefix(pathname, MEMBER_ROUTE_PREFIXES)) return refuse('route-non-autorisee');

  return { ok: true, path: `${pathname}${url.search}${url.hash}` };
}

/**
 * Apercu journalisable d'une valeur hostile : caracteres de controle
 * neutralises et longueur bornee, pour qu'un `redirectTo` malveillant ne
 * puisse pas falsifier une ligne de journal.
 */
function loggablePreview(value: unknown): string {
  if (typeof value !== 'string') return `<${typeof value}>`;

  let preview = '';
  for (const character of value.slice(0, 120)) {
    const code = character.codePointAt(0) ?? 0;
    const isControl = code < 0x20 || (code >= 0x7f && code <= 0x9f);
    preview += isControl ? `\\x${code.toString(16).padStart(2, '0')}` : character;
  }
  return preview;
}

const defaultLogger: RedirectLogger = (message, details) => {
  console.warn(message, details);
};

/**
 * ADDENDUM §5 — Renvoie la cible interne demandee, ou le tableau de bord.
 *
 * Cote utilisateur, un refus est muet : il n'existe aucun message
 * « redirection refusee », qui ne ferait qu'apprendre a l'attaquant ce qui a
 * ete detecte. Cote serveur, chaque refus est journalise avec son motif.
 */
export function safeRedirect(value: unknown, context: SafeRedirectContext = {}): string {
  const inspection = inspectRedirect(value);
  if (inspection.ok) return inspection.path;

  const log = context.logger ?? defaultLogger;
  log('[ISE] redirectTo refusé', {
    motif: inspection.refusal,
    apercu: loggablePreview(value),
    source: context.source ?? 'inconnu',
    correlationId: context.correlationId,
    repli: REDIRECT_FALLBACK,
  });

  return REDIRECT_FALLBACK;
}

/** `true` si la valeur est une cible interne acceptable, sans journalisation. */
export function isSafeRedirect(value: unknown): boolean {
  return inspectRedirect(value).ok;
}
