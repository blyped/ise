/**
 * `@ise/ui-web/cards` — cartes et blocs partagés par les tranches
 * APPELS AU RÉSEAU (ISE-047 → ISE-054) et OPPORTUNITÉS
 * (ISE-055 → ISE-066).
 *
 * Point d'entrée SÉPARÉ de `@ise/ui-web` : aucun composant existant
 * n'est modifié, et l'ajout de ces cartes ne peut pas casser une tranche
 * livrée précédemment.
 */
export { RelevanceNote, type RelevanceNoteProps, type RelevanceReason } from './RelevanceNote';
export { MetaList, type MetaListProps, type MetaItem } from './MetaList';
export { StatTile, type StatTileProps } from './StatTile';
export { StatusTimeline, type StatusTimelineProps, type TimelineEntry } from './StatusTimeline';
