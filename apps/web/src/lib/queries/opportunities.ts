import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import { asArray, asObject, num, str } from '@/lib/network-view';
import {
  toApplicationDetail,
  toApplicationRow,
  toCandidateOptions,
  toOpportunityCard,
  toOpportunityDetail,
  toOutboundClick,
  toProfileDocuments,
  toReceivedApplication,
  type ApplicationDetail,
  type ApplicationRow,
  type CandidateOption,
  type MyApplicationGroup,
  type MyOpportunityGroup,
  type OpportunityCard,
  type OpportunityDetail,
  type OpportunityScope,
  type OutboundClick,
  type Page,
  type ProfileDocument,
  type ReceivedApplication,
} from '@/lib/opportunities-view';
import {
  toAudiencePreview,
  toMatchedProfiles,
  type AudiencePreview,
  type MatchedProfile,
} from '@/lib/calls-view';

/**
 * Lectures et ecritures de la tranche OPPORTUNITES (ISE-055 -> ISE-066).
 *
 * TOUT passe par les RPC des migrations 0008 et 0053.
 *
 * REGLE CARDINALE (MASTER PROMPT §27, D-55) : ce module expose DEUX
 * chemins distincts et jamais interchangeables —
 *   * `submitApplication()` depose une candidature INTERNE, que la
 *     plateforme peut ensuite constater ;
 *   * `declareExternalApplication()` enregistre ce que le MEMBRE declare
 *     avoir fait ailleurs.
 * `recordOutboundClick()` n'est ni l'un ni l'autre : elle journalise un
 * clic et renvoie `isApplication: false`.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export * from '@/lib/opportunities-view';

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] opportunités — RPC en échec', {
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

export interface OpportunityFilters {
  scope: OpportunityScope;
  query: string | null;
  opportunityType: string | null;
  sectorId: number | null;
  countryCode: string | null;
  experienceLevel: string | null;
  remoteOnly: boolean;
  newGraduates: boolean;
  status: 'open' | 'all';
}

/** ISE-055 / ISE-062 — hub et offres enregistrees. */
export async function loadOpportunities(
  filters: OpportunityFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<OpportunityCard>>> {
  return callRpc(
    'list_opportunities',
    {
      p_scope: filters.scope,
      p_query: filters.query,
      p_opportunity_type: filters.opportunityType,
      p_sector_id: filters.sectorId,
      p_country_code: filters.countryCode,
      p_experience_level: filters.experienceLevel,
      p_remote_only: filters.remoteOnly,
      p_new_graduates: filters.newGraduates,
      p_status: filters.status,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => toPage(payload, toOpportunityCard),
  );
}

/** ISE-056 — detail. */
export async function loadOpportunity(
  opportunityId: string,
  correlationId: string,
): Promise<QueryResult<OpportunityDetail | null>> {
  return callRpc(
    'get_opportunity',
    { p_opportunity_id: opportunityId },
    correlationId,
    toOpportunityDetail,
  );
}

/** Mes offres publiees. */
export async function loadMyOpportunities(
  group: MyOpportunityGroup,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<OpportunityCard>>> {
  return callRpc(
    'list_my_opportunities',
    { p_group: group, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toOpportunityCard),
  );
}

/** ISE-058 — profils correspondants (libelle + raisons, jamais de score). */
export async function loadOpportunityMatches(
  opportunityId: string,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<MatchedProfile>>> {
  return callRpc(
    'list_opportunity_matches',
    { p_opportunity_id: opportunityId, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      return { rows: toMatchedProfiles(raw['rows']), nextCursor: sealed(raw['next_cursor']) };
    },
  );
}

/** ISE-058 / ISE-059 — apercu du ciblage. */
export async function loadOpportunityAudience(
  opportunityId: string,
  correlationId: string,
): Promise<QueryResult<AudiencePreview>> {
  return callRpc(
    'preview_opportunity_audience',
    { p_opportunity_id: opportunityId },
    correlationId,
    toAudiencePreview,
  );
}

/** ISE-060 — candidatures recues. */
export async function loadReceivedApplications(
  opportunityId: string,
  status: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<ReceivedApplication>>> {
  return callRpc(
    'list_opportunity_applications',
    { p_opportunity_id: opportunityId, p_status: status, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toReceivedApplication),
  );
}

/** ISE-063 — mes candidatures. */
export async function loadMyApplications(
  group: MyApplicationGroup,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<ApplicationRow>>> {
  return callRpc(
    'list_my_applications',
    { p_group: group, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toApplicationRow),
  );
}

/** ISE-064 -> ISE-066 — detail d'une candidature. */
export async function loadApplication(
  applicationId: string,
  correlationId: string,
): Promise<QueryResult<ApplicationDetail | null>> {
  return callRpc(
    'get_application',
    { p_application_id: applicationId },
    correlationId,
    toApplicationDetail,
  );
}

/** ISE-061 — beneficiaires proposables : les candidats reels. */
export async function loadOpportunityCandidates(
  opportunityId: string,
  correlationId: string,
): Promise<QueryResult<CandidateOption[]>> {
  return callRpc(
    'list_opportunity_candidates',
    { p_opportunity_id: opportunityId },
    correlationId,
    toCandidateOptions,
  );
}

/** Mes documents, pour joindre un CV a une candidature interne. */
export async function loadMyDocuments(
  documentType: string | null,
  correlationId: string,
): Promise<QueryResult<ProfileDocument[]>> {
  return callRpc(
    'list_my_documents',
    { p_document_type: documentType },
    correlationId,
    toProfileDocuments,
  );
}

/* ------------------------------------------------------------------ */
/* Ecritures                                                           */
/* ------------------------------------------------------------------ */

/** ISE-057 / ISE-058 — brouillon d'offre et criteres, en une transaction. */
export async function saveOpportunityDraft(
  opportunityId: string | null,
  payload: Record<string, unknown>,
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'save_opportunity_draft',
    { p_opportunity_id: opportunityId, p_payload: payload },
    correlationId,
    (data) => str(asObject(data)['opportunity_id']) ?? '',
  );
}

export interface PublishResult {
  moderationStatus: string;
  targeted: number;
}

/** ISE-059 — publication. La moderation depend du niveau de confiance. */
export async function publishOpportunity(
  opportunityId: string,
  correlationId: string,
): Promise<QueryResult<PublishResult>> {
  return callRpc(
    'publish_opportunity',
    { p_opportunity_id: opportunityId },
    correlationId,
    (data) => {
      const raw = asObject(data);
      return {
        moderationStatus: str(raw['moderation_status']) ?? 'not_required',
        targeted: num(raw['targeted']) ?? 0,
      };
    },
  );
}

/** Pause ou annulation. La cloture passe par `closeOpportunity`. */
export async function transitionOpportunity(
  opportunityId: string,
  toStatus: 'paused' | 'cancelled',
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'transition_opportunity',
    { p_opportunity_id: opportunityId, p_to_status: toStatus, p_note: null },
    correlationId,
    () => null,
  );
}

/** ISE-061 — cloture et resultat. Aucun faux impact (test 13). */
export async function closeOpportunity(
  input: {
    opportunityId: string;
    outcomeType: string;
    hiresCount: number;
    facilitated: boolean;
    attributionLevel: string;
    notes: string | null;
    beneficiaryIds: string[];
  },
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'close_opportunity',
    {
      p_opportunity_id: input.opportunityId,
      p_outcome_type: input.outcomeType,
      p_hires_count: input.hiresCount,
      p_facilitated: input.facilitated,
      p_attribution_level: input.attributionLevel,
      p_notes: input.notes,
      p_beneficiary_ids: input.beneficiaryIds.length > 0 ? input.beneficiaryIds : null,
    },
    correlationId,
    () => null,
  );
}

/** ISE-062 — enregistrer / retirer une offre. */
export async function toggleSavedOpportunity(
  opportunityId: string,
  saved: boolean,
  correlationId: string,
): Promise<QueryResult<boolean>> {
  return callRpc(
    'toggle_saved_opportunity',
    { p_opportunity_id: opportunityId, p_saved: saved },
    correlationId,
    (data) => asObject(data)['is_saved'] === true,
  );
}

/**
 * CANDIDATURE INTERNE. Seul mode ou la plateforme peut ensuite constater
 * les etapes. Refuse par la base pour toute offre externe.
 */
export async function submitApplication(
  opportunityId: string,
  message: string | null,
  cvDocumentId: string | null,
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'submit_application',
    {
      p_opportunity_id: opportunityId,
      p_message: message,
      p_cv_document_id: cvDocumentId,
    },
    correlationId,
    (data) => str(asObject(data)['id']) ?? '',
  );
}

/**
 * DECLARATION du membre (MASTER PROMPT §27, D-55). C'est le SEUL chemin
 * pour qu'une candidature externe existe. Rien ici n'est deduit d'un
 * clic : la date et le fait viennent de la personne.
 */
export async function declareExternalApplication(
  opportunityId: string,
  declaredAt: string,
  note: string | null,
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'declare_external_application',
    {
      p_opportunity_id: opportunityId,
      p_declared_at: declaredAt,
      p_note: note,
    },
    correlationId,
    (data) => str(asObject(data)['id']) ?? '',
  );
}

/**
 * ISE-065 — etape suivante d'une candidature. Sur une candidature
 * auto-declaree, c'est le MEMBRE qui constate ; l'ecran ne propose que
 * les transitions renvoyees par `get_application`.
 */
export async function transitionApplication(
  applicationId: string,
  toStatus: string,
  note: string | null,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'transition_application_status',
    { p_application_id: applicationId, p_to_status: toStatus, p_note: note },
    correlationId,
    () => null,
  );
}

/**
 * Clic vers une offre externe. Fait TECHNIQUE, jamais une candidature :
 * la fonction renvoie `isApplication: false` et l'ecran le dit.
 */
export async function recordOutboundClick(
  opportunityId: string,
  correlationId: string,
): Promise<QueryResult<OutboundClick | null>> {
  return callRpc(
    'record_opportunity_outbound_click',
    { p_opportunity_id: opportunityId },
    correlationId,
    toOutboundClick,
  );
}
