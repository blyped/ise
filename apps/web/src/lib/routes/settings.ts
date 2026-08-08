/**
 * Chemins de la tranche PARAMETRES, CONFIDENTIALITE ET PREFERENCES
 * (ISE-099, SYS-008, SYS-009).
 */
export const SETTINGS_ROUTES = {
  /** ISE-099 — Sommaire des parametres. */
  overview: '/parametres',
  /** ISE-099 — Visibilite par champ (D-73, D-74). */
  privacy: '/parametres/confidentialite',
  /** ISE-099 — Preferences de notification par type (D-80). */
  notifications: '/parametres/notifications',
  /** ISE-099 — Compte et sollicitations. */
  account: '/parametres/compte',
  /** ISE-099 — Membres bloques. */
  blocked: '/parametres/membres-bloques',
  /** SYS-009 — Mes donnees, consentements et suppression du compte. */
  data: '/parametres/mes-donnees',
} as const;
