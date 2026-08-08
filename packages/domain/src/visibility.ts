/** Echelle de visibilite unifiee — docs/decisions.md D-73. */
export const VISIBILITY_LEVELS = ['private', 'connections', 'promotion', 'members'] as const;
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

export const VISIBILITY_LABELS: Readonly<Record<VisibilityLevel, string>> = {
  private: 'Moi uniquement',
  connections: 'Mes relations',
  promotion: 'Ma promotion',
  members: 'Tous les membres',
};

/** Du plus ferme au plus ouvert. Aucun niveau « web public » en V1. */
export const VISIBILITY_ORDER: Readonly<Record<VisibilityLevel, number>> = {
  private: 0,
  connections: 1,
  promotion: 2,
  members: 3,
};

export interface ViewerContext {
  readonly isOwner: boolean;
  readonly isConnected: boolean;
  readonly sharesPromotion: boolean;
  readonly isActiveMember: boolean;
  readonly isBlocked: boolean;
}

/**
 * Miroir TypeScript de private.can_see_field() (migration 0021).
 * Sert a l'affichage. L'application effective est faite par RLS :
 * une donnee non autorisee n'atteint jamais le client (MASTER PROMPT §47).
 */
export function canSee(level: VisibilityLevel, viewer: ViewerContext): boolean {
  if (viewer.isOwner) return true;
  if (viewer.isBlocked) return false;
  switch (level) {
    case 'private':
      return false;
    case 'connections':
      return viewer.isConnected;
    case 'promotion':
      return viewer.sharesPromotion;
    case 'members':
      return viewer.isActiveMember;
  }
}
