import { Card, CardHeader, CardTitle } from '@ise/ui-web';
import { frCommunities } from '@/i18n/communities';
import { createPostAction } from '@/app/communautes/actions';
import { ActionForm } from './ActionForm';
import { FIELD, TEXTAREA } from './styles';

export interface SkillOption {
  id: number;
  name: string;
  domain: string;
}

/**
 * ISE-086 — corps du formulaire de publication.
 *
 * L'audience « Tout le réseau ISE » n'est proposée que pour une
 * communauté elle-même ouverte au réseau : la base refuse l'autre cas,
 * et proposer une option toujours refusée serait un bouton décoratif
 * (MASTER PROMPT §113).
 */
export function CommunityPublishForm({
  communityId,
  postType,
  communityVisibility,
  skillOptions,
}: {
  communityId: string;
  postType: string;
  communityVisibility: string;
  skillOptions: SkillOption[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frCommunities.publish.title}</CardTitle>
      </CardHeader>

      <ActionForm
        action={createPostAction}
        hidden={{ communityId, postType }}
        label={frCommunities.publish.title}
        submitLabel={frCommunities.publish.submit}
        pendingLabel={frCommunities.publish.submitPending}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="publication-titre" className="text-body-sm text-text-primary font-medium">
            {frCommunities.publish.titleLabel}
          </label>
          <input
            id="publication-titre"
            name="title"
            type="text"
            required
            minLength={8}
            maxLength={240}
            aria-describedby="publication-titre-aide"
            placeholder={frCommunities.publish.titlePlaceholder}
            className={FIELD}
          />
          <p id="publication-titre-aide" className="text-caption text-text-muted">
            {frCommunities.publish.titleHelp}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="publication-corps" className="text-body-sm text-text-primary font-medium">
            {frCommunities.publish.bodyLabel}
          </label>
          <textarea
            id="publication-corps"
            name="body"
            rows={8}
            required
            minLength={20}
            maxLength={5000}
            placeholder={frCommunities.publish.bodyPlaceholder}
            className={TEXTAREA}
          />
        </div>

        {skillOptions.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-body-sm text-text-primary font-medium">
              {frCommunities.publish.skillsLabel}
            </legend>
            <ul className="flex flex-wrap gap-2">
              {skillOptions.map((skill) => (
                <li key={skill.id}>
                  <label className="rounded-base border-border text-body-sm text-text-primary hover:border-primary inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3">
                    <input
                      type="checkbox"
                      name="skillIds"
                      value={String(skill.id)}
                      className="h-4 w-4"
                    />
                    <span>
                      {skill.name}
                      <span className="text-caption text-text-muted"> · {skill.domain}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm text-text-primary font-medium">
            {frCommunities.publish.visibilityLabel}
          </legend>
          <label className="text-body-sm text-text-primary flex min-h-[44px] items-center gap-3">
            <input type="radio" name="visibility" value="community" defaultChecked />
            <span>{frCommunities.publish.visibilityCommunity}</span>
          </label>
          {communityVisibility === 'network' ? (
            <label className="text-body-sm text-text-primary flex min-h-[44px] items-center gap-3">
              <input type="radio" name="visibility" value="network" />
              <span>{frCommunities.publish.visibilityNetwork}</span>
            </label>
          ) : (
            <p className="text-caption text-text-muted">
              {frCommunities.publish.visibilityNetworkHelp}
            </p>
          )}
        </fieldset>
      </ActionForm>
    </Card>
  );
}
