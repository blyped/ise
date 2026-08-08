import { frCommunities } from '@/i18n/communities';
import { markHelpfulAction } from '@/app/communautes/actions';
import { ActionForm } from './ActionForm';

/**
 * Marquage « réponse utile », réservé à l'auteur de la publication.
 * Ce n'est pas un vote : personne d'autre ne peut le poser, et il ne
 * produit aucun classement (DIGEST D 4.9, F 53).
 */
export function HelpfulToggleForm({
  communityId,
  postId,
  commentId,
  isHelpful,
}: {
  communityId: string;
  postId: string;
  commentId: string;
  isHelpful: boolean;
}) {
  const label = isHelpful
    ? frCommunities.tracking.unmarkHelpful
    : frCommunities.tracking.markHelpful;

  return (
    <ActionForm
      action={markHelpfulAction}
      hidden={{ communityId, postId, commentId, helpful: isHelpful ? 'false' : 'true' }}
      label={`${label} — ${commentId}`}
      submitLabel={label}
      pendingLabel="Enregistrement…"
      variant="secondary"
      className="flex flex-col gap-2"
    />
  );
}
