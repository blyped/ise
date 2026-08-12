import {
  connectionMachine,
  introductionMachine,
  type ConnectionStatus,
  type IntroductionStatus,
} from '@ise/domain';
import { INTRODUCTION_OUTCOMES, type IntroductionOutcome } from '@ise/validation';

import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-038 -> ISE-046 — Relations & introductions (coquille mobile).
 *
 * Portage direct des RPC de la migration 0039, deja utilisees par
 * `apps/web/src/lib/queries/network.ts` / `apps/web/src/lib/network-view.ts` :
 * `send_connection_request`, `get_connection_request`,
 * `list_connection_requests`, `accept_connection_request`,
 * `respond_to_connection_request`, `suggest_introduction_paths`,
 * `request_introduction`, `list_my_introductions`,
 * `get_introduction_request`, `transition_introduction`,
 * `declare_introduction_outcome`. Comme sur le web, AUCUN `select` n'est
 * fait ici sur `ise_profiles`, `connections`, `connection_requests` ou
 * `introduction_requests` (MASTER PROMPT §47) : la base compose seule la
 * carte de profil et l'etat de chaque demande.
 *
 * `introductionMachine` / `connectionMachine` (`@ise/domain`) restent
 * l'UNIQUE source des libelles de statut et des transitions permises
 * (D-50) : ce module ne les redefinit pas, il se contente de les
 * utiliser pour narrower les chaines renvoyees par la base au moment du
 * parsing.
 *
 * Pagination : meme choix que `queries/network.ts` et
 * `queries/network-calls.ts` — « charger la suite » sur le curseur
 * keyset renvoye tel quel par la RPC (D-44), SANS scellement cote
 * client. Contrairement au web (`lib/opaque-cursor.ts`), il n'y a pas de
 * serveur applicatif intercale ici pour sceller/desceller un jeton
 * opaque : le curseur transite tel quel entre l'app et Supabase, sous le
 * meme RLS que toute autre requete authentifiee de ce client mobile.
 *
 * Convention deja etablie par `queries/network-calls.ts` : la carte de
 * profil legere (`NetworkProfileCard`) et sa conversion sont DUPLIQUEES
 * localement plutot que partagees via un module commun — il n'existe
 * pas de `network-view.ts` cote mobile.
 */

/* ------------------------------------------------------------------ */
/* Aides JSON — copie du style de queries/network.ts et queries/network-calls.ts */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const bool = (value: unknown): boolean => value === true;
const strings = (value: unknown): string[] =>
  asArray(value).filter((entry): entry is string => typeof entry === 'string');

const inList = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null;

/* ------------------------------------------------------------------ */
/* Carte de profil legere (duplication assumee, cf. network-calls.ts)  */
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

/* ------------------------------------------------------------------ */
/* Vocabulaire ferme (aligne sur packages/validation/src/network.ts)   */
/* ------------------------------------------------------------------ */

/** Codes de `connection_requests.context` — jamais un libelle invente. */
export const CONNECTION_CONTEXTS = [
  'promotion',
  'organization',
  'sector',
  'event',
  'project',
  'network_call',
  'opportunity',
  'introduction',
  'other',
] as const;
export type ConnectionContext = (typeof CONNECTION_CONTEXTS)[number];

/** Codes de `introduction_requests.purpose`. */
export const INTRODUCTION_PURPOSES = [
  'advice',
  'expertise',
  'opportunity',
  'consortium',
  'mentorship',
  'partnership',
  'other',
] as const;
export type IntroductionPurpose = (typeof INTRODUCTION_PURPOSES)[number];

/** Bilan d'introduction — vocabulaire ferme, source unique `@ise/validation`. */
export { INTRODUCTION_OUTCOMES, type IntroductionOutcome };

/* ------------------------------------------------------------------ */
/* Demandes de connexion — ISE-038 / ISE-039 / ISE-041 / ISE-042        */
/* ------------------------------------------------------------------ */

const CONNECTION_REQUEST_STATUSES = connectionMachine.states;
export type ConnectionRequestStatus = ConnectionStatus;

function toConnectionRequestStatus(value: unknown): ConnectionRequestStatus {
  return inList(CONNECTION_REQUEST_STATUSES, value) ?? 'pending';
}

export interface ConnectionRequestRow {
  readonly requestId: string;
  readonly status: ConnectionRequestStatus;
  readonly context: string | null;
  readonly message: string | null;
  readonly createdAt: string | null;
  readonly expiresAt: string | null;
  readonly respondedAt: string | null;
  readonly profile: NetworkProfileCard;
}

function toConnectionRequestRow(value: unknown): ConnectionRequestRow | null {
  const raw = asObject(value);
  const requestId = str(raw['request_id']);
  const profile = toProfileCard(raw['profile']);
  if (requestId === null || profile === null) return null;

  return {
    requestId,
    status: toConnectionRequestStatus(raw['status']),
    context: str(raw['context']),
    message: str(raw['message']),
    createdAt: str(raw['created_at']),
    expiresAt: str(raw['expires_at']),
    respondedAt: str(raw['responded_at']),
    profile,
  };
}

export interface ConnectionRequestDetail extends ConnectionRequestRow {
  readonly myRole: 'requester' | 'addressee';
  readonly commonGround: {
    readonly sharesPromotion: boolean;
    readonly sharedOrganization: string | null;
    readonly mutualConnections: readonly { profileId: string; displayName: string }[];
  };
}

function toConnectionRequestDetail(value: unknown): ConnectionRequestDetail | null {
  const row = toConnectionRequestRow(value);
  if (row === null) return null;
  const raw = asObject(value);
  const common = asObject(raw['common_ground']);

  return {
    ...row,
    myRole: str(raw['my_role']) === 'requester' ? 'requester' : 'addressee',
    commonGround: {
      sharesPromotion: bool(common['shares_promotion']),
      sharedOrganization: str(common['shared_organization']),
      mutualConnections: asArray(common['mutual_connections']).flatMap((entry) => {
        const item = asObject(entry);
        const profileId = str(item['profile_id']);
        const displayName = str(item['display_name']);
        return profileId !== null && displayName !== null ? [{ profileId, displayName }] : [];
      }),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Chemins d'introduction — ISE-043                                    */
/* ------------------------------------------------------------------ */

export type PathLabel = 'recommended' | 'relevant' | 'possible';

function toPathLabel(value: unknown): PathLabel {
  const candidate = str(value);
  return candidate === 'recommended' || candidate === 'relevant' ? candidate : 'possible';
}

export interface IntroductionPath {
  readonly intermediary: NetworkProfileCard;
  /** Libelle QUALITATIF. Aucun score numerique n'existe cote client (§15). */
  readonly label: PathLabel;
  /** Signaux explicites ayant produit le libelle (D-43). */
  readonly reasons: readonly string[];
  readonly connectedSince: string | null;
  readonly targetLinkSince: string | null;
  readonly targetLinkContext: string | null;
  /** Demande deja en cours via cet intermediaire, le cas echeant. */
  readonly pendingRequestId: string | null;
}

export interface IntroductionPathsView {
  readonly target: NetworkProfileCard;
  readonly alreadyConnected: boolean;
  readonly paths: readonly IntroductionPath[];
}

function toIntroductionPathsView(value: unknown): IntroductionPathsView | null {
  const raw = asObject(value);
  const target = toProfileCard(raw['target']);
  if (target === null) return null;

  return {
    target,
    alreadyConnected: bool(raw['already_connected']),
    paths: asArray(raw['paths']).flatMap((entry) => {
      const item = asObject(entry);
      const intermediary = toProfileCard(item['intermediary']);
      if (intermediary === null) return [];
      return [
        {
          intermediary,
          label: toPathLabel(item['label']),
          reasons: strings(item['reasons']),
          connectedSince: str(item['connected_since']),
          targetLinkSince: str(item['target_link_since']),
          targetLinkContext: str(item['target_link_context']),
          pendingRequestId: str(item['pending_request_id']),
        },
      ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Introductions — ISE-044 / ISE-045 / ISE-046                         */
/* ------------------------------------------------------------------ */

const INTRODUCTION_STATUSES = introductionMachine.states;

function toIntroductionStatus(value: unknown): IntroductionStatus {
  return inList(INTRODUCTION_STATUSES, value) ?? 'requested';
}

export type IntroductionRole = 'requester' | 'intermediary' | 'target';

function toIntroductionRole(value: unknown): IntroductionRole {
  const candidate = str(value);
  return candidate === 'intermediary' || candidate === 'target' ? candidate : 'requester';
}

export interface IntroductionEventRow {
  readonly eventType: string;
  readonly toStatus: string | null;
  readonly actorRole: string;
  readonly createdAt: string | null;
}

export interface IntroductionRow {
  readonly introductionId: string;
  readonly status: IntroductionStatus;
  readonly purpose: string;
  readonly myRole: IntroductionRole;
  readonly createdAt: string | null;
  readonly requester: NetworkProfileCard | null;
  readonly intermediary: NetworkProfileCard | null;
  readonly target: NetworkProfileCard | null;
}

function toIntroductionRow(value: unknown): IntroductionRow | null {
  const raw = asObject(value);
  const id = str(raw['introduction_id']);
  if (id === null) return null;

  return {
    introductionId: id,
    status: toIntroductionStatus(raw['status']),
    purpose: str(raw['purpose']) ?? 'other',
    myRole: toIntroductionRole(raw['my_role']),
    createdAt: str(raw['created_at']),
    requester: toProfileCard(raw['requester']),
    intermediary: toProfileCard(raw['intermediary']),
    target: toProfileCard(raw['target']),
  };
}

export interface IntroductionDetail extends IntroductionRow {
  readonly expiresAt: string | null;
  readonly intermediaryRespondedAt: string | null;
  readonly introducedAt: string | null;
  readonly targetRespondedAt: string | null;
  readonly completedAt: string | null;
  readonly outcome: string | null;
  readonly outcomeNote: string | null;
  readonly outcomeDeclaredAt: string | null;
  readonly outcomeDeclaredByRole: string | null;
  /** Absent de la charge utile quand le lecteur est la personne visee. */
  readonly messageToIntermediary: string | null;
  readonly messageToTarget: string | null;
  readonly declineReason: string | null;
  readonly events: readonly IntroductionEventRow[];
}

function toIntroductionDetail(value: unknown): IntroductionDetail | null {
  const row = toIntroductionRow(value);
  if (row === null) return null;
  const raw = asObject(value);

  return {
    ...row,
    expiresAt: str(raw['expires_at']),
    intermediaryRespondedAt: str(raw['intermediary_responded_at']),
    introducedAt: str(raw['introduced_at']),
    targetRespondedAt: str(raw['target_responded_at']),
    completedAt: str(raw['completed_at']),
    outcome: str(raw['outcome']),
    outcomeNote: str(raw['outcome_note']),
    outcomeDeclaredAt: str(raw['outcome_declared_at']),
    outcomeDeclaredByRole: str(raw['outcome_declared_by_role']),
    messageToIntermediary: str(raw['message_to_intermediary']),
    messageToTarget: str(raw['message_to_target']),
    declineReason: str(raw['decline_reason']),
    events: asArray(raw['events']).flatMap((entry) => {
      const item = asObject(entry);
      const eventType = str(item['event_type']);
      if (eventType === null) return [];
      return [
        {
          eventType,
          toStatus: str(item['to_status']),
          actorRole: str(item['actor_role']) ?? 'system',
          createdAt: str(item['created_at']),
        },
      ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Pagination et resultat generique                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Lectures                                                             */
/* ------------------------------------------------------------------ */

/** ISE-043 — chemins d'introduction vers un profil cible. */
export async function loadIntroductionPaths(
  targetProfileId: string,
): Promise<QueryOutcome<IntroductionPathsView | null>> {
  return rpc(
    'suggest_introduction_paths',
    { p_target_profile_id: targetProfileId, p_limit: 10 },
    toIntroductionPathsView,
  );
}

/** ISE-041 / ISE-042 — demandes de connexion recues ou envoyees. */
export async function loadConnectionRequests(
  direction: 'received' | 'sent',
  status: ConnectionRequestStatus,
  cursor: string | null,
): Promise<QueryOutcome<Page<ConnectionRequestRow>>> {
  return rpc(
    'list_connection_requests',
    { p_direction: direction, p_status: status, p_cursor: cursor, p_limit: 20 },
    (payload) => toPage(payload, toConnectionRequestRow),
  );
}

/** ISE-039 / ISE-042 — detail d'une demande de connexion. */
export async function loadConnectionRequest(
  requestId: string,
): Promise<QueryOutcome<ConnectionRequestDetail | null>> {
  return rpc('get_connection_request', { p_request_id: requestId }, toConnectionRequestDetail);
}

/** ISE-045 — mes demandes d'introduction (liste, filtrable par role). */
export async function loadIntroductions(
  scope: 'all' | 'requester' | 'intermediary' | 'target',
  cursor: string | null,
): Promise<QueryOutcome<Page<IntroductionRow>>> {
  return rpc(
    'list_my_introductions',
    { p_scope: scope, p_cursor: cursor, p_limit: 20 },
    (payload) => toPage(payload, toIntroductionRow),
  );
}

/** ISE-045 / ISE-046 — detail d'une introduction, avec sa frise d'evenements. */
export async function loadIntroduction(
  introductionId: string,
): Promise<QueryOutcome<IntroductionDetail | null>> {
  return rpc(
    'get_introduction_request',
    { p_introduction_id: introductionId },
    toIntroductionDetail,
  );
}

/* ------------------------------------------------------------------ */
/* Ecritures                                                            */
/* ------------------------------------------------------------------ */

/** ISE-038 — envoyer une demande de connexion. */
export async function sendConnectionRequest(
  addresseeProfileId: string,
  message: string | null,
  context: ConnectionContext | null,
): Promise<WriteOutcome<string>> {
  return rpcWrite(
    'send_connection_request',
    { p_addressee_profile_id: addresseeProfileId, p_message: message, p_context: context },
    (data) => str(asObject(data)['request_id']) ?? '',
  );
}

/** ISE-041 / ISE-042 — accepter une invitation. Cree la relation en meme temps (D-50). */
export async function acceptConnectionRequest(requestId: string): Promise<WriteOutcome<null>> {
  return rpcWrite('accept_connection_request', { p_request_id: requestId }, () => null);
}

/**
 * ISE-039 / ISE-041 / ISE-042 — decliner ou retirer une demande de
 * connexion. « Ignorer » n'appelle JAMAIS cette fonction (D-55) : voir
 * `InvitationsScreen`, qui traite « Ignorer » comme un simple retrait
 * visuel local.
 */
export async function respondToConnectionRequest(
  requestId: string,
  toStatus: 'declined' | 'withdrawn',
): Promise<WriteOutcome<null>> {
  return rpcWrite(
    'respond_to_connection_request',
    { p_request_id: requestId, p_to_status: toStatus, p_reason: null },
    () => null,
  );
}

export interface RequestIntroductionInput {
  readonly intermediaryProfileId: string;
  readonly targetProfileId: string;
  readonly purpose: IntroductionPurpose;
  readonly messageToIntermediary: string;
  readonly messageToTarget: string | null;
}

/** ISE-044 — demander une introduction. La base verifie les deux maillons du chemin (D-51). */
export async function requestIntroduction(
  input: RequestIntroductionInput,
): Promise<WriteOutcome<string>> {
  return rpcWrite(
    'request_introduction',
    {
      p_intermediary_profile_id: input.intermediaryProfileId,
      p_target_profile_id: input.targetProfileId,
      p_purpose: input.purpose,
      p_message_to_intermediary: input.messageToIntermediary,
      p_message_to_target: input.messageToTarget,
    },
    (data) => str(asObject(data)['introduction_id']) ?? '',
  );
}

/**
 * ISE-045 — faire avancer une introduction. Seules les transitions
 * rendues par `introductionMachine.available(statut, acteur)` doivent
 * etre proposees a l'ecran (D-50) ; `completed` et `no_outcome` en sont
 * TOUJOURS exclus ici, ils passent par `declareIntroductionOutcome`.
 */
export async function transitionIntroduction(
  introductionId: string,
  toStatus: Exclude<IntroductionStatus, 'requested' | 'expired' | 'completed' | 'no_outcome'>,
  note: string | null,
): Promise<WriteOutcome<null>> {
  return rpcWrite(
    'transition_introduction',
    { p_introduction_id: introductionId, p_to_status: toStatus, p_note: note },
    () => null,
  );
}

/**
 * ISE-046 — declarer le resultat reel d'une introduction. La base
 * refuse tant que `target_responded` n'a pas ete constate (MASTER
 * PROMPT §25, D-55) : cet appel ne le revalide pas, il relaie
 * simplement la reponse de la base.
 */
export async function declareIntroductionOutcome(
  introductionId: string,
  outcome: IntroductionOutcome,
  note: string | null,
): Promise<WriteOutcome<null>> {
  return rpcWrite(
    'declare_introduction_outcome',
    { p_introduction_id: introductionId, p_outcome: outcome, p_note: note },
    () => null,
  );
}
