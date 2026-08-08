import {
  asArray,
  asObject,
  bool,
  num,
  str,
  toProfileCard,
  type NetworkProfileCard,
} from '@/lib/network-view';

/**
 * Types de vue et conversions PURES des tranches MESSAGERIE (ISE-097),
 * NOTIFICATIONS (ISE-098), PARAMETRES (ISE-099) et SUPPORT (ISE-100).
 *
 * Meme motif que `lib/network-view.ts` : `MessageThread` est un composant
 * CLIENT. S'il importait quoi que ce soit depuis `lib/queries/*`, le
 * bundler tirerait `lib/supabase/server.ts` — donc `next/headers` — dans
 * le bundle navigateur. Tout ce qui est partage vit ici, sans aucune
 * dependance serveur.
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
/* ISE-097 — Messagerie                                                */
/* ------------------------------------------------------------------ */

/**
 * D-83 — etats d'un message.
 *   `pending` n'existe QUE dans le navigateur, tant que le serveur n'a
 *   pas accuse reception. L'interface n'affiche jamais « Envoyé » avant.
 *   `sent` est pose par la base, et par elle seule.
 *   `failed` est local : l'envoi n'a pas abouti, le message est rejouable
 *   avec le meme `clientMessageId` (idempotence).
 */
export type MessageDeliveryStatus = 'pending' | 'sent' | 'failed';

export function toDeliveryStatus(value: unknown): MessageDeliveryStatus {
  return value === 'pending' || value === 'failed' ? value : 'sent';
}

export interface ConversationPreview {
  excerpt: string | null;
  deleted: boolean;
  fromMe: boolean;
  isSystem: boolean;
  at: string | null;
}

export interface ConversationRow {
  conversationId: string;
  conversationType: string;
  contextType: string | null;
  contextLabel: string | null;
  title: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  archived: boolean;
  participantCount: number;
  counterpart: NetworkProfileCard | null;
  preview: ConversationPreview;
}

export interface ConversationInbox extends CursorPage<ConversationRow> {
  unreadTotal: number;
  archivedTotal: number;
}

export interface ConversationHeader {
  conversationId: string;
  conversationType: string;
  contextType: string | null;
  contextId: string | null;
  contextLabel: string | null;
  initiationReason: string | null;
  title: string | null;
  createdAt: string | null;
  messageCount: number;
  archived: boolean;
  unreadCount: number;
  counterpart: NetworkProfileCard | null;
  counterpartId: string | null;
  isBlocked: boolean;
  canReply: boolean;
  /** Reglage du DESTINATAIRE : s'il le refuse, « Lu » n'est jamais affiche. */
  showReadReceipts: boolean;
}

export interface MessageRow {
  messageId: string;
  clientMessageId: string | null;
  messageType: string;
  body: string | null;
  deleted: boolean;
  createdAt: string | null;
  editedAt: string | null;
  deliveryStatus: MessageDeliveryStatus;
  fromMe: boolean;
  senderName: string | null;
  readByOther: boolean;
  hasAttachments: boolean;
}

export function toConversationPreview(value: unknown): ConversationPreview {
  const raw = asObject(value);
  return {
    excerpt: str(raw['excerpt']),
    deleted: bool(raw['deleted']),
    fromMe: bool(raw['from_me']),
    isSystem: bool(raw['is_system']),
    at: str(raw['at']),
  };
}

export function toConversationRow(value: unknown): ConversationRow | null {
  const raw = asObject(value);
  const conversationId = str(raw['conversation_id']);
  if (conversationId === null) return null;
  return {
    conversationId,
    conversationType: str(raw['conversation_type']) ?? 'direct',
    contextType: str(raw['context_type']),
    contextLabel: str(raw['context_label']),
    title: str(raw['title']),
    lastMessageAt: str(raw['last_message_at']),
    unreadCount: num(raw['unread_count']) ?? 0,
    archived: bool(raw['archived']),
    participantCount: num(raw['participant_count']) ?? 0,
    counterpart: toProfileCard(raw['counterpart']),
    preview: toConversationPreview(raw['preview']),
  };
}

export function toConversationHeader(value: unknown): ConversationHeader | null {
  const raw = asObject(value);
  const conversationId = str(raw['conversation_id']);
  if (conversationId === null) return null;
  return {
    conversationId,
    conversationType: str(raw['conversation_type']) ?? 'direct',
    contextType: str(raw['context_type']),
    contextId: str(raw['context_id']),
    contextLabel: str(raw['context_label']),
    initiationReason: str(raw['initiation_reason']),
    title: str(raw['title']),
    createdAt: str(raw['created_at']),
    messageCount: num(raw['message_count']) ?? 0,
    archived: bool(raw['archived']),
    unreadCount: num(raw['unread_count']) ?? 0,
    counterpart: toProfileCard(raw['counterpart']),
    counterpartId: str(raw['counterpart_id']),
    isBlocked: bool(raw['is_blocked']),
    canReply: bool(raw['can_reply']),
    showReadReceipts: raw['show_read_receipts'] !== false,
  };
}

export function toMessageRow(value: unknown): MessageRow | null {
  const raw = asObject(value);
  const messageId = str(raw['message_id']);
  if (messageId === null) return null;
  return {
    messageId,
    clientMessageId: str(raw['client_message_id']),
    messageType: str(raw['message_type']) ?? 'text',
    body: str(raw['body']),
    deleted: bool(raw['deleted']),
    createdAt: str(raw['created_at']),
    editedAt: str(raw['edited_at']),
    deliveryStatus: toDeliveryStatus(raw['delivery_status']),
    fromMe: bool(raw['from_me']),
    senderName: str(raw['sender_name']),
    readByOther: bool(raw['read_by_other']),
    hasAttachments: bool(raw['has_attachments']),
  };
}

export function toMessageRows(value: unknown): MessageRow[] {
  return asArray(value).flatMap((entry) => {
    const row = toMessageRow(entry);
    return row === null ? [] : [row];
  });
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

export interface NotificationSummary {
  unread: number;
  actionRequired: number;
  readNotArchived: number;
  total: number;
  byCategory: { category: string; total: number; unread: number }[];
  unreadMessages: number;
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
    unreadMessages: num(raw['unread_messages']) ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* ISE-099 — Parametres                                                */
/* ------------------------------------------------------------------ */

export interface MemberSettings {
  interfaceLanguage: string;
  timezone: string;
  notificationPreset: string;
  emailDigestFrequency: string;
  directMessagePolicy: string;
  showReadReceipts: boolean;
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
    directMessagePolicy: str(raw['direct_message_policy']) ?? 'connections',
    showReadReceipts: raw['show_read_receipts'] !== false,
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

const TIME_ONLY = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

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

export function formatTime(value: string | null): string {
  if (value === null) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : TIME_ONLY.format(date);
}
