/**
 * FILES D'ATTENTE COMPTEES DANS LE MENU D'ADMINISTRATION (migration 0138).
 *
 * Module PUR : aucune dependance serveur, il traverse la frontiere
 * client (`nav.ts` -> `AdminNav`). La lecture, elle, vit dans
 * `queries-nav-counters.ts`, qui depend de `next/headers`.
 *
 * Une cle par entree de menu qui possede une file « en attente d'une
 * decision de l'administration ». Les entrees sans file n'ont pas de
 * cle : une pastille eternellement a zero est du bruit
 * (MASTER PROMPT §113). Le detail des exclusions est commente dans
 * `supabase/migrations/0138_admin_nav_counters.sql` et dans `nav.ts`.
 */
export const ADMIN_NAV_COUNTER_KEYS = [
  /** Reclamations de profil a instruire — `profiles.verify`. */
  'claims',
  /** Suggestions de promotion et membres signales manquants — `promotions.manage`. */
  'promotions',
  /** Opportunites en attente de moderation — `opportunities.manage`. */
  'opportunities',
  /** Demandes de participation en consortium — `projects.manage`. */
  'projects',
  /** Publications de communaute en pre-approbation — `communities.manage`. */
  'communities',
  /** Evenements proposes par les ISE — `events.manage`. */
  'events',
  /** Actualites proposees par les ISE — `content.publish`. */
  'news',
  /** Signalements ouverts, tous types de cible — `profiles.moderate`. */
  'moderation',
  /** Tickets ouverts sans reponse d'un agent — `support.manage`. */
  'support',
] as const;

export type AdminNavCounterKey = (typeof ADMIN_NAV_COUNTER_KEYS)[number];

/**
 * Compteurs effectivement renvoyes. Une cle ABSENTE signifie « file hors
 * permission de l'appelant » ou « file vide » — dans les deux cas, aucune
 * pastille. La base ne renvoie jamais zero pour une file interdite : elle
 * ne renvoie rien, pour qu'un compte ne puisse pas deduire l'existence
 * d'une file qu'il n'a pas le droit de voir.
 */
export type AdminNavCounters = Partial<Record<AdminNavCounterKey, number>>;

/**
 * Traduit la charge utile de `admin_nav_counters()`. Tout ce qui n'est
 * pas un entier strictement positif est ignore : un « 0 » affiche serait
 * du bruit, une valeur douteuse ne doit pas atteindre l'interface.
 */
export function toAdminNavCounters(payload: unknown): AdminNavCounters {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const raw = payload as Record<string, unknown>;
  const counters: AdminNavCounters = {};
  for (const key of ADMIN_NAV_COUNTER_KEYS) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
      counters[key] = Math.trunc(value);
    }
  }
  return counters;
}

/** Total des files visibles, pour le bouton du menu replie (mobile). */
export function totalPendingCount(counters: AdminNavCounters): number {
  return ADMIN_NAV_COUNTER_KEYS.reduce((sum, key) => sum + (counters[key] ?? 0), 0);
}
