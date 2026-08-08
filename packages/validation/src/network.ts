import { z } from 'zod';
import { limits } from '@ise/config';

/** ISE-038 — Demande de connexion */
export const connectionRequestSchema = z.object({
  addresseeProfileId: z.string().uuid(),
  message: z.string().trim().max(limits.text.connectionMessageMax).optional(),
  context: z
    .enum([
      'promotion',
      'organization',
      'sector',
      'event',
      'project',
      'network_call',
      'opportunity',
      'introduction',
      'other',
    ])
    .optional(),
});
export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;

/**
 * ISE-041 / ISE-042 — Reponse a une invitation recue.
 *
 * Deux valeurs seulement. « Ignorer » n'y figure pas : ignorer une
 * invitation n'ecrit rien en base, la demande reste `pending` jusqu'a son
 * expiration (D-55 — aucun statut ne se pose sur un fait non constate).
 * L'acceptation ne passe pas par ce schema : elle appelle
 * `public.accept_connection_request()`, qui cree la relation dans la meme
 * transaction.
 */
export const connectionResponseSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['declined', 'withdrawn']),
});
export type ConnectionResponseInput = z.infer<typeof connectionResponseSchema>;

/** ISE-044 — Demander une introduction */
export const introductionRequestSchema = z.object({
  intermediaryProfileId: z.string().uuid(),
  targetProfileId: z.string().uuid(),
  purpose: z.enum([
    'advice',
    'expertise',
    'opportunity',
    'consortium',
    'mentorship',
    'partnership',
    'other',
  ]),
  messageToIntermediary: z
    .string()
    .trim()
    .min(20, 'Expliquez en quelques mots pourquoi vous sollicitez cette introduction.')
    .max(limits.text.introductionMessageMax),
  messageToTarget: z.string().trim().max(limits.text.introductionMessageMax).optional(),
});
export type IntroductionRequestInput = z.infer<typeof introductionRequestSchema>;

/**
 * ISE-046 — Bilan d'une introduction.
 *
 * Les valeurs sont celles de `introduction_requests.outcome`
 * (migrations 0006 et 0039). Elles decrivent un FAIT CONSTATE et rien
 * d'autre : aucune ne signifie « introduction reussie », et la base
 * refuse toute declaration d'echange tant que `target_responded` n'a pas
 * ete constate (MASTER PROMPT §25, D-55).
 */
export const INTRODUCTION_OUTCOMES = [
  'exchange_held',
  'collaboration_considered',
  'collaboration_confirmed',
  'referred_to_other_contact',
  'no_response',
  'not_relevant',
] as const;

export const introductionOutcomeSchema = z.object({
  introductionId: z.string().uuid(),
  outcome: z.enum(INTRODUCTION_OUTCOMES),
  note: z.string().trim().max(limits.text.introductionMessageMax).optional(),
});
export type IntroductionOutcomeInput = z.infer<typeof introductionOutcomeSchema>;
export type IntroductionOutcome = (typeof INTRODUCTION_OUTCOMES)[number];

/**
 * ISE-045 — Transition d'une introduction declenchee depuis l'interface.
 * Les statuts terminaux `completed` et `no_outcome` en sont exclus : ils
 * exigent une declaration de resultat et passent par
 * `introductionOutcomeSchema`.
 */
export const introductionTransitionSchema = z.object({
  introductionId: z.string().uuid(),
  toStatus: z.enum([
    'intermediary_accepted',
    'intermediary_declined',
    'withdrawn',
    'introduced',
    'target_responded',
  ]),
  note: z.string().trim().max(600).optional(),
});
export type IntroductionTransitionInput = z.infer<typeof introductionTransitionSchema>;

/** ISE-034 / ISE-035 — Recherche */
export const searchCriteriaSchema = z.object({
  query: z.string().trim().max(200).optional(),
  skillIds: z.array(z.number().int().positive()).max(10).default([]),
  sectorIds: z.array(z.number().int().positive()).max(10).default([]),
  jobFunctionIds: z.array(z.number().int().positive()).max(10).default([]),
  countryCodes: z.array(z.string().length(2)).max(10).default([]),
  subregionCodes: z.array(z.string()).max(10).default([]),
  promotionIds: z.array(z.number().int().positive()).max(20).default([]),
  languageCodes: z.array(z.string()).max(8).default([]),
  availabilityTypes: z.array(z.string()).max(14).default([]),
  minYearsOfExperience: z.number().int().min(0).max(60).optional(),
  /** Pagination par curseur (D-44) : jamais d'offset sur l'annuaire. */
  cursor: z.string().optional(),
  pageSize: z.number().int().min(1).max(limits.pageSize.max).default(limits.pageSize.web),
});
export type SearchCriteriaInput = z.infer<typeof searchCriteriaSchema>;
