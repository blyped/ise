/**
 * Erreurs metier : code machine cote serveur, message humain cote interface.
 * MASTER PROMPT §99 ; docs/decisions.md D-102.
 *
 * Jamais de contrainte SQL, de nom de table ni de trace technique cote utilisateur.
 */
export const BUSINESS_ERRORS = {
  not_authenticated: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  not_authorized: "Vous n'avez pas accès à cette action.",
  not_found: "Cet élément n'existe plus ou n'est pas accessible.",
  invalid_transition: "Cette action n'est plus possible dans l'état actuel.",
  request_expired: 'Cette demande a expiré.',
  already_connected: 'Vous êtes déjà en relation avec cet ISE.',
  request_already_sent: 'Une demande est déjà en cours avec cet ISE.',
  cannot_target_self: 'Vous ne pouvez pas effectuer cette action sur votre propre profil.',
  blocked: "Cette action n'est pas possible avec ce membre.",
  profile_already_claimed: 'Ce profil a déjà été réclamé par un autre compte.',
  account_already_linked: 'Votre compte est déjà rattaché à un profil ISE.',
  claim_already_pending:
    'Vous avez déjà une réclamation en cours. Attendez son issue avant d’en déposer une autre.',
  claim_not_found: "Cette réclamation n'existe plus ou n'est pas accessible.",
  profile_not_found: "Ce profil n'existe plus ou n'est plus réclamable.",
  profile_not_claimable: 'Ce profil ne peut pas être réclamé.',
  invitation_invalid: "Cette invitation n'existe pas ou n'est plus valable.",
  invitation_expired: 'Cette invitation a expiré. Demandez-en une nouvelle à la personne qui vous a invité.',
  invalid_claim_method: "Cette méthode de vérification n'est pas disponible pour ce profil.",
  rate_limited: 'Vous avez atteint la limite autorisée. Réessayez plus tard.',
  intermediary_not_connected:
    "Vous devez être en relation avec l'intermédiaire pour lui demander une introduction.",
  attachment_limit_exceeded: 'Trop de pièces jointes pour ce message.',
  attachment_too_large: 'Ce fichier dépasse la taille autorisée.',
  attachment_type_not_allowed: "Ce type de fichier n'est pas autorisé.",
  validation_failed: 'Certaines informations sont incomplètes ou invalides.',
  unknown: "Une erreur est survenue. Réessayez ; si le problème persiste, contactez l'assistance.",
} as const;

export type BusinessErrorCode = keyof typeof BUSINESS_ERRORS;

export class BusinessError extends Error {
  readonly code: BusinessErrorCode;
  readonly correlationId: string | undefined;

  constructor(code: BusinessErrorCode, correlationId?: string) {
    super(code);
    this.name = 'BusinessError';
    this.code = code;
    this.correlationId = correlationId;
  }

  /** Message destine a l'utilisateur, en francais, sans detail technique. */
  get userMessage(): string {
    return BUSINESS_ERRORS[this.code];
  }
}

const PG_CODE_MAP: Record<string, BusinessErrorCode> = {
  '28000': 'not_authenticated',
  '42501': 'not_authorized',
  P0002: 'not_found',
  P0001: 'invalid_transition',
};

/**
 * Traduit une erreur PostgreSQL / PostgREST en erreur metier.
 * Toute erreur inconnue devient `unknown` : on ne laisse jamais fuiter
 * un message technique vers l'interface.
 */
export function toBusinessError(raw: unknown, correlationId?: string): BusinessError {
  const err = raw as { code?: string; message?: string } | null;
  const message = err?.message ?? '';

  if (message in BUSINESS_ERRORS) {
    return new BusinessError(message as BusinessErrorCode, correlationId);
  }
  if (err?.code && err.code in PG_CODE_MAP) {
    return new BusinessError(PG_CODE_MAP[err.code]!, correlationId);
  }
  if (err?.code === '23505') {
    return new BusinessError('request_already_sent', correlationId);
  }
  return new BusinessError('unknown', correlationId);
}
