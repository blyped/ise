/**
 * PROPOSITION DE CONTENU PAR LES ISE — socle partagé (migration 0132).
 *
 * Module VOLONTAIREMENT PUR : aucune importation de `next/headers` ni du
 * client Supabase serveur. Il est donc importable depuis un composant
 * client (`'use client'`) comme depuis une Server Action — ce qu'un
 * fichier `'use server'` ne permettrait pas, puisqu'il n'exporte que des
 * fonctions asynchrones (D-159).
 *
 * Les lectures vivent dans `lib/queries/content-proposals.ts` (côté
 * membre) et `lib/admin/queries-proposals.ts` (côté administration).
 */

/**
 * Bucket PRIVÉ dédié aux visuels proposés (0132).
 *
 * POURQUOI PAS `landing-media` : ce bucket-là est PUBLIC (D-134, 0068).
 * Y déposer l'image d'une proposition non validée la rendrait lisible par
 * le web ouvert avant toute décision — exactement l'inverse de ce que la
 * validation cherche à obtenir. Le visuel attend donc dans un espace
 * privé, sous `<profile_id>/…`, et n'est recopié dans `landing-media`
 * qu'au moment où l'administration accepte.
 */
export const CONTENT_PROPOSALS_BUCKET = 'content-proposals';

/** Miroir exact du `file_size_limit` du bucket (0132). */
export const PROPOSAL_COVER_MAX_BYTES = 5 * 1024 * 1024;

/** Miroir exact d'`allowed_mime_types` — identique à `landing-media`. */
export const PROPOSAL_COVER_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
] as const;

export type ProposalCoverMimeType = (typeof PROPOSAL_COVER_MIME_TYPES)[number];

/** Attribut `accept` de l'input fichier. Repris tel quel côté client. */
export const PROPOSAL_COVER_ACCEPT = PROPOSAL_COVER_MIME_TYPES.join(',');

export const PROPOSAL_COVER_EXTENSION: Record<ProposalCoverMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function isProposalCoverMimeType(value: string): value is ProposalCoverMimeType {
  return (PROPOSAL_COVER_MIME_TYPES as readonly string[]).includes(value);
}

/** Les deux natures de proposition. Le mot est celui des RPC `p_kind`. */
export type ProposalKind = 'news' | 'event';

export function isProposalKind(value: unknown): value is ProposalKind {
  return value === 'news' || value === 'event';
}

/**
 * Emplacement d'atterrissage dans `landing-media` APRÈS acceptation.
 * `private.is_landing_media_path` (0068) n'autorise que cinq préfixes ; on
 * reprend ceux que le CMS utilise déjà pour ces deux natures de contenu,
 * pour que le média retombe au même endroit que s'il avait été déposé
 * depuis la médiathèque.
 */
export function landingMediaPrefix(kind: ProposalKind): 'news' | 'sections' {
  return kind === 'news' ? 'news' : 'sections';
}

/* ------------------------------------------------------------------ */
/* États                                                               */
/* ------------------------------------------------------------------ */

/**
 * Trois issues, et rien d'autre à dire à l'auteur.
 *
 * Les deux tables ne nomment pas l'attente de la même façon
 * (`news.editorial_status = 'submitted'`, `events.status =
 * 'pending_review'`) : c'est le vocabulaire d'origine de chaque table, et
 * 0132 s'est gardée d'en inventer un troisième. La traduction se fait
 * ici, une seule fois.
 */
export type ProposalState = 'pending' | 'published' | 'rejected' | 'other';

export function proposalState(kind: ProposalKind, status: string): ProposalState {
  if (status === 'rejected') return 'rejected';
  if (status === 'published') return 'published';
  if (kind === 'news' && status === 'submitted') return 'pending';
  if (kind === 'event' && status === 'pending_review') return 'pending';
  // 'draft', 'approved', 'archived', 'cancelled'… : des états que le
  // circuit administratif peut poser ensuite. On ne les traduit pas en
  // « refusée », ce serait mentir.
  return 'other';
}

/* ------------------------------------------------------------------ */
/* Formes de données                                                   */
/* ------------------------------------------------------------------ */

/**
 * Une entrée de liste de référence (catégorie d'actualité, type
 * d'événement). Déclarée ici, dans le module PUR, pour que les
 * formulaires clients puissent la typer sans importer le module de
 * lecture — lequel tire `next/headers`.
 */
export interface ReferenceOption {
  code: string;
  label: string;
}

/** Une ligne de « Mes propositions » (`list_my_content_proposals`). */
export interface MyProposal {
  kind: ProposalKind;
  id: string;
  title: string;
  summary: string | null;
  status: string;
  state: ProposalState;
  rejectionReason: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  hasCover: boolean;
  createdAt: string | null;
}

/** Une ligne de la file d'attente administrative. */
export interface ProposalQueueRow {
  kind: ProposalKind;
  id: string;
  title: string;
  summary: string | null;
  status: string;
  authorProfileId: string | null;
  authorName: string;
  submittedAt: string | null;
  hasCover: boolean;
  rejectionReason: string | null;
}

/** La fiche complète examinée par l'administration. */
export interface ProposalDetail extends ProposalQueueRow {
  body: string | null;
  categoryCode: string | null;
  eventDate: string | null;
  sourceUrl: string | null;
  format: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  city: string | null;
  venueName: string | null;
  countryCode: string | null;
  /** Chemin dans le bucket PRIVÉ. Jamais rendu tel quel : il sert à signer. */
  coverPath: string | null;
  coverAlt: string | null;
}

/* ------------------------------------------------------------------ */
/* Lecture défensive des charges JSONB                                 */
/* ------------------------------------------------------------------ */

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function rowsOf(payload: unknown): Record<string, unknown>[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const rows = (payload as Record<string, unknown>)['rows'];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((entry) =>
    typeof entry === 'object' && entry !== null ? [entry as Record<string, unknown>] : [],
  );
}

export function toMyProposals(payload: unknown): MyProposal[] {
  return rowsOf(payload).flatMap((item) => {
    const kind = item['kind'];
    const id = str(item['id']);
    const title = str(item['title']);
    const status = str(item['status']);
    if (!isProposalKind(kind) || id === null || title === null || status === null) return [];
    return [
      {
        kind,
        id,
        title,
        summary: str(item['summary']),
        status,
        state: proposalState(kind, status),
        rejectionReason: str(item['rejection_reason']),
        reviewedAt: str(item['reviewed_at']),
        publishedAt: str(item['published_at']),
        hasCover: item['has_cover'] === true,
        createdAt: str(item['created_at']),
      },
    ];
  });
}

function toQueueRow(item: Record<string, unknown>): ProposalQueueRow | null {
  const kind = item['kind'];
  const id = str(item['id']);
  const title = str(item['title']);
  const status = str(item['status']);
  if (!isProposalKind(kind) || id === null || title === null || status === null) return null;
  return {
    kind,
    id,
    title,
    summary: str(item['summary']),
    status,
    authorProfileId: str(item['author_profile_id']),
    authorName: str(item['author_name']) ?? '',
    submittedAt: str(item['submitted_at']),
    hasCover: item['has_cover'] === true,
    rejectionReason: str(item['rejection_reason']),
  };
}

export function toProposalQueue(payload: unknown): ProposalQueueRow[] {
  return rowsOf(payload).flatMap((item) => {
    const row = toQueueRow(item);
    return row === null ? [] : [row];
  });
}

export function toProposalDetail(payload: unknown): ProposalDetail | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const item = payload as Record<string, unknown>;
  const base = toQueueRow(item);
  if (base === null) return null;
  return {
    ...base,
    body: str(item['body']),
    categoryCode: str(item['category_code']),
    eventDate: str(item['event_date']),
    sourceUrl: str(item['source_url']),
    format: str(item['format']),
    startsAt: str(item['starts_at']),
    endsAt: str(item['ends_at']),
    timezone: str(item['timezone']),
    city: str(item['city']),
    venueName: str(item['venue_name']),
    countryCode: str(item['country_code']),
    coverPath: str(item['cover_path']),
    coverAlt: str(item['cover_alt']),
  };
}
