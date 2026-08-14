import { OPPORTUNITY_ROUTES, opportunityRoute } from '@/lib/routes/opportunities';
import { CALL_ROUTES, callRoute } from '@/lib/routes/calls';
import { eventRoute, newsRoute } from '@/lib/routes/content';
import { SEARCH_ROUTES, memberProfileRoute, searchResultsRoute } from '@/lib/routes/search';
import { PARAM } from '@/lib/search-criteria';
import type { ResourceType } from './protected-route';

/**
 * ADDENDUM §10 — Liens d'entite.
 *
 * Le CMS ne stocke jamais d'URL interne : il stocke `entity_type` +
 * `entity_id`. La route est calculee ici, a un seul endroit. Une entite dont
 * l'ecran membre n'existe pas encore renvoie `null` : la carte est alors
 * affichee **sans** action, plutot que de proposer un lien mort.
 */

export const ENTITY_TYPES = [
  'event',
  'news',
  'opportunity',
  'profile',
  'expertise',
  'call',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityRef {
  readonly entityType: EntityType;
  readonly entityId: string;
}

export function isEntityType(value: unknown): value is EntityType {
  return typeof value === 'string' && (ENTITY_TYPES as readonly string[]).includes(value);
}

/**
 * Route membre correspondant a une entite, ou `null` si l'ecran n'existe pas
 * dans l'application.
 *
 * CORRECTION DU 2026-08-14. Le commentaire precedent affirmait que `event` et
 * `news` n'avaient pas d'ecran membre (ISE-092 a ISE-096 non developpes) et
 * renvoyait `null` pour ces deux types. Cette affirmation etait devenue
 * fausse : `app/actualites/[newsId]/page.tsx` (ISE-093) et
 * `app/evenements/[eventId]/page.tsx` (ISE-095) existent, et `/actualites` et
 * `/evenements` figurent dans `MEMBER_ROUTE_PREFIXES`. Consequence du bug :
 * les cartes « Actualite » et « Evenement » de PUB-001 s'affichaient sans
 * aucune action alors que la page de detail existait. Les deux types
 * renvoient desormais leur vraie route, calculee par les fabriques de
 * `lib/routes/content.ts` — jamais par un chemin ecrit en dur.
 *
 * La regle de fond ne change pas : un type dont l'ecran n'existe reellement
 * pas continue de renvoyer `null`, et la carte s'affiche alors sans action
 * plutot qu'avec un lien mort.
 */
export function entityRoute(ref: EntityRef): string | null {
  if (ref.entityId.trim().length === 0) return null;

  switch (ref.entityType) {
    case 'opportunity':
      return opportunityRoute(ref.entityId);
    case 'call':
      return callRoute(ref.entityId);
    case 'profile':
      return memberProfileRoute(ref.entityId);
    case 'expertise':
      // Une expertise n'est pas un critere de recherche : `expertise_areas`
      // (14 domaines) et `skills` (543 competences) sont deux taxonomies
      // distinctes, et ISE-035 ne filtre que sur la seconde. Une pastille
      // d'expertise s'explore donc par `expertiseRoute(nom)`, qui utilise le
      // parametre de recherche plein texte reellement lu par l'ecran ; par
      // identifiant seul, aucune route n'est fabriquee.
      return null;
    case 'event':
      // ISE-095 — `app/evenements/[eventId]/page.tsx`.
      return eventRoute(ref.entityId);
    case 'news':
      // ISE-093 — `app/actualites/[newsId]/page.tsx`.
      return newsRoute(ref.entityId);
    default:
      return null;
  }
}

/**
 * ISE-035 — Exploration d'une expertise depuis PUB-001 (ADDENDUM §24).
 *
 * `expertise_areas.id` est un `bigint` de la taxonomie des domaines ; le
 * parametre `competence` de la recherche attend des identifiants de la table
 * `skills`. Les deux ne sont pas interchangeables. La pastille route donc sur
 * la recherche plein texte, qui est un ecran reel et un critere reel — jamais
 * sur un identifiant qui ne veut rien dire pour ISE-035.
 */
export function expertiseRoute(label: string): string | null {
  const query = label.trim();
  if (query.length === 0) return null;
  return searchResultsRoute(new URLSearchParams({ [PARAM.query]: query }).toString());
}

/** Nature de ressource annoncee par ISE-001 pour une entite donnee. */
export function entityResourceType(entityType: EntityType): ResourceType {
  switch (entityType) {
    case 'event':
      return 'evenement';
    case 'news':
      return 'actualite';
    case 'opportunity':
      return 'opportunite';
    case 'profile':
      return 'profil';
    case 'expertise':
      return 'expertise';
    case 'call':
      return 'appel';
    default:
      return 'espace-membre';
  }
}

/** Routes d'index utilisees par les appels a l'action de PUB-001. */
export const ENTITY_INDEX_ROUTES = {
  opportunities: OPPORTUNITY_ROUTES.list,
  calls: CALL_ROUTES.list,
  search: SEARCH_ROUTES.find,
} as const;
