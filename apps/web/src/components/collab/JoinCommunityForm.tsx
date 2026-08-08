import { frCommunities } from '@/i18n/communities';
import { joinCommunityAction } from '@/app/communautes/actions';
import { ActionForm } from './ActionForm';

/**
 * Bouton d'adhesion. Le libelle depend de la politique de la
 * communaute : « Rejoindre » lorsque l'adhesion est libre, « Demander a
 * rejoindre » lorsqu'elle passe par un animateur. Une communaute sur
 * invitation n'affiche AUCUN bouton : un bouton qui echoue toujours
 * serait decoratif (MASTER PROMPT §113).
 */
export function JoinCommunityForm({
  communityId,
  joinPolicy,
  variant = 'primary',
}: {
  communityId: string;
  joinPolicy: string;
  variant?: 'primary' | 'secondary';
}) {
  if (joinPolicy === 'invitation') {
    return <p className="text-caption text-text-muted">{frCommunities.joinPolicy.invitation}</p>;
  }

  const label = joinPolicy === 'request' ? frCommunities.list.request : frCommunities.list.join;

  return (
    <ActionForm
      action={joinCommunityAction}
      hidden={{ communityId }}
      label={label}
      submitLabel={label}
      pendingLabel="Envoi…"
      variant={variant}
      className="flex flex-col gap-2"
    />
  );
}
