/**
 * Baremes du moteur de matching. POINT DE CALIBRAGE UNIQUE.
 * Source : document 22 normalise sur 100 (docs/decisions.md D-40).
 * Les valeurs de detail absentes des specifications sont fixees par D-41
 * et marquees PROVISOIRE : les modifier ici suffit, le moteur ne les duplique pas.
 */
export const CRITERION_WEIGHTS = {
  skills: 40,
  sector: 15,
  geography: 15,
  availability: 10,
  experience: 10,
  language: 5,
  promotion: 5,
} as const;

export type Criterion = keyof typeof CRITERION_WEIGHTS;

/** Multiplicateurs de niveau declare (document 22). */
export const LEVEL_MULTIPLIERS = {
  notion: 0.4,
  intermediate: 0.7,
  advanced: 0.9,
  expert: 1.0,
  /** Niveau non renseigne : ni penalise a l'exces, ni suppose expert. */
  undeclared: 0.75,
} as const;

/** PROVISOIRE (D-41). */
export const SECTOR_POINTS = { exact: 15, adjacent: 9, none: 0 } as const;

/** PROVISOIRE (D-41). */
export const GEOGRAPHY_POINTS = {
  experienceCountryExact: 15,
  residenceCountryExact: 12,
  sameSubregion: 8,
  none: 0,
} as const;

/** PROVISOIRE (D-41). */
export const AVAILABILITY_POINTS = {
  typeExplicitlyOpen: 10,
  availableWithoutTypeMatch: 5,
  unavailable: 0,
} as const;

/**
 * Seuils des libelles qualitatifs (D-42).
 * MASTER PROMPT §15 : aucun pourcentage n'est jamais affiche.
 */
export const RELEVANCE_THRESHOLDS = {
  veryRelevant: 70,
  relevant: 45,
  close: 25,
} as const;
