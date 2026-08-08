/** Typographie. D-91 : Geist en principal, Inter en repli. */
export const fontFamily = {
  sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
} as const;

/** [taille, interligne] en px. */
export const fontSize = {
  display: [40, 48],
  h1: [32, 40],
  h2: [24, 32],
  h3: [20, 28],
  h4: [18, 26],
  body: [16, 24],
  bodySm: [14, 20],
  caption: [13, 18],
  overline: [12, 16],
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
