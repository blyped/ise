/**
 * Contexte technique d'une remontee (migration 0131).
 *
 * CE QUI EST COLLECTE, ET RIEN D'AUTRE : la page d'ou part la remontee,
 * l'environnement (web ou mobile), le navigateur, le systeme, le type
 * d'appareil, la taille d'ecran, la langue et le fuseau. C'est ce que le
 * porteur demande pour diagnostiquer un bug.
 *
 * CE QUI N'EST JAMAIS COLLECTE : aucun cookie, aucun jeton, aucune
 * adresse, aucun contenu de formulaire, aucun identifiant de session.
 * La liste ci-dessous est FERMEE, et la base la referme une seconde fois
 * (`private.sanitize_support_context`, liste blanche + troncature a 200
 * caracteres) : l'interface ne pousse rien que la base accepterait par
 * defaut.
 *
 * CE QUI N'EST JAMAIS AFFICHE AU MEMBRE : ce contexte n'est pas renvoye
 * par `get_support_ticket()`. Seule l'administration le voit.
 *
 * Fonctions PURES, executables cote client comme cote serveur.
 */

/** Cles acceptees en base. Toute autre cle est jetee par la RPC. */
export const SUPPORT_CONTEXT_KEYS = [
  'page',
  'surface',
  'environment',
  'browser',
  'browser_version',
  'os',
  'os_version',
  'device_type',
  'viewport',
  'language',
  'timezone',
  'app_version',
  'user_agent',
] as const;

export type SupportContextKey = (typeof SUPPORT_CONTEXT_KEYS)[number];

const MAX_VALUE_LENGTH = 200;

interface Named {
  name: string;
  version: string | null;
}

function firstGroup(pattern: RegExp, userAgent: string): string | null {
  const found = pattern.exec(userAgent);
  if (found === null) return null;
  const group = found[1];
  return typeof group === 'string' && group.length > 0 ? group : null;
}

/**
 * Famille de navigateur. L'ordre des tests compte : Edge et Opera se
 * declarent aussi « Chrome », Chrome se declare aussi « Safari ».
 * On renvoie la famille, pas une identification exacte — pretendre
 * mieux serait faux.
 */
function detectBrowser(userAgent: string): Named {
  const test = (pattern: RegExp): string | null => firstGroup(pattern, userAgent);

  const edge = test(/Edg(?:e|A|iOS)?\/([\d.]+)/);
  if (edge !== null) return { name: 'Edge', version: edge };

  const opera = test(/(?:OPR|Opera)\/([\d.]+)/);
  if (opera !== null) return { name: 'Opera', version: opera };

  const samsung = test(/SamsungBrowser\/([\d.]+)/);
  if (samsung !== null) return { name: 'Samsung Internet', version: samsung };

  const firefox = test(/(?:Firefox|FxiOS)\/([\d.]+)/);
  if (firefox !== null) return { name: 'Firefox', version: firefox };

  const chrome = test(/(?:Chrome|CriOS)\/([\d.]+)/);
  if (chrome !== null) return { name: 'Chrome', version: chrome };

  const safari = test(/Version\/([\d.]+).*Safari/);
  if (safari !== null) return { name: 'Safari', version: safari };

  return { name: 'Inconnu', version: null };
}

function detectOs(userAgent: string): Named {
  if (/Windows NT 10/.test(userAgent)) return { name: 'Windows', version: '10 ou 11' };
  if (/Windows NT/.test(userAgent)) return { name: 'Windows', version: null };
  if (/Android/.test(userAgent)) {
    return { name: 'Android', version: firstGroup(/Android ([\d.]+)/, userAgent) };
  }
  if (/(iPhone|iPad|iPod)/.test(userAgent)) {
    const version = firstGroup(/OS ([\d_]+)/, userAgent);
    return { name: 'iOS', version: version === null ? null : version.replace(/_/g, '.') };
  }
  if (/Mac OS X/.test(userAgent)) {
    const version = firstGroup(/Mac OS X ([\d_.]+)/, userAgent);
    return { name: 'macOS', version: version === null ? null : version.replace(/_/g, '.') };
  }
  if (/(Linux|X11)/.test(userAgent)) return { name: 'Linux', version: null };
  return { name: 'Inconnu', version: null };
}

function detectDeviceType(userAgent: string, width: number): string {
  if (/iPad|Tablet/.test(userAgent)) return 'tablette';
  if (/Mobi|Android|iPhone/.test(userAgent)) return 'mobile';
  if (width > 0 && width < 768) return 'mobile';
  return 'ordinateur';
}

/**
 * Collecte le contexte dans le navigateur. Appelee dans un effet, jamais
 * au rendu : `navigator` et `window` n'existent pas au rendu serveur, et
 * lire un contexte different entre serveur et client produirait une
 * discordance d'hydratation.
 */
export function collectSupportContext(page: string): Record<string, string> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { page, surface: 'web' };
  }

  const userAgent = navigator.userAgent;
  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent);
  const width = window.innerWidth;
  const height = window.innerHeight;

  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timezone = '';
  }

  const collected: Record<string, string> = {
    page,
    surface: 'web',
    browser: browser.name,
    os: os.name,
    device_type: detectDeviceType(userAgent, width),
    viewport: width > 0 && height > 0 ? `${width}x${height}` : '',
    language: navigator.language,
    timezone,
    user_agent: userAgent,
  };
  if (browser.version !== null) collected['browser_version'] = browser.version;
  if (os.version !== null && os.version.length > 0) collected['os_version'] = os.version;

  return sanitizeSupportContext(collected);
}

/**
 * Referme la liste cote serveur avant l'appel RPC : meme liste blanche,
 * meme troncature. La base la referme une troisieme fois — une RPC ne
 * doit jamais dependre d'une garde qu'elle ne porte pas.
 */
export function sanitizeSupportContext(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const key of SUPPORT_CONTEXT_KEYS) {
    const value = input[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    output[key] = trimmed.slice(0, MAX_VALUE_LENGTH);
  }
  return output;
}

/** Lit le contexte depose par le formulaire dans des champs caches. */
export function readSupportContextFromForm(
  formData: FormData,
  fallbackPage: string,
): Record<string, string> {
  const raw: Record<string, unknown> = {};
  for (const key of SUPPORT_CONTEXT_KEYS) {
    const value = formData.get(`ctx_${key}`);
    if (typeof value === 'string') raw[key] = value;
  }
  const cleaned = sanitizeSupportContext(raw);
  if (cleaned['page'] === undefined) cleaned['page'] = fallbackPage;
  if (cleaned['surface'] === undefined) cleaned['surface'] = 'web';
  return cleaned;
}
