import { z } from 'zod';

/**
 * Schemas partages Web et Mobile. MASTER PROMPT §62 : la MEME validation
 * s'applique cote client (retour immediat) et cote serveur (autorite reelle).
 * Un formulaire valide cote client est toujours revalide cote serveur.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Renseignez votre adresse e-mail.')
  .email('Cette adresse e-mail ne semble pas valide.')
  .transform((v) => v.toLowerCase());

/**
 * Politique de mot de passe : longueur d'abord, complexite ensuite.
 * Une phrase de passe longue vaut mieux qu'un mot court truffe de symboles.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères.')
  .max(128, 'Le mot de passe est trop long.')
  .refine((v) => /[a-zà-ÿ]/.test(v), 'Ajoutez au moins une minuscule.')
  .refine((v) => /[A-ZÀ-Ÿ]/.test(v), 'Ajoutez au moins une majuscule.')
  .refine((v) => /[0-9]/.test(v), 'Ajoutez au moins un chiffre.');

/** ISE-001 — Connexion */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Renseignez votre mot de passe.'),
  rememberMe: z.boolean().default(false),
});
export type SignInInput = z.infer<typeof signInSchema>;

/** ISE-002 — Créer un compte */
export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    acceptsTerms: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }),
    }),
  })
  .refine((d) => d.password === d.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

/** ISE-003 — Mot de passe oublié */
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** ISE-004 — Réinitialiser le mot de passe */
export const resetPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirmation: z.string() })
  .refine((d) => d.password === d.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Bornes des promotions ISE, alignées sur le référentiel seedé
 * (`public.promotions`, 1960 → année en cours + 5, décision D-64).
 */
export const GRADUATION_YEAR_MIN = 1960;
export const graduationYearMax = (): number => new Date().getFullYear() + 5;

/**
 * ISE-005 — Rechercher son profil référencé.
 *
 * `graduationYear` arrive d'un `<select>` : c'est une chaîne, et « toutes les
 * promotions » est la chaîne vide. Le pré-traitement ramène ces deux cas à
 * `undefined` pour que le MÊME schéma serve au client, au serveur et au mobile
 * (MASTER PROMPT §62).
 */
export const claimSearchSchema = z.object({
  lastName: z
    .string()
    .trim()
    .min(2, 'Renseignez au moins deux caractères de votre nom.')
    .max(80, 'Ce nom est trop long.'),
  firstName: z.string().trim().max(80, 'Ce prénom est trop long.').optional(),
  graduationYear: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z
      .number({ invalid_type_error: 'Choisissez une année de promotion valide.' })
      .int()
      .min(GRADUATION_YEAR_MIN, 'Choisissez une année de promotion valide.')
      .max(graduationYearMax(), 'Choisissez une année de promotion valide.')
      .optional(),
  ),
});
export type ClaimSearchInput = z.infer<typeof claimSearchSchema>;

/**
 * Méthodes de vérification proposables à un demandeur.
 * `admin` est volontairement absent : ce n'est jamais un choix de l'utilisateur,
 * et `public.submit_profile_claim` la refuse également côté base.
 */
export const CLAIM_METHODS = [
  'historical_email',
  'historical_phone',
  'promotion_manager',
  'document',
] as const;
export type ClaimMethod = (typeof CLAIM_METHODS)[number];

/** ISE-006 — Confirmer l'association du profil */
export const claimSubmitSchema = z.object({
  profileId: z.string().uuid(),
  claimMethod: z.enum(CLAIM_METHODS, {
    errorMap: () => ({ message: 'Choisissez une méthode de vérification.' }),
  }),
  /**
   * Confirmation explicite exigée par la maquette ISE-006. Elle est validée
   * côté serveur comme côté client : une case à cocher n'est pas une garantie.
   */
  confirmsIdentity: z.literal(true, {
    errorMap: () => ({ message: 'Confirmez que ce profil est bien le vôtre.' }),
  }),
  declaredDetails: z.record(z.string(), z.string()).default({}),
});
export type ClaimSubmitInput = z.infer<typeof claimSubmitSchema>;
