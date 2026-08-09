import { z } from 'zod';
import { visibilitySchema } from './profile-sections';

/**
 * Schemas des ecrans de profil ISE-024 -> ISE-033.
 *
 * Appliques CLIENT et SERVEUR (MASTER PROMPT §62) : les Server Actions
 * rejouent exactement ces schemas sur l'entree normalisee par
 * `form-input-extras.ts`.
 *
 * Les identifiants (`sectorIds`, `toolId`, `languageCode`…) sont ensuite
 * confrontes a la BASE : un identifiant absent du referentiel echoue en
 * cle etrangere, jamais silencieusement.
 */

/* ------------------------------------------------------------------ */
/* ISE-024 — Secteurs, fonctions & expertises                           */
/* ------------------------------------------------------------------ */

const idList = z.array(z.number().int().positive());

/**
 * Les bornes hautes suivent la taille des referentiels reels
 * (35 secteurs, 36 fonctions, 14 domaines d'expertise) : tout
 * selectionner reste possible, davantage est une entree forgee.
 */
export const positioningSchema = z
  .object({
    sectorIds: idList.max(35),
    primarySectorId: z.number().int().positive().optional(),
    functionIds: idList.max(36),
    expertiseAreaIds: idList.max(14),
  })
  .refine((d) => d.primarySectorId === undefined || d.sectorIds.includes(d.primarySectorId), {
    path: ['primarySectorId'],
    message: 'Le secteur principal doit faire partie des secteurs sélectionnés.',
  });
export type PositioningInput = z.infer<typeof positioningSchema>;

/* ------------------------------------------------------------------ */
/* ISE-026 — Ajouter / modifier un projet (`profile_projects`)          */
/* ------------------------------------------------------------------ */

export const profileProjectSchema = z
  .object({
    title: z.string().trim().min(3, 'Renseignez le nom du projet.').max(160),
    organizationNameRaw: z.string().trim().max(160).optional(),
    role: z.string().trim().max(160).optional(),
    sectorId: z.number().int().positive().optional(),
    countryCode: z.string().length(2).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    summary: z.string().trim().max(600).optional(),
    outcome: z.string().trim().max(400).optional(),
    linkUrl: z.string().trim().url("L'adresse du lien n'est pas valide.").max(500).optional(),
    visibility: visibilitySchema.default('members'),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'La date de fin doit suivre la date de début.',
  });
export type ProfileProjectInput = z.infer<typeof profileProjectSchema>;

/* ------------------------------------------------------------------ */
/* ISE-027 — Langues, zones d'experience, outils                        */
/* ------------------------------------------------------------------ */

/** Les 5 niveaux reels de `profile_languages.proficiency` (0005). */
export const LANGUAGE_PROFICIENCIES = [
  'basic',
  'intermediate',
  'professional',
  'fluent',
  'native',
] as const;
export const languageProficiencySchema = z.enum(LANGUAGE_PROFICIENCIES);
export type LanguageProficiency = z.infer<typeof languageProficiencySchema>;

export const profileLanguagesSchema = z.object({
  entries: z
    .array(
      z.object({
        languageCode: z.string().trim().min(2).max(10),
        proficiency: languageProficiencySchema,
      }),
    )
    .max(20)
    .refine(
      (entries) => new Set(entries.map((entry) => entry.languageCode)).size === entries.length,
      { message: 'Chaque langue ne peut être déclarée qu’une seule fois.' },
    ),
});
export type ProfileLanguagesInput = z.infer<typeof profileLanguagesSchema>;

export const profileGeographiesSchema = z.object({
  countryCodes: z
    .array(z.string().trim().length(2))
    .max(60)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Chaque pays ne peut être déclaré qu’une seule fois.',
    }),
});
export type ProfileGeographiesInput = z.infer<typeof profileGeographiesSchema>;

/** Niveaux declaratifs de `profile_tools.proficiency` (0005, D-75). */
export const toolProficiencySchema = z.enum(['notion', 'intermediate', 'advanced', 'expert']);
export type ToolProficiency = z.infer<typeof toolProficiencySchema>;

export const profileToolsSchema = z.object({
  entries: z
    .array(
      z.object({
        toolId: z.number().int().positive(),
        proficiency: toolProficiencySchema.optional(),
      }),
    )
    .max(44)
    .refine((entries) => new Set(entries.map((entry) => entry.toolId)).size === entries.length, {
      message: 'Chaque outil ne peut être déclaré qu’une seule fois.',
    }),
});
export type ProfileToolsInput = z.infer<typeof profileToolsSchema>;

/* ------------------------------------------------------------------ */
/* ISE-029 — Demander une recommandation                                */
/* ------------------------------------------------------------------ */

/** Nature de la relation professionnelle (maquette ISE-029). */
export const RECOMMENDATION_RELATIONSHIPS = ['project', 'mission', 'management', 'other'] as const;
export const recommendationRelationshipSchema = z.enum(RECOMMENDATION_RELATIONSHIPS);
export type RecommendationRelationship = z.infer<typeof recommendationRelationshipSchema>;

export const recommendationRequestSchema = z.object({
  recipientProfileId: z.string().uuid('Choisissez un membre de votre réseau.'),
  skillId: z.number().int().positive().optional(),
  relationship: recommendationRelationshipSchema,
  context: z.string().trim().max(200).optional(),
  message: z.string().trim().min(20, 'Précisez votre demande (au moins 20 caractères).').max(500),
});
export type RecommendationRequestInput = z.infer<typeof recommendationRequestSchema>;

/**
 * ISE-028 — Reponse du destinataire d'une demande.
 * Accepter implique d'ECRIRE la recommandation : jamais un simple like
 * (MASTER PROMPT §19). Le texte porte les memes bornes 40-2000 que la
 * contrainte de `public.recommendations.body` (0005).
 */
export const recommendationAcceptSchema = z.object({
  requestId: z.string().uuid(),
  relationshipContext: z.string().trim().min(3, 'Précisez la relation professionnelle.').max(200),
  engagementContext: z.string().trim().max(200).optional(),
  skillId: z.number().int().positive().optional(),
  body: z
    .string()
    .trim()
    .min(40, 'Une recommandation fait au moins 40 caractères.')
    .max(2000, 'Une recommandation fait au plus 2 000 caractères.'),
  visibility: visibilitySchema.default('members'),
});
export type RecommendationAcceptInput = z.infer<typeof recommendationAcceptSchema>;

export const recommendationDeclineSchema = z.object({
  requestId: z.string().uuid(),
});
export type RecommendationDeclineInput = z.infer<typeof recommendationDeclineSchema>;

export const recommendationWithdrawSchema = z.object({
  requestId: z.string().uuid(),
});
export type RecommendationWithdrawInput = z.infer<typeof recommendationWithdrawSchema>;

/**
 * Le SUJET valide ou masque une recommandation recue : il ne peut jamais
 * la reecrire (garde-fou pose en base par la migration 0085).
 */
export const recommendationModerationSchema = z.object({
  recommendationId: z.string().uuid(),
  action: z.enum(['publish', 'hide']),
});
export type RecommendationModerationInput = z.infer<typeof recommendationModerationSchema>;

/* ------------------------------------------------------------------ */
/* ISE-033 — Modifier ma disponibilite                                  */
/* ------------------------------------------------------------------ */

export const AVAILABILITY_CHANNELS = ['message', 'email', 'call', 'video'] as const;
export const availabilityChannelSchema = z.enum(AVAILABILITY_CHANNELS);
export type AvailabilityChannel = z.infer<typeof availabilityChannelSchema>;

/**
 * Reglage d'ensemble de la disponibilite : les types actives parmi les
 * 14 codes reels de `availability_types`, et les preferences de
 * sollicitation appliquees aux types actifs. La disponibilite declaree
 * ne vaut JAMAIS obligation d'accepter (MASTER PROMPT §20) : l'ecran le
 * rappelle, et aucune de ces valeurs n'engage le membre.
 */
export const availabilitySettingsSchema = z.object({
  activeTypes: z
    .array(z.string().trim().min(2).max(40))
    .max(14)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Chaque forme d’aide ne peut être activée qu’une seule fois.',
    }),
  maxPerMonth: z.number().int().min(1).max(60).optional(),
  idealDelayDays: z.number().int().min(1).max(365).optional(),
  preferredChannel: availabilityChannelSchema.optional(),
  visibility: visibilitySchema.default('members'),
  notes: z.string().trim().max(300).optional(),
});
export type AvailabilitySettingsInput = z.infer<typeof availabilitySettingsSchema>;
