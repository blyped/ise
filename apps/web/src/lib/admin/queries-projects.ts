import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import {
  toProjectCard,
  toProjectDetail,
  toProjectFinancials,
  type ProjectCard,
  type ProjectDetail,
  type ProjectFinancials,
} from '@/lib/projects-view';
import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes SA-023->026 (projets & consortiums, admin).
 *
 * `admin_list_projects` est neuve (0094) : seule fonction a lister TOUS
 * les statuts, y compris les brouillons, que `list_projects` exclut par
 * construction (`pr.status <> 'draft'`). `get_project` et
 * `get_project_confidential_details` sont en revanche REUTILISEES
 * telles quelles, sans wrapper `admin_` : leurs verifications internes
 * (`private.can_see_project`, `private.is_project_member`) accordent
 * deja un bypass a `projects.manage` (0045/0027) — meme principe que
 * SA-021/022 pour les opportunites. Les mappers (`toProjectCard`,
 * `toProjectDetail`, `toProjectFinancials`) viennent de
 * `lib/projects-view.ts` (module pur, sans dependance serveur) : meme
 * forme de reponse cote membre et cote admin, pas de duplication.
 */

function rawCursor(sealed: string | null): string | null {
  if (sealed === null || sealed.length === 0) return null;
  return unsealCursor(sealed);
}

export interface AdminProjectPage {
  rows: ProjectCard[];
  nextCursor: string | null;
}

export interface AdminProjectFilters {
  status: string | null;
  projectType: string | null;
  query: string | null;
}

export function loadAdminProjects(
  filters: AdminProjectFilters,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminProjectPage>> {
  return adminRpc(
    'admin_list_projects',
    {
      p_status: filters.status,
      p_project_type: filters.projectType,
      p_query: filters.query,
      p_cursor: rawCursor(cursor),
      p_limit: 25,
    },
    correlationId,
    (payload) => {
      const raw =
        payload !== null && typeof payload === 'object'
          ? (payload as { rows?: unknown[]; next_cursor?: unknown })
          : {};
      const rows = Array.isArray(raw.rows)
        ? raw.rows.flatMap((row) => {
            const mapped = toProjectCard(row);
            return mapped === null ? [] : [mapped];
          })
        : [];
      const nextRaw = raw.next_cursor;
      return {
        rows,
        nextCursor: typeof nextRaw === 'string' && nextRaw.length > 0 ? sealCursor(nextRaw) : null,
      };
    },
  );
}

/** SA-024/025/026 — `get_project` existant (0073) : bypass admin deja en base. */
export function loadAdminProject(
  projectId: string,
  correlationId: string,
): Promise<AdminRpcResult<ProjectDetail | null>> {
  return adminRpc('get_project', { p_project_id: projectId }, correlationId, toProjectDetail);
}

/** SA-026 — `get_project_confidential_details` existant (0073) : bypass admin deja en base. */
export function loadAdminProjectFinancials(
  projectId: string,
  correlationId: string,
): Promise<AdminRpcResult<ProjectFinancials | null>> {
  return adminRpc(
    'get_project_confidential_details',
    { p_project_id: projectId },
    correlationId,
    toProjectFinancials,
  );
}

export interface AdminConsortiumRequestRow {
  id: string;
  projectId: string;
  projectTitle: string;
  organizationId: string;
  organizationName: string | null;
  requestedByProfileId: string;
  partnerRole: string;
  message: string | null;
  credentialsSummary: string | null;
  status: string;
  decidedByProfileId: string | null;
  decidedAt: string | null;
  submittedAt: string;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toConsortiumRequestRow(value: unknown): AdminConsortiumRequestRow | null {
  const raw =
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const id = str(raw['id']);
  if (id === null) return null;
  return {
    id,
    projectId: str(raw['project_id']) ?? '',
    projectTitle: str(raw['project_title']) ?? '',
    organizationId: str(raw['organization_id']) ?? '',
    organizationName: str(raw['organization_name']),
    requestedByProfileId: str(raw['requested_by_profile_id']) ?? '',
    partnerRole: str(raw['partner_role']) ?? 'partner',
    message: str(raw['message']),
    credentialsSummary: str(raw['credentials_summary']),
    status: str(raw['status']) ?? 'submitted',
    decidedByProfileId: str(raw['decided_by_profile_id']),
    decidedAt: str(raw['decided_at']),
    submittedAt: str(raw['submitted_at']) ?? '',
  };
}

export interface AdminConsortiumRequestPage {
  rows: AdminConsortiumRequestRow[];
  nextCursor: string | null;
}

/** SA-025 — Demandes de consortium d'un projet donne. */
export function loadAdminConsortiumRequests(
  projectId: string,
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminConsortiumRequestPage>> {
  return adminRpc(
    'admin_list_consortium_requests',
    { p_project_id: projectId, p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => {
      const raw =
        payload !== null && typeof payload === 'object'
          ? (payload as { rows?: unknown[]; next_cursor?: unknown })
          : {};
      const rows = Array.isArray(raw.rows)
        ? raw.rows.flatMap((row) => {
            const mapped = toConsortiumRequestRow(row);
            return mapped === null ? [] : [mapped];
          })
        : [];
      const nextRaw = raw.next_cursor;
      return {
        rows,
        nextCursor: typeof nextRaw === 'string' && nextRaw.length > 0 ? sealCursor(nextRaw) : null,
      };
    },
  );
}
