/**
 * Chemins de la tranche MENTORAT (ISE-078 -> ISE-083).
 *
 * Les noms suivent les MAQUETTES (D-01) : ISE-079 « Definir mon besoin »,
 * ISE-080 « Mentors recommandes », ISE-081 « Detail mentor »,
 * ISE-082 « Demande de mentorat », ISE-083 « Mentorat actif ».
 */
export const MENTORSHIP_ROUTES = {
  /** ISE-078 — Espace mentorat. */
  home: '/mentorat',
  /** ISE-079 — Definir mon besoin de mentorat. */
  need: '/mentorat/besoin',
  /** ISE-080 — Mentors recommandes. */
  recommendations: '/mentorat/mentors',
  /** Activer ou mettre en pause mon profil mentor. */
  becomeMentor: '/mentorat/devenir-mentor',
  /** Demandes recues (mentor) et envoyees (mentore). */
  requests: '/mentorat/demandes',
} as const;

/** ISE-081 — Fiche d'un mentor. */
export function mentorRoute(profileId: string): string {
  return `${MENTORSHIP_ROUTES.recommendations}/${encodeURIComponent(profileId)}`;
}

/** ISE-082 — Envoyer une demande de mentorat. */
export function mentorshipRequestRoute(profileId: string): string {
  return `${mentorRoute(profileId)}/demande`;
}

/** ISE-083 — Mentorat actif : suivi et bilan. */
export function mentorshipRoute(mentorshipId: string): string {
  return `${MENTORSHIP_ROUTES.home}/${encodeURIComponent(mentorshipId)}`;
}

/** ISE-083 — Bilan de fin de mentorat. */
export function mentorshipReviewRoute(mentorshipId: string): string {
  return `${mentorshipRoute(mentorshipId)}/bilan`;
}
