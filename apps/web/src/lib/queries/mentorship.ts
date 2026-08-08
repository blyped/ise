import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import {
  asArray,
  asObject,
  bool,
  str,
  toMentorCard,
  toMentorDetail,
  toMentorshipDetail,
  toMentorshipHome,
  toMentorshipRequestRow,
  toMentorshipSummary,
  type MentorCard,
  type MentorDetail,
  type MentorshipDetail,
  type MentorshipHome,
  type MentorshipRequestRow,
  type MentorshipSummary,
  type Page,
} from '@/lib/collaborate-view';

/**
 * Lectures et ecritures de la tranche MENTORAT (ISE-078 -> ISE-083).
 *
 * TOUT passe par les RPC de la migration 0075.
 *
 * REGLE CARDINALE (MASTER PROMPT §30) : aucune signature de ce module
 * ne peut transporter un score de mentor — la base ne le projette pas,
 * et `collaborate-view.ts` n'a aucun champ ou le stocker. Les mentors
 * recommandes portent un libelle qualitatif et des raisons.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] mentorat — RPC en échec', { correlationId, rpc: name, code: error.code });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}

function sealed(raw: unknown): string | null {
  const cursor = str(raw);
  return cursor === null ? null : sealCursor(cursor);
}

/** ISE-078 — espace mentorat. */
export async function loadMentorshipHome(
  correlationId: string,
): Promise<QueryResult<MentorshipHome>> {
  return callRpc('get_mentorship_home', {}, correlationId, toMentorshipHome);
}

export interface MentorshipNeedInput {
  objectiveType: string;
  objectiveText: string;
  topics: string[];
  mentorPreference: string | null;
  constraintsText: string | null;
  preferredFormat: string;
  preferredFrequency: string | null;
  sectorId: string | null;
  countryCode: string | null;
}

/** ISE-079 — enregistrer le besoin du mentore. */
export async function saveMentorshipNeed(
  input: MentorshipNeedInput,
  correlationId: string,
): Promise<QueryResult<{ saved: boolean }>> {
  return callRpc(
    'save_mentorship_need',
    {
      p_payload: {
        objective_type: input.objectiveType,
        objective_text: input.objectiveText,
        topics: input.topics,
        mentor_preference: input.mentorPreference,
        constraints_text: input.constraintsText,
        preferred_format: input.preferredFormat,
        preferred_frequency: input.preferredFrequency,
        sector_id: input.sectorId,
        country_code: input.countryCode,
      },
    },
    correlationId,
    (payload) => ({ saved: bool(asObject(payload)['saved']) }),
  );
}

export interface MentorFilters {
  query: string | null;
  sectorId: number | null;
  countryCode: string | null;
  format: string | null;
  manual: boolean;
}

export interface MentorPage extends Page<MentorCard> {
  isManual: boolean;
  hasNeed: boolean;
}

/** ISE-080 — mentors recommandes, ou recherche libre ([F 87]). */
export async function loadRecommendedMentors(
  filters: MentorFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<MentorPage>> {
  return callRpc(
    'list_recommended_mentors',
    {
      p_query: filters.query,
      p_sector_id: filters.sectorId,
      p_country_code: filters.countryCode,
      p_format: filters.format,
      p_manual: filters.manual,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        rows: asArray(value['rows']).flatMap((entry) => {
          const card = toMentorCard(entry);
          return card === null ? [] : [card];
        }),
        nextCursor: sealed(value['next_cursor']),
        isManual: bool(value['is_manual']),
        hasNeed: bool(value['has_need']),
      };
    },
  );
}

/** ISE-081 — fiche mentor. */
export async function loadMentorProfile(
  profileId: string,
  correlationId: string,
): Promise<QueryResult<MentorDetail | null>> {
  return callRpc('get_mentor_profile', { p_profile_id: profileId }, correlationId, toMentorDetail);
}

export interface MentorProfileInput {
  isActive: boolean;
  mentorStatement: string | null;
  maxActiveMentees: number;
  preferredFormats: string[];
  preferredFrequency: string | null;
  acceptedObjectives: string[];
  acceptedAudiences: string[];
  preferredChannels: string[];
  availabilityState: string;
  availableFrom: string | null;
}

/** « Devenir mentor » — activation, ajustement, mise en pause. */
export async function saveMentorProfile(
  input: MentorProfileInput,
  correlationId: string,
): Promise<QueryResult<{ isActive: boolean; availabilityState: string }>> {
  return callRpc(
    'save_mentor_profile',
    {
      p_payload: {
        is_active: input.isActive,
        mentor_statement: input.mentorStatement,
        max_active_mentees: input.maxActiveMentees,
        preferred_formats: input.preferredFormats,
        preferred_frequency: input.preferredFrequency,
        accepted_objectives: input.acceptedObjectives,
        accepted_audiences: input.acceptedAudiences,
        preferred_channels: input.preferredChannels,
        availability_state: input.availabilityState,
        available_from: input.availableFrom,
      },
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        isActive: bool(value['is_active']),
        availabilityState: str(value['availability_state']) ?? 'available_now',
      };
    },
  );
}

export interface MentorshipRequestInput {
  mentorProfileId: string;
  objectiveType: string;
  objectiveText: string;
  expectations: string[];
  requestedFormat: string;
  requestedFrequency: string | null;
  currentSituation: string | null;
  message: string | null;
}

/** ISE-082 — envoyer une demande. Aucune relation n'est creee ici. */
export async function submitMentorshipRequest(
  input: MentorshipRequestInput,
  correlationId: string,
): Promise<QueryResult<{ requestId: string | null; createsMentorship: boolean }>> {
  return callRpc(
    'submit_mentorship_request',
    {
      p_mentor_profile_id: input.mentorProfileId,
      p_objective_type: input.objectiveType,
      p_objective_text: input.objectiveText,
      p_expectations: input.expectations,
      p_requested_format: input.requestedFormat,
      p_requested_frequency: input.requestedFrequency,
      p_requested_duration_months: null,
      p_current_situation: input.currentSituation,
      p_message: input.message,
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        requestId: str(value['request_id']),
        createsMentorship: bool(value['creates_mentorship']),
      };
    },
  );
}

/**
 * Reponse du mentor. `decline` n'exige AUCUN motif ([F 59]) et
 * `propose_alternative` ouvre l'etat `alternative_proposed` (D-54).
 */
export async function respondToMentorshipRequest(
  requestId: string,
  decision: 'accept' | 'decline' | 'propose_alternative',
  options: {
    declineReason: string | null;
    alternativeFormat: string | null;
    alternativeMessage: string | null;
  },
  correlationId: string,
): Promise<QueryResult<{ status: string; mentorshipId: string | null }>> {
  return callRpc(
    'respond_to_mentorship_request',
    {
      p_request_id: requestId,
      p_decision: decision,
      p_decline_reason: options.declineReason,
      p_alternative_format: options.alternativeFormat,
      p_alternative_message: options.alternativeMessage,
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        status: str(value['status']) ?? decision,
        mentorshipId: str(value['mentorship_id']),
      };
    },
  );
}

/** Le mentore repond a l'alternative proposee (D-54). */
export async function acceptMentorshipAlternative(
  requestId: string,
  accept: boolean,
  correlationId: string,
): Promise<QueryResult<{ status: string; mentorshipId: string | null }>> {
  return callRpc(
    'accept_mentorship_alternative',
    { p_request_id: requestId, p_accept: accept },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        status: str(value['status']) ?? 'cancelled',
        mentorshipId: str(value['mentorship_id']),
      };
    },
  );
}

export async function cancelMentorshipRequest(
  requestId: string,
  correlationId: string,
): Promise<QueryResult<{ status: string }>> {
  return callRpc(
    'cancel_mentorship_request',
    { p_request_id: requestId },
    correlationId,
    (payload) => ({ status: str(asObject(payload)['status']) ?? 'cancelled' }),
  );
}

export async function loadMentorshipRequests(
  role: 'mentor' | 'mentee',
  scope: 'open' | 'closed' | 'all',
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<MentorshipRequestRow>>> {
  return callRpc(
    'list_my_mentorship_requests',
    { p_role: role, p_scope: scope, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        rows: asArray(value['rows']).flatMap((entry) => {
          const row = toMentorshipRequestRow(entry);
          return row === null ? [] : [row];
        }),
        nextCursor: sealed(value['next_cursor']),
      };
    },
  );
}

/** ISE-083 — mentorat actif. */
export async function loadMentorship(
  mentorshipId: string,
  correlationId: string,
): Promise<QueryResult<MentorshipDetail | null>> {
  return callRpc(
    'get_mentorship',
    { p_mentorship_id: mentorshipId },
    correlationId,
    toMentorshipDetail,
  );
}

export async function loadMyMentorships(
  role: 'mentor' | 'mentee',
  scope: 'ongoing' | 'finished' | 'all',
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<MentorshipSummary>>> {
  return callRpc(
    'list_my_mentorships',
    { p_role: role, p_scope: scope, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        rows: asArray(value['rows']).flatMap((entry) => {
          const row = toMentorshipSummary(entry);
          return row === null ? [] : [row];
        }),
        nextCursor: sealed(value['next_cursor']),
      };
    },
  );
}

/** Pause, reprise, arret, cloture — motif toujours facultatif ([U 102]). */
export async function transitionMentorship(
  mentorshipId: string,
  toStatus: string,
  reason: string | null,
  correlationId: string,
): Promise<QueryResult<{ status: string }>> {
  return callRpc(
    'transition_mentorship',
    { p_mentorship_id: mentorshipId, p_to_status: toStatus, p_reason: reason },
    correlationId,
    (payload) => ({ status: str(asObject(payload)['status']) ?? toStatus }),
  );
}

export async function setMentorshipItem(
  mentorshipId: string,
  kind: 'goal' | 'action',
  itemId: string | null,
  title: string | null,
  status: string | null,
  dueOn: string | null,
  correlationId: string,
): Promise<QueryResult<{ itemId: string | null }>> {
  return callRpc(
    'set_mentorship_item',
    {
      p_mentorship_id: mentorshipId,
      p_kind: kind,
      p_item_id: itemId,
      p_title: title,
      p_status: status,
      p_due_on: dueOn,
    },
    correlationId,
    (payload) => ({ itemId: str(asObject(payload)['item_id']) }),
  );
}

export async function logMentorshipSession(
  mentorshipId: string,
  input: {
    sessionId: string | null;
    scheduledAt: string | null;
    format: string | null;
    topic: string | null;
    sharedSummary: string | null;
    privateNote: string | null;
    status: string;
  },
  correlationId: string,
): Promise<QueryResult<{ sessionId: string | null }>> {
  return callRpc(
    'log_mentorship_session',
    {
      p_mentorship_id: mentorshipId,
      p_session_id: input.sessionId,
      p_scheduled_at: input.scheduledAt,
      p_format: input.format,
      p_topic: input.topic,
      p_shared_summary: input.sharedSummary,
      p_private_note: input.privateNote,
      p_status: input.status,
    },
    correlationId,
    (payload) => ({ sessionId: str(asObject(payload)['session_id']) }),
  );
}

export interface MentorshipFeedbackInput {
  usefulness: string | null;
  objectiveProgress: string | null;
  objectiveReached: string | null;
  outcomeType: string | null;
  comment: string | null;
  platformFeedback: string | null;
  publicTestimonialConsent: boolean;
  testimonialText: string | null;
  isAnonymousTestimonial: boolean;
}

/** ISE-083 — bilan. `isPublicRating` est toujours `false` (CA-MENT-09). */
export async function submitMentorshipFeedback(
  mentorshipId: string,
  input: MentorshipFeedbackInput,
  correlationId: string,
): Promise<QueryResult<{ role: string; isPublicRating: boolean }>> {
  return callRpc(
    'submit_mentorship_feedback',
    {
      p_mentorship_id: mentorshipId,
      p_payload: {
        usefulness: input.usefulness,
        objective_progress: input.objectiveProgress,
        objective_reached: input.objectiveReached,
        outcome_type: input.outcomeType,
        comment: input.comment,
        platform_feedback: input.platformFeedback,
        public_testimonial_consent: input.publicTestimonialConsent,
        testimonial_text: input.testimonialText,
        is_anonymous_testimonial: input.isAnonymousTestimonial,
      },
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        role: str(value['role']) ?? 'mentee',
        isPublicRating: bool(value['is_public_rating']),
      };
    },
  );
}
