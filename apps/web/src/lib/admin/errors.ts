import { toBusinessError } from '@ise/domain';
import { frAdmin } from '@/i18n/admin';

/**
 * Traduction des erreurs du back-office Superadmin (D-102).
 *
 * Les fonctions `admin_*` (0076, 0077) levent des codes machine qui
 * n'existent pas tous dans le dictionnaire partage `@ise/domain`
 * (`reason_required`, `promotion_already_exists`…). On les traduit ici ;
 * tout le reste retombe sur `toBusinessError`, qui garantit qu'aucun
 * message technique ne franchit la frontiere de l'interface.
 */
export interface AdminError {
  readonly code: string;
  readonly userMessage: string;
  readonly correlationId: string;
}

export function toAdminError(raw: unknown, correlationId: string): AdminError {
  const err = raw as { code?: string; message?: string } | null;
  const message = err?.message ?? '';

  const local = frAdmin.errors[message];
  if (typeof local === 'string') {
    return { code: message, userMessage: local, correlationId };
  }

  const business = toBusinessError(raw, correlationId);
  return { code: business.code, userMessage: business.userMessage, correlationId };
}
