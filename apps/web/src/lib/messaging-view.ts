import { asArray, asObject, bool, num, str } from '@/lib/network-view';

/**
 * Types de vue et conversions PURES des tranches NOTIFICATIONS (ISE-098),
 * PARAMETRES (ISE-099) et SUPPORT (ISE-100).
 *
 * NOM TROMPEUR, CONSERVE VOLONTAIREMENT : ce fichier s'appelle encore
 * `messaging-view.ts` parce qu'il est ne avec la tranche ISE-097 -> 100,
 * mais il n'a plus rien de la messagerie depuis C-08. Il est importe par
 * les parametres, le support, les notifications et les membres bloques.
 * Le renommer imposerait de toucher une douzaine d'ecrans etrangers a la
 * decision : le cout depasse le benefice.
 *
 * Meme motif que `lib/network-view.ts` : les consommateurs sont parfois
 * des composants CLIENT. S'ils importaient quoi que ce soit depuis
 * `lib/queries/*`, le bundler tirerait `lib/supabase/server.ts` — donc
 * `next/headers` — dans le bundle navigateur. Tout ce qui est partage vit
 * ici, sans aucune dependance serveur.
 */

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export interface CursorPage<T> {
  rows: T[];
  /** Curseur SCELLE (`lib/opaque-cursor.ts`). `null` = fin de liste. */
  nextCursor: string | null;
}

/* ------------------------------------------------------------------ */
/* ISE-098 — Notifications                                             */
/* ------------------------------------------------------------------ */

export interface NotificationRow {
  notificationId: string;
  typeCode: string | null;
  category: string;
  /** D-81 : la priorite est un axe distinct de la categorie. */
  priority: string;
  title: string;
  body: string | null;
  reasonText: string | null;
  entityType: string | null;
  entityId: string | null;
  actionPath: string | null;
  actionLabel: string | null;
  groupCount: number;
  read: boolean;
  archived: boolean;
  expired: boolean;
  createdAt: string | null;
}

/**
 * C-08 : `unreadMessages` a disparu avec la messagerie. La RPC
 * `my_notification_summary()` ne renvoie plus la cle `unread_messages`
 * (migration 0128) et plus aucun ecran ne l'affichait.
 */
export interface NotificationSummary {
  unread: number;
  actionRequired: number;
  readNotArchived: number;
  total: number;
  byCategory: { category: string; total: number; unread: number }[];
}

export function toNotificationRow(value: unknown): NotificationRow | null {
  const raw = asObject(value);
  const notificationId = str(raw['notification_id']);
  const title = str(raw['title']);
  if (notificationId === null || title === null) return null;
  return {
    notificationId,
    typeCode: str(raw['type_code']),
    category: str(raw['category']) ?? 'system',
    priority: str(raw['priority']) ?? 'info',
    title,
    body: str(raw['body']),
    reasonText: str(raw['reason_text']),
    entityType: str(raw['entity_type']),
    entityId: str(raw['entity_id']),
    actionPath: str(raw['action_path']),
    actionLabel: str(raw['action_label']),
    groupCount: num(raw['group_count']) ?? 1,
    read: bool(raw['read']),
    archived: bool(raw['archived']),
    expired: bool(raw['expired']),
    createdAt: str(raw['created_at']),
  };
}

export function toNotificationSummary(value: unknown): NotificationSummary {
  const raw = asObject(value);
  return {
    unread: num(raw['unread']) ?? 0,
    actionRequired: num(raw['action_required']) ?? 0,
    readNotArchived: num(raw['read_not_archived']) ?? 0,
    total: num(raw['total']) ?? 0,
    byCategory: asArray(raw['by_category']).flatMap((entry) => {
      const item = asObject(entry);
      const category = str(item['category']);
      return category === null
        ? []
        : [
            {
              category,
              total: num(item['total']) ?? 0,
              unread: num(item['unread']) ?? 0,
            },
          ];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* ISE-099 — Parametres                                                */
/* ------------------------------------------------------------------ */

/**
 * C-08 : `directMessagePolicy` (« Qui peut m'ecrire ») et
 * `showReadReceipts` (« accuses de lecture ») ne sont plus projetes. Les
 * COLONNES restent en base — aucune donnee n'est detruite, la decision
 * reste reversible — mais plus rien ne les lit ni ne les ecrit : leur
 * seul lecteur etait `private.can_message_profile()`, supprimee par la
 * migration 0128. Un reglage sans effet ne doit pas rester visible du
 * membre (MASTER PROMPT §113).
 */
export interface MemberSettings {
  interfaceLanguage: string;
  timezone: string;
  notificationPreset: string;
  emailDigestFrequency: string;
  appearInMatching: boolean;
  appearInAttendeeLists: boolean;
  isPaused: boolean;
  pausedAt: string | null;
  pauseReason: string | null;
  deletionRequestedAt: string | null;
}

export interface FieldVisibilityRow {
  fieldKey: string;
  label: string;
  level: string;
  defaultLevel: string;
  /** Seuls ces niveaux sont proposes — et acceptes par la base (D-73). */
  allowedLevels: string[];
  isDefault: boolean;
}

export interface NotificationPreferenceRow {
  typeCode: string;
  category: string;
  label: string;
  description: string | null;
  defaultPriority: string;
  configurable: boolean;
  emailAllowed: boolean;
  pushAllowed: boolean;
  inApp: boolean;
  emailMode: string;
  push: boolean;
  isDefault: boolean;
}

export interface ConsentRow {
  consentType: string;
  version: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface TermsRow {
  documentType: string;
  version: string;
  acceptedAt: string | null;
}

export interface BlockedProfileRow {
  profileId: string;
  displayName: string;
  blockedAt: string | null;
}

export function toMemberSettings(value: unknown): MemberSettings {
  const raw = asObject(value);
  return {
    interfaceLanguage: str(raw['interface_language']) ?? 'fr',
    timezone: str(raw['timezone']) ?? 'UTC',
    notificationPreset: str(raw['notification_preset']) ?? 'recommended',
    emailDigestFrequency: str(raw['email_digest_frequency']) ?? 'weekly',
    appearInMatching: raw['appear_in_matching'] !== false,
    appearInAttendeeLists: bool(raw['appear_in_attendee_lists']),
    isPaused: bool(raw['is_paused']),
    pausedAt: str(raw['paused_at']),
    pauseReason: str(raw['pause_reason']),
    deletionRequestedAt: str(raw['deletion_requested_at']),
  };
}

export function toFieldVisibilityRows(value: unknown): FieldVisibilityRow[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const fieldKey = str(raw['field_key']);
    if (fieldKey === null) return [];
    return [
      {
        fieldKey,
        label: str(raw['label']) ?? fieldKey,
        level: str(raw['level']) ?? 'private',
        defaultLevel: str(raw['default_level']) ?? 'private',
        allowedLevels: asArray(raw['allowed_levels']).filter(
          (level): level is string => typeof level === 'string',
        ),
        isDefault: bool(raw['is_default']),
      },
    ];
  });
}

export function toNotificationPreferenceRows(value: unknown): NotificationPreferenceRow[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const typeCode = str(raw['type_code']);
    if (typeCode === null) return [];
    return [
      {
        typeCode,
        category: str(raw['category']) ?? 'system',
        label: str(raw['label']) ?? typeCode,
        description: str(raw['description']),
        defaultPriority: str(raw['default_priority']) ?? 'info',
        configurable: raw['configurable'] !== false,
        emailAllowed: raw['email_allowed'] !== false,
        pushAllowed: bool(raw['push_allowed']),
        inApp: raw['in_app'] !== false,
        emailMode: str(raw['email_mode']) ?? 'off',
        push: bool(raw['push']),
        isDefault: bool(raw['is_default']),
      },
    ];
  });
}

export function toConsentRows(value: unknown): ConsentRow[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const consentType = str(raw['consent_type']);
    if (consentType === null) return [];
    return [
      {
        consentType,
        version: str(raw['version']) ?? '',
        granted: bool(raw['granted']),
        grantedAt: str(raw['granted_at']),
        revokedAt: str(raw['revoked_at']),
      },
    ];
  });
}

export function toTermsRows(value: unknown): TermsRow[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const documentType = str(raw['document_type']);
    if (documentType === null) return [];
    return [
      {
        documentType,
        version: str(raw['version']) ?? '',
        acceptedAt: str(raw['accepted_at']),
      },
    ];
  });
}

export function toBlockedRows(value: unknown): BlockedProfileRow[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const profileId = str(raw['profile_id']);
    if (profileId === null) return [];
    return [
      {
        profileId,
        displayName: str(raw['display_name']) ?? '',
        blockedAt: str(raw['blocked_at']),
      },
    ];
  });
}

/* ------------------------------------------------------------------ */
/* ISE-100 — Support                                                   */
/* ------------------------------------------------------------------ */

export interface SupportCategory {
  code: string;
  name: string;
  description: string | null;
  routesToModeration: boolean;
}

export interface ReportReason {
  code: string;
  name: string;
  description: string | null;
  /** D-66 : referentiel unique, filtre par type d'objet. */
  appliesTo: string[];
}

export interface TicketRow {
  ticketId: string;
  referenceCode: string;
  subject: string;
  categoryCode: string;
  categoryName: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  reopenedCount: number;
  messageCount: number;
}

export interface TicketMessage {
  messageId: string;
  authorKind: string;
  fromMe: boolean;
  body: string;
  createdAt: string | null;
}

export interface TicketDetail {
  ticketId: string;
  referenceCode: string;
  subject: string;
  description: string;
  categoryCode: string;
  categoryName: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  reopenedCount: number;
  canReply: boolean;
  canClose: boolean;
  canReopen: boolean;
  messages: TicketMessage[];
}

export interface ReportRow {
  reportId: string;
  targetType: string;
  reasonCode: string;
  reasonName: string | null;
  status: string;
  createdAt: string | null;
}

export function toTicketRow(value: unknown): TicketRow | null {
  const raw = asObject(value);
  const ticketId = str(raw['ticket_id']);
  if (ticketId === null) return null;
  return {
    ticketId,
    referenceCode: str(raw['reference_code']) ?? '',
    subject: str(raw['subject']) ?? '',
    categoryCode: str(raw['category_code']) ?? '',
    categoryName: str(raw['category_name']),
    status: str(raw['status']) ?? 'open',
    createdAt: str(raw['created_at']),
    updatedAt: str(raw['updated_at']),
    reopenedCount: num(raw['reopened_count']) ?? 0,
    messageCount: num(raw['message_count']) ?? 0,
  };
}

export function toTicketDetail(value: unknown): TicketDetail | null {
  const raw = asObject(value);
  const ticketId = str(raw['ticket_id']);
  if (ticketId === null) return null;
  return {
    ticketId,
    referenceCode: str(raw['reference_code']) ?? '',
    subject: str(raw['subject']) ?? '',
    description: str(raw['description']) ?? '',
    categoryCode: str(raw['category_code']) ?? '',
    categoryName: str(raw['category_name']),
    status: str(raw['status']) ?? 'open',
    createdAt: str(raw['created_at']),
    updatedAt: str(raw['updated_at']),
    reopenedCount: num(raw['reopened_count']) ?? 0,
    canReply: bool(raw['can_reply']),
    canClose: bool(raw['can_close']),
    canReopen: bool(raw['can_reopen']),
    messages: asArray(raw['messages']).flatMap((entry) => {
      const item = asObject(entry);
      const messageId = str(item['message_id']);
      const body = str(item['body']);
      if (messageId === null || body === null) return [];
      return [
        {
          messageId,
          authorKind: str(item['author_kind']) ?? 'system',
          fromMe: bool(item['from_me']),
          body,
          createdAt: str(item['created_at']),
        },
      ];
    }),
  };
}

export function toReportRows(value: unknown): ReportRow[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const reportId = str(raw['report_id']);
    if (reportId === null) return [];
    return [
      {
        reportId,
        targetType: str(raw['target_type']) ?? 'profile',
        reasonCode: str(raw['reason_code']) ?? '',
        reasonName: str(raw['reason_name']),
        status: str(raw['status']) ?? 'open',
        createdAt: str(raw['created_at']),
      },
    ];
  });
}

/* ------------------------------------------------------------------ */
/* Formatage de date, partage serveur / navigateur                     */
/* ------------------------------------------------------------------ */

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export function formatDateTime(value: string | null): string {
  if (value === null) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : DATE_TIME.format(date);
}

export function formatDate(value: string | null): string {
  if (value === null) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : DATE_ONLY.format(date);
}
