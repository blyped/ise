/**
 * Toutes les limites chiffrees du produit, en un seul endroit.
 * Les valeurs marquees PROVISOIRE sont documentees dans docs/decisions.md
 * et destinees a etre recalibrees apres les premiers usages reels.
 */
export const limits = {
  /** Pagination par curseur (D-44). */
  pageSize: { web: 20, mobile: 15, max: 50 },

  /** Limitation de debit : { nombre, fenetre en secondes } (D-103). */
  rateLimit: {
    accountCreation: { count: 3, windowSeconds: 3600 },
    passwordReset: { count: 5, windowSeconds: 3600 },
    connectionRequests: { count: 30, windowSeconds: 86_400 },
    introductionRequests: { count: 10, windowSeconds: 86_400 },
    networkCallCreation: { count: 5, windowSeconds: 86_400 },
    newConversations: { count: 20, windowSeconds: 86_400 },
    recommendationRequests: { count: 15, windowSeconds: 86_400 },
    profileClaimAttempts: { count: 5, windowSeconds: 86_400 },
  },

  /** Pieces jointes de messagerie (D-84, PROVISOIRE). */
  attachments: {
    maxBytesPerFile: 10 * 1024 * 1024,
    maxPerMessage: 3,
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/webp',
    ] as const,
  },

  avatar: {
    maxBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
  },

  /** Expirations (Q-02 a Q-04, PROVISOIRE). */
  expiry: {
    networkCallDays: 60,
    introductionRequestDays: 14,
    connectionRequestDays: 30,
    promotionInvitationDays: 30,
    profileClaimDays: 30,
  },

  text: {
    headlineMax: 160,
    bioMax: 2000,
    connectionMessageMax: 600,
    introductionMessageMax: 1500,
    recommendationMin: 40,
    recommendationMax: 2000,
    networkCallTitleMax: 120,
  },
} as const;
