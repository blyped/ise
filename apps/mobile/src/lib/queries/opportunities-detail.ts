import { parsePublicMedia, type PublicMedia } from '../media';
import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-056 -> ISE-066 — Opportunités (détail, candidatures, publication).
 *
 * Portage mobile de `apps/web/src/lib/queries/opportunities.ts` et
 * `apps/web/src/lib/opportunities-view.ts`. Fichier VOLONTAIREMENT séparé
 * de `apps/mobile/src/lib/queries/opportunities.ts` (ISE-055, déjà livré,
 * scope réduit à la liste) : ce module couvre le reste de la tranche et
 * appelle les MÊMES RPC que le web, sans nouvelle route serveur.
 *
 * RÈGLE CARDINALE (MASTER PROMPT §27, D-55), portée par TOUT ce fichier :
 * aucune fonction d'ici ne peut faire franchir à une candidature une étape
 * non constatée. Trois chemins distincts, jamais confondus :
 *   - `submitApplication()`            → candidature INTERNE, seule que la
 *     plateforme constate réellement ;
 *   - `declareExternalApplication()`   → DÉCLARATION du membre pour une
 *     offre externe, sur un geste explicite, avec une date qu'il saisit ;
 *   - `recordOutboundClick()`          → un CLIC journalisé, jamais une
 *     candidature (la fonction de base renvoie `is_application: false`).
 * `transitionApplication()` (ISE-065/066) n'accepte que les transitions
 * renvoyées par `get_application` (`allowed_transitions`, calculées EN
 * BASE) : l'écran n'propose jamais une étape que la base refuserait.
 */

/* ------------------------------------------------------------------ */
/* Aides JSON                                                          */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const bool = (value: unknown): boolean => value === true;

const inList = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

/* ------------------------------------------------------------------ */
/* Vocabulaire ferme (migrations 0007/0008)                            */
/* ------------------------------------------------------------------ */

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

/** Sous-ensemble d'issues terminales proposé par ISE-066 (comme le web). */
export const OUTCOME_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'selected',
  'not_selected',
  'withdrawn',
];

export type OpportunityScope = 'for_you' | 'all' | 'saved';
export type MyOpportunityGroup = 'active' | 'drafts' | 'closed' | 'expired';
export type MyApplicationGroup = 'in_progress' | 'finished' | 'withdrawn' | 'drafts';

export const toApplicationStatus = (value: unknown): ApplicationStatus =>
  inList(APPLICATION_STATUSES, value, 'draft');

/* ------------------------------------------------------------------ */
/* Types de vue                                                        */
/* ------------------------------------------------------------------ */

export interface WeightedTag {
  readonly name: string;
  readonly importance: 'required' | 'preferred';
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

export interface MiniProfile {
  readonly profileId: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly currentOrganization: string | null;
  readonly currentCity: string | null;
  readonly currentCountry: string | null;
}

export interface MyApplicationSummary {
  readonly applicationId: string;
  readonly status: ApplicationStatus;
  readonly channel: 'platform' | 'external';
  readonly isSelfDeclared: boolean;
  readonly submittedAt: string | null;
}

export interface OpportunitySummary {
  readonly opportunityId: string;
  readonly opportunityType: string;
  readonly contractType: string | null;
  readonly title: string;
  readonly summary: string | null;
  readonly status: string;
  readonly organization: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly remoteMode: string | null;
  readonly remoteAllowed: boolean;
  readonly experienceLevel: string | null;
  readonly deadline: string | null;
  readonly startDate: string | null;
  readonly durationDays: number | null;
  readonly positionsCount: number;
  readonly publishedAt: string | null;
  readonly createdAt: string | null;
  readonly closedAt: string | null;
  readonly applicationMode: ApplicationMode;
  /** D-55 : seul `true` permet à la plateforme de constater le résultat. */
  readonly canApplyInternally: boolean;
  readonly isManager: boolean;
  readonly isSaved: boolean;
  /**
   * 0113 / D-166 — visuel editorial de l'offre, resolu dans la mediatheque
   * PUBLIQUE par `opportunities.cover_media_id`. MEME fichier que l'encart
   * d'accueil et que le web : une seule image televersee dans
   * /cms/opportunites, jamais de « version mobile » distincte (D-172).
   * `null` si aucun visuel n'est choisi ou s'il n'est plus publiable.
   */
  readonly cover: PublicMedia | null;
  readonly skills: readonly WeightedTag[];
  readonly relevance: Relevance | null;
  readonly myApplication: MyApplicationSummary | null;
  readonly compensationMin: number | null;
  readonly compensationMax: number | null;
  readonly currency: string | null;
  readonly externalApplicationUrl: string | null;
  readonly externalApplicationEmail: string | null;
  readonly applicationCount: number | null;
  readonly targetedCount: number | null;
  readonly strongMatchCount: number | null;
}

export interface OpportunityDetail extends OpportunitySummary {
  readonly description: string;
  readonly tools: readonly WeightedTag[];
}

function toWeightedTags(value: unknown): WeightedTag[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const name = str(item['name']);
    if (name === null) return [];
    return [{ name, importance: str(item['importance']) === 'required' ? 'required' : 'preferred' } as WeightedTag];
  });
}

function toRelevance(value: unknown): Relevance | null {
  const raw = asObject(value);
  if (Object.keys(raw).length === 0) return null;
  const label = str(raw['label']);
  return {
    label: label === 'very_relevant' || label === 'relevant' || label === 'close_profile' ? label : null,
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

function toMiniProfile(value: unknown): MiniProfile | null {
  const raw = asObject(value);
  const profileId = str(raw['profile_id']);
  if (profileId === null) return null;
  return {
    profileId,
    displayName: str(raw['display_name']) ?? '',
    headline: str(raw['headline']),
    currentOrganization: str(raw['current_organization']),
    currentCity: str(raw['current_city']),
    currentCountry: str(raw['current_country']),
  };
}

function toMyApplicationSummary(value: unknown): MyApplicationSummary | null {
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

function toOpportunitySummary(value: unknown): OpportunitySummary | null {
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
    organization: str(raw['organization']),
    city: str(raw['city']),
    country: str(raw['country']),
    remoteMode: str(raw['remote_mode']),
    remoteAllowed: bool(raw['remote_allowed']),
    experienceLevel: str(raw['experience_level']),
    deadline: str(raw['deadline']),
    startDate: str(raw['start_date']),
    durationDays: num(raw['duration_days']),
    positionsCount: num(raw['positions_count']) ?? 1,
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    closedAt: str(raw['closed_at']),
    applicationMode: inList(APPLICATION_MODES, raw['application_mode'], 'internal'),
    canApplyInternally: bool(raw['can_apply_internally']),
    isManager: bool(raw['is_manager']),
    isSaved: bool(raw['is_saved']),
    cover: parsePublicMedia(raw['cover']),
    skills: toWeightedTags(raw['skills']),
    relevance: toRelevance(raw['relevance']),
    myApplication: toMyApplicationSummary(raw['my_application']),
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

function toOpportunityDetail(value: unknown): OpportunityDetail | null {
  const summary = toOpportunitySummary(value);
  if (summary === null) return null;
  const raw = asObject(value);
  return {
    ...summary,
    description: str(raw['description']) ?? '',
    tools: toWeightedTags(raw['tools']),
  };
}

export interface ApplicationRow {
  readonly applicationId: string;
  readonly status: ApplicationStatus;
  readonly channel: 'platform' | 'external';
  readonly isSelfDeclared: boolean;
  readonly submittedAt: string | null;
  readonly declaredAt: string | null;
  readonly decidedAt: string | null;
  readonly opportunity: OpportunitySummary | null;
}

function toApplicationRow(value: unknown): ApplicationRow | null {
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
    opportunity: toOpportunitySummary(raw['opportunity']),
  };
}

export interface ApplicationDetail {
  readonly applicationId: string;
  readonly status: ApplicationStatus;
  readonly channel: 'platform' | 'external';
  readonly isSelfDeclared: boolean;
  /** D-55 : les étapes sont DÉCLARÉES par le membre, pas constatées. */
  readonly stepsAreSelfDeclared: boolean;
  readonly isApplicant: boolean;
  readonly isManager: boolean;
  readonly message: string | null;
  readonly submittedAt: string | null;
  readonly declaredAt: string | null;
  readonly viewedAt: string | null;
  readonly reviewedAt: string | null;
  readonly decidedAt: string | null;
  readonly withdrawnAt: string | null;
  readonly opportunity: OpportunitySummary | null;
  readonly applicant: MiniProfile | null;
  readonly documents: readonly { documentId: string; role: string; title: string | null; filename: string }[];
  readonly answers: readonly { question: string; answer: string }[];
  readonly timeline: readonly {
    fromStatus: string | null;
    toStatus: string;
    actorKind: string;
    note: string | null;
    createdAt: string | null;
  }[];
  /** Calculé EN BASE : l'écran n'affiche jamais un bouton sans transition. */
  readonly allowedTransitions: readonly ApplicationStatus[];
}

function toApplicationDetail(value: unknown): ApplicationDetail | null {
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
    opportunity: toOpportunitySummary(raw['opportunity']),
    applicant: toMiniProfile(raw['applicant']),
    documents: asArray(raw['documents']).flatMap((entry) => {
      const item = asObject(entry);
      const documentId = str(item['document_id']);
      const filename = str(item['filename']);
      if (documentId === null || filename === null) return [];
      return [{ documentId, role: str(item['role']) ?? 'other', title: str(item['title']), filename }];
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
  readonly applicationId: string;
  readonly status: ApplicationStatus;
  readonly channel: 'platform' | 'external';
  readonly isSelfDeclared: boolean;
  readonly submittedAt: string | null;
  readonly hasCv: boolean;
  readonly applicant: MiniProfile | null;
  readonly relevance: Relevance | null;
}

function toReceivedApplication(value: unknown): ReceivedApplication | null {
  const raw = asObject(value);
  const id = str(raw['application_id']);
  if (id === null) return null;
  return {
    applicationId: id,
    status: toApplicationStatus(raw['status']),
    channel: str(raw['channel']) === 'external' ? 'external' : 'platform',
    isSelfDeclared: bool(raw['is_self_declared']),
    submittedAt: str(raw['submitted_at']),
    hasCv: bool(raw['has_cv']),
    applicant: toMiniProfile(raw['applicant']),
    relevance: toRelevance(raw['relevance']),
  };
}

export interface MatchedProfile {
  readonly profile: MiniProfile;
  readonly relevance: Relevance | null;
}

function toMatchedProfiles(value: unknown): MatchedProfile[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const profile = toMiniProfile(item['profile']);
    if (profile === null) return [];
    return [{ profile, relevance: toRelevance({ label: item['label'], reasons: item['reasons'] }) }];
  });
}

export interface AudiencePreview {
  readonly computed: boolean;
  readonly total: number;
  readonly veryRelevant: number;
  readonly relevant: number;
  readonly closeProfile: number;
  readonly priorityNotice: number;
  readonly samples: readonly { profile: MiniProfile; relevance: Relevance | null }[];
}

function toAudiencePreview(value: unknown): AudiencePreview {
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
      const profile = toMiniProfile(item['profile']);
      if (profile === null) return [];
      return [{ profile, relevance: toRelevance({ label: item['label'], reasons: item['reasons'] }) }];
    }),
  };
}

export interface CandidateOption {
  readonly profileId: string;
  readonly profile: MiniProfile | null;
  readonly status: ApplicationStatus;
  readonly channel: 'platform' | 'external';
}

function toCandidateOptions(value: unknown): CandidateOption[] {
  return asArray(value).flatMap((entry) => {
    const item = asObject(entry);
    const profileId = str(item['profile_id']);
    if (profileId === null) return [];
    return [
      {
        profileId,
        profile: toMiniProfile(item['profile']),
        status: toApplicationStatus(item['status']),
        channel: str(item['channel']) === 'external' ? 'external' : 'platform',
      },
    ];
  });
}

/** Résultat de `record_opportunity_outbound_click` (MASTER PROMPT §27). */
export interface OutboundClick {
  readonly opportunityId: string;
  readonly applicationMode: ApplicationMode;
  readonly url: string | null;
  readonly email: string | null;
  /** Toujours `false` : un clic n'est jamais une candidature (D-55). */
  readonly isApplication: boolean;
}

function toOutboundClick(value: unknown): OutboundClick | null {
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

export interface Page<T> {
  readonly rows: readonly T[];
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
/* Appels RPC                                                          */
/* ------------------------------------------------------------------ */

export interface Result<T> {
  readonly data: T | null;
  readonly failed: boolean;
}

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  map: (payload: unknown) => T,
): Promise<Result<T>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    return { data: null, failed: true };
  }
  return { data: map(data), failed: false };
}

/* ----------------------------- Lectures ---------------------------- */

/** ISE-056 — détail d'une opportunité. */
export function getOpportunity(opportunityId: string): Promise<Result<OpportunityDetail | null>> {
  return callRpc('get_opportunity', { p_opportunity_id: opportunityId }, toOpportunityDetail);
}

/** ISE-062 — offres enregistrées (et « toutes » pour la recherche). */
export function loadOpportunitiesByScope(
  scope: OpportunityScope,
  cursor: string | null,
  query: string | null,
): Promise<Result<Page<OpportunitySummary>>> {
  return callRpc(
    'list_opportunities',
    {
      p_scope: scope,
      p_query: query,
      p_opportunity_type: null,
      p_sector_id: null,
      p_country_code: null,
      p_experience_level: null,
      p_remote_only: false,
      p_new_graduates: false,
      p_status: 'all',
      p_cursor: cursor,
      p_limit: 20,
    },
    (payload) => toPage(payload, toOpportunitySummary),
  );
}

/** Mes offres publiées (support de ISE-060/061 : point d'entrée vers le suivi). */
export function loadMyOpportunities(
  group: MyOpportunityGroup,
  cursor: string | null,
): Promise<Result<Page<OpportunitySummary>>> {
  return callRpc('list_my_opportunities', { p_group: group, p_cursor: cursor, p_limit: 20 }, (payload) =>
    toPage(payload, toOpportunitySummary),
  );
}

/** ISE-058 — profils correspondants (libellé + raisons, jamais de score). */
export function loadOpportunityMatches(
  opportunityId: string,
  cursor: string | null,
): Promise<Result<Page<MatchedProfile>>> {
  return callRpc(
    'list_opportunity_matches',
    { p_opportunity_id: opportunityId, p_cursor: cursor, p_limit: 20 },
    (payload) => {
      const raw = asObject(payload);
      return { rows: toMatchedProfiles(raw['rows']), nextCursor: str(raw['next_cursor']) };
    },
  );
}

/** ISE-058 / ISE-059 — aperçu du ciblage. */
export function previewOpportunityAudience(opportunityId: string): Promise<Result<AudiencePreview>> {
  return callRpc('preview_opportunity_audience', { p_opportunity_id: opportunityId }, toAudiencePreview);
}

/** ISE-060 — candidatures reçues. */
export function loadOpportunityApplications(
  opportunityId: string,
  status: string | null,
  cursor: string | null,
): Promise<Result<Page<ReceivedApplication>>> {
  return callRpc(
    'list_opportunity_applications',
    { p_opportunity_id: opportunityId, p_status: status, p_cursor: cursor, p_limit: 20 },
    (payload) => toPage(payload, toReceivedApplication),
  );
}

/** ISE-063 — mes candidatures. */
export function loadMyApplications(
  group: MyApplicationGroup,
  cursor: string | null,
): Promise<Result<Page<ApplicationRow>>> {
  return callRpc('list_my_applications', { p_group: group, p_cursor: cursor, p_limit: 20 }, (payload) =>
    toPage(payload, toApplicationRow),
  );
}

/** ISE-064 -> ISE-066 — détail d'une candidature. */
export function getApplication(applicationId: string): Promise<Result<ApplicationDetail | null>> {
  return callRpc('get_application', { p_application_id: applicationId }, toApplicationDetail);
}

/** ISE-061 — bénéficiaires proposables : les candidats réels. */
export function loadOpportunityCandidates(opportunityId: string): Promise<Result<CandidateOption[]>> {
  return callRpc('list_opportunity_candidates', { p_opportunity_id: opportunityId }, toCandidateOptions);
}

/* ----------------------------- Écritures --------------------------- */

/** ISE-057 / ISE-058 — brouillon d'offre et critères, en une transaction. */
export function saveOpportunityDraft(
  opportunityId: string | null,
  payload: Record<string, unknown>,
): Promise<Result<string>> {
  return callRpc(
    'save_opportunity_draft',
    { p_opportunity_id: opportunityId, p_payload: payload },
    (data) => str(asObject(data)['opportunity_id']) ?? '',
  );
}

export interface PublishResult {
  readonly moderationStatus: string;
  readonly targeted: number;
}

/** ISE-059 — publication. La modération dépend du niveau de confiance. */
export function publishOpportunity(opportunityId: string): Promise<Result<PublishResult>> {
  return callRpc('publish_opportunity', { p_opportunity_id: opportunityId }, (data) => {
    const raw = asObject(data);
    return {
      moderationStatus: str(raw['moderation_status']) ?? 'not_required',
      targeted: num(raw['targeted']) ?? 0,
    };
  });
}

/** Pause ou annulation. La clôture passe par `closeOpportunity`. */
export function transitionOpportunity(
  opportunityId: string,
  toStatus: 'paused' | 'cancelled',
): Promise<Result<null>> {
  return callRpc(
    'transition_opportunity',
    { p_opportunity_id: opportunityId, p_to_status: toStatus, p_note: null },
    () => null,
  );
}

export interface CloseOpportunityInput {
  readonly opportunityId: string;
  readonly outcomeType: string;
  readonly hiresCount: number;
  readonly facilitated: boolean;
  readonly attributionLevel: string;
  readonly notes: string | null;
  readonly beneficiaryIds: readonly string[];
}

/** ISE-061 — clôture et résultat. Aucun faux impact. */
export function closeOpportunity(input: CloseOpportunityInput): Promise<Result<null>> {
  return callRpc(
    'close_opportunity',
    {
      p_opportunity_id: input.opportunityId,
      p_outcome_type: input.outcomeType,
      p_hires_count: input.hiresCount,
      p_facilitated: input.facilitated,
      p_attribution_level: input.attributionLevel,
      p_notes: input.notes,
      p_beneficiary_ids: input.beneficiaryIds.length > 0 ? [...input.beneficiaryIds] : null,
    },
    () => null,
  );
}

/** ISE-062 — enregistrer / retirer une offre. */
export function toggleSavedOpportunity(opportunityId: string, saved: boolean): Promise<Result<boolean>> {
  return callRpc(
    'toggle_saved_opportunity',
    { p_opportunity_id: opportunityId, p_saved: saved },
    (data) => asObject(data)['is_saved'] === true,
  );
}

/**
 * CANDIDATURE INTERNE. Seul mode où la plateforme peut ensuite constater
 * les étapes. Refusé par la base pour toute offre externe.
 */
export function submitApplication(
  opportunityId: string,
  message: string | null,
  cvDocumentId: string | null,
): Promise<Result<string>> {
  return callRpc(
    'submit_application',
    { p_opportunity_id: opportunityId, p_message: message, p_cv_document_id: cvDocumentId },
    (data) => str(asObject(data)['id']) ?? '',
  );
}

/**
 * DÉCLARATION du membre (MASTER PROMPT §27, D-55). C'est le SEUL chemin
 * pour qu'une candidature externe existe. Rien ici n'est déduit d'un
 * clic : la date et le fait viennent de la personne.
 */
export function declareExternalApplication(
  opportunityId: string,
  declaredAt: string,
  note: string | null,
): Promise<Result<string>> {
  return callRpc(
    'declare_external_application',
    { p_opportunity_id: opportunityId, p_declared_at: declaredAt, p_note: note },
    (data) => str(asObject(data)['id']) ?? '',
  );
}

/**
 * ISE-065 / ISE-066 — étape suivante d'une candidature. Sur une
 * candidature auto-déclarée, c'est le MEMBRE qui constate ; l'écran ne
 * propose que les transitions renvoyées par `get_application`.
 */
export function transitionApplication(
  applicationId: string,
  toStatus: string,
  note: string | null,
): Promise<Result<null>> {
  return callRpc(
    'transition_application_status',
    { p_application_id: applicationId, p_to_status: toStatus, p_note: note },
    () => null,
  );
}

/**
 * Clic vers une offre externe. Fait TECHNIQUE, jamais une candidature :
 * la fonction renvoie `is_application: false` et l'écran le dit.
 */
export function recordOutboundClick(opportunityId: string): Promise<Result<OutboundClick | null>> {
  return callRpc('record_opportunity_outbound_click', { p_opportunity_id: opportunityId }, toOutboundClick);
}
