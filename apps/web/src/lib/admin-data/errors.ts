import { toBusinessError } from '@ise/domain';
import { frAdminData } from '@/i18n/admin-data';

/**
 * Traduction des erreurs du back-office « données » (D-102).
 *
 * Les fonctions SQL des migrations 0080 → 0083 lèvent des codes machine
 * spécifiques (`import_file_already_loaded`, `import_review_pending`,
 * `settings_no_secret_allowed`…) qui n'existent pas dans le dictionnaire
 * partagé `@ise/domain`. On les traduit ici ; tout le reste retombe sur
 * `toBusinessError`, qui garantit qu'aucun message technique ne franchit
 * la frontière de l'interface.
 */
export interface AdminError {
  readonly code: string;
  readonly userMessage: string;
  readonly correlationId: string;
}

export function toAdminError(raw: unknown, correlationId: string): AdminError {
  const err = raw as { code?: string; message?: string } | null;
  const message = err?.message ?? '';

  const local = frAdminData.errors[message];
  if (typeof local === 'string') {
    return { code: message, userMessage: local, correlationId };
  }

  const business = toBusinessError(raw, correlationId);
  return { code: business.code, userMessage: business.userMessage, correlationId };
}

/** Message français d'un code d'erreur (pour les retours par query string). */
export function adminErrorMessage(code: string): string {
  const local = frAdminData.errors[code];
  if (typeof local === 'string') return local;
  const business = toBusinessError({ message: code });
  return business.userMessage;
}
