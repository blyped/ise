/**
 * Primitives d'interface propres a la RECHERCHE (ISE-034 -> ISE-037).
 *
 * Sous-chemin dedie (`@ise/ui-web/search`) : la tranche est developpee en
 * parallele d'une autre, et `src/index.ts` est un fichier partage. Rien
 * n'y est ajoute tant que les deux lots ne sont pas termines.
 *
 * Ces composants ne connaissent AUCUNE regle metier : ils n'affichent ni
 * score, ni pourcentage, ni rang, et n'ont aucun moyen d'en recevoir.
 */
export { FilterMultiSelect } from './FilterMultiSelect';
export type { FilterMultiSelectProps, FilterOption } from './FilterMultiSelect';
