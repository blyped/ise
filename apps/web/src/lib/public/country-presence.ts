import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicEnv } from '@/lib/env';
import {
  LANDING_CACHE_TAG,
  LANDING_REVALIDATE_SECONDS,
  LANDING_RPC_TIMEOUT_MS,
} from './landing-data';

/**
 * 0133 — « Ou sont les ISE actuellement ? ».
 *
 * Lecture de `get_landing_country_presence()`, la seule projection qui donne
 * la repartition par pays. Ce que la fonction renvoie, mot pour mot :
 *
 *   { threshold, total_profiles, located_profiles,
 *     countries: [{ code, name, count }], hidden_countries, hidden_profiles,
 *     computed_at }
 *
 * MODULE SEPARE DE `landing-data.ts`, ET POURQUOI. `landing-data.ts` porte les
 * onze projections editoriales de PUB-001 ; celle-ci n'en est pas une. Elle ne
 * lit aucun contenu du CMS, ne depend d'aucun reglage de `cms_sections`, n'a ni
 * `max_items` ni titre editorial, et ne suit pas la regle de repli « derniere
 * version valide » : une repartition perimee servie comme si elle etait fraiche
 * serait pire que pas de carte du tout. Elle partage en revanche l'etiquette de
 * cache de la landing, pour qu'une invalidation continue de tout rafraichir
 * d'un coup.
 *
 * CONFIDENTIALITE (rappel de l'en-tete de la migration). Le seuil d'agregation
 * est applique EN BASE et vaut 1 DEPUIS 0136 : le porteur a demande, le
 * 15/08/2026, que la carte nomme les pays a partir d'un seul ISE. Il valait
 * k = 3 de 0133 a 0136, ou un pays a un ou deux ISE n'etait ni nomme ni compte
 * parmi les `countries`. Tous les pays de presence sont desormais nommes, et
 * `hidden_countries` / `hidden_profiles` sont structurellement a zero — les
 * deux compteurs restent lus et rendus, pour le jour ou le seuil remonterait.
 *
 * Ce qui protege les membres n'est donc plus le seuil, mais deux regles que
 * 0136 laisse intactes : le membre dont la visibilite du champ `country` est
 * `private` reste exclu du comptage, y compris du total ; et seul un AGREGAT
 * sort — un code, un libelle, un nombre —, jamais un nom, un identifiant ou
 * une ville. Le parseur reapplique le seuil sur ce qu'il recoit pour que la
 * valeur affichee et la valeur filtrante ne puissent pas diverger.
 */

/** Un pays retenu par la projection : nomme, donc au-dessus du seuil. */
export interface LandingCountryCount {
  /** Code ISO 3166-1 alpha-2, tel qu'enregistre en base. */
  readonly code: string;
  /** Nom francais du referentiel `countries`, ou le code s'il est inconnu. */
  readonly name: string;
  /** Nombre d'ISE. Toujours >= `threshold`. */
  readonly count: number;
}

export interface LandingCountryPresence {
  readonly status: 'ok' | 'indisponible';
  /** Vide = rien a montrer. La section ne rend alors rien du tout. */
  readonly countries: readonly LandingCountryCount[];
  /** Seuil d'agregation applique en base (1 depuis 0136). */
  readonly threshold: number;
  /** Profils publies pris en compte, pays renseigne ou non. */
  readonly totalProfiles: number;
  /** Ceux d'entre eux qui ont un pays d'exercice renseigne. */
  readonly locatedProfiles: number;
  /** Pays ecartes par le seuil. Comptes, jamais nommes. */
  readonly hiddenCountries: number;
  /** ISE qui y exercent. Comptes, jamais localises. */
  readonly hiddenProfiles: number;
  readonly computedAt: string | null;
  /** Cause de l'indisponibilite, `null` quand tout va bien. */
  readonly reason: string | null;
}

const countSchema = z
  .number()
  .refine((value) => Number.isFinite(value))
  .transform((value) => Math.trunc(value))
  .pipe(z.number().int().min(0));

const countrySchema = z.object({
  code: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.string().min(2).max(3)),
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1)),
  count: countSchema,
});

const presenceSchema = z.object({
  threshold: countSchema,
  total_profiles: countSchema,
  located_profiles: countSchema,
  hidden_countries: countSchema,
  hidden_profiles: countSchema,
  computed_at: z.unknown(),
  countries: z.array(z.unknown()),
});

function unavailable(reason: string): LandingCountryPresence {
  return {
    status: 'indisponible',
    countries: [],
    threshold: 0,
    totalProfiles: 0,
    locatedProfiles: 0,
    hiddenCountries: 0,
    hiddenProfiles: 0,
    computedAt: null,
    reason,
  };
}

/** Exportee pour etre testable sans base. */
export function parseCountryPresence(payload: unknown): LandingCountryPresence {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return unavailable('reponse-inattendue');
  }

  const parsed = presenceSchema.safeParse(payload);
  if (!parsed.success) return unavailable('forme-inattendue');

  // Un seuil absent ou aberrant retombe sur 1, la valeur decidee par le
  // porteur le 15/08/2026 et posee par 0136 : la carte nomme les pays a partir
  // d'un seul ISE. Le repli valait 3 jusque-la, au motif qu'un pays a un ISE ne
  // devait jamais etre publie ; ce motif n'a plus cours, c'est desormais le
  // comportement voulu. Deux protections subsistent, et elles ne dependent pas
  // de ce nombre : le membre dont la visibilite du champ `country` est
  // `private` reste exclu du comptage, et seul un agregat sort d'ici (code,
  // libelle, nombre) — jamais un nom.
  const threshold = parsed.data.threshold >= 1 ? parsed.data.threshold : 1;

  const countries: LandingCountryCount[] = [];
  for (const row of parsed.data.countries) {
    const country = countrySchema.safeParse(row);
    if (!country.success) continue;
    // Seconde application du seuil, cote lecture. Voir l'en-tete.
    if (country.data.count < threshold) continue;
    countries.push(country.data);
  }
  countries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));

  const computedAt = parsed.data.computed_at;

  return {
    status: 'ok',
    countries,
    threshold,
    totalProfiles: parsed.data.total_profiles,
    locatedProfiles: parsed.data.located_profiles,
    hiddenCountries: parsed.data.hidden_countries,
    hiddenProfiles: parsed.data.hidden_profiles,
    computedAt: typeof computedAt === 'string' && computedAt.trim().length > 0 ? computedAt : null,
    reason: null,
  };
}

/**
 * Client anonyme, sans cookie — meme regle que les autres lectures publiques :
 * la page ne touche qu'a des fonctions explicitement `public-safe`.
 */
function publicClient() {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchCountryPresence(): Promise<LandingCountryPresence> {
  try {
    const signal =
      typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(LANDING_RPC_TIMEOUT_MS)
        : undefined;
    const query = publicClient().rpc('get_landing_country_presence');
    const { data, error } = await (signal === undefined ? query : query.abortSignal(signal));

    if (error) return unavailable(error.code ? `erreur:${error.code}` : 'erreur');
    return parseCountryPresence(data);
  } catch (cause) {
    console.error('[ISE] repartition par pays injoignable', { cause });
    return unavailable('exception');
  }
}

/** Version **non** mise en cache, utilisee par les tests. */
export const fetchCountryPresenceUncached = fetchCountryPresence;

/** Meme etiquette de cache que la landing : une invalidation suffit pour tout. */
export const loadCountryPresence: () => Promise<LandingCountryPresence> = unstable_cache(
  fetchCountryPresence,
  ['pub-001-country-presence'],
  { tags: [LANDING_CACHE_TAG], revalidate: LANDING_REVALIDATE_SECONDS },
);
