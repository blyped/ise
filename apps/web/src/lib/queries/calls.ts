import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import {
  asArray,
  asObject,
  str,
  toAudiencePreview,
  toCallCard,
  toCallDetail,
  toCallResponse,
  toCallTracking,
  toMatchedProfiles,
  toRespondents,
  type AudiencePreview,
  type CallCard,
  type CallDetail,
  type CallResponse,
  type CallScope,
  type CallTracking,
  type MatchedProfile,
  type MyCallGroup,
  type Page,
  type Respondent,
} from '@/lib/calls-view';

/**
 * Lectures et ecritures de la tranche APPELS AU RESEAU (ISE-047 -> 054).
 *
 * TOUT passe par les RPC des migrations 0007 et 0052. Aucun `select`
 * direct n'est fait ici sur `ise_profiles` (privilege de colonne retire
 * depuis 0028) ni sur `network_call_matches` (score retire depuis 0040) :
 * composer une carte cote application reviendrait a « renvoyer puis
 * masquer », ce que le MASTER PROMPT §47 interdit.
 *
 * Les curseurs keyset renvoyes par la base sont SCELLES avant de quitter
 * le serveur (`lib/opaque-cursor.ts`) : celui de l'onglet « Pour moi »
 * porte le SCORE interne, qui ne doit jamais atteindre le navigateur
 * (MASTER PROMPT §15).
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export * from '@/lib/calls-view';

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    // Jamais le message brut de PostgreSQL vers l'interface (D-102).
    console.error('[ISE] appels au réseau — RPC en échec', {
      correlationId,
      rpc: name,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}

function sealed(raw: unknown): string | null {
  const cursor = str(raw);
  return cursor === null ? null : sealCursor(cursor);
}

function toPage<T>(payload: unknown, map: (entry: unknown) => T | null): Page<T> {
  const raw = asObject(payload);
  return {
    rows: asArray(raw['rows']).flatMap((entry) => {
      const row = map(entry);
      return row === null ? [] : [row];
    }),
    nextCursor: sealed(raw['next_cursor']),
  };
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

export interface CallListFilters {
  scope: CallScope;
  query: string | null;
  callType: string | null;
  skillId: number | null;
  sectorId: number | null;
  countryCode: string | null;
  urgency: string | null;
  status: 'open' | 'all';
}

/** ISE-047 — liste et filtres. */
export async function loadNetworkCalls(
  filters: CallListFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<CallCard>>> {
  return callRpc(
    'list_network_calls',
    {
      p_scope: filters.scope,
      p_query: filters.query,
      p_call_type: filters.callType,
      p_skill_id: filters.skillId,
      p_sector_id: filters.sectorId,
      p_country_code: filters.countryCode,
      p_urgency: filters.urgency,
      p_status: filters.status,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => toPage(payload, toCallCard),
  );
}

/** ISE-048 — detail. */
export async function loadNetworkCall(
  callId: string,
  correlationId: string,
): Promise<QueryResult<CallDetail | null>> {
  return callRpc('get_network_call', { p_call_id: callId }, correlationId, toCallDetail);
}

/** Mes appels, groupes par etat. */
export async function loadMyNetworkCalls(
  group: MyCallGroup,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<CallCard>>> {
  return callRpc(
    'list_my_network_calls',
    { p_group: group, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toCallCard),
  );
}

/** ISE-053 — suivi de l'appel (indicateurs reels, aucune vanity metric). */
export async function loadCallTracking(
  callId: string,
  correlationId: string,
): Promise<QueryResult<CallTracking | null>> {
  return callRpc('get_network_call_tracking', { p_call_id: callId }, correlationId, toCallTracking);
}

/** ISE-053 — reponses recues, reservees a l'auteur de l'appel. */
export async function loadCallResponses(
  callId: string,
  status: string | null,
  kind: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<CallResponse>>> {
  return callRpc(
    'list_network_call_responses',
    { p_call_id: callId, p_status: status, p_kind: kind, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toCallResponse),
  );
}

/** ISE-051 — profils pertinents (libelle + raisons, jamais de score). */
export async function loadCallMatches(
  callId: string,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<MatchedProfile>>> {
  return callRpc(
    'list_network_call_matches',
    { p_call_id: callId, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      return { rows: toMatchedProfiles(raw['rows']), nextCursor: sealed(raw['next_cursor']) };
    },
  );
}

/** ISE-052 — apercu d'audience. Recalcule reellement (D6 §44). */
export async function loadAudiencePreview(
  callId: string,
  correlationId: string,
): Promise<QueryResult<AudiencePreview>> {
  return callRpc(
    'preview_network_call_audience',
    { p_call_id: callId },
    correlationId,
    toAudiencePreview,
  );
}

/** ISE-054 — contributeurs proposables : les repondants, rien d'autre. */
export async function loadRespondents(
  callId: string,
  correlationId: string,
): Promise<QueryResult<Respondent[]>> {
  return callRpc(
    'list_network_call_respondents',
    { p_call_id: callId },
    correlationId,
    toRespondents,
  );
}

/* ------------------------------------------------------------------ */
/* Ecritures                                                           */
/* ------------------------------------------------------------------ */

/** ISE-049 -> ISE-051 — brouillon et criteres, en une transaction. */
export async function saveCallDraft(
  callId: string | null,
  payload: Record<string, unknown>,
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'save_network_call_draft',
    { p_call_id: callId, p_payload: payload },
    correlationId,
    (data) => str(asObject(data)['call_id']) ?? '',
  );
}

/** ISE-052 — publication puis calcul de l'audience, meme transaction. */
export async function publishCall(
  callId: string,
  correlationId: string,
): Promise<QueryResult<number>> {
  return callRpc(
    'publish_network_call_with_audience',
    { p_call_id: callId, p_extend_days: 60 },
    correlationId,
    (data) => {
      const raw = asObject(data);
      const targeted = raw['targeted'];
      return typeof targeted === 'number' ? targeted : 0;
    },
  );
}

/** Pause, reprise, annulation. La cloture passe par `closeCall`. */
export async function transitionCall(
  callId: string,
  toStatus: 'paused' | 'active' | 'cancelled',
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'transition_network_call',
    { p_call_id: callId, p_to_status: toStatus, p_note: null },
    correlationId,
    () => null,
  );
}

/** ISE-054 — cloture TERNAIRE (D-52). */
export async function closeCall(
  input: {
    callId: string;
    resolution: string;
    resultType: string | null;
    missingReason: string | null;
    notes: string | null;
    testimonial: string | null;
    testimonialConsent: boolean;
    contributorIds: string[];
  },
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'close_network_call',
    {
      p_call_id: input.callId,
      p_resolution: input.resolution,
      p_result_type: input.resultType,
      p_missing_reason: input.missingReason,
      p_notes: input.notes,
      p_testimonial: input.testimonial,
      p_testimonial_consent: input.testimonialConsent,
      p_contributor_ids: input.contributorIds.length > 0 ? input.contributorIds : null,
    },
    correlationId,
    () => null,
  );
}

/** ISE-051 — repondre a un appel. */
export async function respondToCall(
  input: {
    callId: string;
    responseType: string;
    message: string | null;
    sharesContact: boolean;
    recommendedProfileId: string | null;
    externalPersonName: string | null;
    externalPersonContext: string | null;
    rationale: string | null;
    offersIntroduction: boolean;
    consentConfirmed: boolean;
  },
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'respond_to_network_call',
    {
      p_call_id: input.callId,
      p_response_type: input.responseType,
      p_message: input.message,
      p_shares_contact: input.sharesContact,
      p_recommended_profile_id: input.recommendedProfileId,
      p_external_person_name: input.externalPersonName,
      p_external_person_context: input.externalPersonContext,
      p_rationale: input.rationale,
      p_offers_introduction: input.offersIntroduction,
      p_consent_confirmed: input.consentConfirmed,
    },
    correlationId,
    (data) => str(asObject(data)['response_id']) ?? '',
  );
}

/** ISE-053 — triage prive des reponses par l'auteur (D6 §65). */
export async function setResponseStatus(
  responseId: string,
  status: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'set_network_call_response_status',
    { p_response_id: responseId, p_status: status },
    correlationId,
    () => null,
  );
}

/** ISE-047 — enregistrer / retirer un appel. */
export async function toggleSavedCall(
  callId: string,
  saved: boolean,
  correlationId: string,
): Promise<QueryResult<boolean>> {
  return callRpc(
    'toggle_saved_network_call',
    { p_call_id: callId, p_saved: saved },
    correlationId,
    (data) => asObject(data)['is_saved'] === true,
  );
}
