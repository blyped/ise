import { frCms } from '@/i18n/cms';
import type { CmsStatus } from './types';

/**
 * Formatage des dates et des statuts du CMS.
 *
 * Toutes les dates sont stockees en UTC (`timestamptz`). Elles sont
 * affichees dans le fuseau Europe/Paris, qui est celui de l'equipe
 * editoriale, et le fuseau est ECRIT a cote quand la precision compte :
 * un ordre de programmation lu dans le mauvais fuseau se declenche a la
 * mauvaise heure.
 */

const DISPLAY_TIME_ZONE = 'Europe/Paris';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: DISPLAY_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: DISPLAY_TIME_ZONE,
});

const longDateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: DISPLAY_TIME_ZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  timeZone: DISPLAY_TIME_ZONE,
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return frCms.common.none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return frCms.common.none;
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return frCms.common.none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return frCms.common.none;
  return dateTimeFormatter.format(date);
}

export function formatLongDateTime(value: string | null | undefined): string {
  if (!value) return frCms.common.none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return frCms.common.none;
  return longDateTimeFormatter.format(date);
}

export function formatWeekday(date: Date): string {
  return weekdayFormatter.format(date).replace('.', '').toUpperCase();
}

/**
 * Periode d'un contenu, telle que l'affichent les maquettes :
 * « Maintenant → 24 sept. », « Jusqu'au 15 août », « Non programmé ».
 */
export function formatPeriod(startAt: string | null, endAt: string | null): string {
  if (startAt === null && endAt === null) return frCms.common.notScheduled;
  if (startAt !== null && endAt === null) return `À partir du ${formatDate(startAt)}`;
  if (startAt === null && endAt !== null) return `Jusqu’au ${formatDate(endAt)}`;
  return `${formatDate(startAt)} → ${formatDate(endAt)}`;
}

export function statusLabel(status: string): string {
  return frCms.status[status] ?? status;
}

/**
 * 0137 — pseudo-statut d'affichage.
 *
 * Ce n'est PAS un statut métier : aucune colonne ne le porte, et il ne
 * transite jamais vers la base. Il sert uniquement de clé de teinte pour la
 * pastille d'une ligne marquée « Visible sur la landing » que la landing
 * n'affichera pourtant pas.
 */
export const LANDING_BLOCKED_STATUS = 'landing_blocked';

/**
 * 0137 — motif de non-parution, en clair.
 *
 * Les codes viennent de `private.landing_event_block_reason()` et de
 * `private.landing_opportunity_block_reason()`. Un code inconnu se replie
 * sur une phrase générique, puis sur le code brut : mieux vaut afficher
 * `deadline_passed` que rien du tout.
 */
export function landingBlockedLabel(reason: string): string {
  const { reasons } = frCms.landingBlocked;
  return reasons[reason] ?? reasons['unknown'] ?? reason;
}

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'accent';

/**
 * Teinte de la pastille. La couleur ne porte JAMAIS seule l'information :
 * le libelle est toujours affiche a cote (D-90).
 */
export function statusTone(status: string): StatusTone {
  // 0137 — une contradiction entre le CMS et la landing s'annonce en
  // avertissement, jamais en vert.
  if (status === LANDING_BLOCKED_STATUS) return 'warning';
  switch (status as CmsStatus) {
    case 'published':
      return 'success';
    case 'scheduled':
      return 'warning';
    case 'draft':
      return 'neutral';
    case 'expired':
      return 'error';
    case 'archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function scheduleStatusTone(status: string): StatusTone {
  switch (status) {
    case 'applied':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Valeur d'un `<input type="datetime-local">` a partir d'un instant UTC.
 * Le navigateur attend une heure LOCALE sans fuseau ; on convertit
 * explicitement plutot que de laisser `toISOString()` decaler la valeur.
 */
export function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** Instant UTC a partir de la valeur d'un `<input type="datetime-local">`. */
export function fromDateTimeLocalValue(value: string | null): string | null {
  if (value === null || value.trim().length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
