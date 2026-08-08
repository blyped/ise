import { Card, CardHeader, CardTitle } from '@ise/ui-web';
import { frProjects } from '@/i18n/projects';
import { submitInterestAction } from '@/app/projets/actions';
import { ActionForm } from './ActionForm';
import { FIELD, SELECT, TEXTAREA } from './styles';

/**
 * ISE-090 — corps du formulaire d'expression d'intérêt.
 *
 * La case « conditions de participation » est obligatoire : le porteur
 * doit pouvoir constater que la personne a lu ce à quoi elle répond
 * (CA-PROJ-04). Le consentement CV est distinct et facultatif : sans
 * lui, aucun document du profil n'accompagne la proposition (F §82).
 */
export function ContributionForm({
  projectId,
  preselectedRole,
  roles,
}: {
  projectId: string;
  preselectedRole: string | null;
  roles: { id: string; title: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frProjects.contribution.title}</CardTitle>
      </CardHeader>

      <ActionForm
        action={submitInterestAction}
        hidden={{ projectId }}
        label={frProjects.contribution.title}
        submitLabel={frProjects.contribution.submit}
        pendingLabel={frProjects.contribution.submitPending}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="contribution-role" className="text-body-sm text-text-primary font-medium">
            {frProjects.contribution.roleLabel}
          </label>
          <select
            id="contribution-role"
            name="roleId"
            defaultValue={preselectedRole ?? ''}
            className={SELECT}
          >
            <option value="">{frProjects.contribution.roleNone}</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="contribution-message"
            className="text-body-sm text-text-primary font-medium"
          >
            {frProjects.contribution.messageLabel}
          </label>
          <textarea
            id="contribution-message"
            name="message"
            rows={7}
            required
            minLength={20}
            maxLength={3000}
            placeholder={frProjects.contribution.messagePlaceholder}
            className={TEXTAREA}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="contribution-disponibilite"
            className="text-body-sm text-text-primary font-medium"
          >
            {frProjects.contribution.availabilityLabel}
          </label>
          <input
            id="contribution-disponibilite"
            name="availabilityNotes"
            type="text"
            maxLength={240}
            placeholder={frProjects.contribution.availabilityPlaceholder}
            className={FIELD}
          />
        </div>

        <label className="text-body-sm text-text-primary flex min-h-[44px] items-start gap-3">
          <input type="checkbox" name="availabilityConfirmed" className="mt-1 h-4 w-4" />
          <span>{frProjects.contribution.availabilityConfirm}</span>
        </label>

        <label className="text-body-sm text-text-primary flex min-h-[44px] items-start gap-3">
          <input type="checkbox" name="termsAcknowledged" required className="mt-1 h-4 w-4" />
          <span>{frProjects.contribution.termsConfirm}</span>
        </label>

        <div className="flex flex-col gap-1">
          <label className="text-body-sm text-text-primary flex min-h-[44px] items-start gap-3">
            <input
              type="checkbox"
              name="cvConsent"
              aria-describedby="contribution-cv-aide"
              className="mt-1 h-4 w-4"
            />
            <span>{frProjects.contribution.cvConsent}</span>
          </label>
          <p id="contribution-cv-aide" className="text-caption text-text-muted">
            {frProjects.contribution.cvConsentHelp}
          </p>
        </div>
      </ActionForm>
    </Card>
  );
}
