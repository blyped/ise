import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frCommunities } from '@/i18n/communities';
import { ROUTES } from '@/lib/routes';
import { COMMUNITY_ROUTES, communityPublishRoute, communityRoute } from '@/lib/routes/communities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCommunity } from '@/lib/queries/communities';
import { searchSkills } from '@/lib/queries/reference';
import { AppShell } from '@/components/layout/AppShell';
import { CommunityPublishForm } from '@/components/collab/CommunityPublishForm';
import { ACTION_LINK, FIELD, PRIMARY_LINK } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCommunities.publish.title };

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * ISE-086 — Publier dans la communauté.
 *
 * Le type de contribution structure la publication : il est choisi
 * d'abord, comme dans la maquette, et détermine le vocabulaire du
 * formulaire. C'est ce qui distingue une communauté professionnelle d'un
 * fil social (CA-COMM-04).
 *
 * ÉCART ASSUMÉ : le bloc « Audience estimée » de la maquette annonce un
 * nombre d'experts « particulièrement proches ». Aucune donnée ne
 * permet de le calculer honnêtement ; seul le nombre réel de membres et
 * le nombre de membres ayant publié ces trente derniers jours sont
 * affichés (MASTER PROMPT §98).
 *
 * ÉCART ASSUMÉ : la pièce jointe de la maquette n'est pas ouverte —
 * aucun bucket ne reçoit de document de communauté, et un bouton sans
 * téléversement serait décoratif (MASTER PROMPT §113). Le partage passe
 * par un lien dans le corps de la publication.
 *
 * La sélection des compétences se fait par une recherche serveur : la
 * taxonomie compte plus de cinq cents entrées, une liste déroulante
 * complète serait inutilisable au clavier.
 */
export default async function CommunityPublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { communityId } = await params;
  const query = await searchParams;
  const skillQuery = one(query['competence']);
  const postType = one(query['type']) ?? 'question';

  const correlationId = newCorrelationId();
  const [viewer, community, skills] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadCommunity(communityId, correlationId),
    skillQuery === null ? Promise.resolve(null) : searchSkills(skillQuery, 12, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={COMMUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!community.ok) {
    return shell(
      <ErrorState
        title={frCommunities.common.loadErrorTitle}
        description={community.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const detail = community.data;
  if (detail === null) {
    return shell(
      <EmptyState
        title={frCommunities.common.notFoundTitle}
        description={frCommunities.common.notFoundBody}
        action={
          <Link href={COMMUNITY_ROUTES.list} className={ACTION_LINK}>
            {frCommunities.common.breadcrumb}
          </Link>
        }
      />,
    );
  }

  if (!detail.isMember) {
    return shell(
      <EmptyState
        title={frCommunities.detail.joinToPublish}
        description={frCommunities.detail.membersReservedBody}
        action={
          <Link href={communityRoute(communityId)} className={ACTION_LINK}>
            {detail.name}
          </Link>
        }
      />,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <Link href={COMMUNITY_ROUTES.list} className="text-primary hover:underline">
          {frCommunities.common.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span>{' '}
        <Link href={communityRoute(communityId)} className="text-primary hover:underline">
          {detail.name}
        </Link>{' '}
        <span aria-hidden="true">›</span> <span>{frCommunities.publish.title}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frCommunities.publish.title}</h1>
        <p className="text-body text-text-secondary">{frCommunities.publish.subtitle}</p>
        <p className="text-caption text-text-muted">
          {detail.name} · {detail.memberCount} {frCommunities.common.members}
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCommunities.publish.stepType}</CardTitle>
            </CardHeader>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    'question',
                    frCommunities.publish.typeQuestion,
                    frCommunities.publish.typeQuestionHint,
                  ],
                  [
                    'resource',
                    frCommunities.publish.typeResource,
                    frCommunities.publish.typeResourceHint,
                  ],
                  [
                    'experience',
                    frCommunities.publish.typeExperience,
                    frCommunities.publish.typeExperienceHint,
                  ],
                  [
                    'analysis',
                    frCommunities.publish.typeAnalysis,
                    frCommunities.publish.typeAnalysisHint,
                  ],
                  ['news', frCommunities.publish.typeNews, frCommunities.publish.typeNewsHint],
                ] as const
              ).map(([value, label, hint]) => {
                const isCurrent = value === postType;
                const href = `${communityPublishRoute(communityId)}?${new URLSearchParams({
                  type: value,
                  ...(skillQuery === null ? {} : { competence: skillQuery }),
                }).toString()}`;
                return (
                  <li key={value}>
                    <Link
                      href={href}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={`rounded-base focus-visible:outline-active-blue flex min-h-[44px] flex-col justify-center border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        isCurrent
                          ? 'border-primary bg-[#EFF6FF]'
                          : 'border-border hover:border-primary'
                      }`}
                    >
                      <span className="text-body-sm text-text-primary font-medium">{label}</span>
                      <span className="text-caption text-text-secondary">{hint}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCommunities.publish.skillsLabel}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary mb-4">
              {frCommunities.publish.skillsHelp}
            </p>
            <form
              method="get"
              action={communityPublishRoute(communityId)}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input type="hidden" name="type" value={postType} />
              <label htmlFor="recherche-competence" className="sr-only">
                {frCommunities.publish.skillsLabel}
              </label>
              <input
                id="recherche-competence"
                name="competence"
                type="search"
                defaultValue={skillQuery ?? ''}
                placeholder="Économétrie, gouvernance des données…"
                className={`${FIELD} flex-1`}
              />
              <button type="submit" className={PRIMARY_LINK}>
                {frCommunities.list.searchSubmit}
              </button>
            </form>
          </Card>

          <CommunityPublishForm
            communityId={communityId}
            postType={postType}
            communityVisibility={detail.visibility}
            skillOptions={(skills !== null && skills.ok ? skills.data : []).map((skill) => ({
              id: skill.skillId,
              name: skill.name,
              domain: skill.domainName,
            }))}
          />
        </div>

        <aside className="flex flex-col gap-7">
          {detail.postModerationMode === 'pre_approval' ? (
            <Alert variant="warning" title={frCommunities.publish.moderationNotice} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCommunities.publish.checklistTitle}</CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex flex-col gap-2">
              <li>· {frCommunities.publish.checklistExplicit}</li>
              <li>· {frCommunities.publish.checklistContext}</li>
              <li>· {frCommunities.publish.checklistAsk}</li>
              <li>· {frCommunities.publish.checklistTags}</li>
              <li>· {frCommunities.publish.checklistPrivacy}</li>
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCommunities.publish.audienceTitle}</CardTitle>
            </CardHeader>
            <p className="text-h2 text-text-primary font-bold">
              {detail.stats.members} {frCommunities.common.members}
            </p>
            <p className="text-caption text-text-secondary mt-1">
              dont {detail.stats.active30d} {frCommunities.detail.statActive.toLowerCase()}
            </p>
            <p className="text-caption text-text-muted mt-3">
              {frCommunities.publish.audienceBody}
            </p>
          </Card>

          <Alert variant="info" title={frCommunities.publish.antiSpamTitle}>
            {frCommunities.publish.antiSpamBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
