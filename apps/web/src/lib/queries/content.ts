import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import { asArray, asObject, str } from '@/lib/network-view';
import {
  toEventCard,
  toEventDetail,
  toEventFollowup,
  toFeedEntry,
  toNewsDetail,
  type EventCard,
  type EventDetail,
  type EventFollowup,
  type EventScope,
  type FeedEntry,
  type FeedScope,
  type NewsDetail,
  type Page,
} from '@/lib/content-view';

/**
 * Lectures et ecritures de la tranche ACTUALITES & EVENEMENTS
 * (ISE-092 -> ISE-096). Tout passe par les RPC de la migration 0074.
 *
 * CE MODULE N'EXPOSE AUCUN CHEMIN vers `news.editorial_status` : le
 * circuit editorial appartient au CMS (D-128). Il n'expose pas non plus
 * `landing_visibility` en ecriture : rendre un contenu visible du web
 * ouvert exige `cms.publish` (D-131).
 *
 * L'URL de connexion d'un evenement en ligne se demande par
 * `loadEventOnlineUrl()`, jamais par une projection.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export * from '@/lib/content-view';

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] actualités & événements — RPC en échec', {
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

/** ISE-092 — fil mixte actualites + evenements. */
export async function loadNetworkFeed(
  scope: FeedScope,
  query: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<FeedEntry>>> {
  return callRpc(
    'list_network_feed',
    { p_scope: scope, p_query: query, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toFeedEntry),
  );
}

/** ISE-093 — detail d'une actualite. */
export async function loadNews(
  newsId: string,
  correlationId: string,
): Promise<QueryResult<NewsDetail | null>> {
  return callRpc('get_news', { p_news: newsId }, correlationId, toNewsDetail);
}

export interface EventFilters {
  scope: EventScope;
  query: string | null;
  format: string | null;
  countryCode: string | null;
}

/** ISE-094 — espace evenements. */
export async function loadEvents(
  filters: EventFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<EventCard>>> {
  return callRpc(
    'list_events',
    {
      p_scope: filters.scope,
      p_query: filters.query,
      p_format: filters.format,
      p_country_code: filters.countryCode,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => toPage(payload, toEventCard),
  );
}

/** ISE-095 — detail d'un evenement. */
export async function loadEvent(
  eventId: string,
  correlationId: string,
): Promise<QueryResult<EventDetail | null>> {
  return callRpc('get_event', { p_event: eventId }, correlationId, toEventDetail);
}

/**
 * Lien de connexion. Fonction dediee, jamais une colonne projetee :
 * `events.online_url_private` a son privilege de lecture retire depuis
 * la migration 0046 (docs/rls.md §10.7).
 */
export async function loadEventOnlineUrl(
  eventId: string,
  correlationId: string,
): Promise<QueryResult<string | null>> {
  return callRpc('get_event_online_url', { p_event: eventId }, correlationId, (data) => str(data));
}

/** ISE-096 — apres l'evenement. */
export async function loadEventFollowup(
  eventId: string,
  correlationId: string,
): Promise<QueryResult<EventFollowup | null>> {
  return callRpc('get_event_followup', { p_event: eventId }, correlationId, toEventFollowup);
}

/* ------------------------------------------------------------------ */
/* Ecritures                                                           */
/* ------------------------------------------------------------------ */

export interface EventAnswer {
  questionId: string;
  answer: string;
}

/** Inscription en un clic. La base decide de l'etat obtenu. */
export async function registerToEvent(
  eventId: string,
  answers: EventAnswer[],
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'register_to_event',
    {
      p_event: eventId,
      p_answers: answers.map((entry) => ({
        question_id: entry.questionId,
        answer: entry.answer,
      })),
    },
    correlationId,
    (data) => str(asObject(data)['status']) ?? 'registered',
  );
}

export async function cancelEventRegistration(
  eventId: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc('cancel_event_registration', { p_event: eventId }, correlationId, () => null);
}

export async function setEventRegistrationListed(
  eventId: string,
  listed: boolean,
  correlationId: string,
): Promise<QueryResult<boolean>> {
  return callRpc(
    'set_event_registration_listed',
    { p_event: eventId, p_listed: listed },
    correlationId,
    (data) => asObject(data)['is_listed'] === true,
  );
}

/** ISE-096 — le membre DECLARE une suite constatee (D-55). */
export async function declareEventOutcome(
  input: {
    eventId: string;
    outcomeType: string;
    targetEntityType: string | null;
    targetEntityId: string | null;
    notes: string | null;
  },
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'declare_event_outcome',
    {
      p_event: input.eventId,
      p_outcome_type: input.outcomeType,
      p_target_entity_type: input.targetEntityType,
      p_target_entity_id: input.targetEntityId,
      p_notes: input.notes,
    },
    correlationId,
    (data) => str(asObject(data)['outcome_id']) ?? '',
  );
}

export async function deleteEventOutcome(
  outcomeId: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc('delete_event_outcome', { p_outcome: outcomeId }, correlationId, () => null);
}
