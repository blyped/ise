/**
 * Types de vue et conversions PURES de la tranche OPPORTUNITES
 * (ISE-055 -> ISE-066).
 *
 * Aucune dependance serveur : ce module est importable par un composant
 * client. Les acces base vivent dans `lib/queries/opportunities.ts`.
 */
import {
  asArray,
  asObject,
  bool,
  num,
  str,
  toProfileCard,
  type NetworkProfileCard,
  type Page,
} from '@/lib/network-view';
import { toRelevance, type Relevance, type WeightedTag } from '@/lib/calls-view';
import { parseMedia, type LandingMedia } from '@/lib/public/landing-data';

export type { Page, NetworkProfileCard, Relevance, WeightedTag };

/* ------------------------------------------------------------------ */
/* Vocabulaire ferme, aligne sur les CHECK de la migration 0008        */
/* ------------------------------------------------------------------ */

export const OPPORTUNITY_TYPES = [
  'job',
  'internship',
  'mission',
  'business',
  'research',
  'scholarship',
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

/** Perimetre MVP (D27 §1) : emplois, stages, missions. */
export const MVP_OPPORTUNITY_TYPES = ['job', 'internship', 'mission'] as const;

export const APPLICATION_MODES = [
  'internal',
  'external_url',
  'external_email',
  'contact_recruiter',
] as const;
export type ApplicationMode = (typeof APPLICATION_MODES)[number];

export const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'viewed',
  'under_review',
  'interview',
  'selected',
  'not_selected',
  'withdrawn',
  'closed',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const OUTCOME_TYPES = [
  'ise_hired',
  'mission_awarded',
  'intern_selected',
  'multiple_selected',
  'no_selection',
  'external_hire',
  'cancelled',
  'other',
] as const;
export type OutcomeType = (typeof OUTCOME_TYPES)[number];

/** Les quatre resultats qui autorisent une attribution d'impact (0008). */
export const HIRING_OUTCOME_TYPES: readonly OutcomeType[] = [
  'ise_hired',
  'mission_awarded',
  'intern_selected',
  'multiple_selected',
];

export const ATTRIBUTION_LEVELS = ['direct', 'partial', 'self_reported', 'unknown'] as const;
export type AttributionLevel = (typeof ATTRIBUTION_LEVELS)[number];

export type OpportunityScope = 'for_you' | 'all' | 'saved';
export type MyOpportunityGroup = 'active' | 'drafts' | 'closed' | 'expired';
export type MyApplicationGroup = 'in_progress' | 'finished' | 'withdrawn' | 'drafts';

const inList = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

export const toOpportunityScope = (v: unknown): OpportunityScope =>
  inList(['for_you', 'all', 'saved'] as const, v, 'for_you');
export const toMyOpportunityGroup = (v: unknown): MyOpportunityGroup =>
  inList(['active', 'drafts', 'closed', 'expired'] as const, v, 'active');
export const toMyApplicationGroup = (v: unknown): MyApplicationGroup =>
  inList(['in_progress', 'finished', 'withdrawn', 'drafts'] as const, v, 'in_progress');
export const toOpportunityType = (v: unknown): OpportunityType | null =>
  typeof v === 'string' && (OPPORTUNITY_TYPES as readonly string[]).includes(v)
    ? (v as OpportunityType)
    : null;

/* ------------------------------------------------------------------ */
/* Carte d'opportunite                                                 */
/* ------------------------------------------------------------------ */

export interface MyApplicationSummary {
  applicationId: string;
  status: ApplicationStatus;
  channel: 'platform' | 'external';
  isSelfDeclared: boolean;
  submittedAt: string | null;
}

export interface OpportunityCard {
  opportunityId: string;
  opportunityType: string;
  contractType: string | null;
  title: string;
  summary: string | null;
  status: string;
  moderationStatus: string;
  visibility: string;
  origin: 'internal' | 'external';
  sourceType: string;
  sourceVerified: boolean;
  organization: string | null;
  country: string | null;
  city: string | null;
  remoteMode: string | null;
  remoteAllowed: boolean;
  sector: string | null;
  jobFunction: string | null;
  experienceLevel: string | null;
  minExperienceYears: number | null;
  suitableForNewGraduates: boolean;
  startDate: string | null;
  durationDays: number | null;
  deadline: string | null;
  positionsCount: number;
  publishedAt: string | null;
  createdAt: string | null;
  closedAt: string | null;
  applicationMode: ApplicationMode;
  /** D-55 : seul `internal` permet a la plateforme de constater le resultat. */
  canApplyInternally: boolean;
  isManager: boolean;
  isSaved: boolean;
  /**
   * 0113 / D-166 — visuel editorial de l'offre, resolu dans la mediatheque
   * PUBLIQUE (`landing-media`) par `opportunities.cover_media_id`.
   *
   * C'est le MEME media que celui de l'encart d'accueil : une seule image
   * televersee et decrite dans /cms/opportunites, reutilisee sur la carte
   * et sur la page de l'offre. Les resolutions du mobile sont produites a
   * la volee par `next/image`, jamais par un second fichier (D-172).
   *
   * Distinct de tout logo d'organisation. `null` si aucun visuel n'est
   * choisi ou si le media n'est plus publiable (bucket public + alternative
   * textuelle) : la page s'affiche alors sans visuel, jamais avec un cadre
   * vide ni une image cassee.
   */
  cover: LandingMedia | null;
  author: NetworkProfileCard | null;
  contact: NetworkProfileCard | null;
  skills: WeightedTag[];
  relevance: Relevance | null;
  myApplication: MyApplicationSummary | null;
  /** Absents quand la remuneration n'est pas divulguee (D27 §32). */
  compensationMin: number | null;
  compensationMax: number | null;
  currency: string | null;
  externalApplicationUrl: string | null;
  externalApplicationEmail: string | null;
  /** Presents uniquement dans « Mes offres ». */
  applicationCount: number | null;
  targetedCount: number | null;
  strongMatchCount: number | null;
}

function toWeightedTags(value: unknown): WeightedTag[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const name = str(item['name']);
    if (name === null) return [];
    return [
      {
        name,
        importance: str(item['importance']) === 'required' ? 'required' : 'preferred',
      } as WeightedTag,
    ];
  });
}

export function toApplicationStatus(value: unknown): ApplicationStatus {
  return inList(APPLICATION_STATUSES, value, 'draft');
}

function toMyApplication(value: unknown): MyApplicationSummary | null {
  const raw = asObject(value);
  const id = str(raw['application_id']);
  if (id === null) return null;
  return {
    applicationId: id,
    status: toApplicationStatus(raw['status']),
    channel: str(raw['channel']) === 'external' ? 'external' : 'platform',
    isSelfDeclared: bool(raw['is_self_declared']),
    submittedAt: str(raw['submitted_at']),
  };
}

export function toOpportunityCard(value: unknown): OpportunityCard | null {
  const raw = asObject(value);
  const opportunityId = str(raw['opportunity_id']);
  if (opportunityId === null) return null;

  return {
    opportunityId,
    opportunityType: str(raw['opportunity_type']) ?? 'job',
    contractType: str(raw['contract_type']),
    title: str(raw['title']) ?? '',
    summary: str(raw['summary']),
    status: str(raw['status']) ?? 'draft',
    moderationStatus: str(raw['moderation_status']) ?? 'not_required',
    visibility: str(raw['visibility']) ?? 'members',
    origin: str(raw['origin']) === 'external' ? 'external' : 'internal',
    sourceType: str(raw['source_type']) ?? 'ise_member',
    sourceVerified: bool(raw['source_verified']),
    organization: str(raw['organization']),
    country: str(raw['country']),
    city: str(raw['city']),
    remoteMode: str(raw['remote_mode']),
    remoteAllowed: bool(raw['remote_allowed']),
    sector: str(raw['sector']),
    jobFunction: str(raw['job_function']),
    experienceLevel: str(raw['experience_level']),
    minExperienceYears: num(raw['min_experience_years']),
    suitableForNewGraduates: bool(raw['suitable_for_new_graduates']),
    startDate: str(raw['start_date']),
    durationDays: num(raw['duration_days']),
    deadline: str(raw['deadline']),
    positionsCount: num(raw['positions_count']) ?? 1,
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    closedAt: str(raw['closed_at']),
    applicationMode: inList(APPLICATION_MODES, raw['application_mode'], 'internal'),
    canApplyInternally: bool(raw['can_apply_internally']),
    isManager: bool(raw['is_manager']),
    isSaved: bool(raw['is_saved']),
    cover: parseMedia(raw['cover']),
    author: toProfileCard(raw['author']),
    contact: toProfileCard(raw['contact']),
    skills: toWeightedTags(raw['skills']),
    relevance: toRelevance(raw['relevance']),
    myApplication: toMyApplication(raw['my_application']),
    compensationMin: num(raw['compensation_min']),
    compensationMax: num(raw['compensation_max']),
    currency: str(raw['currency']),
    externalApplicationUrl: str(raw['external_application_url']),
    externalApplicationEmail: str(raw['external_application_email']),
    applicationCount: num(raw['application_count']),
    targetedCount: num(raw['targeted_count']),
    strongMatchCount: num(raw['strong_match_count']),
  };
}

export interface OpportunityQuestion {
  questionId: string;
  question: string;
  isRequired: boolean;
}

export interface OpportunityOutcome {
  outcomeType: string;
  hiresCount: number;
  facilitatedByPlatform: boolean;
  attributionLevel: string;
  notes: string | null;
}

export interface OpportunityDetail extends OpportunityCard {
  description: string;
  sourceUrl: string | null;
  tools: WeightedTag[];
  languages: { name: string; minProficiency: string; importance: 'required' | 'preferred' }[];
  countries: {
    name: string;
    scope: 'residence' | 'experience';
    importance: 'required' | 'preferred';
  }[];
  questions: OpportunityQuestion[];
  audiencePromotions: string[];
  outcome: OpportunityOutcome | null;
}

export function toOpportunityDetail(value: unknown): OpportunityDetail | null {
  const card = toOpportunityCard(value);
  if (card === null) return null;
  const raw = asObject(value);
  const outcomeRaw = asObject(raw['outcome']);
  const outcomeType = str(outcomeRaw['outcome_type']);

  return {
    ...card,
    description: str(raw['description']) ?? '',
    sourceUrl: str(raw['source_url']),
    tools: toWeightedTags(raw['tools']),
    languages: asArray(raw['languages']).flatMap((entry) => {
      const item = asObject(entry);
      const name = str(item['name']);
      if (name === null) return [];
      return [
        {
          name,
          minProficiency: str(item['min_proficiency']) ?? 'professional',
          importance: (str(item['importance']) === 'required' ? 'required' : 'preferred') as
            'required' | 'preferred',
        },
      ];
    }),
    countries: asArray(raw['countries']).flatMap((entry) => {
      const item = asObject(entry);
      const name = str(item['name']);
      if (name === null) return [];
      return [
        {
          name,
          scope: (str(item['scope']) === 'residence' ? 'residence' : 'experience') as
            'residence' | 'experience',
          importance: (str(item['importance']) === 'required' ? 'required' : 'preferred') as
            'required' | 'preferred',
        },
      ];
    }),
    questions: asArray(raw['questions']).flatMap((entry) => {
      const item = asObject(entry);
      const id = str(item['question_id']);
      const question = str(item['question']);
      if (id === null || question === null) return [];
      return [{ questionId: id, question, isRequired: bool(item['is_required']) }];
    }),
    audiencePromotions: asArray(raw['audience_promotions']).filter(
      (v): v is string => typeof v === 'string',
    ),
    outcome:
      outcomeType === null
        ? null
        : {
            outcomeType,
            hiresCount: num(outcomeRaw['hires_count']) ?? 0,
            facilitatedByPlatform: bool(outcomeRaw['facilitated_by_platform']),
            attributionLevel: str(outcomeRaw['attribution_level']) ?? 'unknown',
            notes: str(outcomeRaw['notes']),
          },
  };
}

/* ------------------------------------------------------------------ */
/* Candidatures                                                        */
/* ------------------------------------------------------------------ */

export interface ApplicationRow {
  applicationId: string;
  status: ApplicationStatus;
  channel: 'platform' | 'external';
  isSelfDeclared: boolean;
  submittedAt: string | null;
  declaredAt: string | null;
  decidedAt: string | null;
  opportunity: OpportunityCard | null;
}

export function toApplicationRow(value: unknown): ApplicationRow | null {
  const raw = asObject(value);
  const id = str(raw['application_id']);
  if (id === null) return null;
  return {
    applicationId: id,
    status: toApplicationStatus(raw['status']),
    channel: str(raw['channel']) === 'external' ? 'external' : 'platform',
    isSelfDeclared: bool(raw['is_self_declared']),
    submittedAt: str(raw['submitted_at']),
    declaredAt: str(raw['declared_at']),
    decidedAt: str(raw['decided_at']),
    opportunity: toOpportunityCard(raw['opportunity']),
  };
}

export interface ApplicationDetail {
  applicationId: string;
  status: ApplicationStatus;
  channel: 'platform' | 'external';
  isSelfDeclared: boolean;
  /** D-55 : les etapes sont DECLAREES par le membre, pas constatees. */
  stepsAreSelfDeclared: boolean;
  isApplicant: boolean;
  isManager: boolean;
  message: string | null;
  submittedAt: string | null;
  declaredAt: string | null;
  viewedAt: string | null;
  reviewedAt: string | null;
  decidedAt: string | null;
  withdrawnAt: string | null;
  opportunity: OpportunityCard | null;
  applicant: NetworkProfileCard | null;
  documents: { documentId: string; role: string; title: string | null; filename: string }[];
  answers: { question: string; answer: string }[];
  timeline: {
    fromStatus: string | null;
    toStatus: string;
    actorKind: string;
    note: string | null;
    createdAt: string | null;
  }[];
  /** Calcule EN BASE : l'ecran n'affiche jamais un bouton sans transition. */
  allowedTransitions: ApplicationStatus[];
}

export function toApplicationDetail(value: unknown): ApplicationDetail | null {
  const raw = asObject(value);
  const id = str(raw['application_id']);
  if (id === null) return null;

  return {
    applicationId: id,
    status: toApplicationStatus(raw['status']),
    channel: str(raw['channel']) === 'external' ? 'external' : 'platform',
    isSelfDeclared: bool(raw['is_self_declared']),
    stepsAreSelfDeclared: bool(raw['steps_are_self_declared']),
    isApplicant: bool(raw['is_applicant']),
    isManager: bool(raw['is_manager']),
    message: str(raw['message']),
    submittedAt: str(raw['submitted_at']),
    declaredAt: str(raw['declared_at']),
    viewedAt: str(raw['viewed_at']),
    reviewedAt: str(raw['reviewed_at']),
    decidedAt: str(raw['decided_at']),
    withdrawnAt: str(raw['withdrawn_at']),
    opportunity: toOpportunityCard(raw['opportunity']),
    applicant: toProfileCard(raw['applicant']),
    documents: asArray(raw['documents']).flatMap((entry) => {
      const item = asObject(entry);
      const documentId = str(item['document_id']);
      const filename = str(item['filename']);
      if (documentId === null || filename === null) return [];
      return [
        { documentId, role: str(item['role']) ?? 'other', title: str(item['title']), filename },
      ];
    }),
    answers: asArray(raw['answers']).flatMap((entry) => {
      const item = asObject(entry);
      const question = str(item['question']);
      const answer = str(item['answer']);
      return question !== null && answer !== null ? [{ question, answer }] : [];
    }),
    timeline: asArray(raw['timeline']).flatMap((entry) => {
      const item = asObject(entry);
      const toStatus = str(item['to_status']);
      if (toStatus === null) return [];
      return [
        {
          fromStatus: str(item['from_status']),
          toStatus,
          actorKind: str(item['actor_kind']) ?? 'system',
          note: str(item['note']),
          createdAt: str(item['created_at']),
        },
      ];
    }),
    allowedTransitions: asArray(raw['allowed_transitions']).flatMap((entry) =>
      typeof entry === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(entry)
        ? [entry as ApplicationStatus]
        : [],
    ),
  };
}

export interface ReceivedApplication {
  applicationId: string;
  status: ApplicationStatus;
  channel: 'platform' | 'external';
  isSelfDeclared: boolean;
  message: string | null;
  submittedAt: string | null;
  hasCv: boolean;
  applicant: NetworkProfileCard | null;
  relevance: Relevance | null;
  missing: string[];
}

export function toReceivedApplication(value: unknown): ReceivedApplication | null {
  const raw = asObject(value);
  const id = str(raw['application_id']);
  if (id === null) return null;
  const relevanceRaw = asObject(raw['relevance']);
  return {
    applicationId: id,
    status: toApplicationStatus(raw['status']),
    channel: str(raw['channel']) === 'external' ? 'external' : 'platform',
    isSelfDeclared: bool(raw['is_self_declared']),
    message: str(raw['message']),
    submittedAt: str(raw['submitted_at']),
    hasCv: bool(raw['has_cv']),
    applicant: toProfileCard(raw['applicant']),
    relevance: toRelevance(relevanceRaw),
    missing: asArray(relevanceRaw['missing']).flatMap((entry) => {
      const criterion = str(asObject(entry)['criterion']);
      return criterion === null ? [] : [criterion];
    }),
  };
}

export interface ProfileDocument {
  documentId: string;
  documentType: string;
  title: string | null;
  filename: string;
  isPrimary: boolean;
}

export function toProfileDocuments(value: unknown): ProfileDocument[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const documentId = str(item['document_id']);
    const filename = str(item['filename']);
    if (documentId === null || filename === null) return [];
    return [
      {
        documentId,
        documentType: str(item['document_type']) ?? 'other',
        title: str(item['title']),
        filename,
        isPrimary: bool(item['is_primary']),
      },
    ];
  });
}

export interface CandidateOption {
  profileId: string;
  profile: NetworkProfileCard | null;
  status: ApplicationStatus;
  channel: 'platform' | 'external';
}

export function toCandidateOptions(value: unknown): CandidateOption[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const profileId = str(item['profile_id']);
    if (profileId === null) return [];
    return [
      {
        profileId,
        profile: toProfileCard(item['profile']),
        status: toApplicationStatus(item['status']),
        channel: str(item['channel']) === 'external' ? 'external' : 'platform',
      },
    ];
  });
}

/** Resultat de `record_opportunity_outbound_click` (MASTER PROMPT §27). */
export interface OutboundClick {
  opportunityId: string;
  applicationMode: ApplicationMode;
  url: string | null;
  email: string | null;
  /** Toujours `false` : un clic n'est jamais une candidature (D-55). */
  isApplication: boolean;
}

export function toOutboundClick(value: unknown): OutboundClick | null {
  const raw = asObject(value);
  const opportunityId = str(raw['opportunity_id']);
  if (opportunityId === null) return null;
  return {
    opportunityId,
    applicationMode: inList(APPLICATION_MODES, raw['application_mode'], 'external_url'),
    url: str(raw['url']),
    email: str(raw['email']),
    isApplication: bool(raw['is_application']),
  };
}
