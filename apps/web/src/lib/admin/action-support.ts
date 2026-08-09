import { frAdmin } from '@/i18n/admin';
import { failure, success, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { adminRpc } from './rpc';
import { readAdminAccess, type AdminPermission } from './permissions';

/**
 * Fabrique commune des Server Actions du back-office Superadmin.
 *
 * Elle impose, une fois pour toutes (meme motif que `lib/cms/action-support`) :
 *   * la verification de permission AVANT l'appel — chaque fonction
 *     `admin_*` revalide de son cote et journalise ; ce controle ne sert
 *     qu'a produire un message francais plutot qu'un 42501 brut ;
 *   * un `correlation_id` sur chaque echec (D-93, D-102) ;
 *   * la traduction des erreurs metier en francais.
 *
 * Ce module n'est PAS marque `'use server'` : les actions l'importent.
 */

export function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function requiredText(formData: FormData, key: string): string {
  return text(formData, key) ?? '';
}

export function integer(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Execute un RPC admin en Server Action : permission, correlation,
 * traduction d'erreur, message de succes.
 */
export async function runAdminAction(
  permissions: readonly AdminPermission[],
  rpcName: string,
  args: Record<string, unknown>,
  successMessage: string,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const access = await readAdminAccess();
  if (access === null || !access.canAny(permissions)) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const result = await adminRpc(rpcName, args, correlationId, (payload) => payload);
  if (!result.ok) return failure(result.error.userMessage, correlationId);
  return success(successMessage);
}

/**
 * Variante qui renvoie AUSSI la charge utile du RPC (ex. : lecture
 * journalisee de l'indice de contact, dont le RESULTAT doit s'afficher).
 */
export async function runAdminActionWithPayload(
  permissions: readonly AdminPermission[],
  rpcName: string,
  args: Record<string, unknown>,
  toMessage: (payload: unknown) => string,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const access = await readAdminAccess();
  if (access === null || !access.canAny(permissions)) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const result = await adminRpc(rpcName, args, correlationId, (payload) => payload);
  if (!result.ok) return failure(result.error.userMessage, correlationId);
  return success(toMessage(result.data));
}

export function validationError(
  message: string,
  fieldErrors: Record<string, string> = {},
): FormState {
  return failure(message, newCorrelationId(), fieldErrors);
}
