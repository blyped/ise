'use client';

import { useCallback, useState, type FormEvent } from 'react';
import type { ZodTypeAny } from 'zod';
import { fieldErrorsFromZod } from './form-state';

/**
 * Validation client avec le MEME schema Zod que la Server Action
 * (MASTER PROMPT §62). Le client donne un retour immediat ; le serveur
 * reste seul juge — il revalide systematiquement.
 */
export function useZodForm<TSchema extends ZodTypeAny>(
  schema: TSchema,
  toInput: (formData: FormData) => unknown,
) {
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const clearField = useCallback((name: string) => {
    setClientErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  /**
   * A brancher sur `onSubmit`. En cas d'echec, l'envoi est annule : cela
   * evite un aller-retour serveur inutile sans rien retirer a sa validation.
   */
  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const result = schema.safeParse(toInput(new FormData(event.currentTarget)));
      if (result.success) {
        setClientErrors({});
        return;
      }
      event.preventDefault();
      setClientErrors(fieldErrorsFromZod(result.error));
      const firstInvalid = event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstInvalid?.focus();
    },
    [schema, toInput],
  );

  return { clientErrors, clearField, onSubmit };
}
