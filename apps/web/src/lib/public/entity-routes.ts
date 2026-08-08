import { OPPORTUNITY_ROUTES, opportunityRoute } from '@/lib/routes/opportunities';
import { CALL_ROUTES, callRoute } from '@/lib/routes/calls';
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
 * encore dans l'application.
 *
 * `event` et `news` : ISE-092 a ISE-096 ne sont pas developpes (voir
 * `docs/screen-traceability-matrix.md`). Tant qu'ils n'existent pas, aucune
 * route n'est fabriquee — un lien vers une page absente serait un lien mort.
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
    case 'news':
      return null;
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
