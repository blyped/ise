/**
 * ECARTS D'EXPOSITION COMPTES DANS LE MENU DU CMS (migration 0139).
 *
 * Module PUR : aucune dependance serveur, il traverse la frontiere
 * client (`nav.ts` -> `CmsNav`). La lecture, elle, vit dans
 * `queries-nav-counters.ts`, qui depend de `next/headers`.
 *
 * Le CMS ne juge pas un contenu, il decide de son EXPOSITION. Ce qui s'y
 * accumule n'est donc pas une file de decisions recues — c'est l'ecart
 * entre ce que le CMS croit avoir expose et ce que la page d'accueil
 * montre reellement.
 *
 * Une cle par entree de menu qui possede un tel ecart. Les entrees sans
 * ecart possible n'ont pas de cle : une pastille eternellement a zero est
 * du bruit (MASTER PROMPT §113). Le detail des exclusions — carrousel,
 * sections, partenaires, mediatheque, file « A la une », tableau de bord
 * et apercu — est commente dans
 * `supabase/migrations/0139_cms_nav_counters.sql` et resume dans `nav.ts`.
 */
export const CMS_NAV_COUNTER_KEYS = [
  /** Actualites marquees visibles que la vitrine ecarte — `cms.publish`. */
  'news',
  /** Evenements marques visibles que la vitrine ecarte — `cms.publish`. */
  'events',
  /** Opportunites marquees visibles que la vitrine ecarte — `cms.publish`. */
  'opportunities',
  /** Piliers sans visuel affichable — `cms.edit`. */
  'pillars',
  /** Organisations publiees sans logo affichable — `cms.edit`. */
  'organizations',
  /** Encart « ISE du jour » sans candidat eligible (0 ou 1) — `cms.featured_profile.manage`. */
  'featured_profile',
  /** Programmations en echec — `cms.schedule`. */
  'schedule',
] as const;

export type CmsNavCounterKey = (typeof CMS_NAV_COUNTER_KEYS)[number];

/**
 * Compteurs effectivement renvoyes. Une cle ABSENTE signifie « hors
 * permission de l'appelant » ou « rien a corriger » — dans les deux cas,
 * aucune pastille. La base ne renvoie jamais zero pour une file
 * interdite : elle ne renvoie rien, pour qu'un compte ne puisse pas
 * deduire l'existence d'un ecart qu'il n'a pas le droit de connaitre.
 */
export type CmsNavCounters = Partial<Record<CmsNavCounterKey, number>>;

/**
 * Traduit la charge utile de `cms_nav_counters()`. Tout ce qui n'est pas
 * un entier strictement positif est ignore : un « 0 » affiche serait du
 * bruit, une valeur douteuse ne doit pas atteindre l'interface.
 */
export function toCmsNavCounters(payload: unknown): CmsNavCounters {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const raw = payload as Record<string, unknown>;
  const counters: CmsNavCounters = {};
  for (const key of CMS_NAV_COUNTER_KEYS) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
      counters[key] = Math.trunc(value);
    }
  }
  return counters;
}

/** Total des ecarts visibles, pour le bouton du menu replie (mobile). */
export function totalCmsPendingCount(counters: CmsNavCounters): number {
  return CMS_NAV_COUNTER_KEYS.reduce((sum, key) => sum + (counters[key] ?? 0), 0);
}
