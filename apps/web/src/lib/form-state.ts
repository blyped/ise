import type { ZodError } from 'zod';

/**
 * Etat partage par toutes les Server Actions de formulaire.
 * Volontairement sans champ optionnel : `exactOptionalPropertyTypes` est actif
 * et un etat partiel serait une source de bugs silencieux.
 */
export interface FormState {
  status: 'idle' | 'error' | 'success';
  /** Message global, en francais, destine a l'utilisateur. */
  message: string | null;
  /** Present uniquement en cas d'erreur (D-102). */
  correlationId: string | null;
  /** Erreurs par champ, cle = nom du champ du formulaire. */
  fieldErrors: Record<string, string>;
}

export const initialFormState: FormState = {
  status: 'idle',
  message: null,
  correlationId: null,
  fieldErrors: {},
};

/** Premiere erreur rencontree pour chaque champ. */
export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) {
      out[key] = issue.message;
    }
  }
  return out;
}

export function failure(
  message: string,
  correlationId: string,
  fieldErrors: Record<string, string> = {},
): FormState {
  return { status: 'error', message, correlationId, fieldErrors };
}

export function success(message: string): FormState {
  return { status: 'success', message, correlationId: null, fieldErrors: {} };
}
