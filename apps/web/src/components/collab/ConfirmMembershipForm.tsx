import { frProjects } from '@/i18n/projects';
import { confirmMembershipAction } from '@/app/projets/actions';
import { ActionForm } from './ActionForm';

/**
 * SEUL chemin vers une participation engagée (MASTER PROMPT §32,
 * CA-PROJ-05). Le rôle et les conditions sont rappelés au-dessus de la
 * case : on ne confirme pas à l'aveugle, et ce qui est accepté est
 * historisé tel quel dans `agreed_terms`.
 */
export function ConfirmMembershipForm({
  projectId,
  roleTitle,
  compensation,
}: {
  projectId: string;
  roleTitle: string;
  compensation: string;
}) {
  return (
    <ActionForm
      action={confirmMembershipAction}
      hidden={{ projectId, roleTitle, compensation }}
      label={frProjects.participation.confirmSubmit}
      submitLabel={frProjects.participation.confirmSubmit}
      pendingLabel={frProjects.participation.confirmPending}
    >
      <dl className="border-border rounded-base border p-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-caption text-text-secondary">{frProjects.participation.myRole}</dt>
          <dd className="text-body-sm text-text-primary font-medium">
            {roleTitle.length === 0 ? '—' : roleTitle}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <dt className="text-caption text-text-secondary">{frProjects.compensation.label}</dt>
          <dd className="text-body-sm text-text-primary font-medium">{compensation}</dd>
        </div>
      </dl>

      <label className="text-body-sm text-text-primary flex min-h-[44px] items-start gap-3">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4" />
        <span>{frProjects.participation.confirmTerms}</span>
      </label>

      <label className="text-body-sm text-text-primary flex min-h-[44px] items-start gap-3">
        <input type="checkbox" name="cvConsent" className="mt-1 h-4 w-4" />
        <span>{frProjects.participation.confirmCvConsent}</span>
      </label>
    </ActionForm>
  );
}
