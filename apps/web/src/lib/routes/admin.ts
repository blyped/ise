/**
 * Chemins du back-office Superadmin (`/administration`).
 *
 * La liste couvre les DEUX lots livres en parallele : le coeur
 * (tableau de bord, membres, reclamations, promotions, moderation,
 * support) et le lot profils incomplets / analytics / parametres /
 * audit. La navigation du layout partage s'appuie sur ce module unique
 * pour que toutes les sections soient atteignables (MASTER PROMPT §89).
 *
 * L'import en masse (SA-040 -> SA-042, SA-044, SA-045) est abandonne
 * (decision C-06, docs/decisions.md) : plus aucune route n'y correspond.
 */
export const ADMIN_ROUTES = {
  root: '/administration',
  /** SA-002 — Membres & profils. */
  members: '/administration/membres',
  /** SA-005 — Doublons potentiels de profils. */
  memberDuplicates: '/administration/membres/doublons',
  /** SA-007 — Creation d'un profil reference. */
  memberNew: '/administration/membres/nouveau',
  /** SA-006 — Revue des reclamations de profil. */
  claims: '/administration/reclamations',
  /** SA-008 — Promotions. */
  promotions: '/administration/promotions',
  /** SA-008 — Creation d'une promotion. */
  promotionNew: '/administration/promotions/nouvelle',
  /** SA-010 — Signalements « ma promotion n'existe pas » (ISE-009). */
  promotionSuggestions: '/administration/promotions/suggestions',
  /**
   * Suivi des clics sur les liens d'e-mail Supabase (D-173, migration
   * 0118/0119) : vue GLOBALE plateforme (pas liee a une promotion), placee
   * sous /promotions faute d'un meilleur ecran dedie — cf. commentaire du
   * fichier `promotions/liens/page.tsx`.
   */
  authLinkEvents: '/administration/promotions/liens',
  /** SA-016 — File de moderation des appels au reseau. */
  calls: '/administration/appels',
  /** SA-019 — File de moderation des opportunites. */
  opportunities: '/administration/opportunites',
  /** SA-023 -> 026 — Projets & consortiums. */
  projects: '/administration/projets',
  /** SA-023 — Creation d'un projet. */
  projectNew: '/administration/projets/nouveau',
  /** SA-027 -> 029 — Communautes. */
  communities: '/administration/communautes',
  /** SA-027 — Creation d'une communaute. */
  communityNew: '/administration/communautes/nouvelle',
  /** SA-030 -> 033 — Evenements. */
  events: '/administration/evenements',
  /** SA-030 — Creation d'un evenement. */
  eventNew: '/administration/evenements/nouveau',
  /**
   * File de validation des EVENEMENTS proposes par les ISE (0132).
   * Permission `events.manage`, la meme que la gestion des evenements :
   * qui decide de l'agenda decide des propositions qui l'alimentent.
   */
  eventProposals: '/administration/evenements/propositions',
  /** Redaction administrative des actualites (0110, tache #83). */
  news: '/administration/actualites',
  /** Creation d'un article. */
  newsNew: '/administration/actualites/nouveau',
  /**
   * File de validation des ACTUALITES proposees par les ISE (0132).
   * Permission `content.publish`. Deux files distinctes plutot qu'un
   * ecran unique : les deux permissions sont distinctes en base, et un
   * ecran commun montrerait a chacun une moitie vide.
   */
  newsProposals: '/administration/actualites/propositions',
  /** SA-018 / SA-038 — Moderation & signalements. */
  moderation: '/administration/moderation',
  /** SA-038 — File des tickets support. */
  support: '/administration/support',
  /** SA-043 — Profils incomplets, priorisation. */
  incompleteProfiles: '/administration/profils-incomplets',
  /** Lot livre en parallele : analytics / parametres / audit. */
  analytics: '/administration/analytics',
  settings: '/administration/parametres',
  audit: '/administration/audit',
} as const;

/** SA-003 — Fiche administrative d'un membre / profil. */
export function adminMemberRoute(profileId: string): string {
  return `${ADMIN_ROUTES.members}/${encodeURIComponent(profileId)}`;
}

/** SA-006 — Detail d'une reclamation. */
export function adminClaimRoute(claimId: string): string {
  return `${ADMIN_ROUTES.claims}/${encodeURIComponent(claimId)}`;
}

/** SA-009 — Fiche d'une promotion. */
export function adminPromotionRoute(promotionId: number | string): string {
  return `${ADMIN_ROUTES.promotions}/${encodeURIComponent(String(promotionId))}`;
}

/** SA-011 — Suivi (oversight) des invitations d'une promotion. */
export function adminPromotionInvitationsRoute(promotionId: number | string): string {
  return `${adminPromotionRoute(promotionId)}/invitations`;
}

/** SA-012 — Campagnes d'invitation d'une promotion. */
export function adminCampaignsRoute(promotionId: number | string): string {
  return `${adminPromotionRoute(promotionId)}/campagnes`;
}

/** SA-012 — Creation d'une campagne d'invitation. */
export function adminCampaignNewRoute(promotionId: number | string): string {
  return `${adminCampaignsRoute(promotionId)}/nouvelle`;
}

/** SA-013/SA-014/SA-015 — Detail d'une campagne (apercu, suivi, bilan). */
export function adminCampaignRoute(promotionId: number | string, campaignId: string): string {
  return `${adminCampaignsRoute(promotionId)}/${encodeURIComponent(campaignId)}`;
}

/** SA-018 / SA-039 — Detail d'un signalement. */
export function adminReportRoute(reportId: string): string {
  return `${ADMIN_ROUTES.moderation}/${encodeURIComponent(reportId)}`;
}

/** SA-039 — Detail agent d'un ticket support. */
export function adminTicketRoute(ticketId: string): string {
  return `${ADMIN_ROUTES.support}/${encodeURIComponent(ticketId)}`;
}

/** SA-017 — Detail de moderation d'un appel au reseau. */
export function adminCallRoute(callId: string): string {
  return `${ADMIN_ROUTES.calls}/${encodeURIComponent(callId)}`;
}

/** SA-020 — Detail de validation d'une opportunite. */
export function adminOpportunityRoute(opportunityId: string): string {
  return `${ADMIN_ROUTES.opportunities}/${encodeURIComponent(opportunityId)}`;
}

/** SA-021 — Candidatures recues pour une opportunite (supervision). */
export function adminOpportunityCandidatesRoute(opportunityId: string): string {
  return `${adminOpportunityRoute(opportunityId)}/candidatures`;
}

/** SA-022 — Cloture d'une opportunite et bilan d'impact. */
export function adminOpportunityClosureRoute(opportunityId: string): string {
  return `${adminOpportunityRoute(opportunityId)}/cloture`;
}

/**
 * SA-024/025/026 — Fiche d'un projet : statut adaptatif (publication,
 * demandes de consortium, cloture). Un seul ecran, meme principe que la
 * fiche campagne SA-013/014/015 : pas de decoupage en routes distinctes
 * quand une seule fiche suffit a couvrir tout le cycle de vie.
 */
export function adminProjectRoute(projectId: string): string {
  return `${ADMIN_ROUTES.projects}/${encodeURIComponent(projectId)}`;
}

/**
 * SA-028/029 — Fiche d'une communaute : statut adaptatif (edition,
 * cycle de vie, moderation des publications). Meme principe que
 * `adminProjectRoute` : un seul ecran couvre tout le cycle de vie.
 */
export function adminCommunityRoute(communityId: string): string {
  return `${ADMIN_ROUTES.communities}/${encodeURIComponent(communityId)}`;
}

/**
 * SA-031/032/033 — Fiche d'un evenement : statut adaptatif (edition,
 * cycle de vie, suivi des inscriptions/presence, bilan et instantane
 * d'impact apres l'evenement). Meme principe que `adminProjectRoute`
 * et `adminCommunityRoute` : un seul ecran couvre tout le cycle de vie
 * operationnel plutot que d'etre fragmente en routes distinctes.
 */
export function adminEventRoute(eventId: string): string {
  return `${ADMIN_ROUTES.events}/${encodeURIComponent(eventId)}`;
}

/** Fiche d'un article : edition du contenu + cycle de vie editorial (0110). */
export function adminNewsRoute(newsId: string): string {
  return `${ADMIN_ROUTES.news}/${encodeURIComponent(newsId)}`;
}

/** Examen d'une proposition d'actualite recue d'un ISE (0132). */
export function adminNewsProposalRoute(newsId: string): string {
  return `${ADMIN_ROUTES.newsProposals}/${encodeURIComponent(newsId)}`;
}

/** Examen d'une proposition d'evenement recue d'un ISE (0132). */
export function adminEventProposalRoute(eventId: string): string {
  return `${ADMIN_ROUTES.eventProposals}/${encodeURIComponent(eventId)}`;
}
