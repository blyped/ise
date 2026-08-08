/**
 * Types de vue et conversions PURES de la tranche APPELS AU RESEAU
 * (ISE-047 -> ISE-054).
 *
 * Meme regle que `lib/network-view.ts` : tout ce qui est partage entre
 * le serveur et le navigateur vit ici et n'a AUCUNE dependance serveur.
 * Les acces base restent dans `lib/queries/calls.ts`, qui importe
 * `next/headers` et ne doit jamais partir dans le bundle client.
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

export type { Page, NetworkProfileCard };
export { asArray, asObject, bool, num, str, toProfileCard };

/* ------------------------------------------------------------------ */
/* Vocabulaire ferme, aligne sur les CHECK de la migration 0007        */
/* ------------------------------------------------------------------ */

export const CALL_TYPES = [
  'expert',
  'consultant',
  'job',
  'internship',
  'partner',
  'contact',
  'recommendation',
  'information',
  'skill',
  'speaker',
  'funding',
  'collaborators',
  'mentor',
  'consortium',
  'other',
] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const CALL_FAMILIES = [
  'find_person',
  'career',
  'collaboration',
  'information',
  'business',
  'other',
] as const;
export type CallFamily = (typeof CALL_FAMILIES)[number];

export const HELP_TYPES = [
  'direct_expert',
  'recommendation',
  'introduction',
  'advice',
  'information',
] as const;
export type HelpType = (typeof HELP_TYPES)[number];

export const RESPONSE_TYPES = [
  'direct',
  'knows_someone',
  'introduction',
  'information',
  'participate',
  'other',
] as const;
export type ResponseType = (typeof RESPONSE_TYPES)[number];

export const RESPONSE_STATUSES = [
  'new',
  'reviewed',
  'useful',
  'contacted',
  'selected',
  'archived',
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/** D-52 : la clotûre est ternaire. Un booleen ne peut pas la porter. */
export const RESOLUTIONS = ['resolved', 'partially_resolved', 'not_resolved'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const CLOSURE_RESULT_TYPES = [
  'expert_found',
  'consultant_found',
  'internship_found',
  'job_found',
  'introduction_made',
  'advice_received',
  'partner_found',
  'collaborator_found',
  'team_formed',
  'information_obtained',
  'funding_identified',
  'other',
] as const;
export type ClosureResultType = (typeof CLOSURE_RESULT_TYPES)[number];

export const CLOSURE_MISSING_REASONS = [
  'no_response',
  'irrelevant_profiles',
  'deadline_too_short',
  'need_changed',
  'other',
] as const;
export type ClosureMissingReason = (typeof CLOSURE_MISSING_REASONS)[number];

export const VISIBILITY_LEVELS = ['members', 'connections', 'promotion', 'private'] as const;
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

export type CallScope = 'for_me' | 'all' | 'promotion' | 'saved';
export type MyCallGroup = 'active' | 'resolved' | 'drafts' | 'expired';

const inList = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

export const toCallScope = (v: unknown): CallScope =>
  inList(['for_me', 'all', 'promotion', 'saved'] as const, v, 'for_me');
export const toMyCallGroup = (v: unknown): MyCallGroup =>
  inList(['active', 'resolved', 'drafts', 'expired'] as const, v, 'active');
export const toResolution = (v: unknown): Resolution | null =>
  typeof v === 'string' && (RESOLUTIONS as readonly string[]).includes(v)
    ? (v as Resolution)
    : null;

/* ------------------------------------------------------------------ */
/* Pertinence : LIBELLE et RAISONS, jamais un score (MASTER PROMPT §15) */
/* ------------------------------------------------------------------ */

export type RelevanceLabel = 'very_relevant' | 'relevant' | 'close_profile';

export interface MatchReason {
  criterion: string;
  label: string;
  evidence: string[];
}

export interface Relevance {
  label: RelevanceLabel | null;
  reasons: MatchReason[];
}

export function toRelevance(value: unknown): Relevance | null {
  const raw = asObject(value);
  if (Object.keys(raw).length === 0) return null;
  const label = str(raw['label']);
  return {
    label:
      label === 'very_relevant' || label === 'relevant' || label === 'close_profile' ? label : null,
    reasons: asArray(raw['reasons']).flatMap((entry) => {
      const item = asObject(entry);
      const criterion = str(item['criterion']);
      const text = str(item['label']);
      if (criterion === null || text === null) return [];
      return [
        {
          criterion,
          label: text,
          evidence: asArray(item['evidence']).filter((e): e is string => typeof e === 'string'),
        },
      ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Carte d'appel                                                       */
/* ------------------------------------------------------------------ */

export interface WeightedTag {
  name: string;
  importance: 'required' | 'preferred';
}

export interface CallCard {
  callId: string;
  callType: string;
  callFamily: string | null;
  title: string;
  excerpt: string;
  status: string;
  urgency: string;
  visibility: string;
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  closedAt: string | null;
  resolution: Resolution | null;
  isAuthor: boolean;
  isSaved: boolean;
  author: NetworkProfileCard | null;
  country: string | null;
  city: string | null;
  remoteAllowed: boolean;
  sector: string | null;
  skills: WeightedTag[];
  helpTypes: string[];
  responseCount: number;
  myResponseId: string | null;
  relevance: Relevance | null;
  /** Present uniquement dans « Mes appels ». */
  usefulResponseCount: number | null;
  recommendationCount: number | null;
  targetedCount: number | null;
}

function toWeightedTags(value: unknown): WeightedTag[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const name = str(item['name']);
    if (name === null) return [];
    const importance = str(item['importance']) === 'required' ? 'required' : 'preferred';
    return [{ name, importance } as WeightedTag];
  });
}

export function toCallCard(value: unknown): CallCard | null {
  const raw = asObject(value);
  const callId = str(raw['call_id']);
  if (callId === null) return null;

  return {
    callId,
    callType: str(raw['call_type']) ?? 'other',
    callFamily: str(raw['call_family']),
    title: str(raw['title']) ?? '',
    excerpt: str(raw['excerpt']) ?? '',
    status: str(raw['status']) ?? 'draft',
    urgency: str(raw['urgency']) ?? 'normal',
    visibility: str(raw['visibility']) ?? 'members',
    deadline: str(raw['deadline']),
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    closedAt: str(raw['closed_at']),
    resolution: toResolution(raw['resolution']),
    isAuthor: bool(raw['is_author']),
    isSaved: bool(raw['is_saved']),
    author: toProfileCard(raw['author']),
    country: str(raw['country']),
    city: str(raw['city']),
    remoteAllowed: bool(raw['remote_allowed']),
    sector: str(raw['sector']),
    skills: toWeightedTags(raw['skills']),
    helpTypes: asArray(raw['help_types']).filter((v): v is string => typeof v === 'string'),
    responseCount: num(raw['response_count']) ?? 0,
    myResponseId: str(raw['my_response_id']),
    relevance: toRelevance(raw['relevance']),
    usefulResponseCount: num(raw['useful_response_count']),
    recommendationCount: num(raw['recommendation_count']),
    targetedCount: num(raw['targeted_count']),
  };
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

export interface CallLanguage {
  name: string;
  minProficiency: string;
  importance: 'required' | 'preferred';
}

export interface CallCountry {
  name: string;
  scope: 'residence' | 'experience';
  importance: 'required' | 'preferred';
}

export interface CallDetail extends CallCard {
  description: string;
  context: string | null;
  wantedProfile: string | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  promotionYearFrom: number | null;
  promotionYearTo: number | null;
  closureResultType: string | null;
  closureMissingReason: string | null;
  closureNotes: string | null;
  impactTestimonial: string | null;
  tools: WeightedTag[];
  languages: CallLanguage[];
  countries: CallCountry[];
  audiencePromotions: string[];
  audienceProfileCount: number;
  myResponse: { responseId: string; responseType: string; createdAt: string | null } | null;
}

export function toCallDetail(value: unknown): CallDetail | null {
  const card = toCallCard(value);
  if (card === null) return null;
  const raw = asObject(value);
  const mine = asObject(raw['my_response']);
  const myResponseId = str(mine['response_id']);

  return {
    ...card,
    description: str(raw['description']) ?? '',
    context: str(raw['context']),
    wantedProfile: str(raw['wanted_profile']),
    minExperienceYears: num(raw['min_experience_years']),
    maxExperienceYears: num(raw['max_experience_years']),
    promotionYearFrom: num(raw['promotion_year_from']),
    promotionYearTo: num(raw['promotion_year_to']),
    closureResultType: str(raw['closure_result_type']),
    closureMissingReason: str(raw['closure_missing_reason']),
    closureNotes: str(raw['closure_notes']),
    impactTestimonial: str(raw['impact_testimonial']),
    tools: toWeightedTags(raw['tools']),
    languages: asArray(raw['languages']).flatMap((entry) => {
      const item = asObject(entry);
      const name = str(item['name']);
      if (name === null) return [];
      return [
        {
          name,
          minProficiency: str(item['min_proficiency']) ?? 'professional',
          importance: str(item['importance']) === 'required' ? 'required' : 'preferred',
        } as CallLanguage,
      ];
    }),
    countries: asArray(raw['countries']).flatMap((entry) => {
      const item = asObject(entry);
      const name = str(item['name']);
      if (name === null) return [];
      return [
        {
          name,
          scope: str(item['scope']) === 'residence' ? 'residence' : 'experience',
          importance: str(item['importance']) === 'required' ? 'required' : 'preferred',
        } as CallCountry,
      ];
    }),
    audiencePromotions: asArray(raw['audience_promotions']).filter(
      (v): v is string => typeof v === 'string',
    ),
    audienceProfileCount: num(raw['audience_profile_count']) ?? 0,
    myResponse:
      myResponseId === null
        ? null
        : {
            responseId: myResponseId,
            responseType: str(mine['response_type']) ?? 'direct',
            createdAt: str(mine['created_at']),
          },
  };
}

/* ------------------------------------------------------------------ */
/* Audience, suivi, reponses                                           */
/* ------------------------------------------------------------------ */

export interface AudiencePreview {
  computed: boolean;
  total: number;
  veryRelevant: number;
  relevant: number;
  closeProfile: number;
  priorityNotice: number;
  samples: { profile: NetworkProfileCard; relevance: Relevance | null }[];
}

export function toAudiencePreview(value: unknown): AudiencePreview {
  const raw = asObject(value);
  return {
    computed: bool(raw['computed']),
    total: num(raw['total']) ?? 0,
    veryRelevant: num(raw['very_relevant']) ?? 0,
    relevant: num(raw['relevant']) ?? 0,
    closeProfile: num(raw['close_profile']) ?? 0,
    priorityNotice: num(raw['priority_notice']) ?? 0,
    samples: asArray(raw['samples']).flatMap((entry) => {
      const item = asObject(entry);
      const profile = toProfileCard(item['profile']);
      if (profile === null) return [];
      return [
        {
          profile,
          relevance: toRelevance({ label: item['label'], reasons: item['reasons'] }),
        },
      ];
    }),
  };
}

export interface MatchedProfile {
  profile: NetworkProfileCard;
  relevance: Relevance | null;
}

export function toMatchedProfiles(value: unknown): MatchedProfile[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const profile = toProfileCard(item['profile']);
    if (profile === null) return [];
    return [
      { profile, relevance: toRelevance({ label: item['label'], reasons: item['reasons'] }) },
    ];
  });
}

export interface CallRecommendation {
  recommendationId: string;
  rationale: string | null;
  offersIntroduction: boolean;
  consentConfirmed: boolean;
  status: string;
  externalPersonName: string | null;
  externalPersonContext: string | null;
  profile: NetworkProfileCard | null;
}

export interface CallResponse {
  responseId: string;
  responseType: string;
  message: string | null;
  sharesContact: boolean;
  status: ResponseStatus;
  createdAt: string | null;
  author: NetworkProfileCard | null;
  relevance: Relevance | null;
  recommendations: CallRecommendation[];
}

export function toCallResponse(value: unknown): CallResponse | null {
  const raw = asObject(value);
  const responseId = str(raw['response_id']);
  if (responseId === null) return null;
  const status = str(raw['status']);
  return {
    responseId,
    responseType: str(raw['response_type']) ?? 'direct',
    message: str(raw['message']),
    sharesContact: bool(raw['shares_contact']),
    status:
      status !== null && (RESPONSE_STATUSES as readonly string[]).includes(status)
        ? (status as ResponseStatus)
        : 'new',
    createdAt: str(raw['created_at']),
    author: toProfileCard(raw['author']),
    relevance: toRelevance(raw['relevance']),
    recommendations: asArray(raw['recommendations']).flatMap((entry) => {
      const item = asObject(entry);
      const id = str(item['recommendation_id']);
      if (id === null) return [];
      return [
        {
          recommendationId: id,
          rationale: str(item['rationale']),
          offersIntroduction: bool(item['offers_introduction']),
          consentConfirmed: bool(item['consent_confirmed']),
          status: str(item['status']) ?? 'proposed',
          externalPersonName: str(item['external_person_name']),
          externalPersonContext: str(item['external_person_context']),
          profile: toProfileCard(item['profile']),
        },
      ];
    }),
  };
}

export interface CallTracking extends CallDetail {
  targeted: number;
  responses: number;
  useful: number;
  recommendations: number;
  introductions: number;
  firstResponseAt: string | null;
  byStatus: Record<string, number>;
  events: {
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string | null;
  }[];
}

export function toCallTracking(value: unknown): CallTracking | null {
  const detail = toCallDetail(value);
  if (detail === null) return null;
  const raw = asObject(value);
  const byStatusRaw = asObject(raw['by_status']);
  const byStatus: Record<string, number> = {};
  for (const [key, entry] of Object.entries(byStatusRaw)) {
    const count = num(entry);
    if (count !== null) byStatus[key] = count;
  }
  return {
    ...detail,
    targeted: num(raw['targeted']) ?? 0,
    responses: num(raw['responses']) ?? 0,
    useful: num(raw['useful']) ?? 0,
    recommendations: num(raw['recommendations']) ?? 0,
    introductions: num(raw['introductions']) ?? 0,
    firstResponseAt: str(raw['first_response_at']),
    byStatus,
    events: asArray(raw['events']).flatMap((entry) => {
      const item = asObject(entry);
      const eventType = str(item['event_type']);
      if (eventType === null) return [];
      return [
        {
          eventType,
          fromStatus: str(item['from_status']),
          toStatus: str(item['to_status']),
          createdAt: str(item['created_at']),
        },
      ];
    }),
  };
}

export interface Respondent {
  profileId: string;
  profile: NetworkProfileCard | null;
  responseType: string;
  status: string;
}

export function toRespondents(value: unknown): Respondent[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const profileId = str(item['profile_id']);
    if (profileId === null) return [];
    return [
      {
        profileId,
        profile: toProfileCard(item['profile']),
        responseType: str(item['response_type']) ?? 'direct',
        status: str(item['status']) ?? 'new',
      },
    ];
  });
}
