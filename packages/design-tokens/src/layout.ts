/** Espacement, rayons, ombres, grille. D-91, D-96. */
export const spacing = {
  0: '0px',
  1: '2px',
  2: '4px',
  3: '8px',
  4: '12px',
  5: '16px',
  6: '20px',
  7: '24px',
  8: '32px',
  9: '40px',
  10: '48px',
  11: '64px',
} as const;

export const radius = {
  none: '0px',
  sm: '6px',
  /** Rayon de base du design system. */
  base: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
} as const;

export const shadow = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
  base: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
  md: '0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 6px -2px rgb(15 23 42 / 0.06)',
  lg: '0 12px 28px -8px rgb(15 23 42 / 0.16)',
  focus: '0 0 0 3px rgb(37 99 235 / 0.35)',
} as const;

/** D-96 : grille 12 colonnes, sidebar 248, contenu max 1160, topbar 68. */
export const layout = {
  sidebarWidth: 248,
  topbarHeight: 68,
  contentMaxWidth: 1160,
  gridColumns: 12,
  gutterDesktop: 24,
  gutterMobile: 16,
  /** Cible tactile minimale (MASTER PROMPT §56). */
  minTouchTarget: 44,
} as const;

export const breakpoints = {
  mobile: 375,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
} as const;
