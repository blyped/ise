import { z } from 'zod';
import { ALERT_CHANNELS, ALERT_FREQUENCIES } from '@/lib/alert-preferences';
import { frSearch } from '@/i18n/search';

/**
 * ISE-036 — schema du formulaire d'enregistrement.
 *
 * Applique cote client (retour immediat) ET cote serveur (autorite), en
 * complement de `searchCriteriaSchema` qui valide les criteres eux-memes.
 *
 * Les valeurs de `frequency` et `channel` sont exactement celles que les
 * contraintes CHECK de `search_alerts` acceptent : l'interface ne propose
 * rien que la base refuserait.
 */
export const saveSearchFormSchema = z.object({
  name: z.string().trim().min(1, frSearch.save.nameRequired).max(120, frSearch.save.nameTooLong),
  alertEnabled: z.boolean().default(false),
  frequency: z.enum(ALERT_FREQUENCIES).default('weekly'),
  channel: z.enum(ALERT_CHANNELS).default('in_app'),
  savedSearchId: z.string().uuid().optional(),
});

export type SaveSearchFormInput = z.infer<typeof saveSearchFormSchema>;

/** Lecture d'un `FormData` vers l'entree brute du schema. */
export function saveSearchInputFrom(formData: FormData): unknown {
  const savedSearchId = formData.get('savedSearchId');
  return {
    name: formData.get('name'),
    // `Switch` de @ise/ui-web pose un champ cache a `true` / `false`.
    alertEnabled: formData.get('alertEnabled') === 'true',
    frequency: formData.get('frequency') ?? 'weekly',
    channel: formData.get('channel') ?? 'in_app',
    ...(typeof savedSearchId === 'string' && savedSearchId.length > 0 ? { savedSearchId } : {}),
  };
}
