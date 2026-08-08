import Link from 'next/link';
import { Alert, Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES, profileSkillRoute } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadVisibilityRules } from '@/lib/queries/reference';
import { loadProfileSkills, loadProfileVisibility } from '@/lib/queries/profile-sections';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { DeleteRowForm } from '@/components/profile/DeleteRowForm';
import { deleteProfileSkillAction } from '../actions';
import { SkillsVisibilityForm } from './SkillsVisibilityForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.skills.title };

const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';
const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-022 — Mes competences.
 *
 * Le niveau affiche est DECLARATIF et etiquete comme tel (D-75) : aucun
 * badge de validation n'est derive d'une experience ou d'une
 * recommandation.
 */
export default async function ProfileSkillsPage() {
  const context = await requireProfile();

  const [skills, rules, visibility] = context.ok
    ? await Promise.all([
        loadProfileSkills(context.profile.id, context.correlationId),
        loadVisibilityRules(context.correlationId),
        loadProfileVisibility(context.profile.id, context.correlationId),
      ])
    : [null, null, null];

  const rule = rules?.ok ? rules.data.find((entry) => entry.fieldKey === 'skills') : undefined;
  const primary = skills?.ok ? skills.data.filter((skill) => skill.isPrimary) : [];
  const others = skills?.ok ? skills.data.filter((skill) => !skill.isPrimary) : [];

  const renderSkill = (skill: (typeof primary)[number]) => (
    <Card as="li" key={skill.skillId}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-h4 text-text-primary font-semibold">{skill.name}</h3>
            <Badge tone="info">
              {skill.level === null
                ? frProfile.skillForm.level.none
                : frProfile.skillForm.level[skill.level]}
            </Badge>
            {skill.isPrimary ? <Badge tone="accent">{frProfile.skills.primaryBadge}</Badge> : null}
          </div>
          <p className="text-caption text-text-secondary mt-1">
            {[skill.domainName, skill.categoryName].filter(Boolean).join(' · ')}
          </p>
          {skill.yearsExperience !== null ? (
            <p className="text-caption text-text-muted mt-1">
              {frProfile.skills.yearsLabel.replace('{count}', String(skill.yearsExperience))}
            </p>
          ) : null}
          {skill.context ? (
            <p className="text-body-sm text-text-secondary mt-3 whitespace-pre-line">
              {skill.context}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <Link href={profileSkillRoute(skill.skillId)} className={LINK_CLASS}>
            {frProfile.skills.manage}
            <span className="sr-only"> — {skill.name}</span>
          </Link>
          <DeleteRowForm
            action={deleteProfileSkillAction}
            fieldName="skillId"
            fieldValue={String(skill.skillId)}
            confirmLabel={frProfile.skillForm.delete}
            itemLabel={skill.name}
          />
        </div>
      </div>
    </Card>
  );

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.skills}
      title={frProfile.skills.title}
      subtitle={frProfile.skills.subtitle}
      action={
        <Link href={PROFILE_ROUTES.newSkill} className={PRIMARY_LINK}>
          {frProfile.skills.add}
        </Link>
      }
    >
      {skills === null ? null : !skills.ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={skills.error.userMessage}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : (
        <>
          <Alert variant="info" title={frProfile.skills.declarativeTitle}>
            {frProfile.skills.declarativeBody}
          </Alert>

          {skills.data.length === 0 ? (
            <EmptyState
              title={frProfile.skills.emptyTitle}
              description={frProfile.skills.emptyBody}
              action={
                <Link href={PROFILE_ROUTES.newSkill} className={PRIMARY_LINK}>
                  {frProfile.skills.add}
                </Link>
              }
            />
          ) : (
            <>
              <p className="text-body-sm text-text-secondary">
                {frProfile.skills.count.replace('{count}', String(skills.data.length))} ·{' '}
                {frProfile.skills.primaryCount.replace('{count}', String(primary.length))}
              </p>

              {primary.length > 0 ? (
                <section aria-labelledby="competences-principales" className="flex flex-col gap-4">
                  <h2
                    id="competences-principales"
                    className="text-h4 text-text-primary font-semibold"
                  >
                    {frProfile.skills.primaryTitle}
                  </h2>
                  <ul className="flex flex-col gap-4">{primary.map(renderSkill)}</ul>
                </section>
              ) : null}

              {others.length > 0 ? (
                <section aria-labelledby="autres-competences" className="flex flex-col gap-4">
                  <h2 id="autres-competences" className="text-h4 text-text-primary font-semibold">
                    {frProfile.skills.otherTitle}
                  </h2>
                  <ul className="flex flex-col gap-4">{others.map(renderSkill)}</ul>
                </section>
              ) : null}
            </>
          )}

          {rule ? (
            <SkillsVisibilityForm
              rule={rule}
              defaultValue={
                (visibility?.ok ? visibility.data['skills'] : undefined) ?? rule.defaultVisibility
              }
            />
          ) : null}
        </>
      )}
    </ProfilePage>
  );
}
