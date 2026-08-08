import type { IntroductionStatus } from '@ise/domain';

/**
 * Types de vue et conversions PURES de la tranche RELATIONS &
 * INTRODUCTIONS (ISE-038 -> ISE-046).
 *
 * POURQUOI CE FICHIER EXISTE, separe de `lib/queries/network.ts` :
 * `ConnectionsList` et `ProfileSummary` sont des composants CLIENT. S'ils
 * importaient une seule valeur — ne serait-ce que `formatDate` — depuis
 * le module de requetes, le bundler tirerait avec elle
 * `lib/supabase/server.ts`, donc `next/headers`, dans le bundle
 * navigateur. Le build echoue, et c'est heureux : cela signalerait qu'un
 * module serveur part cote client.
 *
 * Regle : tout ce qui est partage entre serveur et navigateur vit ici et
 * n'a AUCUNE dependance serveur. Les acces base restent dans
 * `lib/queries/network.ts`.
 */

/* ------------------------------------------------------------------ */
/* Conversions defensives                                             */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

export const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
export const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
export const bool = (value: unknown): boolean => value === true;

export const strings = (value: unknown): string[] =>
  asArray(value).filter((entry): entry is string => typeof entry === 'string');

/* ------------------------------------------------------------------ */
/* Carte de profil (private.network_profile_card)                     */
/* ------------------------------------------------------------------ */

export interface NetworkAvailability {
  code: string;
  name: string;
}

export interface NetworkProfileCard {
  profileId: string;
  displayName: string;
  verificationStatus: string;
  claimStatus: string;
  isSelf: boolean;
  avatarPath: string | null;
  headline: string | null;
  currentPosition: string | null;
  currentOrganization: string | null;
  currentCity: string | null;
  currentCountry: string | null;
  promotionLabel: string | null;
  skills: string[];
  availabilities: NetworkAvailability[];
}

/**
 * `null` couvre indistinctement : profil inexistant, supprime, suspendu,
 * ou bloque dans un sens ou dans l'autre. La base ne distingue pas ces
 * cas, l'application non plus.
 */
export function toProfileCard(value: unknown): NetworkProfileCard | null {
  const raw = asObject(value);
  const profileId = str(raw['profile_id']);
  if (profileId === null) return null;

  const promotion = asObject(raw['promotion']);

  return {
    profileId,
    displayName: str(raw['display_name']) ?? '',
    verificationStatus: str(raw['verification_status']) ?? 'unverified',
    claimStatus: str(raw['claim_status']) ?? 'unclaimed',
    isSelf: bool(raw['is_self']),
    avatarPath: str(raw['avatar_path']),
    headline: str(raw['headline']),
    currentPosition: str(raw['current_position']),
    currentOrganization: str(raw['current_organization']),
    currentCity: str(raw['current_city']),
    currentCountry: str(raw['current_country']),
    promotionLabel: str(promotion['label']),
    skills: strings(raw['skills']),
    availabilities: asArray(raw['availabilities']).flatMap((entry) => {
      const item = asObject(entry);
      const code = str(item['code']);
      const name = str(item['name']);
      return code !== null && name !== null ? [{ code, name }] : [];
    }),
  };
}

/** Ligne d'identite : « ISE 2005 · Directrice stratégie ». */
export function identityLine(card: NetworkProfileCard): string {
  return [card.promotionLabel, card.currentPosition]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');
}

/** Ligne de lieu : « Abidjan, Côte d'Ivoire ». */
export function locationLine(card: NetworkProfileCard): string {
  return [card.currentCity, card.currentCountry]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');
}

/* ------------------------------------------------------------------ */
/* Lignes de liste                                                    */
/* ------------------------------------------------------------------ */

export interface Page<T> {
  rows: T[];
  /** Curseur SCELLE, remis tel quel au client. `null` = fin de liste. */
  nextCursor: string | null;
}

export interface ConnectionRow {
  profile: NetworkProfileCard;
  connectedAt: string | null;
  /** Code de `connections.context`, jamais un libelle. */
  context: string | null;
}

export type ConnectionRequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';

const REQUEST_STATUSES: readonly ConnectionRequestStatus[] = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
];

export function toRequestStatus(value: unknown): ConnectionRequestStatus {
  const candidate = str(value);
  return candidate !== null && (REQUEST_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as ConnectionRequestStatus)
    : 'pending';
}

export interface ConnectionRequestRow {
  requestId: string;
  status: ConnectionRequestStatus;
  context: string | null;
  message: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  profile: NetworkProfileCard;
}

export interface ConnectionRequestDetail extends ConnectionRequestRow {
  myRole: 'requester' | 'addressee';
  commonGround: {
    sharesPromotion: boolean;
    sharedOrganization: string | null;
    mutualConnections: { profileId: string; displayName: string }[];
  };
}

export interface NetworkSummary {
  connections: number;
  promotions: number;
  countries: number;
  availableToHelp: number;
  byAvailability: { code: string; name: string; count: number }[];
  pendingReceived: number;
  pendingSent: number;
}

/* ------------------------------------------------------------------ */
/* Chemins d'introduction                                             */
/* ------------------------------------------------------------------ */

export type PathLabel = 'recommended' | 'relevant' | 'possible';

export function toPathLabel(value: unknown): PathLabel {
  const candidate = str(value);
  return candidate === 'recommended' || candidate === 'relevant' ? candidate : 'possible';
}

export interface IntroductionPath {
  intermediary: NetworkProfileCard;
  /** Libelle QUALITATIF. Aucun score numerique n'existe cote client (§15). */
  label: PathLabel;
  /** Signaux explicites ayant produit le libelle (D-43). */
  reasons: string[];
  connectedSince: string | null;
  targetLinkSince: string | null;
  targetLinkContext: string | null;
  /** Demande deja en cours via cet intermediaire, le cas echeant. */
  pendingRequestId: string | null;
}

export interface IntroductionPathsView {
  target: NetworkProfileCard;
  alreadyConnected: boolean;
  paths: IntroductionPath[];
}

/* ------------------------------------------------------------------ */
/* Introductions                                                      */
/* ------------------------------------------------------------------ */

export type IntroductionRole = 'requester' | 'intermediary' | 'target';

const INTRODUCTION_STATUSES: readonly IntroductionStatus[] = [
  'requested',
  'intermediary_accepted',
  'intermediary_declined',
  'withdrawn',
  'expired',
  'introduced',
  'target_responded',
  'completed',
  'no_outcome',
];

export function toIntroductionStatus(value: unknown): IntroductionStatus {
  const candidate = str(value);
  return candidate !== null && (INTRODUCTION_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as IntroductionStatus)
    : 'requested';
}

export function toRole(value: unknown): IntroductionRole {
  const candidate = str(value);
  return candidate === 'intermediary' || candidate === 'target' ? candidate : 'requester';
}

export interface IntroductionEventRow {
  eventType: string;
  toStatus: string | null;
  actorRole: string;
  createdAt: string | null;
}

export interface IntroductionRow {
  introductionId: string;
  status: IntroductionStatus;
  purpose: string;
  myRole: IntroductionRole;
  createdAt: string | null;
  requester: NetworkProfileCard | null;
  intermediary: NetworkProfileCard | null;
  target: NetworkProfileCard | null;
}

export interface IntroductionDetail extends IntroductionRow {
  expiresAt: string | null;
  intermediaryRespondedAt: string | null;
  introducedAt: string | null;
  targetRespondedAt: string | null;
  completedAt: string | null;
  outcome: string | null;
  outcomeNote: string | null;
  outcomeDeclaredAt: string | null;
  outcomeDeclaredByRole: string | null;
  /** Absent de la charge utile quand le lecteur est la personne visee. */
  messageToIntermediary: string | null;
  messageToTarget: string | null;
  declineReason: string | null;
  events: IntroductionEventRow[];
}

/* ------------------------------------------------------------------ */
/* Formats                                                            */
/* ------------------------------------------------------------------ */

/** Format de date court et sans ambiguite, coherent sur tous les ecrans. */
export function formatDate(value: string | null): string {
  if (value === null) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Format d'identifiant attendu : un uuid, rien d'autre. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
