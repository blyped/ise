import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-047 -> ISE-054 — Appels au reseau (coquille mobile).
 *
 * Portage direct des RPC utilisees par `apps/web/src/lib/queries/calls.ts` :
 * `list_network_calls`, `get_network_call`, `toggle_saved_network_call`,
 * `save_network_call_draft`, `preview_network_call_audience`,
 * `publish_network_call_with_audience`, `get_network_call_tracking`,
 * `list_network_call_responses`, `set_network_call_response_status`,
 * `transition_network_call`, `list_my_network_calls`,
 * `list_network_call_respondents`, `close_network_call` et
 * `respond_to_network_call`. AUCUNE de ces fonctions ne recompose une carte
 * ou un score cote client (MASTER PROMPT §47) : la base reste la seule
 * source du libelle de pertinence et de ses raisons.
 *
 * D-52 : la cloture est TERNAIRE (`resolved` / `partially_resolved` /
 * `not_resolved`) — jamais un booleen. `RESOLUTIONS` en est le seul
 * vocabulaire ferme.
 *
 * Reduction de perimetre assumee pour cette premiere tranche mobile
 * (meme logique que `queries/network.ts` et `queries/opportunities.ts`) :
 *  - pas de filtres avances (type, secteur, pays, urgence) sur la liste,
 *    seulement les onglets de portee et une recherche texte ;
 *  - l'etape « Profil recherche » du wizard ne couvre que competences,
 *    secteur, pays principal et experience minimale — outils et langues
 *    restent une extension future ;
 *  - repondre a un appel se fait en ligne sur l'ecran de detail (pas de
 *    route dediee), conformement a la note mobile de la specification
 *    (« bottom sheet possible pour reponse rapide »).
 */

/* ------------------------------------------------------------------ */
/* Vocabulaire ferme (aligne sur les CHECK de la migration 0007)       */
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

/** D-52 : la cloture est ternaire. Un booleen ne peut pas la porter. */
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

/* ------------------------------------------------------------------ */
/* Aides JSON — copie du style de queries/network.ts et queries/opportunities.ts */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const bool = (value: unknown): boolean => value === true;

const inList = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null;

/* ------------------------------------------------------------------ */
/* Profil, pertinence                                                  */
/* ------------------------------------------------------------------ */

export interface NetworkProfileCard {
  readonly profileId: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly currentPosition: string | null;
  readonly currentOrganization: string | null;
  readonly currentCity: string | null;
  readonly currentCountry: string | null;
  readonly promotionLabel: string | null;
}

function toProfileCard(value: unknown): NetworkProfileCard | null {
  const raw = asObject(value);
  const profileId = str(raw['profile_id']);
  if (profileId === null) return null;
  const promotion = asObject(raw['promotion']);

  return {
    profileId,
    displayName: str(raw['display_name']) ?? '',
    headline: str(raw['headline']),
    currentPosition: str(raw['current_position']),
    currentOrganization: str(raw['current_organization']),
    currentCity: str(raw['current_city']),
    currentCountry: str(raw['current_country']),
    promotionLabel: str(promotion['label']),
  };
}

export type RelevanceLabel = 'very_relevant' | 'relevant' | 'close_profile';

export interface MatchReason {
  readonly criterion: string;
  readonly label: string;
  readonly evidence: readonly string[];
}

export interface Relevance {
  readonly label: RelevanceLabel | null;
  readonly reasons: readonly MatchReason[];
}

function toRelevance(value: unknown): Relevance | null {
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

export interface WeightedTag {
  readonly name: string;
  readonly importance: 'required' | 'preferred';
}

function toWeightedTags(value: unknown): WeightedTag[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const name = str(item['name']);
    if (name === null) return [];
    return [{ name, importance: str(item['importance']) === 'required' ? 'required' : 'preferred' }];
  });
}

/* ------------------------------------------------------------------ */
/* Carte et detail d'appel                                             */
/* ------------------------------------------------------------------ */

export interface NetworkCallCard {
  readonly callId: string;
  readonly callType: string;
  readonly title: string;
  readonly excerpt: string;
  readonly status: string;
  readonly urgency: string;
  readonly visibility: string;
  readonly deadline: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string | null;
  readonly resolution: Resolution | null;
  readonly isAuthor: boolean;
  readonly isSaved: boolean;
  readonly author: NetworkProfileCard | null;
  readonly country: string | null;
  readonly sector: string | null;
  readonly skills: readonly WeightedTag[];
  readonly helpTypes: readonly string[];
  readonly responseCount: number;
  readonly myResponseId: string | null;
  readonly relevance: Relevance | null;
  readonly targetedCount: number | null;
}

function toCallCard(value: unknown): NetworkCallCard | null {
  const raw = asObject(value);
  const callId = str(raw['call_id']);
  if (callId === null) return null;

  return {
    callId,
    callType: str(raw['call_type']) ?? 'other',
    title: str(raw['title']) ?? '',
    excerpt: str(raw['excerpt']) ?? '',
    status: str(raw['status']) ?? 'draft',
    urgency: str(raw['urgency']) ?? 'normal',
    visibility: str(raw['visibility']) ?? 'members',
    deadline: str(raw['deadline']),
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    resolution: inList(RESOLUTIONS, raw['resolution']),
    isAuthor: bool(raw['is_author']),
    isSaved: bool(raw['is_saved']),
    author: toProfileCard(raw['author']),
    country: str(raw['country']),
    sector: str(raw['sector']),
    skills: toWeightedTags(raw['skills']),
    helpTypes: asArray(raw['help_types']).filter((v): v is string => typeof v === 'string'),
    responseCount: num(raw['response_count']) ?? 0,
    myResponseId: str(raw['my_response_id']),
    relevance: toRelevance(raw['relevance']),
    targetedCount: num(raw['targeted_count']),
  };
}

export interface NetworkCallDetail extends NetworkCallCard {
  readonly description: string;
  readonly context: string | null;
  readonly wantedProfile: string | null;
  readonly minExperienceYears: number | null;
  readonly promotionYearFrom: number | null;
  readonly promotionYearTo: number | null;
  readonly closureResultType: string | null;
  readonly closureMissingReason: string | null;
  readonly closureNotes: string | null;
  readonly impactTestimonial: string | null;
  readonly audiencePromotions: readonly string[];
  readonly audienceProfileCount: number;
  readonly myResponse: { responseId: string; responseType: string; createdAt: string | null } | null;
}

function toCallDetail(value: unknown): NetworkCallDetail | null {
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
    promotionYearFrom: num(raw['promotion_year_from']),
    promotionYearTo: num(raw['promotion_year_to']),
    closureResultType: str(raw['closure_result_type']),
    closureMissingReason: str(raw['closure_missing_reason']),
    closureNotes: str(raw['closure_notes']),
    impactTestimonial: str(raw['impact_testimonial']),
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

export interface NetworkCallTracking extends NetworkCallDetail {
  readonly targeted: number;
  readonly responses: number;
  readonly useful: number;
  readonly recommendations: number;
  readonly introductions: number;
  readonly firstResponseAt: string | null;
  readonly events: readonly {
    eventType: string;
    toStatus: string | null;
    createdAt: string | null;
  }[];
}

function toCallTracking(value: unknown): NetworkCallTracking | null {
  const detail = toCallDetail(value);
  if (detail === null) return null;
  const raw = asObject(value);
  return {
    ...detail,
    targeted: num(raw['targeted']) ?? 0,
    responses: num(raw['responses']) ?? 0,
    useful: num(raw['useful']) ?? 0,
    recommendations: num(raw['recommendations']) ?? 0,
    introductions: num(raw['introductions']) ?? 0,
    firstResponseAt: str(raw['first_response_at']),
    events: asArray(raw['events']).flatMap((entry) => {
      const item = asObject(entry);
      const eventType = str(item['event_type']);
      if (eventType === null) return [];
      return [{ eventType, toStatus: str(item['to_status']), createdAt: str(item['created_at']) }];
    }),
  };
}

export interface CallRecommendation {
  readonly recommendationId: string;
  readonly rationale: string | null;
  readonly offersIntroduction: boolean;
  readonly consentConfirmed: boolean;
  readonly externalPersonName: string | null;
  readonly profile: NetworkProfileCard | null;
}

export interface NetworkCallResponse {
  readonly responseId: string;
  readonly responseType: string;
  readonly message: string | null;
  readonly sharesContact: boolean;
  readonly status: ResponseStatus;
  readonly createdAt: string | null;
  readonly author: NetworkProfileCard | null;
  readonly relevance: Relevance | null;
  readonly recommendations: readonly CallRecommendation[];
}

function toCallResponse(value: unknown): NetworkCallResponse | null {
  const raw = asObject(value);
  const responseId = str(raw['response_id']);
  if (responseId === null) return null;
  return {
    responseId,
    responseType: str(raw['response_type']) ?? 'direct',
    message: str(raw['message']),
    sharesContact: bool(raw['shares_contact']),
    status: inList(RESPONSE_STATUSES, raw['status']) ?? 'new',
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
          externalPersonName: str(item['external_person_name']),
          profile: toProfileCard(item['profile']),
        },
      ];
    }),
  };
}

export interface Respondent {
  readonly profileId: string;
  readonly profile: NetworkProfileCard | null;
  readonly responseType: string;
  readonly status: string;
}

function toRespondents(value: unknown): Respondent[] {
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

export interface AudiencePreview {
  readonly computed: boolean;
  readonly total: number;
  readonly veryRelevant: number;
  readonly relevant: number;
  readonly closeProfile: number;
}

function toAudiencePreview(value: unknown): AudiencePreview {
  const raw = asObject(value);
  return {
    computed: bool(raw['computed']),
    total: num(raw['total']) ?? 0,
    veryRelevant: num(raw['very_relevant']) ?? 0,
    relevant: num(raw['relevant']) ?? 0,
    closeProfile: num(raw['close_profile']) ?? 0,
  };
}

export interface Page<T> {
  readonly rows: readonly T[];
  /** `null` = fin de liste. */
  readonly nextCursor: string | null;
}

function toPage<T>(payload: unknown, map: (entry: unknown) => T | null): Page<T> {
  const raw = asObject(payload);
  return {
    rows: asArray(raw['rows']).flatMap((entry) => {
      const row = map(entry);
      return row === null ? [] : [row];
    }),
    nextCursor: str(raw['next_cursor']),
  };
}

/* ------------------------------------------------------------------ */
/* Resultat generique                                                  */
/* ------------------------------------------------------------------ */

export interface QueryOutcome<T> {
  readonly data: T | null;
  readonly failed: boolean;
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  map: (payload: unknown) => T,
): Promise<QueryOutcome<T>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { data: null, failed: true };
  return { data: map(data), failed: false };
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

/** ISE-047 — liste et onglets de portee. */
export async function loadNetworkCalls(
  scope: CallScope,
  query: string | null,
  cursor: string | null,
): Promise<QueryOutcome<Page<NetworkCallCard>>> {
  return rpc(
    'list_network_calls',
    {
      p_scope: scope,
      p_query: query,
      p_call_type: null,
      p_skill_id: null,
      p_sector_id: null,
      p_country_code: null,
      p_urgency: null,
      p_status: 'open',
      p_cursor: cursor,
      p_limit: 20,
    },
    (payload) => toPage(payload, toCallCard),
  );
}

/** « Mes appels » — groupes Actifs / Resolus / Brouillons / Expires. */
export async function loadMyNetworkCalls(
  group: MyCallGroup,
  cursor: string | null,
): Promise<QueryOutcome<Page<NetworkCallCard>>> {
  return rpc(
    'list_my_network_calls',
    { p_group: group, p_cursor: cursor, p_limit: 20 },
    (payload) => toPage(payload, toCallCard),
  );
}

/** ISE-048 — detail. */
export async function loadNetworkCall(callId: string): Promise<QueryOutcome<NetworkCallDetail>> {
  return rpc('get_network_call', { p_call_id: callId }, toCallDetail as (p: unknown) => NetworkCallDetail);
}

/** ISE-053 — suivi (indicateurs reels, jamais de vue/like). */
export async function loadCallTracking(callId: string): Promise<QueryOutcome<NetworkCallTracking>> {
  return rpc(
    'get_network_call_tracking',
    { p_call_id: callId },
    toCallTracking as (p: unknown) => NetworkCallTracking,
  );
}

/** ISE-053 — reponses recues, reservees a l'auteur. */
export async function loadCallResponses(
  callId: string,
  status: string | null,
  cursor: string | null,
): Promise<QueryOutcome<Page<NetworkCallResponse>>> {
  return rpc(
    'list_network_call_responses',
    { p_call_id: callId, p_status: status, p_kind: null, p_cursor: cursor, p_limit: 20 },
    (payload) => toPage(payload, toCallResponse),
  );
}

/** ISE-052 — apercu d'audience, RECALCULE a chaque appel (D6 §44). */
export async function loadAudiencePreview(callId: string): Promise<QueryOutcome<AudiencePreview>> {
  return rpc('preview_network_call_audience', { p_call_id: callId }, toAudiencePreview);
}

/** ISE-054 — contributeurs proposables : les repondants, rien d'autre. */
export async function loadRespondents(callId: string): Promise<QueryOutcome<Respondent[]>> {
  return rpc('list_network_call_respondents', { p_call_id: callId }, toRespondents);
}

/* ------------------------------------------------------------------ */
/* Referentiels (lectures directes, memes tables que le web)           */
/* ------------------------------------------------------------------ */

export interface SectorOption {
  readonly id: number;
  readonly name: string;
}

export async function loadSectors(): Promise<QueryOutcome<SectorOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sectors')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return { data: null, failed: true };
  const rows = (data ?? []) as unknown as Array<{ id: number; name: string }>;
  return { data: rows.map((row) => ({ id: row.id, name: row.name })), failed: false };
}

export interface CountryOption {
  readonly code: string;
  readonly name: string;
}

export async function loadCountries(): Promise<QueryOutcome<CountryOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('countries')
    .select('code, name_fr')
    .eq('is_active', true)
    .order('name_fr');
  if (error) return { data: null, failed: true };
  const rows = (data ?? []) as unknown as Array<{ code: string; name_fr: string }>;
  return {
    data: rows.map((row) => ({ code: row.code.trim(), name: row.name_fr })),
    failed: false,
  };
}

export interface PromotionOption {
  readonly id: number;
  readonly name: string;
}

export async function loadPromotions(): Promise<QueryOutcome<PromotionOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('promotions')
    .select('id, name')
    .eq('status', 'active')
    .order('graduation_year', { ascending: false });
  if (error) return { data: null, failed: true };
  const rows = (data ?? []) as unknown as Array<{ id: number; name: string }>;
  return { data: rows.map((row) => ({ id: row.id, name: row.name })), failed: false };
}

export interface SkillOption {
  readonly skillId: number;
  readonly name: string;
}

export async function searchCallSkills(query: string | null): Promise<QueryOutcome<SkillOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('search_skills', {
    p_query: query && query.trim().length > 0 ? query.trim() : null,
    p_limit: 20,
  });
  if (error) return { data: null, failed: true };
  const rows = asArray(data) as unknown[];
  const options = rows.flatMap((entry) => {
    const item = asObject(entry);
    const skillId = num(item['skill_id']);
    const name = str(item['skill_name']);
    if (skillId === null || name === null) return [];
    return [{ skillId, name }];
  });
  return { data: options, failed: false };
}

/* ------------------------------------------------------------------ */
/* Ecritures                                                           */
/* ------------------------------------------------------------------ */

export interface WriteOutcome<T> {
  readonly data: T | null;
  readonly failed: boolean;
}

async function rpcWrite<T>(
  name: string,
  args: Record<string, unknown>,
  map: (payload: unknown) => T,
): Promise<WriteOutcome<T>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { data: null, failed: true };
  return { data: map(data), failed: false };
}

/** ISE-047 — enregistrer / retirer un appel. */
export async function toggleSavedCall(callId: string, saved: boolean): Promise<WriteOutcome<boolean>> {
  return rpcWrite(
    'toggle_saved_network_call',
    { p_call_id: callId, p_saved: saved },
    (data) => asObject(data)['is_saved'] === true,
  );
}

export interface CallDraftPayload {
  call_family?: string | null;
  call_type?: string;
  title?: string;
  description?: string;
  context?: string;
  deadline?: string;
  visibility?: string;
  hide_author_organization?: boolean;
  wanted_profile?: string;
  sector_id?: string;
  sector_importance?: string;
  country_code?: string;
  min_experience_years?: string;
  promotion_year_from?: string;
  promotion_year_to?: string;
  skills?: { skill_id: string; importance: string }[];
  help_types?: string[];
  audience_promotion_ids?: string[];
}

/** ISE-049 -> ISE-051 — brouillon et criteres, une transaction par etape. */
export async function saveCallDraft(
  callId: string | null,
  payload: CallDraftPayload,
): Promise<WriteOutcome<string>> {
  return rpcWrite(
    'save_network_call_draft',
    { p_call_id: callId, p_payload: payload },
    (data) => str(asObject(data)['call_id']) ?? '',
  );
}

/** ISE-052 — publication puis calcul d'audience, meme transaction. */
export async function publishCall(callId: string): Promise<WriteOutcome<number>> {
  return rpcWrite('publish_network_call_with_audience', { p_call_id: callId, p_extend_days: 60 }, (data) => {
    const targeted = asObject(data)['targeted'];
    return typeof targeted === 'number' ? targeted : 0;
  });
}

/** Pause, reprise, annulation. La cloture passe par `closeCall`. */
export async function transitionCall(
  callId: string,
  toStatus: 'paused' | 'active' | 'cancelled',
): Promise<WriteOutcome<null>> {
  return rpcWrite(
    'transition_network_call',
    { p_call_id: callId, p_to_status: toStatus, p_note: null },
    () => null,
  );
}

/** ISE-053 — triage prive des reponses par l'auteur (D6 §65). */
export async function setResponseStatus(
  responseId: string,
  status: string,
): Promise<WriteOutcome<null>> {
  return rpcWrite('set_network_call_response_status', { p_response_id: responseId, p_status: status }, () => null);
}

export interface RespondInput {
  callId: string;
  responseType: string;
  message: string | null;
  sharesContact: boolean;
  recommendedProfileId: string | null;
  externalPersonName: string | null;
  offersIntroduction: boolean;
  consentConfirmed: boolean;
}

/** ISE-048 — repondre a un appel (en ligne, pas d'ecran dedie sur mobile). */
export async function respondToCall(input: RespondInput): Promise<WriteOutcome<string>> {
  return rpcWrite(
    'respond_to_network_call',
    {
      p_call_id: input.callId,
      p_response_type: input.responseType,
      p_message: input.message,
      p_shares_contact: input.sharesContact,
      p_recommended_profile_id: input.recommendedProfileId,
      p_external_person_name: input.externalPersonName,
      p_external_person_context: null,
      p_rationale: null,
      p_offers_introduction: input.offersIntroduction,
      p_consent_confirmed: input.consentConfirmed,
    },
    (data) => str(asObject(data)['response_id']) ?? '',
  );
}

export interface CloseCallInput {
  callId: string;
  resolution: Resolution;
  resultType: string | null;
  missingReason: string | null;
  notes: string | null;
  testimonial: string | null;
  testimonialConsent: boolean;
  contributorIds: string[];
}

/** ISE-054 — cloture TERNAIRE (D-52). */
export async function closeCall(input: CloseCallInput): Promise<WriteOutcome<null>> {
  return rpcWrite(
    'close_network_call',
    {
      p_call_id: input.callId,
      p_resolution: input.resolution,
      p_result_type: input.resolution === 'not_resolved' ? null : input.resultType,
      p_missing_reason: input.resolution === 'resolved' ? null : input.missingReason,
      p_notes: input.notes,
      p_testimonial: input.testimonial,
      p_testimonial_consent: input.testimonial !== null && input.testimonialConsent,
      p_contributor_ids: input.contributorIds.length > 0 ? input.contributorIds : null,
    },
    () => null,
  );
}
