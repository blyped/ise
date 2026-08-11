import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import {
  toEventCard,
  toEventDetail,
  toEventFollowup,
  type EventCard,
  type EventDetail,
  type EventFollowup,
} from '@/lib/content-view';
import { toProfileCard, type NetworkProfileCard } from '@/lib/network-view';
import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes SA-030->033 (evenements, admin).
 *
 * `admin_list_events` est neuve (0100) : seule fonction a lister TOUS
 * les statuts, y compris 'draft'/'pending_review', que
 * `public.list_events` (0074) exclut par construction. Elle reutilise
 * en base `private.event_card()` : meme forme de ligne que cote membre,
 * mappee ici par `toEventCard` (`lib/content-view.ts`, ISE-094->096) —
 * pas de duplication de mapper.
 *
 * `get_event` et `get_event_followup` sont en revanche REUTILISEES
 * telles quelles, sans wrapper `admin_` : leur verification interne
 * (`private.can_see_event` / `private.is_event_organizer`) accorde deja
 * un bypass a `events.manage` (0046) — meme principe que SA-024/028
 * reutilisant `get_project`/`get_community`. `get_event_followup`
 * couvre la LECTURE du bilan et de l'instantane d'impact (SA-033) ;
 * l'ECRITURE passe par les fonctions neuves `admin_upsert_event_followup`
 * et `admin_record_event_impact_snapshot` (0100).
 */

function rawCursor(sealed: string | null): string | null {
  if (sealed === null || sealed.length === 0) return null;
  return unsealCursor(sealed);
}

export interface AdminEventPage {
  rows: EventCard[];
  nextCursor: string | null;
}

export interface AdminEventFilters {
  status: string | null;
  eventTypeCode: string | null;
  format: string | null;
  query: string | null;
}

export function loadAdminEvents(
  filters: AdminEventFilters,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminEventPage>> {
  return adminRpc(
    'admin_list_events',
    {
      p_status: filters.status,
      p_event_type_code: filters.eventTypeCode,
      p_format: filters.format,
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
            const mapped = toEventCard(row);
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

/** SA-031/032/033 — `get_event` existant (0074) : bypass admin deja en base. */
export function loadAdminEvent(
  eventId: string,
  correlationId: string,
): Promise<AdminRpcResult<EventDetail | null>> {
  return adminRpc('get_event', { p_event: eventId }, correlationId, toEventDetail);
}

/** SA-033 — `get_event_followup` existant (0074) : bilan + instantane d'impact, bypass admin deja en base. */
export function loadAdminEventFollowup(
  eventId: string,
  correlationId: string,
): Promise<AdminRpcResult<EventFollowup | null>> {
  return adminRpc('get_event_followup', { p_event: eventId }, correlationId, toEventFollowup);
}

function str0(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * SA-031 — `get_event_online_url` existant (0046) : trois portes
 * successives (visibilite, organisateur, inscrit) bypassent deja
 * `events.manage` via `private.is_event_organizer`. Reutilisee pour
 * prereplir le lien prive dans le formulaire d'edition — jamais
 * projetee par `get_event`/`toEventDetail` (D-150).
 */
export function loadAdminEventOnlineUrl(
  eventId: string,
  correlationId: string,
): Promise<AdminRpcResult<string | null>> {
  return adminRpc('get_event_online_url', { p_event: eventId }, correlationId, str0);
}

export interface AdminEventRegistrationRow {
  eventId: string;
  profileId: string;
  profile: NetworkProfileCard | null;
  status: string;
  registeredAt: string;
  cancelledAt: string | null;
  checkedInAt: string | null;
  attendedAt: string | null;
  isListed: boolean;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function bool(value: unknown): boolean {
  return value === true;
}

function toRegistrationRow(value: unknown): AdminEventRegistrationRow | null {
  const raw =
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const eventId = str(raw['event_id']);
  const profileId = str(raw['profile_id']);
  if (eventId === null || profileId === null) return null;
  return {
    eventId,
    profileId,
    profile: toProfileCard(raw['profile']),
    status: str(raw['status']) ?? 'registered',
    registeredAt: str(raw['registered_at']) ?? '',
    cancelledAt: str(raw['cancelled_at']),
    checkedInAt: str(raw['checked_in_at']),
    attendedAt: str(raw['attended_at']),
    isListed: bool(raw['is_listed']),
  };
}

export interface AdminEventRegistrationPage {
  rows: AdminEventRegistrationRow[];
  nextCursor: string | null;
}

/** SA-032 — Suivi des inscriptions d'un evenement, tous statuts. */
export function loadAdminEventRegistrations(
  eventId: string,
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminEventRegistrationPage>> {
  return adminRpc(
    'admin_list_event_registrations',
    { p_event_id: eventId, p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => {
      const raw =
        payload !== null && typeof payload === 'object'
          ? (payload as { rows?: unknown[]; next_cursor?: unknown })
          : {};
      const rows = Array.isArray(raw.rows)
        ? raw.rows.flatMap((row) => {
            const mapped = toRegistrationRow(row);
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
