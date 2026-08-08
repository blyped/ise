import { frProjects } from '@/i18n/projects';
import { withdrawMembershipAction } from '@/app/projets/actions';
import { ActionForm } from './ActionForm';

/** Un membre n'est jamais retenu indéfiniment dans un projet (DIGEST D 5.8, U 148-150). */
export function WithdrawMembershipForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm
      action={withdrawMembershipAction}
      hidden={{ projectId }}
      label={frProjects.participation.withdraw}
      submitLabel={frProjects.participation.withdraw}
      pendingLabel={frProjects.participation.withdrawPending}
      variant="secondary"
      className="flex flex-col gap-2"
    />
  );
}
