import { frProjects } from '@/i18n/projects';
import { setMilestoneAction } from '@/app/projets/actions';
import { ActionForm } from './ActionForm';
import { SELECT } from './styles';

/**
 * Mise à jour du statut d'un jalon dont je suis responsable.
 * Quatre états seulement : le module suit les grands jalons, pas les
 * micro-tâches, et n'affiche aucun pourcentage d'avancement.
 */
export function MilestoneStatusForm({
  projectId,
  milestoneId,
  status,
}: {
  projectId: string;
  milestoneId: string;
  status: string;
}) {
  return (
    <ActionForm
      action={setMilestoneAction}
      hidden={{ projectId, milestoneId }}
      label={`${frProjects.participation.milestoneUpdate} — ${milestoneId}`}
      submitLabel={frProjects.participation.milestoneUpdate}
      pendingLabel="Enregistrement…"
      variant="secondary"
      className="flex flex-wrap items-end gap-3"
    >
      <label className="text-caption text-text-secondary flex flex-col gap-1">
        <span className="sr-only">{frProjects.participation.milestoneUpdate}</span>
        <select name="status" defaultValue={status} className={SELECT}>
          <option value="todo">{frProjects.participation.milestoneStatus.todo}</option>
          <option value="in_progress">
            {frProjects.participation.milestoneStatus.in_progress}
          </option>
          <option value="done">{frProjects.participation.milestoneStatus.done}</option>
          <option value="blocked">{frProjects.participation.milestoneStatus.blocked}</option>
        </select>
      </label>
    </ActionForm>
  );
}
