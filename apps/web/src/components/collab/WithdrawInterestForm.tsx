import { frProjects } from '@/i18n/projects';
import { withdrawInterestAction } from '@/app/projets/actions';
import { ActionForm } from './ActionForm';

/** Retirer une expression d'intérêt tant qu'elle n'a pas été examinée. */
export function WithdrawInterestForm({
  projectId,
  applicationId,
}: {
  projectId: string;
  applicationId: string;
}) {
  return (
    <ActionForm
      action={withdrawInterestAction}
      hidden={{ projectId, applicationId }}
      label={frProjects.contribution.withdraw}
      submitLabel={frProjects.contribution.withdraw}
      pendingLabel={frProjects.contribution.withdrawPending}
      variant="secondary"
      className="flex flex-col gap-2"
    />
  );
}
