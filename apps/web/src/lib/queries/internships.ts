import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import {
  asArray,
  asObject,
  bool,
  num,
  str,
  toInternshipApplicationDetail,
  toInternshipApplicationRow,
  toInternshipHelper,
  toInternshipHome,
  toInternshipOfferCard,
  toInternshipOfferDetail,
  type InternshipApplicationDetail,
  type InternshipApplicationRow,
  type InternshipHelper,
  type InternshipHome,
  type InternshipOfferCard,
  type InternshipOfferDetail,
  type Page,
} from '@/lib/collaborate-view';

/**
 * Lectures et ecritures de la tranche STAGES (ISE-072 -> ISE-077).
 *
 * TOUT passe par les RPC de la migration 0071.
 *
 * REGLE CARDINALE (MASTER PROMPT §27, D-55) : ce module expose DEUX
 * chemins distincts et jamais interchangeables —
 *   * `saveApplicationDraft()` prepare un dossier et le laisse en
 *     `to_prepare` ;
 *   * `declareApplicationSent()` enregistre ce que l'ELEVE declare avoir
 *     envoye, a une date qu'il fournit lui-meme.
 * Aucune fonction de ce fichier ne transmet un dossier a un tiers.
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
    console.error('[ISE] stages — RPC en échec', { correlationId, rpc: name, code: error.code });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}

function sealed(raw: unknown): string | null {
  const cursor = str(raw);
  return cursor === null ? null : sealCursor(cursor);
}

/** ISE-072 — espace eleve. Refuse (42501) pour un profil non `student`. */
export async function loadInternshipHome(
  correlationId: string,
): Promise<QueryResult<InternshipHome>> {
  return callRpc('get_internship_home', {}, correlationId, toInternshipHome);
}

export interface AlumniHome {
  studentsInMySectors: number;
  myOffers: number;
  pendingRequests: {
    requestId: string;
    requestType: string;
    message: string;
    createdAt: string | null;
    studentName: string;
  }[];
}

/** ISE-072, version ancien : « je peux aider ». */
export async function loadInternshipAlumniHome(
  correlationId: string,
): Promise<QueryResult<AlumniHome>> {
  return callRpc('get_internship_alumni_home', {}, correlationId, (payload) => {
    const value = asObject(payload);
    return {
      studentsInMySectors: num(value['students_in_my_sectors']) ?? 0,
      myOffers: num(value['my_offers']) ?? 0,
      pendingRequests: asArray(value['pending_requests']).flatMap((entry) => {
        const r = asObject(entry);
        const requestId = str(r['request_id']);
        if (requestId === null) return [];
        return [
          {
            requestId,
            requestType: str(r['request_type']) ?? 'advice',
            message: str(r['message']) ?? '',
            createdAt: str(r['created_at']),
            studentName: str(asObject(r['student'])['display_name']) ?? '',
          },
        ];
      }),
    };
  });
}

export interface InternshipNeedInput {
  status: 'draft' | 'active' | 'paused';
  internshipType: string;
  objective: string | null;
  startDate: string | null;
  endDate: string | null;
  datesFlexible: boolean;
  workMode: string;
  remoteAllowed: boolean;
  mobilityInternational: string;
  visibility: string;
  sectorIds: string[];
  countryCodes: string[];
}

export async function saveInternshipNeed(
  input: InternshipNeedInput,
  correlationId: string,
): Promise<QueryResult<{ needId: string | null; status: string }>> {
  return callRpc(
    'save_internship_need',
    {
      p_payload: {
        status: input.status,
        internship_type: input.internshipType,
        objective: input.objective,
        start_date: input.startDate,
        end_date: input.endDate,
        dates_flexible: input.datesFlexible,
        work_mode: input.workMode,
        remote_allowed: input.remoteAllowed,
        mobility_international: input.mobilityInternational,
        visibility: input.visibility,
        sector_ids: input.sectorIds,
        country_codes: input.countryCodes,
      },
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return { needId: str(value['need_id']), status: str(value['status']) ?? 'draft' };
    },
  );
}

export interface OfferFilters {
  scope: 'for_me' | 'all' | 'partners';
  query: string | null;
  countryCode: string | null;
  sectorId: number | null;
  maxMonths: number | null;
}

export interface OfferPage extends Page<InternshipOfferCard> {
  hasNeed: boolean;
}

/** ISE-072 / ISE-073 — liste d'offres, curseur keyset (D-44). */
export async function loadInternshipOffers(
  filters: OfferFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<OfferPage>> {
  return callRpc(
    'list_internship_offers',
    {
      p_scope: filters.scope,
      p_query: filters.query,
      p_country_code: filters.countryCode,
      p_sector_id: filters.sectorId,
      p_max_months: filters.maxMonths,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        rows: asArray(value['rows']).flatMap((entry) => {
          const card = toInternshipOfferCard(entry);
          return card === null ? [] : [card];
        }),
        nextCursor: sealed(value['next_cursor']),
        hasNeed: bool(value['has_need']),
      };
    },
  );
}

/** ISE-073 — detail d'une offre. */
export async function loadInternshipOffer(
  offerId: string,
  correlationId: string,
): Promise<QueryResult<InternshipOfferDetail | null>> {
  return callRpc(
    'get_internship_offer',
    { p_offer_id: offerId },
    correlationId,
    toInternshipOfferDetail,
  );
}

/** ISE-074 — preparer un dossier. Ne soumet JAMAIS (D-55). */
export async function saveApplicationDraft(
  applicationId: string | null,
  offerId: string | null,
  payload: {
    positionTitle: string | null;
    applicationChannel: string | null;
    cvStoragePath: string | null;
    message: string | null;
    notes: string | null;
  },
  correlationId: string,
): Promise<QueryResult<{ applicationId: string | null; status: string; isSent: boolean }>> {
  return callRpc(
    'save_internship_application_draft',
    {
      p_application_id: applicationId,
      p_offer_id: offerId,
      p_payload: {
        position_title: payload.positionTitle,
        application_channel: payload.applicationChannel,
        cv_storage_path: payload.cvStoragePath,
        message: payload.message,
        notes: payload.notes,
      },
    },
    correlationId,
    (payload_) => {
      const value = asObject(payload_);
      return {
        applicationId: str(value['application_id']),
        status: str(value['status']) ?? 'to_prepare',
        isSent: bool(value['is_sent']),
      };
    },
  );
}

/**
 * SEUL chemin vers « envoyée ». `sentOn` est obligatoire et vient de
 * l'eleve : la plateforme n'a rien constate (MASTER PROMPT §27, D-55).
 */
export async function declareApplicationSent(
  applicationId: string,
  channel: string,
  sentOn: string,
  correlationId: string,
): Promise<QueryResult<{ status: string; declaredBy: string }>> {
  return callRpc(
    'declare_internship_application_sent',
    { p_application_id: applicationId, p_channel: channel, p_sent_on: sentOn },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        status: str(value['status']) ?? 'submitted',
        declaredBy: str(value['declared_by']) ?? 'student',
      };
    },
  );
}

/** Etapes suivantes, toutes declaratives. */
export async function declareApplicationStep(
  applicationId: string,
  toStatus: string,
  occurredOn: string | null,
  note: string | null,
  correlationId: string,
): Promise<QueryResult<{ status: string }>> {
  return callRpc(
    'declare_internship_application_step',
    {
      p_application_id: applicationId,
      p_to_status: toStatus,
      p_occurred_on: occurredOn,
      p_note: note,
    },
    correlationId,
    (payload) => ({ status: str(asObject(payload)['status']) ?? toStatus }),
  );
}

/** ISE-076 — suivi d'une candidature. */
export async function loadInternshipApplication(
  applicationId: string,
  correlationId: string,
): Promise<QueryResult<InternshipApplicationDetail | null>> {
  return callRpc(
    'get_internship_application',
    { p_application_id: applicationId },
    correlationId,
    toInternshipApplicationDetail,
  );
}

export async function loadMyInternshipApplications(
  group: 'in_progress' | 'to_prepare' | 'closed' | 'all',
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<InternshipApplicationRow>>> {
  return callRpc(
    'list_my_internship_applications',
    { p_group: group, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        rows: asArray(value['rows']).flatMap((entry) => {
          const row = toInternshipApplicationRow(entry);
          return row === null ? [] : [row];
        }),
        nextCursor: sealed(value['next_cursor']),
      };
    },
  );
}

/** ISE-075 — anciens susceptibles d'aider. Raisons obligatoires (D-43). */
export async function loadInternshipHelpers(
  offerId: string | null,
  correlationId: string,
): Promise<QueryResult<InternshipHelper[]>> {
  return callRpc(
    'list_internship_helpers',
    { p_offer_id: offerId, p_limit: 6 },
    correlationId,
    (payload) =>
      asArray(asObject(payload)['rows']).flatMap((entry) => {
        const helper = toInternshipHelper(entry);
        return helper === null ? [] : [helper];
      }),
  );
}

export async function requestInternshipHelp(
  alumniProfileId: string,
  requestType: string,
  message: string,
  relatedOfferId: string | null,
  correlationId: string,
): Promise<QueryResult<{ requestId: string | null; commitsAlumni: boolean }>> {
  return callRpc(
    'request_internship_help',
    {
      p_alumni_profile_id: alumniProfileId,
      p_request_type: requestType,
      p_message: message,
      p_related_offer_id: relatedOfferId,
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        requestId: str(value['request_id']),
        commitsAlumni: bool(value['commits_alumni']),
      };
    },
  );
}

export async function respondToInternshipHelp(
  requestId: string,
  decision: 'view' | 'accept' | 'decline' | 'answer',
  message: string | null,
  correlationId: string,
): Promise<QueryResult<{ status: string }>> {
  return callRpc(
    'respond_to_internship_help_request',
    { p_request_id: requestId, p_decision: decision, p_message: message },
    correlationId,
    (payload) => ({ status: str(asObject(payload)['status']) ?? decision }),
  );
}

export interface InternshipResultInput {
  organizationRaw: string | null;
  countryCode: string;
  city: string | null;
  department: string | null;
  startDate: string;
  endDate: string;
  workMode: string;
  supervisorName: string | null;
  supervisorRole: string | null;
  placementSource: string;
  networkAttribution: 'direct' | 'partial' | 'none' | 'unknown';
  helperProfileId: string | null;
  agreementStatus: string;
}

/** ISE-077 — resultat declare par l'eleve. */
export async function recordInternshipResult(
  applicationId: string,
  input: InternshipResultInput,
  correlationId: string,
): Promise<QueryResult<{ placementId: string | null; impactRecorded: boolean }>> {
  return callRpc(
    'record_internship_result',
    {
      p_application_id: applicationId,
      p_payload: {
        organization_raw: input.organizationRaw,
        country_code: input.countryCode,
        city: input.city,
        department: input.department,
        start_date: input.startDate,
        end_date: input.endDate,
        work_mode: input.workMode,
        professional_supervisor_name: input.supervisorName,
        professional_supervisor_role: input.supervisorRole,
        placement_source: input.placementSource,
        network_attribution: input.networkAttribution,
        attributed_helper_profile_id: input.helperProfileId,
        agreement_status: input.agreementStatus,
      },
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        placementId: str(value['placement_id']),
        impactRecorded: bool(value['impact_recorded']),
      };
    },
  );
}
