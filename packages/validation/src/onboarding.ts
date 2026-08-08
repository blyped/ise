import { z } from 'zod';

/**
 * Schemas de l'onboarding ISE-008 -> ISE-014.
 *
 * Les 7 etapes et leur ordre viennent des NOMS DE FICHIERS des maquettes
 * (D-01, D-70) : 1 Verification · 2 Promotion · 3 Competences ·
 * 4 Secteurs · 5 Localisation · 6 Disponibilite · 7 Finalisation.
 *
 * Ces schemas sont appliques CLIENT et SERVEUR (MASTER PROMPT §62).
 * Aucun libelle de reference (promotion, secteur, pays, type de
 * disponibilite) n'apparait ici : ce sont des identifiants, valides
 * ensuite par les cles etrangeres de la base.
 */

/** Etapes de l'onboarding, dans l'ordre des maquettes (D-70). */
export const ONBOARDING_STEPS = [
  'verification',
  'promotion',
  'competences',
  'secteurs',
  'localisation',
  'disponibilite',
  'finalisation',
] as const;

export type OnboardingStepSlug = (typeof ONBOARDING_STEPS)[number];

/** Numero d'etape (1..7) d'un slug. */
export function onboardingStepNumber(slug: OnboardingStepSlug): number {
  return ONBOARDING_STEPS.indexOf(slug) + 1;
}

export function onboardingStepSlug(step: number): OnboardingStepSlug {
  const index = Math.min(Math.max(Math.trunc(step), 1), ONBOARDING_STEPS.length) - 1;
  return ONBOARDING_STEPS[index] as OnboardingStepSlug;
}

export const onboardingStepSchema = z.coerce.number().int().min(1).max(ONBOARDING_STEPS.length);

/** Etape 1 — Verification. Le membre confirme l'identite deja associee. */
export const onboardingVerificationSchema = z.object({
  acknowledged: z.literal('on', {
    errorMap: () => ({ message: 'Confirmez que ces informations sont bien les vôtres.' }),
  }),
});
export type OnboardingVerificationInput = z.infer<typeof onboardingVerificationSchema>;

/** Etape 2 — Promotion (ISE-008). L'identifiant vient de `promotions`. */
export const onboardingPromotionSchema = z.object({
  promotionId: z.coerce
    .number({ invalid_type_error: 'Sélectionnez votre promotion.' })
    .int()
    .positive('Sélectionnez votre promotion.'),
});
export type OnboardingPromotionInput = z.infer<typeof onboardingPromotionSchema>;

/**
 * ISE-009 — Signaler une promotion absente.
 * Alimente `public.promotion_suggestions` : aucune promotion n'est creee
 * automatiquement, le signalement part en revue.
 */
export const promotionSuggestionSchema = z.object({
  promotionLabel: z
    .string()
    .trim()
    .min(2, 'Indiquez l’année ou le libellé de la promotion.')
    .max(120),
  institution: z.string().trim().max(160).optional().or(z.literal('')),
  countryCode: z.string().length(2).optional().or(z.literal('')),
  approximateYear: z.union([z.coerce.number().int().min(1940).max(2100), z.literal('')]).optional(),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type PromotionSuggestionInput = z.infer<typeof promotionSuggestionSchema>;

/**
 * Etape 3 — Competences (ISE-010). Cinq au maximum, comme la maquette.
 * Le niveau reste DECLARATIF (D-75) : il est saisi ecran ISE-023.
 */
export const ONBOARDING_MAX_SKILLS = 5;

export const onboardingSkillsSchema = z.object({
  skillIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'Choisissez au moins une compétence.')
    .max(ONBOARDING_MAX_SKILLS, `Choisissez ${ONBOARDING_MAX_SKILLS} compétences au maximum.`),
});
export type OnboardingSkillsInput = z.infer<typeof onboardingSkillsSchema>;

/** Etape 4 — Secteurs (ISE-011). Cinq au maximum, etape passable. */
export const ONBOARDING_MAX_SECTORS = 5;

export const onboardingSectorsSchema = z.object({
  sectorIds: z
    .array(z.coerce.number().int().positive())
    .max(ONBOARDING_MAX_SECTORS, `Choisissez ${ONBOARDING_MAX_SECTORS} secteurs au maximum.`),
});
export type OnboardingSectorsInput = z.infer<typeof onboardingSectorsSchema>;

/**
 * Etape 5 — Localisation (ISE-012).
 * `countryCodes` = zones d'experience professionnelle, distinctes de la
 * localisation actuelle, comme le rappelle la maquette.
 */
export const ONBOARDING_MAX_EXPERIENCE_COUNTRIES = 12;

export const onboardingLocationSchema = z.object({
  currentCountryCode: z.string().length(2).optional().or(z.literal('')),
  currentCity: z.string().trim().max(120).optional().or(z.literal('')),
  experienceCountryCodes: z
    .array(z.string().length(2))
    .max(
      ONBOARDING_MAX_EXPERIENCE_COUNTRIES,
      `Indiquez ${ONBOARDING_MAX_EXPERIENCE_COUNTRIES} pays d’expérience au maximum.`,
    ),
  /** ISE-012 — « Afficher ma ville sur mon profil » (D-73). */
  cityVisibility: z.enum(['private', 'connections', 'promotion', 'members']),
});
export type OnboardingLocationInput = z.infer<typeof onboardingLocationSchema>;

/**
 * Etape 6 — Disponibilite (ISE-013).
 * Les codes viennent de `availability_types` (14 lignes, D-65).
 * `intensity` est le « niveau de disponibilite » de la maquette ; il est
 * enregistre en base comme un plafond mensuel declare, jamais comme un
 * engagement (MASTER PROMPT §20).
 */
export const AVAILABILITY_INTENSITIES = ['low', 'moderate', 'high'] as const;
export type AvailabilityIntensity = (typeof AVAILABILITY_INTENSITIES)[number];

/** Plafond mensuel declare associe a chaque niveau. Une seule source. */
export const AVAILABILITY_INTENSITY_MAX_PER_MONTH: Readonly<Record<AvailabilityIntensity, number>> =
  { low: 1, moderate: 3, high: 8 };

export const onboardingAvailabilitySchema = z.object({
  availabilityTypes: z.array(z.string().trim().min(2).max(60)).max(14),
  intensity: z.enum(AVAILABILITY_INTENSITIES),
  visibility: z.enum(['private', 'connections', 'promotion', 'members']),
});
export type OnboardingAvailabilityInput = z.infer<typeof onboardingAvailabilitySchema>;

/** Etape 7 — Finalisation (ISE-014). La confirmation est obligatoire. */
export const onboardingFinalizeSchema = z.object({
  confirmed: z.literal('on', {
    errorMap: () => ({
      message: 'Confirmez que les informations saisies décrivent fidèlement votre profil.',
    }),
  }),
});
export type OnboardingFinalizeInput = z.infer<typeof onboardingFinalizeSchema>;
