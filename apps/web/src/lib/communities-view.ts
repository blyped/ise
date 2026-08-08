import { asArray, asObject, bool, num, str, strings, toProfileCard } from '@/lib/network-view';
import type { NetworkProfileCard } from '@/lib/network-view';

/**
 * Types de vue et conversions PURES de la tranche COMMUNAUTES
 * (ISE-084 -> ISE-087).
 *
 * Meme regle que `lib/network-view.ts` : aucune dependance serveur ici,
 * pour qu'un composant client puisse importer ces types sans tirer
 * `next/headers` dans le bundle navigateur.
 *
 * Rien dans ce fichier ne porte de compteur de vues, de « like » ni de
 * rang : la base n'en renvoie pas, et l'interface n'en fabrique pas
 * (MASTER PROMPT §1).
 */

export interface Page<T> {
  rows: T[];
  nextCursor: string | null;
}

export type CommunityScope = 'for_me' | 'all' | 'mine' | 'new';

export const COMMUNITY_SCOPES: readonly CommunityScope[] = ['for_me', 'all', 'mine', 'new'];

export function toCommunityScope(raw: unknown): CommunityScope {
  return typeof raw === 'string' && (COMMUNITY_SCOPES as readonly string[]).includes(raw)
    ? (raw as CommunityScope)
    : 'for_me';
}

export type CommunityType = 'country' | 'sector' | 'thematic' | 'special';

export const POST_TYPES = ['question', 'experience', 'resource', 'analysis', 'news'] as const;

export type PostType = (typeof POST_TYPES)[number];

export interface MatchReason {
  code: string;
  label: string | null;
  detail: string | null;
}

export interface CommunityMembership {
  status: string;
  role: string;
  notificationLevel: string;
  digestFrequency: string;
}

export interface CommunityCard {
  communityId: string;
  name: string;
  slug: string;
  description: string;
  communityType: string;
  typeLabel: string | null;
  countryCode: string | null;
  visibility: string;
  joinPolicy: string;
  status: string;
  memberCount: number;
  lastActivityAt: string | null;
  lastTopic: string | null;
  openQuestionCount: number;
  isMember: boolean;
  isModerator: boolean;
  membership: CommunityMembership | null;
  reasons: MatchReason[];
}

export interface CommunityStats {
  members: number;
  active30d: number;
  openDiscussions: number;
  expertiseCalls: number;
  countries: number;
  promotions: number;
}

export interface CommunityModerator extends NetworkProfileCard {
  communityRole: string;
}

export interface CommunityDetail extends CommunityCard {
  purpose: string | null;
  charterText: string | null;
  postModerationMode: string;
  stats: CommunityStats;
  moderators: CommunityModerator[];
  knownMembers: NetworkProfileCard[];
  knownMemberCount: number;
  expertise: string[];
}

export interface CommunityPostCard {
  postId: string;
  communityId: string;
  communityName: string;
  postType: string;
  title: string;
  visibility: string;
  status: string;
  isLocked: boolean;
  isAuthor: boolean;
  isResolved: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: NetworkProfileCard | null;
  replyCount: number;
  helpfulCount: number;
  skills: string[];
}

export interface CommunityComment {
  commentId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  isHelpful: boolean;
  isAuthor: boolean;
  author: NetworkProfileCard | null;
}

export interface CommunityPostDetail extends CommunityPostCard {
  body: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  comments: CommunityComment[];
  canReply: boolean;
}

export interface PostTrackingCounters {
  replies: number;
  helpful: number;
  contributors: number;
}

export interface HelpfulReply {
  commentId: string;
  body: string;
  createdAt: string;
  author: NetworkProfileCard | null;
}

export interface CommunityPostTracking extends CommunityPostDetail {
  counters: PostTrackingCounters;
  helpfulReplies: HelpfulReply[];
  contributors: NetworkProfileCard[];
}

export interface CommunityMemberRow extends NetworkProfileCard {
  communityRole: string;
  joinedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Conversions                                                         */
/* ------------------------------------------------------------------ */

export function toMatchReasons(value: unknown): MatchReason[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const code = str(raw['code']);
    if (code === null) return [];
    return [{ code, label: str(raw['label']), detail: str(raw['detail']) }];
  });
}

function toMembership(value: unknown): CommunityMembership | null {
  const raw = asObject(value);
  const status = str(raw['status']);
  if (status === null) return null;
  return {
    status,
    role: str(raw['role']) ?? 'member',
    notificationLevel: str(raw['notification_level']) ?? 'important',
    digestFrequency: str(raw['digest_frequency']) ?? 'weekly',
  };
}

export function toCommunityCard(value: unknown): CommunityCard | null {
  const raw = asObject(value);
  const communityId = str(raw['community_id']);
  if (communityId === null) return null;
  return {
    communityId,
    name: str(raw['name']) ?? '',
    slug: str(raw['slug']) ?? '',
    description: str(raw['description']) ?? '',
    communityType: str(raw['community_type']) ?? 'thematic',
    typeLabel: str(raw['type_label']),
    countryCode: str(raw['country_code']),
    visibility: str(raw['visibility']) ?? 'network',
    joinPolicy: str(raw['join_policy']) ?? 'open',
    status: str(raw['status']) ?? 'active',
    memberCount: num(raw['member_count']) ?? 0,
    lastActivityAt: str(raw['last_activity_at']),
    lastTopic: str(raw['last_topic']),
    openQuestionCount: num(raw['open_question_count']) ?? 0,
    isMember: bool(raw['is_member']),
    isModerator: bool(raw['is_moderator']),
    membership: toMembership(raw['membership']),
    reasons: toMatchReasons(raw['reasons']),
  };
}

export function toCommunityDetail(value: unknown): CommunityDetail | null {
  const card = toCommunityCard(value);
  if (card === null) return null;
  const raw = asObject(value);
  const stats = asObject(raw['stats']);

  return {
    ...card,
    purpose: str(raw['purpose']),
    charterText: str(raw['charter_text']),
    postModerationMode: str(raw['post_moderation_mode']) ?? 'immediate',
    stats: {
      members: num(stats['members']) ?? 0,
      active30d: num(stats['active_30d']) ?? 0,
      openDiscussions: num(stats['open_discussions']) ?? 0,
      expertiseCalls: num(stats['expertise_calls']) ?? 0,
      countries: num(stats['countries']) ?? 0,
      promotions: num(stats['promotions']) ?? 0,
    },
    moderators: asArray(raw['moderators']).flatMap((entry) => {
      const profile = toProfileCard(entry);
      if (profile === null) return [];
      return [{ ...profile, communityRole: str(asObject(entry)['community_role']) ?? 'moderator' }];
    }),
    knownMembers: asArray(raw['known_members']).flatMap((entry) => {
      const profile = toProfileCard(entry);
      return profile === null ? [] : [profile];
    }),
    knownMemberCount: num(raw['known_member_count']) ?? 0,
    expertise: strings(raw['expertise']),
  };
}

export function toCommunityPostCard(value: unknown): CommunityPostCard | null {
  const raw = asObject(value);
  const postId = str(raw['post_id']);
  if (postId === null) return null;
  return {
    postId,
    communityId: str(raw['community_id']) ?? '',
    communityName: str(raw['community_name']) ?? '',
    postType: str(raw['post_type']) ?? 'question',
    title: str(raw['title']) ?? '',
    visibility: str(raw['visibility']) ?? 'community',
    status: str(raw['status']) ?? 'published',
    isLocked: bool(raw['is_locked']),
    isAuthor: bool(raw['is_author']),
    isResolved: bool(raw['is_resolved']),
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']) ?? '',
    author: toProfileCard(raw['author']),
    replyCount: num(raw['reply_count']) ?? 0,
    helpfulCount: num(raw['helpful_count']) ?? 0,
    skills: strings(raw['skills']),
  };
}

function toComments(value: unknown): CommunityComment[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const commentId = str(raw['comment_id']);
    if (commentId === null) return [];
    return [
      {
        commentId,
        parentId: str(raw['parent_id']),
        body: str(raw['body']) ?? '',
        createdAt: str(raw['created_at']) ?? '',
        isHelpful: bool(raw['is_helpful']),
        isAuthor: bool(raw['is_author']),
        author: toProfileCard(raw['author']),
      },
    ];
  });
}

export function toCommunityPostDetail(value: unknown): CommunityPostDetail | null {
  const card = toCommunityPostCard(value);
  if (card === null) return null;
  const raw = asObject(value);
  return {
    ...card,
    body: str(raw['body']),
    resolutionSummary: str(raw['resolution_summary']),
    resolvedAt: str(raw['resolved_at']),
    comments: toComments(raw['comments']),
    canReply: bool(raw['can_reply']),
  };
}

export function toCommunityPostTracking(value: unknown): CommunityPostTracking | null {
  const detail = toCommunityPostDetail(value);
  if (detail === null) return null;
  const raw = asObject(value);
  const counters = asObject(raw['counters']);
  return {
    ...detail,
    counters: {
      replies: num(counters['replies']) ?? 0,
      helpful: num(counters['helpful']) ?? 0,
      contributors: num(counters['contributors']) ?? 0,
    },
    helpfulReplies: asArray(raw['helpful_replies']).flatMap((entry) => {
      const row = asObject(entry);
      const commentId = str(row['comment_id']);
      if (commentId === null) return [];
      return [
        {
          commentId,
          body: str(row['body']) ?? '',
          createdAt: str(row['created_at']) ?? '',
          author: toProfileCard(row['author']),
        },
      ];
    }),
    contributors: asArray(raw['contributors']).flatMap((entry) => {
      const profile = toProfileCard(entry);
      return profile === null ? [] : [profile];
    }),
  };
}

export function toCommunityMemberRow(value: unknown): CommunityMemberRow | null {
  const profile = toProfileCard(value);
  if (profile === null) return null;
  const raw = asObject(value);
  return {
    ...profile,
    communityRole: str(raw['community_role']) ?? 'member',
    joinedAt: str(raw['joined_at']),
  };
}

/** Date courte en francais, sans heure : les cartes n'en ont pas besoin. */
export function formatDay(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
