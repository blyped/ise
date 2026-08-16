import { z } from 'zod';
import { limits } from '@ise/config';

const visibility = z.enum(['private', 'connections', 'promotion', 'members']);

/** ISE-017 — En-tête et À propos */
export const profileHeaderSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est obligatoire.').max(80),
  lastName: z.string().trim().min(1, 'Le nom est obligatoire.').max(80),
  headline: z.string().trim().max(limits.text.headlineMax).optional(),
  bio: z.string().trim().max(limits.text.bioMax).optional(),
  currentPosition: z.string().trim().max(160).optional(),
  currentOrganizationId: z.string().uuid().optional(),
  currentOrganizationRaw: z.string().trim().max(160).optional(),
  currentCountryCode: z.string().length(2).optional(),
  currentCity: z.string().trim().max(120).optional(),
  linkedinUrl: z.string().url("L'adresse LinkedIn n'est pas valide.").optional().or(z.literal('')),
  websiteUrl: z.string().url("L'adresse du site n'est pas valide.").optional().or(z.literal('')),
});
export type ProfileHeaderInput = z.infer<typeof profileHeaderSchema>;

/** ISE-019 — Ajouter / modifier une expérience */
export const experienceSchema = z
  .object({
    organizationId: z.string().uuid().optional(),
    organizationNameRaw: z.string().trim().max(160).optional(),
    positionTitle: z.string().trim().min(2, 'Renseignez l’intitulé du poste.').max(160),
    sectorId: z.number().int().positive().optional(),
    jobFunctionId: z.number().int().positive().optional(),
    countryCode: z.string().length(2).optional(),
    city: z.string().trim().max(120).optional(),
    startDate: z.string().date(),
    endDate: z.string().date().optional(),
    isCurrent: z.boolean().default(false),
    description: z.string().trim().max(4000).optional(),
    visibility: visibility.default('members'),
  })
  .refine((d) => d.organizationId || d.organizationNameRaw, {
    path: ['organizationNameRaw'],
    message: "Renseignez l'organisation.",
  })
  .refine((d) => !d.isCurrent || !d.endDate, {
    path: ['endDate'],
    message: 'Un poste en cours ne peut pas avoir de date de fin.',
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'La date de fin doit suivre la date de début.',
  });
export type ExperienceInput = z.infer<typeof experienceSchema>;

/** ISE-023 — Gérer une compétence. Le niveau reste DÉCLARATIF (D-75). */
export const profileSkillSchema = z.object({
  skillId: z.number().int().positive(),
  level: z.enum(['notion', 'intermediate', 'advanced', 'expert']).optional(),
  yearsExperience: z.number().min(0).max(60).optional(),
  isPrimary: z.boolean().default(false),
  context: z.string().trim().max(500).optional(),
});
export type ProfileSkillInput = z.infer<typeof profileSkillSchema>;

/* ------------------------------------------------------------------ */
/* Vitrine publique — brève description et consentements (révision D-135) */
/* ------------------------------------------------------------------ */

/**
 * SOURCE DE VÉRITÉ UNIQUE des bornes de la brève description publique.
 *
 * Ces deux valeurs ne sont pas choisies ici : elles RECOPIENT la contrainte
 * `ise_profiles_public_summary_length` posée en base par la migration 0057
 * (`char_length(btrim(public_summary)) between 40 and 400`). Une divergence
 * produirait un formulaire qui accepte un texte que la base refuse, avec un
 * message d'erreur incompréhensible. Toute évolution passe donc d'abord par
 * une migration, puis par ces constantes.
 */
export const PUBLIC_SUMMARY_MIN = 40;
export const PUBLIC_SUMMARY_MAX = 400;

/** Alternative textuelle du portrait public (contrôlée aussi par set_my_public_photo). */
export const PUBLIC_PHOTO_ALT_MIN = 3;
export const PUBLIC_PHOTO_ALT_MAX = 200;

/**
 * Vitrine publique du membre.
 *
 * D-211 — le consentement de publication de la PHOTO (`allowPublicPhoto`)
 * a quitte ce schema : il vit desormais sur l'ecran « Photo de profil »
 * (mon-profil/en-tete), aux cotes du depot unique de la photo elle-meme
 * (fusion D-211, docs/decisions.md). Seul reste ici `allowPublicFeature` —
 * paraitre comme « ISE du jour » avec le texte ci-dessous — qui est un
 * consentement independant, portant sur la brieve description et pas sur
 * l'image.
 *
 * La brève description est exigée dès que ce consentement est donné : sans
 * elle, le profil n'est de toute façon pas éligible côté base
 * (`private.featured_profile_eligible`, migration 0120). Le dire ici évite
 * un consentement qui ne produirait jamais rien.
 */
export const publicShowcaseSchema = z
  .object({
    publicSummary: z
      .string()
      .trim()
      .min(PUBLIC_SUMMARY_MIN, `La brève description doit faire au moins ${PUBLIC_SUMMARY_MIN} caractères.`)
      .max(PUBLIC_SUMMARY_MAX, `La brève description ne peut pas dépasser ${PUBLIC_SUMMARY_MAX} caractères.`)
      .optional(),
    allowPublicFeature: z.boolean().default(false),
  })
  .refine((d) => !d.allowPublicFeature || d.publicSummary !== undefined, {
    path: ['publicSummary'],
    message:
      'Rédigez d’abord votre brève description : sans elle, votre profil ne peut pas paraître.',
  });
export type PublicShowcaseInput = z.infer<typeof publicShowcaseSchema>;

/** ISE-033 — Modifier ma disponibilité */
export const availabilitySchema = z.object({
  availabilityType: z.string().min(2),
  active: z.boolean(),
  maxPerMonth: z.number().int().min(1).max(60).optional(),
  idealDelayDays: z.number().int().min(1).max(365).optional(),
  preferredChannel: z.enum(['message', 'email', 'call', 'video']).optional(),
  visibility: visibility.default('members'),
  notes: z.string().trim().max(500).optional(),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
