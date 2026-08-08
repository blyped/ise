/**
 * Palette Competences ISE.
 * Source : MASTER PROMPT §13 + docs/decisions.md D-90, D-91, D-92.
 *
 * Regle D-90 : aucune couleur dediee par module metier. La couleur ne porte
 * jamais seule une information : tout etat est double d'un libelle ou d'une icone.
 */
export const colors = {
  deepNavy: '#0B214A',
  darkNavy: '#071A36',

  actionBlue: '#2563EB',
  activeBlue: '#1D4ED8',

  /** Or ISE : accent uniquement, jamais en surface ni en fond de bloc. */
  iseGold: '#D9A441',

  background: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  border: '#E2E8F0',

  success: '#15803D',
  warning: '#B45309',
  error: '#B91C1C',
  info: '#0369A1',
  purple: '#7C3AED',
} as const;

export type ColorToken = keyof typeof colors;
