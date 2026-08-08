import { z } from 'zod';

/**
 * Schemas des sections de profil ISE-016 -> ISE-023 qui manquaient au lot
 * initial. `profileHeaderSchema`, `experienceSchema` et
 * `profileSkillSchema` vivent dans `./profile.ts` et ne sont pas
 * redefinis ici.
 *
 * Appliques CLIENT et SERVEUR (MASTER PROMPT §62).
 */

export const VISIBILITY_LEVELS = ['private', 'connections', 'promotion', 'members'] as const;
export const visibilitySchema = z.enum(VISIBILITY_LEVELS);
export type VisibilityValue = z.infer<typeof visibilitySchema>;

/**
 * ISE-021 — Ajouter / modifier une formation.
 * Les champs correspondent un pour un aux colonnes de `public.educations`
 * (migration 0005, completee par 0036 pour le type, la ville et le lien
 * de verification) : aucun champ n'est affiche sans support en base.
 */
export const educationSchema = z
  .object({
    educationType: z.enum(['academic', 'certification']).default('academic'),
    institution: z.string().trim().min(2, 'Renseignez l’établissement.').max(160),
    degree: z.string().trim().min(2, 'Renseignez l’intitulé du diplôme.').max(200),
    fieldOfStudy: z.string().trim().max(160).optional().or(z.literal('')),
    countryCode: z.string().length(2).optional().or(z.literal('')),
    city: z.string().trim().max(120).optional().or(z.literal('')),
    startYear: z.union([z.coerce.number().int().min(1940).max(2100), z.literal('')]).optional(),
    endYear: z.union([z.coerce.number().int().min(1940).max(2100), z.literal('')]).optional(),
    credentialUrl: z
      .string()
      .trim()
      .url("L'adresse du justificatif n'est pas valide.")
      .max(500)
      .optional()
      .or(z.literal('')),
    description: z.string().trim().max(400).optional().or(z.literal('')),
    visibility: visibilitySchema.default('members'),
  })
  .refine(
    (d) =>
      d.startYear === '' ||
      d.startYear === undefined ||
      d.endYear === '' ||
      d.endYear === undefined ||
      Number(d.endYear) >= Number(d.startYear),
    {
      path: ['endYear'],
      message: 'L’année d’obtention doit suivre l’année de début.',
    },
  );
export type EducationInput = z.infer<typeof educationSchema>;

/**
 * Visibilite par champ (D-73). Le couple (champ, niveau) est ensuite
 * confronte cote serveur a `profile_visibility_defaults.allowed_levels` :
 * proposer « tous les membres » sur le telephone ne doit pas dependre du
 * seul formulaire.
 */
export const profileVisibilitySchema = z.object({
  fieldKey: z.string().trim().min(2).max(60),
  visibility: visibilitySchema,
});
export type ProfileVisibilityInput = z.infer<typeof profileVisibilitySchema>;

/** Plusieurs champs d'un coup (ISE-017, ISE-022). */
export const profileVisibilityBatchSchema = z.object({
  entries: z.array(profileVisibilitySchema).min(1).max(40),
});
export type ProfileVisibilityBatchInput = z.infer<typeof profileVisibilityBatchSchema>;

/**
 * Identifiants d'une ligne de section. Les Server Actions les recoivent
 * par `FormData` : ils doivent etre valides avant tout appel a la base.
 */
export const sectionRowIdSchema = z.object({
  id: z.string().uuid("Cet élément n'est pas identifiable."),
});
export type SectionRowIdInput = z.infer<typeof sectionRowIdSchema>;

export const profileSkillIdSchema = z.object({
  skillId: z.coerce.number().int().positive(),
});
export type ProfileSkillIdInput = z.infer<typeof profileSkillIdSchema>;
