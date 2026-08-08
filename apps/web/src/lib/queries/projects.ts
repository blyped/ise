import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import { asArray, asObject, str } from '@/lib/network-view';
import {
  toProjectCard,
  toProjectDetail,
  toProjectFinancials,
  toProjectParticipation,
  type Page,
  type ProjectCard,
  type ProjectDetail,
  type ProjectFinancials,
  type ProjectParticipation,
  type ProjectScope,
  type MyProjectGroup,
} from '@/lib/projects-view';

/**
 * Lectures et ecritures de la tranche PROJETS & CONSORTIUMS
 * (ISE-088 -> ISE-091). Tout passe par les RPC de la migration 0073.
 *
 * REGLE CARDINALE (MASTER PROMPT §32) : ce module expose DEUX chemins
 * qui ne se remplacent jamais —
 *   * `submitProjectInterest()` enregistre une EXPRESSION D'INTERET ;
 *   * `confirmProjectMembership()` enregistre un CONSENTEMENT horodate,
 *     seul chemin vers une appartenance `active`.
 * Aucun appel de l'un ne declenche l'autre.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export * from '@/lib/projects-view';

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] projets — RPC en échec', { correlationId, rpc: name, code: error.code });
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

export interface ProjectFilters {
  scope: ProjectScope;
  query: string | null;
  projectType: string | null;
  sectorId: number | null;
  countryCode: string | null;
  compensation: string | null;
  status: string;
}

/** ISE-088 — hub. */
export async function loadProjects(
  filters: ProjectFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<ProjectCard>>> {
  return callRpc(
    'list_projects',
    {
      p_scope: filters.scope,
      p_query: filters.query,
      p_project_type: filters.projectType,
      p_sector_id: filters.sectorId,
      p_country_code: filters.countryCode,
      p_compensation: filters.compensation,
      p_status: filters.status,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => toPage(payload, toProjectCard),
  );
}

/** ISE-088 — onglet « Mes collaborations ». */
export async function loadMyProjects(
  group: MyProjectGroup,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<ProjectCard>>> {
  return callRpc(
    'list_my_projects',
    { p_group: group, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toProjectCard),
  );
}

/** ISE-089 — detail. */
export async function loadProject(
  projectId: string,
  correlationId: string,
): Promise<QueryResult<ProjectDetail | null>> {
  return callRpc('get_project', { p_project: projectId }, correlationId, toProjectDetail);
}

/** ISE-091 — ma participation. */
export async function loadMyParticipation(
  projectId: string,
  correlationId: string,
): Promise<QueryResult<ProjectParticipation | null>> {
  return callRpc(
    'get_my_project_participation',
    { p_project: projectId },
    correlationId,
    toProjectParticipation,
  );
}

/**
 * Donnees financieres du projet. La base refuse (42501) tout appelant
 * hors equipe : cette fonction n'est appelee que depuis ISE-091.
 */
export async function loadProjectFinancials(
  projectId: string,
  correlationId: string,
): Promise<QueryResult<ProjectFinancials | null>> {
  return callRpc(
    'get_project_confidential_details',
    { p_project: projectId },
    correlationId,
    toProjectFinancials,
  );
}

/* ------------------------------------------------------------------ */
/* Ecritures                                                           */
/* ------------------------------------------------------------------ */

export interface InterestResult {
  applicationId: string;
  status: string;
  /** Toujours `false`. La base le renvoie pour que l'ecran le dise. */
  createsMembership: boolean;
}

/** ISE-090 — EXPRESSION D'INTERET. Ne cree jamais de membre d'equipe. */
export async function submitProjectInterest(
  input: {
    projectId: string;
    roleId: string | null;
    message: string | null;
    availabilityNotes: string | null;
    availabilityConfirmed: boolean;
    termsAcknowledged: boolean;
    cvConsent: boolean;
  },
  correlationId: string,
): Promise<QueryResult<InterestResult>> {
  return callRpc(
    'submit_project_interest',
    {
      p_project: input.projectId,
      p_role: input.roleId,
      p_message: input.message,
      p_availability_notes: input.availabilityNotes,
      p_availability_confirmed: input.availabilityConfirmed,
      p_terms_acknowledged: input.termsAcknowledged,
      p_cv_consent: input.cvConsent,
    },
    correlationId,
    (data) => {
      const raw = asObject(data);
      return {
        applicationId: str(raw['application_id']) ?? '',
        status: str(raw['status']) ?? 'submitted',
        createsMembership: raw['creates_membership'] === true,
      };
    },
  );
}

export async function withdrawProjectInterest(
  applicationId: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'withdraw_project_interest',
    { p_application: applicationId },
    correlationId,
    () => null,
  );
}

/** Une invitation acceptee produit `pending_confirmation`, pas `active`. */
export async function respondProjectInvitation(
  invitationId: string,
  response: 'accepted' | 'declined' | 'question_asked',
  correlationId: string,
): Promise<QueryResult<string | null>> {
  return callRpc(
    'respond_project_invitation',
    { p_invitation: invitationId, p_response: response },
    correlationId,
    (data) => str(asObject(data)['membership_status']),
  );
}

/** SEUL chemin vers une appartenance `active`. Consentement horodate. */
export async function confirmProjectMembership(
  projectId: string,
  agreedTerms: Record<string, unknown>,
  cvConsent: boolean,
  correlationId: string,
): Promise<QueryResult<string | null>> {
  return callRpc(
    'confirm_project_membership',
    { p_project: projectId, p_agreed_terms: agreedTerms, p_cv_consent: cvConsent },
    correlationId,
    (data) => str(asObject(data)['confirmed_at']),
  );
}

export async function withdrawProjectMembership(
  projectId: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'withdraw_project_membership',
    { p_project: projectId },
    correlationId,
    () => null,
  );
}

export async function setMilestoneStatus(
  milestoneId: string,
  status: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'set_project_milestone_status',
    { p_milestone: milestoneId, p_status: status },
    correlationId,
    () => null,
  );
}
