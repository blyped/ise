import { frCommunities } from '@/i18n/communities';
import { setNotificationAction } from '@/app/communautes/actions';
import { ActionForm } from './ActionForm';
import { SELECT } from './styles';

/**
 * Preferences de notification d'une communaute (CA-COMM-08).
 * Le defaut recommande — « important » + resume hebdomadaire — est celui
 * que la base pose a l'adhesion : l'ecran ne le reinvente pas.
 */
export function CommunityNotificationForm({
  communityId,
  level,
  digest,
}: {
  communityId: string;
  level: string;
  digest: string;
}) {
  return (
    <ActionForm
      action={setNotificationAction}
      hidden={{ communityId }}
      label={frCommunities.detail.notifications}
      submitLabel={frCommunities.detail.notificationSave}
      pendingLabel="Enregistrement…"
      variant="secondary"
    >
      <label className="text-caption text-text-secondary flex flex-col gap-1">
        {frCommunities.detail.notificationLevel}
        <select name="level" defaultValue={level} className={SELECT}>
          <option value="all">{frCommunities.detail.notificationAll}</option>
          <option value="important">{frCommunities.detail.notificationImportant}</option>
          <option value="none">{frCommunities.detail.notificationNone}</option>
        </select>
      </label>

      <label className="text-caption text-text-secondary flex flex-col gap-1">
        {frCommunities.detail.digest}
        <select name="digest" defaultValue={digest} className={SELECT}>
          <option value="weekly">{frCommunities.detail.digestWeekly}</option>
          <option value="daily">{frCommunities.detail.digestDaily}</option>
          <option value="none">{frCommunities.detail.digestNone}</option>
        </select>
      </label>
    </ActionForm>
  );
}
