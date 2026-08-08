/**
 * Chemins de la tranche PROJETS & CONSORTIUMS (ISE-088 -> ISE-091).
 *
 * Le fil d'Ariane des maquettes place ces ecrans sous « Collaborer » ;
 * la route reste `/projets`, qui est ce que le nom de fichier de la
 * maquette designe (ISE-088_Espace_Projets_Consortiums).
 */
export const PROJECT_ROUTES = {
  /** ISE-088 — Espace Projets & Consortiums. */
  list: '/projets',
} as const;

/** ISE-089 — Detail d'un projet ou d'un consortium. */
export function projectRoute(projectId: string): string {
  return `${PROJECT_ROUTES.list}/${encodeURIComponent(projectId)}`;
}

/** ISE-090 — Proposer ma contribution (expression d'interet, jamais une adhesion). */
export function projectContributionRoute(projectId: string): string {
  return `${projectRoute(projectId)}/proposer`;
}

/** ISE-091 — Ma participation au projet. */
export function projectParticipationRoute(projectId: string): string {
  return `${projectRoute(projectId)}/participation`;
}
