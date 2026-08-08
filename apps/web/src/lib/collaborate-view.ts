/**
 * Types de vue et conversions PURES des tranches PROMOTIONS (ISE-067 ->
 * ISE-071), STAGES (ISE-072 -> ISE-077) et MENTORAT (ISE-078 -> ISE-083).
 *
 * POURQUOI CE FICHIER EXISTE, separe des modules de requetes : il est
 * importe par des composants rendus cote navigateur. S'il dependait de
 * `lib/queries/*`, le bundler tirerait `lib/supabase/server.ts` — donc
 * `next/headers` — dans le bundle client. Aucune dependance serveur ici.
 *
 * AUCUN SCORE N'EST TYPE ICI. Les trois modules ne recoivent de la base
 * qu'un libelle qualitatif et des raisons (D-42, D-43, MASTER PROMPT
 * §15 et §30) : il n'existe donc aucun champ ou en stocker un.
 */

type Json = Record<string, unknown>;

export const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
export const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
export const bool = (value: unknown): boolean => value === true;
export const strings = (value: unknown): string[] =>
  asArray(value).filter((entry): entry is string => typeof entry === 'string');

export interface Page<T> {
  rows: T[];
  nextCursor: string | null;
}

/* ------------------------------------------------------------------ */
/* Pertinence — libelle qualitatif et raisons, jamais de chiffre       */
/* ------------------------------------------------------------------ */

export type RelevanceLabel = 'very_relevant' | 'relevant' | 'close_profile';

export interface Relevance {
  label: RelevanceLabel | null;
  reasons: string[];
}

const RELEVANCE_LABELS: readonly string[] = ['very_relevant', 'relevant', 'close_profile'];

export function toRelevance(raw: unknown): Relevance {
  const value = asObject(raw);
  const label = str(value['label']);
  return {
    label: label !== null && RELEVANCE_LABELS.includes(label) ? (label as RelevanceLabel) : null,
    reasons: asArray(value['reasons']).flatMap((entry) => {
      // Les raisons de stage sont des objets {criterion, label} ; celles
      // du mentorat aussi. Les listes d'anciens renvoient des chaines.
      if (typeof entry === 'string') return [entry];
      const line = str(asObject(entry)['label']);
      return line === null ? [] : [line];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Promotions                                                          */
/* ------------------------------------------------------------------ */

export interface PromotionMemberCard {
  profileId: string;
  displayName: string;
  isClaimed: boolean;
  isSelf: boolean;
  verificationStatus: string;
  avatarPath: string | null;
  headline: string | null;
  position: string | null;
  organization: string | null;
  city: string | null;
  countryName: string | null;
  skills: string[];
  availabilityHelp: boolean;
}

export function toPromotionMemberCard(raw: unknown): PromotionMemberCard | null {
  const value = asObject(raw);
  const profileId = str(value['profile_id']);
  if (profileId === null) return null;
  return {
    profileId,
    displayName: str(value['display_name']) ?? '',
    isClaimed: bool(value['is_claimed']),
    isSelf: bool(value['is_self']),
    verificationStatus: str(value['verification_status']) ?? 'unverified',
    avatarPath: str(value['avatar_path']),
    headline: str(value['headline']),
    position: str(value['position']),
    organization: str(value['organization']),
    city: str(value['city']),
    countryName: str(value['country_name']),
    skills: strings(value['skills']),
    availabilityHelp: bool(value['availability_help']),
  };
}

export interface PromotionManager {
  profileId: string;
  displayName: string;
  avatarPath: string | null;
  managerRole: string;
}

export interface PromotionNewsItem {
  newsId: string;
  title: string;
  summary: string | null;
  publishedAt: string | null;
}

export interface PromotionEvent {
  eventId: string;
  title: string;
  startsAt: string | null;
  city: string | null;
  format: string | null;
}

export interface PromotionOverview {
  promotionId: number;
  label: string;
  name: string;
  description: string | null;
  estimatedSize: number | null;
  isMember: boolean;
  isManager: boolean;
  canManage: boolean;
  stats: {
    referenced: number;
    claimed: number;
    verified: number;
    toFind: number;
    countries: number;
  };
  managers: PromotionManager[];
  /** `null` quand l'appelant n'appartient pas a la promotion. */
  classmates: PromotionMemberCard[] | null;
  news: PromotionNewsItem[] | null;
  nextEvent: PromotionEvent | null;
  toFindCount: number | null;
  missingSuggestionCount: number | null;
}

export function toPromotionOverview(raw: unknown): PromotionOverview | null {
  const value = asObject(raw);
  const promotionId = num(value['promotion_id']);
  if (promotionId === null) return null;

  const stats = asObject(value['stats']);
  const classmates = value['classmates'];
  const news = value['news'];
  const nextEvent = asObject(value['next_event']);

  return {
    promotionId,
    label: `${str(value['program_code']) ?? 'ISE'} ${num(value['graduation_year']) ?? ''}`.trim(),
    name: str(value['name']) ?? '',
    description: str(value['description']),
    estimatedSize: num(value['estimated_size']),
    isMember: bool(value['is_member']),
    isManager: bool(value['is_manager']),
    canManage: bool(value['can_manage']),
    stats: {
      referenced: num(stats['referenced']) ?? 0,
      claimed: num(stats['claimed']) ?? 0,
      verified: num(stats['verified']) ?? 0,
      toFind: num(stats['to_find']) ?? 0,
      countries: num(stats['countries']) ?? 0,
    },
    managers: asArray(value['managers']).flatMap((entry) => {
      const m = asObject(entry);
      const profileId = str(m['profile_id']);
      if (profileId === null) return [];
      return [
        {
          profileId,
          displayName: str(m['display_name']) ?? '',
          avatarPath: str(m['avatar_path']),
          managerRole: str(m['manager_role']) ?? 'delegate',
        },
      ];
    }),
    classmates:
      classmates === null || classmates === undefined
        ? null
        : asArray(classmates).flatMap((entry) => {
            const card = toPromotionMemberCard(entry);
            return card === null ? [] : [card];
          }),
    news:
      news === null || news === undefined
        ? null
        : asArray(news).flatMap((entry) => {
            const n = asObject(entry);
            const newsId = str(n['news_id']);
            if (newsId === null) return [];
            return [
              {
                newsId,
                title: str(n['title']) ?? '',
                summary: str(n['summary']),
                publishedAt: str(n['published_at']),
              },
            ];
          }),
    nextEvent:
      str(nextEvent['event_id']) === null
        ? null
        : {
            eventId: str(nextEvent['event_id']) as string,
            title: str(nextEvent['title']) ?? '',
            startsAt: str(nextEvent['starts_at']),
            city: str(nextEvent['city']),
            format: str(nextEvent['format']),
          },
    toFindCount: num(value['to_find_count']),
    missingSuggestionCount: num(value['missing_suggestion_count']),
  };
}

export interface ReferencedMember {
  profileId: string;
  displayName: string;
  promotionLabel: string;
  promotionId: number | null;
  countryName: string | null;
  declaredExpertise: string[];
  organization: string | null;
  lastUpdatedAt: string | null;
  dataQuality: { promotion: string; country: string; organization: string };
  /** Existence d'un indice de contact — jamais son contenu (CA-PROMO-04). */
  hasContactHint: boolean;
  pendingInvitation: { invitationId: string; status: string; expiresAt: string | null } | null;
}

export function toReferencedMember(raw: unknown): ReferencedMember | null {
  const value = asObject(raw);
  const profileId = str(value['profile_id']);
  if (profileId === null) return null;
  const promotion = asObject(value['promotion']);
  const quality = asObject(value['data_quality']);
  const invitation = asObject(value['pending_invitation']);
  return {
    profileId,
    displayName: str(value['display_name']) ?? '',
    promotionLabel:
      `${str(promotion['program_code']) ?? 'ISE'} ${num(promotion['graduation_year']) ?? ''}`.trim(),
    promotionId: num(promotion['promotion_id']),
    countryName: str(value['country_name']),
    declaredExpertise: strings(value['declared_expertise']),
    organization: str(value['organization']),
    lastUpdatedAt: str(value['last_updated_at']),
    dataQuality: {
      promotion: str(quality['promotion']) ?? 'unknown',
      country: str(quality['country']) ?? 'unknown',
      organization: str(quality['organization']) ?? 'unknown',
    },
    hasContactHint: bool(value['has_contact_hint']),
    pendingInvitation:
      str(invitation['invitation_id']) === null
        ? null
        : {
            invitationId: str(invitation['invitation_id']) as string,
            status: str(invitation['status']) ?? 'sent',
            expiresAt: str(invitation['expires_at']),
          },
  };
}

export interface InvitationRow {
  profileId: string;
  displayName: string;
  claimStatus: string;
  invitationId: string | null;
  invitationStatus: string;
  channel: string | null;
  lastActionAt: string | null;
  expiresAt: string | null;
}

export function toInvitationRow(raw: unknown): InvitationRow | null {
  const value = asObject(raw);
  const profileId = str(value['profile_id']);
  if (profileId === null) return null;
  return {
    profileId,
    displayName: str(value['display_name']) ?? '',
    claimStatus: str(value['claim_status']) ?? 'unclaimed',
    invitationId: str(value['invitation_id']),
    invitationStatus: str(value['invitation_status']) ?? 'none',
    channel: str(value['channel']),
    lastActionAt: str(value['last_action_at']),
    expiresAt: str(value['expires_at']),
  };
}

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

export interface InternshipOfferCard {
  offerId: string;
  offerType: string;
  title: string;
  organization: string | null;
  city: string | null;
  countryName: string | null;
  workMode: string;
  durationMonths: number | null;
  startDate: string | null;
  deadline: string | null;
  applicationMode: string;
  sector: string | null;
  skills: string[];
  relevance: Relevance;
  networkIseCount: number;
  /** La plateforme ne transmet aucun dossier : elle le dit (D-55). */
  platformTransmits: boolean;
}

export function toInternshipOfferCard(raw: unknown): InternshipOfferCard | null {
  const value = asObject(raw);
  const offerId = str(value['offer_id']);
  if (offerId === null) return null;
  return {
    offerId,
    offerType: str(value['offer_type']) ?? 'official_offer',
    title: str(value['title']) ?? '',
    organization: str(value['organization']),
    city: str(value['city']),
    countryName: str(value['country_name']),
    workMode: str(value['work_mode']) ?? 'on_site',
    durationMonths: num(value['duration_months']),
    startDate: str(value['start_date']),
    deadline: str(value['deadline']),
    applicationMode: str(value['application_mode']) ?? 'email',
    sector: str(value['sector']),
    skills: strings(value['skills']),
    relevance: toRelevance(value['relevance']),
    networkIseCount: num(value['network_ise_count']) ?? 0,
    platformTransmits: bool(value['platform_transmits']),
  };
}

export interface InternshipOfferDetail extends InternshipOfferCard {
  description: string | null;
  profileWanted: string | null;
  compensationDetails: string | null;
  applicationInstructions: string | null;
  externalUrl: string | null;
  conditionsToConfirm: string | null;
  networkMembers: {
    profileId: string;
    displayName: string;
    position: string | null;
    promotion: string | null;
  }[];
  myApplication: { applicationId: string; status: string } | null;
}

export function toInternshipOfferDetail(raw: unknown): InternshipOfferDetail | null {
  const card = toInternshipOfferCard(raw);
  if (card === null) return null;
  const value = asObject(raw);
  const mine = asObject(value['my_application']);
  return {
    ...card,
    description: str(value['description']),
    profileWanted: str(value['profile_wanted']),
    compensationDetails: str(value['compensation_details']),
    applicationInstructions: str(value['application_instructions']),
    externalUrl: str(value['external_url']),
    conditionsToConfirm: str(value['conditions_to_confirm']),
    networkMembers: asArray(value['network_members']).flatMap((entry) => {
      const m = asObject(entry);
      const profileId = str(m['profile_id']);
      if (profileId === null) return [];
      return [
        {
          profileId,
          displayName: str(m['display_name']) ?? '',
          position: str(m['position']),
          promotion: str(m['promotion']),
        },
      ];
    }),
    myApplication:
      str(mine['application_id']) === null
        ? null
        : {
            applicationId: str(mine['application_id']) as string,
            status: str(mine['status']) ?? 'to_prepare',
          },
  };
}

export interface InternshipNeed {
  needId: string;
  status: string;
  internshipType: string;
  objective: string | null;
  startDate: string | null;
  endDate: string | null;
  durationMonths: number | null;
  workMode: string;
  remoteAllowed: boolean;
  mobilityInternational: string;
  datesFlexible: boolean;
  visibility: string;
  sectors: { sectorId: number; name: string; isPrimary: boolean }[];
  countries: { countryCode: string; name: string }[];
}

export interface InternshipHome {
  need: InternshipNeed | null;
  counters: {
    applications: number;
    drafts: number;
    interviews: number;
    offersReceived: number;
    helpers: number;
  };
  placement: {
    placementId: string;
    organization: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
    agreementStatus: string;
  } | null;
  recommended: InternshipOfferCard[];
}

export function toInternshipHome(raw: unknown): InternshipHome {
  const value = asObject(raw);
  const needRaw = value['need'];
  const counters = asObject(value['counters']);
  const placement = asObject(value['placement']);

  const need =
    needRaw === null || needRaw === undefined
      ? null
      : (() => {
          const n = asObject(needRaw);
          const needId = str(n['need_id']);
          if (needId === null) return null;
          return {
            needId,
            status: str(n['status']) ?? 'draft',
            internshipType: str(n['internship_type']) ?? 'academic',
            objective: str(n['objective']),
            startDate: str(n['start_date']),
            endDate: str(n['end_date']),
            durationMonths: num(n['duration_months']),
            workMode: str(n['work_mode']) ?? 'on_site',
            remoteAllowed: bool(n['remote_allowed']),
            mobilityInternational: str(n['mobility_international']) ?? 'no',
            datesFlexible: bool(n['dates_flexible']),
            visibility: str(n['visibility']) ?? 'internship_managers_and_relevant_alumni',
            sectors: asArray(n['sectors']).flatMap((entry) => {
              const s = asObject(entry);
              const sectorId = num(s['sector_id']);
              if (sectorId === null) return [];
              return [{ sectorId, name: str(s['name']) ?? '', isPrimary: bool(s['is_primary']) }];
            }),
            countries: asArray(n['countries']).flatMap((entry) => {
              const c = asObject(entry);
              const countryCode = str(c['country_code']);
              if (countryCode === null) return [];
              return [{ countryCode, name: str(c['name']) ?? '' }];
            }),
          };
        })();

  return {
    need,
    counters: {
      applications: num(counters['applications']) ?? 0,
      drafts: num(counters['drafts']) ?? 0,
      interviews: num(counters['interviews']) ?? 0,
      offersReceived: num(counters['offers_received']) ?? 0,
      helpers: num(counters['helpers']) ?? 0,
    },
    placement:
      str(placement['placement_id']) === null
        ? null
        : {
            placementId: str(placement['placement_id']) as string,
            organization: str(placement['organization']),
            startDate: str(placement['start_date']),
            endDate: str(placement['end_date']),
            status: str(placement['status']) ?? 'confirmed',
            agreementStatus: str(placement['agreement_status']) ?? 'not_started',
          },
    recommended: asArray(value['recommended']).flatMap((entry) => {
      const card = toInternshipOfferCard(entry);
      return card === null ? [] : [card];
    }),
  };
}

export interface InternshipHelper {
  profileId: string;
  displayName: string;
  position: string | null;
  organization: string | null;
  avatarPath: string | null;
  promotion: string | null;
  available: boolean;
  /** D-43 : une proposition sans raison n'est jamais rendue. */
  reasons: string[];
}

export function toInternshipHelper(raw: unknown): InternshipHelper | null {
  const value = asObject(raw);
  const profileId = str(value['profile_id']);
  const reasons = strings(value['reasons']);
  if (profileId === null || reasons.length === 0) return null;
  return {
    profileId,
    displayName: str(value['display_name']) ?? '',
    position: str(value['position']),
    organization: str(value['organization']),
    avatarPath: str(value['avatar_path']),
    promotion: str(value['promotion']),
    available: bool(value['available']),
    reasons,
  };
}

export interface InternshipApplicationRow {
  applicationId: string;
  offerId: string | null;
  positionTitle: string;
  organization: string | null;
  status: string;
  submittedOn: string | null;
  nextAction: string | null;
  nextActionDueOn: string | null;
}

export function toInternshipApplicationRow(raw: unknown): InternshipApplicationRow | null {
  const value = asObject(raw);
  const applicationId = str(value['application_id']);
  if (applicationId === null) return null;
  return {
    applicationId,
    offerId: str(value['offer_id']),
    positionTitle: str(value['position_title']) ?? '',
    organization: str(value['organization']),
    status: str(value['status']) ?? 'to_prepare',
    submittedOn: str(value['submitted_on']),
    nextAction: str(value['next_action']),
    nextActionDueOn: str(value['next_action_due_on']),
  };
}

export interface InternshipApplicationDetail extends InternshipApplicationRow {
  applicationChannel: string;
  message: string | null;
  notes: string | null;
  cvStoragePath: string | null;
  timeline: {
    fromStatus: string | null;
    toStatus: string;
    occurredOn: string;
    note: string | null;
    declaredByMe: boolean;
  }[];
  helpers: {
    requestId: string;
    requestType: string;
    status: string;
    displayName: string;
  }[];
  placement: { placementId: string; status: string } | null;
}

export function toInternshipApplicationDetail(raw: unknown): InternshipApplicationDetail | null {
  const row = toInternshipApplicationRow(raw);
  if (row === null) return null;
  const value = asObject(raw);
  const placement = asObject(value['placement']);
  return {
    ...row,
    applicationChannel: str(value['application_channel']) ?? 'platform',
    message: str(value['message']),
    notes: str(value['notes']),
    cvStoragePath: str(value['cv_storage_path']),
    timeline: asArray(value['timeline']).flatMap((entry) => {
      const e = asObject(entry);
      const toStatus = str(e['to_status']);
      const occurredOn = str(e['occurred_on']);
      if (toStatus === null || occurredOn === null) return [];
      return [
        {
          fromStatus: str(e['from_status']),
          toStatus,
          occurredOn,
          note: str(e['note']),
          declaredByMe: bool(e['declared_by_me']),
        },
      ];
    }),
    helpers: asArray(value['helpers']).flatMap((entry) => {
      const h = asObject(entry);
      const requestId = str(h['request_id']);
      if (requestId === null) return [];
      return [
        {
          requestId,
          requestType: str(h['request_type']) ?? 'advice',
          status: str(h['status']) ?? 'sent',
          displayName: str(asObject(h['alumni'])['display_name']) ?? '',
        },
      ];
    }),
    placement:
      str(placement['placement_id']) === null
        ? null
        : {
            placementId: str(placement['placement_id']) as string,
            status: str(placement['status']) ?? 'confirmed',
          },
  };
}

/* ------------------------------------------------------------------ */
/* Mentorat                                                            */
/* ------------------------------------------------------------------ */

export type MentorAvailability = 'available' | 'capacity_reached';

export interface MentorCard {
  profileId: string;
  displayName: string;
  avatarPath: string | null;
  position: string | null;
  organization: string | null;
  city: string | null;
  countryName: string | null;
  promotion: string | null;
  verificationStatus: string;
  expertises: string[];
  topics: string[];
  formats: string[];
  frequency: string | null;
  statement: string | null;
  /** Deux etats seulement, jamais « 2 / 3 mentores » ([U 30]). */
  availability: MentorAvailability;
  relevance: Relevance;
}

export function toMentorCard(raw: unknown): MentorCard | null {
  const value = asObject(raw);
  const profileId = str(value['profile_id']);
  if (profileId === null) return null;
  return {
    profileId,
    displayName: str(value['display_name']) ?? '',
    avatarPath: str(value['avatar_path']),
    position: str(value['position']),
    organization: str(value['organization']),
    city: str(value['city']),
    countryName: str(value['country_name']),
    promotion: str(value['promotion']),
    verificationStatus: str(value['verification_status']) ?? 'unverified',
    expertises: strings(value['expertises']),
    topics: strings(value['topics']),
    formats: strings(value['formats']),
    frequency: str(value['frequency']),
    statement: str(value['statement']),
    availability: str(value['availability']) === 'available' ? 'available' : 'capacity_reached',
    relevance: toRelevance(value['relevance']),
  };
}

export interface MentorDetail extends MentorCard {
  isSelf: boolean;
  helpTopics: string[];
  languages: string[];
  /** Un FAIT (« 4 accompagnements termines »), pas une note ([F 30]). */
  completedMentorships: number;
  mentorSince: string | null;
  canRequest: boolean;
}

export function toMentorDetail(raw: unknown): MentorDetail | null {
  const card = toMentorCard(raw);
  if (card === null) return null;
  const value = asObject(raw);
  return {
    ...card,
    isSelf: bool(value['is_self']),
    helpTopics: strings(value['help_topics']),
    languages: strings(value['languages']),
    completedMentorships: num(value['completed_mentorships']) ?? 0,
    mentorSince: str(value['mentor_since']),
    canRequest: bool(value['can_request']),
  };
}

export interface MentorshipNeedView {
  objectiveType: string;
  objectiveText: string;
  topics: string[];
  mentorPreference: string | null;
  constraintsText: string | null;
  preferredFormat: string;
  preferredFrequency: string | null;
  sectorId: number | null;
  countryCode: string | null;
  languageCodes: string[];
}

export interface MentorProfileState {
  isActive: boolean;
  availabilityState: string;
  maxActiveMentees: number;
  activeMentorships: number;
  hasCapacity: boolean;
  pendingRequests: number;
  statement: string | null;
}

export interface MentorshipSummary {
  mentorshipId: string;
  status: string;
  objective: string;
  format: string;
  startDate: string | null;
  plannedEndDate: string | null;
  counterpartName: string;
  counterpartId: string | null;
}

function toMentorshipSummary(raw: unknown): MentorshipSummary | null {
  const value = asObject(raw);
  const mentorshipId = str(value['mentorship_id']);
  if (mentorshipId === null) return null;
  const counterpart = asObject(value['counterpart']);
  return {
    mentorshipId,
    status: str(value['status']) ?? 'active',
    objective: str(value['objective']) ?? '',
    format: str(value['format']) ?? 'three_months',
    startDate: str(value['start_date']),
    plannedEndDate: str(value['planned_end_date']),
    counterpartName: str(counterpart['display_name']) ?? '',
    counterpartId: str(counterpart['profile_id']),
  };
}

export interface MentorshipHome {
  need: MentorshipNeedView | null;
  mentorProfile: MentorProfileState | null;
  asMentee: MentorshipSummary[];
  asMentor: MentorshipSummary[];
  recommended: MentorCard[];
}

export function toMentorshipHome(raw: unknown): MentorshipHome {
  const value = asObject(raw);
  const needRaw = value['need'];
  const mentorRaw = value['mentor_profile'];

  return {
    need:
      needRaw === null || needRaw === undefined
        ? null
        : (() => {
            const n = asObject(needRaw);
            return {
              objectiveType: str(n['objective_type']) ?? 'other',
              objectiveText: str(n['objective_text']) ?? '',
              topics: strings(n['topics']),
              mentorPreference: str(n['mentor_preference']),
              constraintsText: str(n['constraints_text']),
              preferredFormat: str(n['preferred_format']) ?? 'three_months',
              preferredFrequency: str(n['preferred_frequency']),
              sectorId: num(n['sector_id']),
              countryCode: str(n['country_code']),
              languageCodes: strings(n['language_codes']),
            };
          })(),
    mentorProfile:
      mentorRaw === null || mentorRaw === undefined
        ? null
        : (() => {
            const m = asObject(mentorRaw);
            return {
              isActive: bool(m['is_active']),
              availabilityState: str(m['availability_state']) ?? 'available_now',
              maxActiveMentees: num(m['max_active_mentees']) ?? 1,
              activeMentorships: num(m['active_mentorships']) ?? 0,
              hasCapacity: bool(m['has_capacity']),
              pendingRequests: num(m['pending_requests']) ?? 0,
              statement: str(m['statement']),
            };
          })(),
    asMentee: asArray(value['as_mentee']).flatMap((entry) => {
      const s = toMentorshipSummary(entry);
      return s === null ? [] : [s];
    }),
    asMentor: asArray(value['as_mentor']).flatMap((entry) => {
      const s = toMentorshipSummary(entry);
      return s === null ? [] : [s];
    }),
    recommended: asArray(value['recommended']).flatMap((entry) => {
      const card = toMentorCard(entry);
      return card === null ? [] : [card];
    }),
  };
}

export { toMentorshipSummary };

export interface MentorshipRequestRow {
  requestId: string;
  status: string;
  objectiveType: string;
  objectiveText: string;
  currentSituation: string | null;
  expectations: string[];
  requestedFormat: string;
  requestedFrequency: string | null;
  message: string | null;
  alternativeFormat: string | null;
  alternativeMessage: string | null;
  declineReason: string | null;
  createdAt: string | null;
  counterpartName: string;
  counterpartId: string | null;
}

export function toMentorshipRequestRow(raw: unknown): MentorshipRequestRow | null {
  const value = asObject(raw);
  const requestId = str(value['request_id']);
  if (requestId === null) return null;
  const counterpart = asObject(value['counterpart']);
  return {
    requestId,
    status: str(value['status']) ?? 'pending',
    objectiveType: str(value['objective_type']) ?? 'other',
    objectiveText: str(value['objective_text']) ?? '',
    currentSituation: str(value['current_situation']),
    expectations: strings(value['expectations']),
    requestedFormat: str(value['requested_format']) ?? 'three_months',
    requestedFrequency: str(value['requested_frequency']),
    message: str(value['message']),
    alternativeFormat: str(value['alternative_format']),
    alternativeMessage: str(value['alternative_message']),
    declineReason: str(value['decline_reason']),
    createdAt: str(value['created_at']),
    counterpartName: str(counterpart['display_name']) ?? '',
    counterpartId: str(counterpart['profile_id']),
  };
}

export interface MentorshipDetail {
  mentorshipId: string;
  status: string;
  myRole: 'mentor' | 'mentee';
  counterpartName: string;
  counterpartId: string | null;
  objective: string;
  format: string;
  frequency: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  actualEndDate: string | null;
  closureReason: string | null;
  cycleNumber: number;
  sessionsCompleted: number;
  goals: { goalId: string; title: string; status: string; targetDate: string | null }[];
  actions: { actionId: string; title: string; status: string; dueOn: string | null }[];
  nextSession: {
    sessionId: string;
    scheduledAt: string | null;
    format: string | null;
    topic: string | null;
  } | null;
  sessions: {
    sessionId: string;
    scheduledAt: string | null;
    completedAt: string | null;
    format: string | null;
    topic: string | null;
    sharedSummary: string | null;
    status: string;
  }[];
  /** Uniquement les notes de l'appelant (rls.md §10.4). */
  myNotes: { sessionId: string | null; note: string }[];
  myFeedbackGiven: boolean;
}

export function toMentorshipDetail(raw: unknown): MentorshipDetail | null {
  const value = asObject(raw);
  const mentorshipId = str(value['mentorship_id']);
  if (mentorshipId === null) return null;
  const counterpart = asObject(value['counterpart']);
  const nextSession = asObject(value['next_session']);
  return {
    mentorshipId,
    status: str(value['status']) ?? 'active',
    myRole: str(value['my_role']) === 'mentor' ? 'mentor' : 'mentee',
    counterpartName: str(counterpart['display_name']) ?? '',
    counterpartId: str(counterpart['profile_id']),
    objective: str(value['objective']) ?? '',
    format: str(value['format']) ?? 'three_months',
    frequency: str(value['frequency']),
    startDate: str(value['start_date']),
    plannedEndDate: str(value['planned_end_date']),
    actualEndDate: str(value['actual_end_date']),
    closureReason: str(value['closure_reason']),
    cycleNumber: num(value['cycle_number']) ?? 1,
    sessionsCompleted: num(value['sessions_completed']) ?? 0,
    goals: asArray(value['goals']).flatMap((entry) => {
      const g = asObject(entry);
      const goalId = str(g['goal_id']);
      if (goalId === null) return [];
      return [
        {
          goalId,
          title: str(g['title']) ?? '',
          status: str(g['status']) ?? 'todo',
          targetDate: str(g['target_date']),
        },
      ];
    }),
    actions: asArray(value['actions']).flatMap((entry) => {
      const a = asObject(entry);
      const actionId = str(a['action_id']);
      if (actionId === null) return [];
      return [
        {
          actionId,
          title: str(a['title']) ?? '',
          status: str(a['status']) ?? 'todo',
          dueOn: str(a['due_on']),
        },
      ];
    }),
    nextSession:
      str(nextSession['session_id']) === null
        ? null
        : {
            sessionId: str(nextSession['session_id']) as string,
            scheduledAt: str(nextSession['scheduled_at']),
            format: str(nextSession['format']),
            topic: str(nextSession['topic']),
          },
    sessions: asArray(value['sessions']).flatMap((entry) => {
      const s = asObject(entry);
      const sessionId = str(s['session_id']);
      if (sessionId === null) return [];
      return [
        {
          sessionId,
          scheduledAt: str(s['scheduled_at']),
          completedAt: str(s['completed_at']),
          format: str(s['format']),
          topic: str(s['topic']),
          sharedSummary: str(s['shared_summary']),
          status: str(s['status']) ?? 'planned',
        },
      ];
    }),
    myNotes: asArray(value['my_notes']).flatMap((entry) => {
      const n = asObject(entry);
      const note = str(n['note']);
      if (note === null) return [];
      return [{ sessionId: str(n['session_id']), note }];
    }),
    myFeedbackGiven: bool(value['my_feedback_given']),
  };
}

/* ------------------------------------------------------------------ */
/* Mise en forme                                                       */
/* ------------------------------------------------------------------ */

/** Date courte francaise. `null` reste `null` : aucune date inventee. */
export function formatDate(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Taux de reconstitution, borne a 100 %. Jamais compare a une autre promotion. */
export function completionRate(claimed: number, referenced: number): number | null {
  if (referenced <= 0) return null;
  return Math.min(100, Math.round((claimed / referenced) * 100));
}
