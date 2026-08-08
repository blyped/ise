import { z } from 'zod';
import { frCms } from '@/i18n/cms';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsPermission, type CmsPermission } from './permissions';
import type { MutationResult } from './mutations';
import { revalidateLandingCache } from './revalidate';

/**
 * Fabrique commune des Server Actions du CMS.
 *
 * Elle impose, une fois pour toutes :
 *   * la verification de permission AVANT l'appel — la base revalide de
 *     son cote, systematiquement ; ce controle ne sert qu'a produire un
 *     message francais plutot qu'une erreur 42501 brute ;
 *   * un `correlation_id` sur chaque echec (D-93, D-102) ;
 *   * la traduction des erreurs metier en francais.
 *
 * Ce module n'est PAS marque `'use server'` : un fichier de Server Actions
 * ne peut exporter que des fonctions asynchrones. Les helpers vivent donc
 * ici, et les actions les importent.
 */

/** Champ texte non vide, ou `null`. */
export function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Champ obligatoire : chaine vide plutot que `null`, pour que Zod le refuse. */
export function requiredText(formData: FormData, key: string): string {
  return text(formData, key) ?? '';
}

export function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'true' || formData.get(key) === 'on';
}

export function integer(formData: FormData, key: string, fallback: number): number {
  const raw = text(formData, key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Valeur d'un `<input type="datetime-local">` convertie en instant UTC. */
export function timestamp(formData: FormData, key: string): string | null {
  const raw = text(formData, key);
  if (raw === null) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export const uuidSchema = z.string().uuid({ message: 'Identifiant invalide.' });

/**
 * Enveloppe une action : permission, correlation, traduction d'erreur.
 *
 * `run` recoit le `correlation_id` et renvoie un `MutationResult`. En cas
 * de succes, `successMessage` est affiche tel quel.
 */
export async function runCmsAction(
  permission: CmsPermission,
  run: (correlationId: string) => Promise<MutationResult<unknown>>,
  successMessage: string,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await requireCmsPermission(permission);
  if (access === null) return failure(frCms.common.forbidden, correlationId);

  const result = await run(correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);
  return success(successMessage);
}

/**
 * Variante des actions de PUBLICATION : apres succes, le cache cible de
 * PUB-001 est invalide (§46). Le message DIT si l'invalidation a eu lieu :
 * on ne pretend jamais avoir purge un cache qu'on n'a pas purge.
 */
export async function runCmsPublishAction(
  permission: CmsPermission,
  run: (correlationId: string) => Promise<MutationResult<unknown>>,
  successMessage: string = frCms.common.published,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await requireCmsPermission(permission);
  if (access === null) return failure(frCms.common.forbidden, correlationId);

  const result = await run(correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  const outcome = await revalidateLandingCache(correlationId);
  return success(outcome.revalidated ? successMessage : frCms.common.publishedNoCache);
}

/** Traduit un echec de validation Zod en `FormState`. */
export function validationFailure(error: z.ZodError): FormState {
  return failure(
    'Certaines informations sont incomplètes ou invalides.',
    newCorrelationId(),
    fieldErrorsFromZod(error),
  );
}
