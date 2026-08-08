import { frProjects } from '@/i18n/projects';
import { respondInvitationAction } from '@/app/projets/actions';
import { ActionForm } from './ActionForm';

/**
 * Réponse à une invitation de projet.
 *
 * Accepter n'engage pas : la base place l'appartenance en
 * `pending_confirmation`. L'engagement viendra d'un second geste,
 * horodaté (MASTER PROMPT §32, CA-PROJ-05). Le libellé le dit.
 */
export function InvitationResponseForm({
  projectId,
  invitationId,
}: {
  projectId: string;
  invitationId: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <ActionForm
        action={respondInvitationAction}
        hidden={{ projectId, invitationId, response: 'accepted' }}
        label={frProjects.detail.invitationAccept}
        submitLabel={frProjects.detail.invitationAccept}
        pendingLabel="Envoi…"
        className="flex flex-col gap-2"
      />
      <ActionForm
        action={respondInvitationAction}
        hidden={{ projectId, invitationId, response: 'declined' }}
        label={frProjects.detail.invitationDecline}
        submitLabel={frProjects.detail.invitationDecline}
        pendingLabel="Envoi…"
        variant="secondary"
        className="flex flex-col gap-2"
      />
    </div>
  );
}
