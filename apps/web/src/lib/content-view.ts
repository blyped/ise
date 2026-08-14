import { asArray, asObject, bool, num, str, strings, toProfileCard } from '@/lib/network-view';
import type { NetworkProfileCard } from '@/lib/network-view';
import type { Page } from '@/lib/communities-view';
import { parseMedia, type LandingMedia } from '@/lib/public/landing-data';

/**
 * Types de vue et conversions PURES de la tranche ACTUALITES &
 * EVENEMENTS (ISE-092 -> ISE-096).
 *
 * DEUX POINTS DE VIGILANCE PORTES JUSQU'ICI :
 *  - `landingVisibility` est projete pour que l'interface DISE ce que
 *    voit un visiteur anonyme (D-123, D-131) ;
 *  - aucun type ne porte l'URL de connexion d'un evenement : seul
 *    `onlineUrlAvailable` existe. L'URL se demande separement par
 *    `public.get_event_online_url()`.
 */

export type { Page };

export type FeedScope = 'for_me' | 'network' | 'careers' | 'publications' | 'events';

const FEED_SCOPES: readonly FeedScope[] = [
  'for_me',
  'network',
  'careers',
  'publications',
  'events',
];

export function toFeedScope(raw: unknown): FeedScope {
  return typeof raw === 'string' && (FEED_SCOPES as readonly string[]).includes(raw)
    ? (raw as FeedScope)
    : 'for_me';
}

export type EventScope = 'for_me' | 'upcoming' | 'online' | 'nearby' | 'mine' | 'past';

const EVENT_SCOPES: readonly EventScope[] = [
  'for_me',
  'upcoming',
  'online',
  'nearby',
  'mine',
  'past',
];

export function toEventScope(raw: unknown): EventScope {
  return typeof raw === 'string' && (EVENT_SCOPES as readonly string[]).includes(raw)
    ? (raw as EventScope)
    : 'for_me';
}

export interface NewsProfileRef extends NetworkProfileCard {
  profileRole: string;
}

export interface NewsSource {
  sourceType: string;
  sourceUrl: string | null;
  title: string | null;
  verifiedAt: string | null;
}

export interface RelatedNews {
  newsId: string;
  title: string;
  categoryCode: string;
  publishedAt: string | null;
}

export interface NamedEntity {
  id: string;
  name: string;
}

export interface NewsCard {
  newsId: string;
  categoryCode: string;
  categoryName: string | null;
  title: string;
  slug: string;
  summary: string;
  eventDate: string | null;
  imagePath: string | null;
  /**
   * 0117 — couverture unique de l'article, resolue dans la mediatheque
   * publique (meme validation que la landing : bucket public, alternative
   * textuelle >= 3 caracteres). Remplace `imagePath` comme source de
   * verite pour « une image est-elle definie et affichable ? ». `null` si
   * aucune couverture n'est choisie, ou si le media n'y est plus valide.
   */
  cover: LandingMedia | null;
  /** 0117 — sans effet sur la page article (le titre y reste toujours visible) ; utile pour l'admin. */
  coverHasText: boolean;
  sourceType: string | null;
  sourceUrl: string | null;
  visibility: string;
  isFeatured: boolean;
  editorialStatus: string;
  publishedAt: string | null;
  createdAt: string;
  isSubmitter: boolean;
  /** `visible` = lisible par un visiteur anonyme sur la vitrine (D-123). */
  landingVisibility: string;
  promotion: string | null;
  community: string | null;
  profiles: NewsProfileRef[];
  skills: string[];
}

export interface NewsDetail extends NewsCard {
  body: string | null;
  organizations: NamedEntity[];
  communities: NamedEntity[];
  sources: NewsSource[];
  related: RelatedNews[];
}

export interface EventRegistration {
  status: string;
  registeredAt: string | null;
  isListed: boolean;
  attendedAt: string | null;
}

export interface AgendaItem {
  itemId: string;
  startsAt: string | null;
  title: string;
  description: string | null;
}

export interface EventSpeaker {
  speakerId: string;
  speakerRole: string;
  status: string;
  externalName: string | null;
  externalTitle: string | null;
  externalOrganization: string | null;
  profile: NetworkProfileCard | null;
}

export interface EventQuestion {
  questionId: string;
  question: string;
  isRequired: boolean;
}

export interface EventCard {
  eventId: string;
  eventTypeCode: string;
  eventTypeName: string | null;
  title: string;
  slug: string;
  format: string;
  countryCode: string | null;
  country: string | null;
  city: string | null;
  venueName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  capacity: number | null;
  registrationPolicy: string;
  visibility: string;
  status: string;
  publishedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  landingVisibility: string;
  /**
   * 0113 / D-166 — visuel de couverture de l'evenement, resolu dans la
   * mediatheque PUBLIQUE (`landing-media`) par `events.cover_media_id`.
   *
   * C'est EXACTEMENT le meme media que celui de l'encart d'accueil : une
   * seule image est televersee et decrite dans le CMS, puis reutilisee sur
   * la carte et sur la page de l'evenement. Les resolutions du mobile sont
   * produites a la volee par `next/image`, jamais par un second fichier
   * (meme regle que l'actualite, D-172).
   *
   * `null` si aucune couverture n'est choisie, ou si le media n'est plus
   * enregistre, decrit et dans un bucket public : la page s'affiche alors
   * SANS visuel, jamais avec un cadre vide ni une image cassee.
   */
  cover: LandingMedia | null;
  organizerType: string;
  organizerLabel: string | null;
  isOrganizer: boolean;
  registeredCount: number;
  knownRegisteredCount: number;
  myRegistration: EventRegistration | null;
  onlineUrlVisibility: string;
  onlineUrlAvailable: boolean;
}

export interface EventDetail extends EventCard {
  description: string | null;
  targetAudience: string | null;
  address: string | null;
  cancellationReason: string | null;
  attendeeListVisibility: string;
  agenda: AgendaItem[];
  speakers: EventSpeaker[];
  questions: EventQuestion[];
  communities: NamedEntity[];
  knownAttendees: NetworkProfileCard[];
}

export interface EventFollowupBlock {
  summary: string | null;
  conclusions: string | null;
  decisions: string | null;
  nextSteps: string | null;
  replayUrl: string | null;
  publishedAt: string | null;
}

export interface EventResource {
  resourceId: string;
  title: string;
  resourceType: string;
  externalUrl: string | null;
  storagePath: string | null;
}

export interface EventOutcome {
  outcomeId: string;
  outcomeType: string;
  targetEntityType: string | null;
  targetEntityId: string | null;
  notes: string | null;
  declaredAt: string;
  targetProfile: NetworkProfileCard | null;
}

export interface MyEventImpact {
  contacts: number;
  followUps: number;
  resources: number;
}

export interface EventImpactSnapshot {
  snapshotAt: string;
  registeredCount: number;
  attendedCount: number;
  noShowCount: number;
  promotionsRepresented: number;
  countriesRepresented: number;
  connectionsCreated: number;
  projectsInitiated: number;
  mentorshipsInitiated: number;
  resourcesProduced: number;
}

export interface EventFollowup extends EventDetail {
  followup: EventFollowupBlock | null;
  resources: EventResource[];
  myOutcomes: EventOutcome[];
  myImpact: MyEventImpact;
  /** Renseigne pour l'organisateur seulement ; `null` sinon (jamais 0). */
  eventImpact: EventImpactSnapshot | null;
}

export type FeedEntry =
  { kind: 'news'; at: string; news: NewsCard } | { kind: 'event'; at: string; event: EventCard };

/* ------------------------------------------------------------------ */

export function toNewsCard(value: unknown): NewsCard | null {
  const raw = asObject(value);
  const newsId = str(raw['news_id']);
  if (newsId === null) return null;
  return {
    newsId,
    categoryCode: str(raw['category_code']) ?? 'other',
    categoryName: str(raw['category_name']),
    title: str(raw['title']) ?? '',
    slug: str(raw['slug']) ?? '',
    summary: str(raw['summary']) ?? '',
    eventDate: str(raw['event_date']),
    imagePath: str(raw['image_path']),
    cover: parseMedia(raw['cover']),
    coverHasText: bool(raw['cover_has_text']),
    sourceType: str(raw['source_type']),
    sourceUrl: str(raw['source_url']),
    visibility: str(raw['visibility']) ?? 'members',
    isFeatured: bool(raw['is_featured']),
    editorialStatus: str(raw['editorial_status']) ?? 'published',
    publishedAt: str(raw['published_at']),
    createdAt: str(raw['created_at']) ?? '',
    isSubmitter: bool(raw['is_submitter']),
    landingVisibility: str(raw['landing_visibility']) ?? 'hidden',
    promotion: str(raw['promotion']),
    community: str(raw['community']),
    profiles: asArray(raw['profiles']).flatMap((entry) => {
      const profile = toProfileCard(entry);
      if (profile === null) return [];
      return [{ ...profile, profileRole: str(asObject(entry)['profile_role']) ?? 'subject' }];
    }),
    skills: strings(raw['skills']),
  };
}

function toNamedEntities(value: unknown): NamedEntity[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const id = str(raw['id']);
    const name = str(raw['name']);
    if (id === null || name === null) return [];
    return [{ id, name }];
  });
}

export function toNewsDetail(value: unknown): NewsDetail | null {
  const card = toNewsCard(value);
  if (card === null) return null;
  const raw = asObject(value);
  return {
    ...card,
    body: str(raw['body']),
    organizations: toNamedEntities(raw['organizations']),
    communities: toNamedEntities(raw['communities']),
    sources: asArray(raw['sources']).flatMap((entry) => {
      const source = asObject(entry);
      const sourceType = str(source['source_type']);
      if (sourceType === null) return [];
      return [
        {
          sourceType,
          sourceUrl: str(source['source_url']),
          title: str(source['title']),
          verifiedAt: str(source['verified_at']),
        },
      ];
    }),
    related: asArray(raw['related']).flatMap((entry) => {
      const item = asObject(entry);
      const newsId = str(item['news_id']);
      if (newsId === null) return [];
      return [
        {
          newsId,
          title: str(item['title']) ?? '',
          categoryCode: str(item['category_code']) ?? 'other',
          publishedAt: str(item['published_at']),
        },
      ];
    }),
  };
}

export function toEventCard(value: unknown): EventCard | null {
  const raw = asObject(value);
  const eventId = str(raw['event_id']);
  if (eventId === null) return null;
  const registration = asObject(raw['my_registration']);
  const registrationStatus = str(registration['status']);

  return {
    eventId,
    eventTypeCode: str(raw['event_type_code']) ?? '',
    eventTypeName: str(raw['event_type_name']),
    title: str(raw['title']) ?? '',
    slug: str(raw['slug']) ?? '',
    format: str(raw['format']) ?? 'online',
    countryCode: str(raw['country_code']),
    country: str(raw['country']),
    city: str(raw['city']),
    venueName: str(raw['venue_name']),
    startsAt: str(raw['starts_at']) ?? '',
    endsAt: str(raw['ends_at']),
    timezone: str(raw['timezone']) ?? 'UTC',
    capacity: num(raw['capacity']),
    registrationPolicy: str(raw['registration_policy']) ?? 'optional',
    visibility: str(raw['visibility']) ?? 'members',
    status: str(raw['status']) ?? 'published',
    publishedAt: str(raw['published_at']),
    cancelledAt: str(raw['cancelled_at']),
    completedAt: str(raw['completed_at']),
    createdAt: str(raw['created_at']) ?? '',
    landingVisibility: str(raw['landing_visibility']) ?? 'hidden',
    cover: parseMedia(raw['cover']),
    organizerType: str(raw['organizer_type']) ?? 'platform',
    organizerLabel: str(raw['organizer_label']),
    isOrganizer: bool(raw['is_organizer']),
    registeredCount: num(raw['registered_count']) ?? 0,
    knownRegisteredCount: num(raw['known_registered_count']) ?? 0,
    myRegistration:
      registrationStatus === null
        ? null
        : {
            status: registrationStatus,
            registeredAt: str(registration['registered_at']),
            isListed: bool(registration['is_listed']),
            attendedAt: str(registration['attended_at']),
          },
    onlineUrlVisibility: str(raw['online_url_visibility']) ?? 'registered',
    onlineUrlAvailable: bool(raw['online_url_available']),
  };
}

export function toEventDetail(value: unknown): EventDetail | null {
  const card = toEventCard(value);
  if (card === null) return null;
  const raw = asObject(value);
  return {
    ...card,
    description: str(raw['description']),
    targetAudience: str(raw['target_audience']),
    address: str(raw['address']),
    cancellationReason: str(raw['cancellation_reason']),
    attendeeListVisibility: str(raw['attendee_list_visibility']) ?? 'organizer',
    agenda: asArray(raw['agenda']).flatMap((entry) => {
      const item = asObject(entry);
      const itemId = str(item['item_id']);
      if (itemId === null) return [];
      return [
        {
          itemId,
          startsAt: str(item['starts_at']),
          title: str(item['title']) ?? '',
          description: str(item['description']),
        },
      ];
    }),
    speakers: asArray(raw['speakers']).flatMap((entry) => {
      const speaker = asObject(entry);
      const speakerId = str(speaker['speaker_id']);
      if (speakerId === null) return [];
      return [
        {
          speakerId,
          speakerRole: str(speaker['speaker_role']) ?? 'speaker',
          status: str(speaker['status']) ?? 'invited',
          externalName: str(speaker['external_name']),
          externalTitle: str(speaker['external_title']),
          externalOrganization: str(speaker['external_organization']),
          profile: toProfileCard(speaker['profile']),
        },
      ];
    }),
    questions: asArray(raw['questions']).flatMap((entry) => {
      const question = asObject(entry);
      const questionId = str(question['question_id']);
      if (questionId === null) return [];
      return [
        {
          questionId,
          question: str(question['question']) ?? '',
          isRequired: bool(question['is_required']),
        },
      ];
    }),
    communities: toNamedEntities(raw['communities']),
    knownAttendees: asArray(raw['known_attendees']).flatMap((entry) => {
      const profile = toProfileCard(entry);
      return profile === null ? [] : [profile];
    }),
  };
}

export function toEventFollowup(value: unknown): EventFollowup | null {
  const detail = toEventDetail(value);
  if (detail === null) return null;
  const raw = asObject(value);
  const followup = asObject(raw['followup']);
  const impact = asObject(raw['my_impact']);
  const snapshot = asObject(raw['event_impact']);
  const snapshotAt = str(snapshot['snapshot_at']);

  return {
    ...detail,
    followup:
      Object.keys(followup).length === 0
        ? null
        : {
            summary: str(followup['summary']),
            conclusions: str(followup['conclusions']),
            decisions: str(followup['decisions']),
            nextSteps: str(followup['next_steps']),
            replayUrl: str(followup['replay_url']),
            publishedAt: str(followup['published_at']),
          },
    resources: asArray(raw['resources']).flatMap((entry) => {
      const resource = asObject(entry);
      const resourceId = str(resource['resource_id']);
      if (resourceId === null) return [];
      return [
        {
          resourceId,
          title: str(resource['title']) ?? '',
          resourceType: str(resource['resource_type']) ?? 'document',
          externalUrl: str(resource['external_url']),
          storagePath: str(resource['storage_path']),
        },
      ];
    }),
    myOutcomes: asArray(raw['my_outcomes']).flatMap((entry) => {
      const outcome = asObject(entry);
      const outcomeId = str(outcome['outcome_id']);
      if (outcomeId === null) return [];
      return [
        {
          outcomeId,
          outcomeType: str(outcome['outcome_type']) ?? 'other',
          targetEntityType: str(outcome['target_entity_type']),
          targetEntityId: str(outcome['target_entity_id']),
          notes: str(outcome['notes']),
          declaredAt: str(outcome['declared_at']) ?? '',
          targetProfile: toProfileCard(outcome['target_profile']),
        },
      ];
    }),
    myImpact: {
      contacts: num(impact['contacts']) ?? 0,
      followUps: num(impact['follow_ups']) ?? 0,
      resources: num(impact['resources']) ?? 0,
    },
    eventImpact:
      snapshotAt === null
        ? null
        : {
            snapshotAt,
            registeredCount: num(snapshot['registered_count']) ?? 0,
            attendedCount: num(snapshot['attended_count']) ?? 0,
            noShowCount: num(snapshot['no_show_count']) ?? 0,
            promotionsRepresented: num(snapshot['promotions_represented']) ?? 0,
            countriesRepresented: num(snapshot['countries_represented']) ?? 0,
            connectionsCreated: num(snapshot['connections_created']) ?? 0,
            projectsInitiated: num(snapshot['projects_initiated']) ?? 0,
            mentorshipsInitiated: num(snapshot['mentorships_initiated']) ?? 0,
            resourcesProduced: num(snapshot['resources_produced']) ?? 0,
          },
  };
}

export function toFeedEntry(value: unknown): FeedEntry | null {
  const raw = asObject(value);
  const kind = str(raw['kind']);
  const at = str(raw['at']) ?? '';
  if (kind === 'news') {
    const news = toNewsCard(raw['news']);
    return news === null ? null : { kind: 'news', at, news };
  }
  if (kind === 'event') {
    const event = toEventCard(raw['event']);
    return event === null ? null : { kind: 'event', at, event };
  }
  return null;
}

/** Date longue en francais avec heure et fuseau explicite (CA-EVENT-01). */
export function formatEventMoment(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
  return `${formatted} (${timezone})`;
}

/** Bloc « date » des cartes evenement : jour et mois abreges. */
export function formatEventDayBadge(iso: string, timezone: string): { day: string; month: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '', month: '' };
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: timezone }).format(date);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: timezone }).format(
    date,
  );
  return { day, month };
}
