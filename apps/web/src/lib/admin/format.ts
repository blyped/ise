import type { BadgeTone } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';

/**
 * Formatage des dates et tonalites de statut du back-office Superadmin.
 * Memes conventions que `lib/cms/format.ts` : dates UTC affichees en
 * Europe/Paris. La couleur ne porte jamais seule l'information (D-90) :
 * chaque pastille ecrit son libelle.
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
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: DISPLAY_TIME_ZONE,
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return frAdmin.common.none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return frAdmin.common.none;
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return frAdmin.common.none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return frAdmin.common.none;
  return dateTimeFormatter.format(date);
}

/** Tonalite d'une pastille de statut. Le libelle est TOUJOURS ecrit a cote. */
export function adminStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'active':
    case 'claimed':
    case 'verified':
    case 'approved':
    case 'accepted':
    case 'matched':
    case 'resolved':
      return 'success';
    case 'suspended':
    case 'moderated':
    case 'rejected':
    case 'security':
      return 'error';
    case 'submitted':
    case 'under_review':
    case 'reviewing':
    case 'pending':
    case 'claim_pending':
    case 'open':
    case 'in_progress':
    case 'waiting_user':
    case 'important':
    case 'deadline_soon':
      return 'warning';
    case 'referenced':
    case 'unclaimed':
    case 'unverified':
    case 'draft':
      return 'info';
    default:
      return 'neutral';
  }
}
