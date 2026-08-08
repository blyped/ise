import { frCommunities } from '@/i18n/communities';
import { resolvePostAction } from '@/app/communautes/actions';
import { ActionForm } from './ActionForm';
import { TEXTAREA } from './styles';

/**
 * ISE-087 — publier la synthèse et clôturer.
 * La synthèse est le seul « résultat » de la publication : aucune note,
 * aucun score, aucune meilleure réponse imposée.
 */
export function ResolvePostForm({ communityId, postId }: { communityId: string; postId: string }) {
  return (
    <ActionForm
      action={resolvePostAction}
      hidden={{ communityId, postId }}
      label={frCommunities.tracking.resolveTitle}
      submitLabel={frCommunities.tracking.resolveSubmit}
      pendingLabel={frCommunities.tracking.resolvePending}
    >
      <label htmlFor={`synthese-${postId}`} className="text-body-sm text-text-primary font-medium">
        {frCommunities.tracking.resolveLabel}
      </label>
      <textarea
        id={`synthese-${postId}`}
        name="summary"
        rows={5}
        required
        minLength={20}
        maxLength={2000}
        aria-describedby={`synthese-aide-${postId}`}
        placeholder={frCommunities.tracking.resolvePlaceholder}
        className={TEXTAREA}
      />
      <p id={`synthese-aide-${postId}`} className="text-caption text-text-muted">
        {frCommunities.tracking.resolveHelp}
      </p>
    </ActionForm>
  );
}
