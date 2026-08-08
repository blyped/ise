import { ONBOARDING_STEPS, onboardingStepSlug, type OnboardingStepSlug } from '@ise/validation';

/**
 * Chemins de l'onboarding (ISE-008 -> ISE-014) et du profil membre
 * (ISE-016 -> ISE-023), en francais (MASTER PROMPT §66).
 *
 * Ce fichier est volontairement distinct de `src/lib/routes.ts` : les deux
 * lots avancent en parallele et ne doivent pas se marcher dessus. Les
 * constantes communes (`ROUTES.dashboard`, `ROUTES.sessionExpired`) sont
 * importees depuis `src/lib/routes.ts` par les ecrans, jamais recopiees ici.
 */

/** Racine du parcours. Redirige vers l'etape reellement en cours. */
export const ONBOARDING_ROOT = '/bienvenue';

/** ISE-009 — Signaler une promotion absente (sous-ecran de l'etape 2). */
export const ONBOARDING_MISSING_PROMOTION = '/bienvenue/promotion/signaler';

export function onboardingRoute(step: OnboardingStepSlug | number): string {
  const slug = typeof step === 'number' ? onboardingStepSlug(step) : step;
  return `${ONBOARDING_ROOT}/${slug}`;
}

/** Les 7 chemins, dans l'ordre des maquettes (D-70). */
export const ONBOARDING_ROUTES: readonly string[] = ONBOARDING_STEPS.map((slug) =>
  onboardingRoute(slug),
);

/** ISE-016 -> ISE-023 — Mon profil. */
export const PROFILE_ROUTES = {
  overview: '/mon-profil',
  header: '/mon-profil/en-tete',
  experiences: '/mon-profil/experiences',
  newExperience: '/mon-profil/experiences/nouvelle',
  educations: '/mon-profil/formations',
  newEducation: '/mon-profil/formations/nouvelle',
  skills: '/mon-profil/competences',
  newSkill: '/mon-profil/competences/nouvelle',
} as const;

export function experienceRoute(experienceId: string): string {
  return `${PROFILE_ROUTES.experiences}/${encodeURIComponent(experienceId)}`;
}

export function educationRoute(educationId: string): string {
  return `${PROFILE_ROUTES.educations}/${encodeURIComponent(educationId)}`;
}

export function profileSkillRoute(skillId: number): string {
  return `${PROFILE_ROUTES.skills}/${skillId}`;
}
