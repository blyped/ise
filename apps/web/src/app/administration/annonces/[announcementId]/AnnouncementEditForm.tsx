'use client';

import { frAnnouncements } from '@/i18n/announcements';
import type { AdminAnnouncementRow } from '@/lib/admin/queries-announcements';
import { AnnouncementForm } from '../AnnouncementForm';
import { updateAnnouncementAction } from './actions';

/** ISO -> valeur `datetime-local` (troncature a la minute, meme convention que EventEditForm). */
function toLocalInput(value: string | null): string {
  if (value === null || value.length < 16) return '';
  return value.slice(0, 16);
}

/** Edition du contenu d'une annonce existante (0145, tache #188). */
export function AnnouncementEditForm({ announcement }: { announcement: AdminAnnouncementRow }) {
  return (
    <AnnouncementForm
      action={updateAnnouncementAction}
      submitLabel={frAnnouncements.admin.form.submitUpdate}
      hiddenFields={{ announcementId: announcement.id }}
      defaults={{
        body: announcement.body,
        severity: announcement.severity,
        startsAt: toLocalInput(announcement.startsAt),
        endsAt: toLocalInput(announcement.endsAt),
      }}
    />
  );
}
