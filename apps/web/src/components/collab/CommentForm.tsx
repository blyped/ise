import { frCommunities } from '@/i18n/communities';
import { addCommentAction } from '@/app/communautes/actions';
import { ActionForm } from './ActionForm';
import { TEXTAREA } from './styles';

/** Répondre à une publication de communauté. Fil simple, sans imbrication profonde. */
export function CommentForm({
  communityId,
  postId,
  parentId,
}: {
  communityId: string;
  postId: string;
  parentId?: string;
}) {
  return (
    <ActionForm
      action={addCommentAction}
      hidden={{ communityId, postId, ...(parentId === undefined ? {} : { parentId }) }}
      label={frCommunities.tracking.replyLabel}
      submitLabel={frCommunities.tracking.replySubmit}
      pendingLabel={frCommunities.tracking.replyPending}
    >
      <label htmlFor={`reponse-${postId}`} className="sr-only">
        {frCommunities.tracking.replyLabel}
      </label>
      <textarea
        id={`reponse-${postId}`}
        name="body"
        rows={5}
        required
        minLength={2}
        maxLength={5000}
        placeholder={frCommunities.tracking.replyPlaceholder}
        className={TEXTAREA}
      />
    </ActionForm>
  );
}
