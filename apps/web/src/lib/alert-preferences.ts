/**
 * Valeurs d'alerte de recherche (ISE-036).
 *
 * Module volontairement SANS dependance serveur : il est importe par le
 * schema de formulaire, donc par un composant client. Le placer dans
 * `lib/queries/saved-search.ts` ferait entrer le client Supabase serveur
 * — et `next/headers` — dans le bundle du navigateur.
 *
 * Ces listes reproduisent exactement les contraintes CHECK de
 * `public.search_alerts` (migration 0005) : l'interface ne propose rien
 * que la base refuserait.
 */
export const ALERT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_CHANNELS = ['in_app', 'email', 'both'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export type AlertStatus = 'active' | 'paused';
