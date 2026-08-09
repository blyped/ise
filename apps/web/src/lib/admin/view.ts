import { asArray, asObject, bool, num, str } from '@/lib/network-view';

/**
 * Projections du back-office Superadmin : conversion defensive des
 * charges `jsonb` renvoyees par les fonctions `admin_*` (0076) vers des
 * types stricts. Un champ manquant devient `null` ou une valeur sure —
 * jamais un `undefined` silencieux (exactOptionalPropertyTypes actif).
 */

export interface AdminCursorPage<T> {
  rows: T[];
  /** Curseur SCELLE (`lib/opaque-cursor.ts`). `null` = fin de liste. */
  nextCursor: string | null;
}

/* ------------------------------------------------------------------ */
/* SA-001 — Tableau de bord                                            */
/* ------------------------------------------------------------------ */

export interface AdminCounterBlock {
  key: string;
  entries: { key: string; value: number }[];
}

export interface AdminDashboard {
  profiles: AdminCounterBlock | null;
  claims: AdminCounterBlock | null;
  reports: AdminCounterBlock | null;
  tickets: AdminCounterBlock | null;
  promotions: AdminCounterBlock | null;
}

const PROFILE_KEYS = [
  'active',
  'referenced',
  'suspended',
  'archived',
  'unclaimed',
  'claim_pending',
];
const CLAIM_KEYS = ['submitted', 'under_review'];
const REPORT_KEYS = ['open', 'reviewing'];
const TICKET_KEYS = ['open', 'in_progress', 'waiting_user'];

function toBlock(
  key: string,
  value: unknown,
  order: string[],
  rename?: Record<string, string>,
): AdminCounterBlock | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const raw = asObject(value);
  const entries = order.flatMap((entryKey) => {
    const count = num(raw[entryKey]);
    if (count === null) return [];
    return [{ key: rename?.[entryKey] ?? entryKey, value: count }];
  });
  return { key, entries };
}

export function toAdminDashboard(value: unknown): AdminDashboard {
  const raw = asObject(value);
  return {
    profiles: toBlock('profiles', raw['profiles'], PROFILE_KEYS),
    claims: toBlock('claims', raw['claims'], CLAIM_KEYS),
    reports: toBlock('reports', raw['reports'], REPORT_KEYS),
    tickets: toBlock('tickets', raw['tickets'], TICKET_KEYS),
    promotions: toBlock(
      'promotions',
      raw['promotions'],
      ['active', 'missing_members_pending', 'suggestions_pending'],
      {
        active: 'promotions_active',
        missing_members_pending: 'missing_members',
        suggestions_pending: 'promotion_suggestions',
      },
    ),
  };
}

/* ------------------------------------------------------------------ */
/* SA-002 / SA-003 — Membres & profils                                 */
/* ------------------------------------------------------------------ */

export interface AdminProfileRow {
  profileId: string;
  displayName: string;
  profileStatus: string;
  claimStatus: string;
  verificationStatus: string;
  hasAccount: boolean;
  promotionName: string | null;
  graduationYear: number | null;
  organization: string | null;
  country: string | null;
  createdAt: string | null;
}

export function toAdminProfileRow(value: unknown): AdminProfileRow | null {
  const raw = asObject(value);
  const profileId = str(raw['profile_id']);
  if (profileId === null) return null;
  return {
    profileId,
    displayName: str(raw['display_name']) ?? '',
    profileStatus: str(raw['profile_status']) ?? 'referenced',
    claimStatus: str(raw['claim_status']) ?? 'unclaimed',
    verificationStatus: str(raw['verification_status']) ?? 'unverified',
    hasAccount: bool(raw['has_account']),
    promotionName: str(raw['promotion_name']),
    graduationYear: num(raw['graduation_year']),
    organization: str(raw['organization']),
    country: str(raw['country']),
    createdAt: str(raw['created_at']),
  };
}

export interface AdminProfileClaimEntry {
  claimId: string;
  status: string;
  claimMethod: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reason: string | null;
}

export interface AdminModerationEntry {
  actionId: string;
  actionType: string;
  reason: string;
  createdAt: string | null;
  moderator: string | null;
}

export interface AdminProfileDetail {
  profileId: string;
  displayName: string;
  headline: string | null;
  profileType: string;
  profileStatus: string;
  claimStatus: string;
  verificationStatus: string;
  verificationLevel: string | null;
  promotionId: number | null;
  promotionName: string | null;
  graduationYear: number | null;
  currentPosition: string | null;
  organization: string | null;
  currentCity: string | null;
  country: string | null;
  linkedinUrl: string | null;
  hasAccount: boolean;
  accountEmail: string | null;
  isTestAccount: boolean;
  createdAt: string | null;
  claimedAt: string | null;
  verifiedAt: string | null;
  lastActiveAt: string | null;
  emailHint: string | null;
  claims: AdminProfileClaimEntry[];
  verifications: {
    verificationType: string;
    verificationResult: string;
    verifiedAt: string | null;
  }[];
  moderationActions: AdminModerationEntry[];
}

export function toAdminProfileDetail(value: unknown): AdminProfileDetail | null {
  const root = asObject(value);
  const raw = asObject(root['profile']);
  const profileId = str(raw['profile_id']);
  if (profileId === null) return null;
  return {
    profileId,
    displayName: str(raw['display_name']) ?? '',
    headline: str(raw['headline']),
    profileType: str(raw['profile_type']) ?? 'graduate',
    profileStatus: str(raw['profile_status']) ?? 'referenced',
    claimStatus: str(raw['claim_status']) ?? 'unclaimed',
    verificationStatus: str(raw['verification_status']) ?? 'unverified',
    verificationLevel: str(raw['verification_level']),
    promotionId: num(raw['promotion_id']),
    promotionName: str(raw['promotion_name']),
    graduationYear: num(raw['graduation_year']),
    currentPosition: str(raw['current_position']),
    organization: str(raw['organization']),
    currentCity: str(raw['current_city']),
    country: str(raw['country']),
    linkedinUrl: str(raw['linkedin_url']),
    hasAccount: bool(raw['has_account']),
    accountEmail: str(raw['account_email']),
    isTestAccount: bool(raw['is_test_account']),
    createdAt: str(raw['created_at']),
    claimedAt: str(raw['claimed_at']),
    verifiedAt: str(raw['verified_at']),
    lastActiveAt: str(raw['last_active_at']),
    emailHint: str(raw['email_hint']),
    claims: asArray(root['claims']).flatMap((entry) => {
      const c = asObject(entry);
      const claimId = str(c['claim_id']);
      if (claimId === null) return [];
      return [
        {
          claimId,
          status: str(c['status']) ?? '',
          claimMethod: str(c['claim_method']) ?? '',
          submittedAt: str(c['submitted_at']),
          reviewedAt: str(c['reviewed_at']),
          reason: str(c['reason']),
        },
      ];
    }),
    verifications: asArray(root['verifications']).map((entry) => {
      const v = asObject(entry);
      return {
        verificationType: str(v['verification_type']) ?? '',
        verificationResult: str(v['verification_result']) ?? '',
        verifiedAt: str(v['verified_at']),
      };
    }),
    moderationActions: asArray(root['moderation_actions']).flatMap((entry) => {
      const a = asObject(entry);
      const actionId = str(a['action_id']);
      if (actionId === null) return [];
      return [
        {
          actionId,
          actionType: str(a['action_type']) ?? '',
          reason: str(a['reason']) ?? '',
          createdAt: str(a['created_at']),
          moderator: str(a['moderator']),
        },
      ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* SA-006 — Reclamations                                               */
/* ------------------------------------------------------------------ */

export interface AdminClaimRow {
  claimId: string;
  status: string;
  claimMethod: string;
  submittedAt: string | null;
  profileName: string;
  graduationYear: number | null;
  claimantEmail: string | null;
}

export function toAdminClaimRow(value: unknown): AdminClaimRow | null {
  const raw = asObject(value);
  const claimId = str(raw['claim_id']);
  if (claimId === null) return null;
  return {
    claimId,
    status: str(raw['status']) ?? 'submitted',
    claimMethod: str(raw['claim_method']) ?? '',
    submittedAt: str(raw['submitted_at']),
    profileName: str(raw['profile_name']) ?? '',
    graduationYear: num(raw['graduation_year']),
    claimantEmail: str(raw['claimant_email']),
  };
}

export interface AdminClaimDetail {
  claimId: string;
  status: string;
  claimMethod: string;
  declaredDetails: Record<string, unknown>;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reason: string | null;
  claimant: {
    accountEmail: string | null;
    accountEmailConfirmed: boolean;
    accountCreatedAt: string | null;
  };
  profile: {
    profileId: string;
    displayName: string;
    headline: string | null;
    profileStatus: string;
    claimStatus: string;
    verificationStatus: string;
    promotionName: string | null;
    graduationYear: number | null;
    currentPosition: string | null;
    organization: string | null;
    currentCity: string | null;
    country: string | null;
    emailHint: string | null;
    hasHistoricalEmail: boolean;
  };
  concordance: {
    emailsMatch: boolean;
    otherPendingClaims: number;
  };
}

export function toAdminClaimDetail(value: unknown): AdminClaimDetail | null {
  const root = asObject(value);
  const claim = asObject(root['claim']);
  const claimId = str(claim['claim_id']);
  if (claimId === null) return null;
  const claimant = asObject(root['claimant']);
  const profile = asObject(root['profile']);
  const concordance = asObject(root['concordance']);
  const declared = claim['declared_details'];
  return {
    claimId,
    status: str(claim['status']) ?? 'submitted',
    claimMethod: str(claim['claim_method']) ?? '',
    declaredDetails:
      declared !== null && typeof declared === 'object' && !Array.isArray(declared)
        ? (declared as Record<string, unknown>)
        : {},
    submittedAt: str(claim['submitted_at']),
    reviewedAt: str(claim['reviewed_at']),
    reviewedBy: str(claim['reviewed_by']),
    reason: str(claim['reason']),
    claimant: {
      accountEmail: str(claimant['account_email']),
      accountEmailConfirmed: bool(claimant['account_email_confirmed']),
      accountCreatedAt: str(claimant['account_created_at']),
    },
    profile: {
      profileId: str(profile['profile_id']) ?? '',
      displayName: str(profile['display_name']) ?? '',
      headline: str(profile['headline']),
      profileStatus: str(profile['profile_status']) ?? '',
      claimStatus: str(profile['claim_status']) ?? '',
      verificationStatus: str(profile['verification_status']) ?? '',
      promotionName: str(profile['promotion_name']),
      graduationYear: num(profile['graduation_year']),
      currentPosition: str(profile['current_position']),
      organization: str(profile['organization']),
      currentCity: str(profile['current_city']),
      country: str(profile['country']),
      emailHint: str(profile['email_hint']),
      hasHistoricalEmail: bool(profile['has_historical_email']),
    },
    concordance: {
      emailsMatch: bool(concordance['emails_match']),
      otherPendingClaims: num(concordance['other_pending_claims_on_profile']) ?? 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* SA-008 / SA-009 / SA-010 — Promotions                               */
/* ------------------------------------------------------------------ */

export interface AdminPromotionRow {
  promotionId: number;
  name: string;
  graduationYear: number;
  status: string;
  estimatedSize: number | null;
  totalProfiles: number;
  activeMembers: number;
  unclaimedProfiles: number;
  suggestionsPending: number;
}

export function toAdminPromotionRow(value: unknown): AdminPromotionRow | null {
  const raw = asObject(value);
  const promotionId = num(raw['promotion_id']);
  const graduationYear = num(raw['graduation_year']);
  if (promotionId === null || graduationYear === null) return null;
  return {
    promotionId,
    name: str(raw['name']) ?? '',
    graduationYear,
    status: str(raw['status']) ?? 'active',
    estimatedSize: num(raw['estimated_size']),
    totalProfiles: num(raw['total_profiles']) ?? 0,
    activeMembers: num(raw['active_members']) ?? 0,
    unclaimedProfiles: num(raw['unclaimed_profiles']) ?? 0,
    suggestionsPending: num(raw['suggestions_pending']) ?? 0,
  };
}

export interface AdminPromotionManager {
  managerId: string;
  profileId: string;
  displayName: string;
  managerRole: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface AdminMissingMember {
  suggestionId: string;
  firstName: string;
  lastName: string;
  country: string | null;
  status: string;
  submittedBy: string | null;
  createdAt: string | null;
  matchedProfileId: string | null;
}

export interface AdminPromotionDetail {
  promotionId: number;
  name: string;
  programCode: string;
  graduationYear: number;
  description: string | null;
  estimatedSize: number | null;
  status: string;
  counts: {
    totalProfiles: number;
    activeMembers: number;
    unclaimedProfiles: number;
    verifiedProfiles: number;
  };
  managers: AdminPromotionManager[];
  invitations: { key: string; value: number }[];
  missingMembers: AdminMissingMember[];
}

export function toAdminPromotionDetail(value: unknown): AdminPromotionDetail | null {
  const root = asObject(value);
  const raw = asObject(root['promotion']);
  const promotionId = num(raw['promotion_id']);
  const graduationYear = num(raw['graduation_year']);
  if (promotionId === null || graduationYear === null) return null;
  const counts = asObject(root['counts']);
  const invitations = asObject(root['invitations']);
  return {
    promotionId,
    name: str(raw['name']) ?? '',
    programCode: str(raw['program_code']) ?? 'ISE',
    graduationYear,
    description: str(raw['description']),
    estimatedSize: num(raw['estimated_size']),
    status: str(raw['status']) ?? 'active',
    counts: {
      totalProfiles: num(counts['total_profiles']) ?? 0,
      activeMembers: num(counts['active_members']) ?? 0,
      unclaimedProfiles: num(counts['unclaimed_profiles']) ?? 0,
      verifiedProfiles: num(counts['verified_profiles']) ?? 0,
    },
    managers: asArray(root['managers']).flatMap((entry) => {
      const m = asObject(entry);
      const managerId = str(m['manager_id']);
      const profileId = str(m['profile_id']);
      if (managerId === null || profileId === null) return [];
      return [
        {
          managerId,
          profileId,
          displayName: str(m['display_name']) ?? '',
          managerRole: str(m['manager_role']) ?? 'delegate',
          active: bool(m['active']),
          startsAt: str(m['starts_at']),
          endsAt: str(m['ends_at']),
        },
      ];
    }),
    invitations: ['sent', 'opened', 'claimed', 'expired', 'revoked'].flatMap((key) => {
      const count = num(invitations[key]);
      if (count === null) return [];
      return [{ key, value: count }];
    }),
    missingMembers: asArray(root['missing_members']).flatMap((entry) => {
      const s = asObject(entry);
      const suggestionId = str(s['suggestion_id']);
      if (suggestionId === null) return [];
      return [
        {
          suggestionId,
          firstName: str(s['first_name']) ?? '',
          lastName: str(s['last_name']) ?? '',
          country: str(s['country']),
          status: str(s['status']) ?? 'submitted',
          submittedBy: str(s['submitted_by']),
          createdAt: str(s['created_at']),
          matchedProfileId: str(s['matched_profile_id']),
        },
      ];
    }),
  };
}

export interface AdminPromotionSuggestionRow {
  suggestionId: string;
  promotionLabel: string;
  institution: string | null;
  approximateYear: number | null;
  comment: string | null;
  status: string;
  reviewNote: string | null;
  country: string | null;
  submittedBy: string | null;
  matchedPromotionId: number | null;
  createdAt: string | null;
}

export function toAdminPromotionSuggestionRow(value: unknown): AdminPromotionSuggestionRow | null {
  const raw = asObject(value);
  const suggestionId = str(raw['suggestion_id']);
  if (suggestionId === null) return null;
  return {
    suggestionId,
    promotionLabel: str(raw['promotion_label']) ?? '',
    institution: str(raw['institution']),
    approximateYear: num(raw['approximate_year']),
    comment: str(raw['comment']),
    status: str(raw['status']) ?? 'submitted',
    reviewNote: str(raw['review_note']),
    country: str(raw['country']),
    submittedBy: str(raw['submitted_by']),
    matchedPromotionId: num(raw['matched_promotion_id']),
    createdAt: str(raw['created_at']),
  };
}

/* ------------------------------------------------------------------ */
/* SA-018 / SA-038 / SA-039 — Moderation                               */
/* ------------------------------------------------------------------ */

export interface AdminReportRow {
  reportId: string;
  targetType: string;
  reasonCode: string;
  reasonName: string;
  severity: string;
  status: string;
  resolutionCode: string | null;
  reporterName: string | null;
  targetOwnerName: string | null;
  reviewerName: string | null;
  createdAt: string | null;
}

export function toAdminReportRow(value: unknown): AdminReportRow | null {
  const raw = asObject(value);
  const reportId = str(raw['report_id']);
  if (reportId === null) return null;
  return {
    reportId,
    targetType: str(raw['target_type']) ?? '',
    reasonCode: str(raw['reason_code']) ?? '',
    reasonName: str(raw['reason_name']) ?? '',
    severity: str(raw['severity']) ?? 'standard',
    status: str(raw['status']) ?? 'open',
    resolutionCode: str(raw['resolution_code']),
    reporterName: str(raw['reporter_name']),
    targetOwnerName: str(raw['target_owner_name']),
    reviewerName: str(raw['reviewer_name']),
    createdAt: str(raw['created_at']),
  };
}

export interface AdminReportDetail {
  reportId: string;
  targetType: string;
  targetId: string;
  reasonName: string;
  description: string | null;
  severity: string;
  status: string;
  resolutionCode: string | null;
  resolutionNote: string | null;
  reporterName: string | null;
  targetOwnerId: string | null;
  targetOwnerName: string | null;
  reviewerName: string | null;
  createdAt: string | null;
  closedAt: string | null;
  evidence: {
    evidenceId: string;
    evidenceKind: string;
    note: string | null;
    createdAt: string | null;
  }[];
  events: {
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    actorName: string | null;
    createdAt: string | null;
  }[];
  actions: AdminModerationEntry[];
}

export function toAdminReportDetail(value: unknown): AdminReportDetail | null {
  const root = asObject(value);
  const raw = asObject(root['report']);
  const reportId = str(raw['report_id']);
  if (reportId === null) return null;
  return {
    reportId,
    targetType: str(raw['target_type']) ?? '',
    targetId: str(raw['target_id']) ?? '',
    reasonName: str(raw['reason_name']) ?? '',
    description: str(raw['description']),
    severity: str(raw['severity']) ?? 'standard',
    status: str(raw['status']) ?? 'open',
    resolutionCode: str(raw['resolution_code']),
    resolutionNote: str(raw['resolution_note']),
    reporterName: str(raw['reporter_name']),
    targetOwnerId: str(raw['target_owner_id']),
    targetOwnerName: str(raw['target_owner_name']),
    reviewerName: str(raw['reviewer_name']),
    createdAt: str(raw['created_at']),
    closedAt: str(raw['closed_at']),
    evidence: asArray(root['evidence']).flatMap((entry) => {
      const e = asObject(entry);
      const evidenceId = str(e['evidence_id']);
      if (evidenceId === null) return [];
      return [
        {
          evidenceId,
          evidenceKind: str(e['evidence_kind']) ?? '',
          note: str(e['note']),
          createdAt: str(e['created_at']),
        },
      ];
    }),
    events: asArray(root['events']).map((entry) => {
      const e = asObject(entry);
      return {
        fromStatus: str(e['from_status']),
        toStatus: str(e['to_status']) ?? '',
        note: str(e['note']),
        actorName: str(e['actor_name']),
        createdAt: str(e['created_at']),
      };
    }),
    actions: asArray(root['actions']).flatMap((entry) => {
      const a = asObject(entry);
      const actionId = str(a['action_id']);
      if (actionId === null) return [];
      return [
        {
          actionId,
          actionType: str(a['action_type']) ?? '',
          reason: str(a['reason']) ?? '',
          createdAt: str(a['created_at']),
          moderator: str(a['moderator']),
        },
      ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* SA-038 / SA-039 — Support                                           */
/* ------------------------------------------------------------------ */

export interface AdminTicketRow {
  ticketId: string;
  referenceCode: string;
  subject: string;
  categoryName: string | null;
  status: string;
  urgency: string;
  reopenedCount: number;
  requesterName: string | null;
  assigneeName: string | null;
  messageCount: number;
  createdAt: string | null;
}

export function toAdminTicketRow(value: unknown): AdminTicketRow | null {
  const raw = asObject(value);
  const ticketId = str(raw['ticket_id']);
  if (ticketId === null) return null;
  return {
    ticketId,
    referenceCode: str(raw['reference_code']) ?? '',
    subject: str(raw['subject']) ?? '',
    categoryName: str(raw['category_name']),
    status: str(raw['status']) ?? 'open',
    urgency: str(raw['urgency']) ?? 'standard',
    reopenedCount: num(raw['reopened_count']) ?? 0,
    requesterName: str(raw['requester_name']),
    assigneeName: str(raw['assignee_name']),
    messageCount: num(raw['message_count']) ?? 0,
    createdAt: str(raw['created_at']),
  };
}

export interface AdminTicketMessage {
  messageId: string;
  authorKind: string;
  authorName: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string | null;
}

export interface AdminTicketDetail {
  ticketId: string;
  referenceCode: string;
  subject: string;
  description: string;
  categoryName: string | null;
  status: string;
  urgency: string;
  reopenedCount: number;
  correlationId: string | null;
  requesterProfileId: string | null;
  requesterName: string | null;
  assigneeProfileId: string | null;
  assigneeName: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: AdminTicketMessage[];
}

export function toAdminTicketDetail(value: unknown): AdminTicketDetail | null {
  const root = asObject(value);
  const raw = asObject(root['ticket']);
  const ticketId = str(raw['ticket_id']);
  if (ticketId === null) return null;
  return {
    ticketId,
    referenceCode: str(raw['reference_code']) ?? '',
    subject: str(raw['subject']) ?? '',
    description: str(raw['description']) ?? '',
    categoryName: str(raw['category_name']),
    status: str(raw['status']) ?? 'open',
    urgency: str(raw['urgency']) ?? 'standard',
    reopenedCount: num(raw['reopened_count']) ?? 0,
    correlationId: str(raw['correlation_id']),
    requesterProfileId: str(raw['requester_profile_id']),
    requesterName: str(raw['requester_name']),
    assigneeProfileId: str(raw['assignee_profile_id']),
    assigneeName: str(raw['assignee_name']),
    createdAt: str(raw['created_at']),
    resolvedAt: str(raw['resolved_at']),
    closedAt: str(raw['closed_at']),
    messages: asArray(root['messages']).flatMap((entry) => {
      const m = asObject(entry);
      const messageId = str(m['message_id']);
      if (messageId === null) return [];
      return [
        {
          messageId,
          authorKind: str(m['author_kind']) ?? 'system',
          authorName: str(m['author_name']),
          body: str(m['body']) ?? '',
          isInternalNote: bool(m['is_internal_note']),
          createdAt: str(m['created_at']),
        },
      ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* SA-016 / SA-017 — Appels au reseau (0077)                           */
/* ------------------------------------------------------------------ */

export interface AdminCallRow {
  callId: string;
  title: string;
  callFamily: string | null;
  callType: string;
  status: string;
  urgency: string;
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  authorName: string;
  authorProfileId: string | null;
  openReports: number;
}

export function toAdminCallRow(value: unknown): AdminCallRow | null {
  const raw = asObject(value);
  const callId = str(raw['call_id']);
  if (callId === null) return null;
  return {
    callId,
    title: str(raw['title']) ?? '',
    callFamily: str(raw['call_family']),
    callType: str(raw['call_type']) ?? '',
    status: str(raw['status']) ?? 'active',
    urgency: str(raw['urgency']) ?? 'normal',
    deadline: str(raw['deadline']),
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    authorName: str(raw['author_name']) ?? '',
    authorProfileId: str(raw['author_profile_id']),
    openReports: num(raw['open_reports']) ?? 0,
  };
}

export interface AdminCallReportEntry {
  reportId: string;
  reasonCode: string;
  reasonName: string | null;
  status: string;
  severity: string;
  createdAt: string | null;
}

export interface AdminCallEvent {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actorName: string | null;
  createdAt: string | null;
}

export interface AdminCallDetail {
  callId: string;
  title: string;
  description: string;
  context: string | null;
  wantedProfile: string | null;
  callFamily: string | null;
  callType: string;
  status: string;
  urgency: string;
  visibility: string;
  sector: string | null;
  country: string | null;
  city: string | null;
  remoteAllowed: boolean;
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  authorProfileId: string | null;
  authorName: string;
  reports: AdminCallReportEntry[];
  events: AdminCallEvent[];
}

export function toAdminCallDetail(value: unknown): AdminCallDetail | null {
  const root = asObject(value);
  const raw = asObject(root['call']);
  const callId = str(raw['call_id']);
  if (callId === null) return null;
  return {
    callId,
    title: str(raw['title']) ?? '',
    description: str(raw['description']) ?? '',
    context: str(raw['context']),
    wantedProfile: str(raw['wanted_profile']),
    callFamily: str(raw['call_family']),
    callType: str(raw['call_type']) ?? '',
    status: str(raw['status']) ?? 'active',
    urgency: str(raw['urgency']) ?? 'normal',
    visibility: str(raw['visibility']) ?? 'members',
    sector: str(raw['sector']),
    country: str(raw['country']),
    city: str(raw['city']),
    remoteAllowed: bool(raw['remote_allowed']),
    deadline: str(raw['deadline']),
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    authorProfileId: str(raw['author_profile_id']),
    authorName: str(raw['author_name']) ?? '',
    reports: asArray(root['reports']).flatMap((entry) => {
      const r = asObject(entry);
      const reportId = str(r['report_id']);
      if (reportId === null) return [];
      return [
        {
          reportId,
          reasonCode: str(r['reason_code']) ?? '',
          reasonName: str(r['reason_name']),
          status: str(r['status']) ?? 'open',
          severity: str(r['severity']) ?? 'standard',
          createdAt: str(r['created_at']),
        },
      ];
    }),
    events: asArray(root['events']).map((entry) => {
      const e = asObject(entry);
      return {
        eventType: str(e['event_type']) ?? '',
        fromStatus: str(e['from_status']),
        toStatus: str(e['to_status']),
        note: str(e['note']),
        actorName: str(e['actor_name']),
        createdAt: str(e['created_at']),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* SA-019 / SA-020 — Opportunites (0077)                               */
/* ------------------------------------------------------------------ */

export interface AdminOpportunityRow {
  opportunityId: string;
  title: string;
  opportunityType: string;
  contractType: string | null;
  origin: string;
  sourceType: string | null;
  status: string;
  moderationStatus: string;
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  organization: string | null;
  authorName: string | null;
}

export function toAdminOpportunityRow(value: unknown): AdminOpportunityRow | null {
  const raw = asObject(value);
  const opportunityId = str(raw['opportunity_id']);
  if (opportunityId === null) return null;
  return {
    opportunityId,
    title: str(raw['title']) ?? '',
    opportunityType: str(raw['opportunity_type']) ?? '',
    contractType: str(raw['contract_type']),
    origin: str(raw['origin']) ?? 'internal',
    sourceType: str(raw['source_type']),
    status: str(raw['status']) ?? 'draft',
    moderationStatus: str(raw['moderation_status']) ?? 'not_required',
    deadline: str(raw['deadline']),
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    organization: str(raw['organization']),
    authorName: str(raw['author_name']),
  };
}

export interface AdminOpportunityDetail {
  opportunityId: string;
  title: string;
  summary: string | null;
  description: string;
  opportunityType: string;
  contractType: string | null;
  origin: string;
  sourceType: string | null;
  sourceUrl: string | null;
  status: string;
  moderationStatus: string;
  visibility: string;
  sector: string | null;
  country: string | null;
  city: string | null;
  remoteAllowed: boolean;
  experienceLevel: string | null;
  deadline: string | null;
  positionsCount: number | null;
  applicationMode: string;
  externalApplicationUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  organization: string | null;
  authorProfileId: string | null;
  authorName: string | null;
  moderationHistory: {
    decision: string | null;
    note: string | null;
    actorName: string | null;
    createdAt: string | null;
  }[];
  openReports: number;
}

export function toAdminOpportunityDetail(value: unknown): AdminOpportunityDetail | null {
  const root = asObject(value);
  const raw = asObject(root['opportunity']);
  const opportunityId = str(raw['opportunity_id']);
  if (opportunityId === null) return null;
  return {
    opportunityId,
    title: str(raw['title']) ?? '',
    summary: str(raw['summary']),
    description: str(raw['description']) ?? '',
    opportunityType: str(raw['opportunity_type']) ?? '',
    contractType: str(raw['contract_type']),
    origin: str(raw['origin']) ?? 'internal',
    sourceType: str(raw['source_type']),
    sourceUrl: str(raw['source_url']),
    status: str(raw['status']) ?? 'draft',
    moderationStatus: str(raw['moderation_status']) ?? 'not_required',
    visibility: str(raw['visibility']) ?? 'members',
    sector: str(raw['sector']),
    country: str(raw['country']),
    city: str(raw['city']),
    remoteAllowed: bool(raw['remote_allowed']),
    experienceLevel: str(raw['experience_level']),
    deadline: str(raw['deadline']),
    positionsCount: num(raw['positions_count']),
    applicationMode: str(raw['application_mode']) ?? 'internal',
    externalApplicationUrl: str(raw['external_application_url']),
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']),
    organization: str(raw['organization']),
    authorProfileId: str(raw['author_profile_id']),
    authorName: str(raw['author_name']),
    moderationHistory: asArray(root['moderation_history']).map((entry) => {
      const h = asObject(entry);
      return {
        decision: str(h['decision']),
        note: str(h['note']),
        actorName: str(h['actor_name']),
        createdAt: str(h['created_at']),
      };
    }),
    openReports: num(root['open_reports']) ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* SA-003 — Roles et notes administratives (0077)                      */
/* ------------------------------------------------------------------ */

export interface AdminRoleInfo {
  code: string;
  name: string;
  description: string | null;
  isAdminRole: boolean;
  holders: number;
  permissions: string[];
}

export function toAdminRoleInfoList(value: unknown): AdminRoleInfo[] {
  return asArray(value).flatMap((entry) => {
    const r = asObject(entry);
    const code = str(r['code']);
    if (code === null) return [];
    return [
      {
        code,
        name: str(r['name']) ?? code,
        description: str(r['description']),
        isAdminRole: bool(r['is_admin_role']),
        holders: num(r['holders']) ?? 0,
        permissions: asArray(r['permissions']).flatMap((p) => {
          const s = str(p);
          return s === null ? [] : [s];
        }),
      },
    ];
  });
}

export interface AdminProfileRoleEntry {
  code: string;
  name: string;
  grantedAt: string | null;
  grantedBy: string | null;
  expiresAt: string | null;
}

export function toAdminProfileRoleList(value: unknown): AdminProfileRoleEntry[] {
  return asArray(value).flatMap((entry) => {
    const r = asObject(entry);
    const code = str(r['code']);
    if (code === null) return [];
    return [
      {
        code,
        name: str(r['name']) ?? code,
        grantedAt: str(r['granted_at']),
        grantedBy: str(r['granted_by']),
        expiresAt: str(r['expires_at']),
      },
    ];
  });
}

export interface AdminNote {
  noteId: string;
  body: string;
  author: string | null;
  createdAt: string | null;
}

export function toAdminNoteList(value: unknown): AdminNote[] {
  return asArray(value).flatMap((entry) => {
    const n = asObject(entry);
    const noteId = str(n['note_id']);
    if (noteId === null) return [];
    return [
      {
        noteId,
        body: str(n['body']) ?? '',
        author: str(n['author']),
        createdAt: str(n['created_at']),
      },
    ];
  });
}
