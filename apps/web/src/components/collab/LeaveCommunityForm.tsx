import { frCommunities } from '@/i18n/communities';
import { leaveCommunityAction } from '@/app/communautes/actions';
import { ActionForm } from './ActionForm';

/** Quitter une communaute. Aucune confirmation modale : l'action est reversible (on peut rejoindre a nouveau). */
export function LeaveCommunityForm({ communityId }: { communityId: string }) {
  return (
    <ActionForm
      action={leaveCommunityAction}
      hidden={{ communityId }}
      label={frCommunities.detail.leave}
      submitLabel={frCommunities.detail.leave}
      pendingLabel="Traitement…"
      variant="secondary"
      className="flex flex-col gap-2"
    />
  );
}
