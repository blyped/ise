import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frProjects } from '@/i18n/projects';
import { ROUTES } from '@/lib/routes';
import { PROJECT_ROUTES, projectRoute } from '@/lib/routes/projects';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyProjects, loadProjects } from '@/lib/queries/projects';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import {
  toMyProjectGroup,
  toProjectScope,
  type ProjectCard as ProjectCardModel,
} from '@/lib/projects-view';
import { formatDay } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  ACTION_LINK,
  CHIP,
  FIELD,
  PRIMARY_LINK,
  SELECT,
  TAB_BASE,
  TAB_CURRENT,
  TAB_IDLE,
} from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProjects.list.title };

const TABS = [
  { id: 'for_me', label: frProjects.list.tabForMe },
  { id: 'all', label: frProjects.list.tabAll },
  { id: 'consortiums', label: frProjects.list.tabConsortiums },
  { id: 'mine', label: frProjects.list.tabMine },
] as const;

const MINE_GROUPS = [
  { id: 'coordinating', label: frProjects.list.groupCoordinating },
  { id: 'participating', label: frProjects.list.groupParticipating },
  { id: 'invitations', label: frProjects.list.groupInvitations },
  { id: 'interests', label: frProjects.list.groupInterests },
  { id: 'completed', label: frProjects.list.groupCompleted },
] as const;

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

function reasonLabel(code: string): string {
  const labels: Record<string, string> = frProjects.reason;
  return labels[code] ?? code;
}

/**
 * ISE-088 — Espace Projets & Consortiums.
 *
 * L'onglet par défaut, « Pour moi », s'appuie sur une correspondance
 * calculée par rôle : un projet n'y figure que si au moins une raison
 * explicite existe (CA-PROJ-02, D-43). Aucun pourcentage n'est affiché ;
 * seul un libellé qualitatif l'est (D-42).
 *
 * ÉCART ASSUMÉ : le bouton « + Proposer un projet » de la maquette n'est
 * pas rendu. L'assistant de création (six étapes, rôles, conditions,
 * visibilité) n'est pas livré dans cette tranche, et un bouton menant à
 * un écran inexistant serait décoratif (MASTER PROMPT §113). L'écran le
 * dit explicitement dans le rail latéral.
 *
 * RESPONSIVE : cartes en une colonne sous 1024 px, rail latéral sous la
 * liste, onglets défilants à 375 px.
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const params = await searchParams;
  const scope = toProjectScope(params['onglet']);
  const group = toMyProjectGroup(params['groupe']);
  const query = one(params['recherche']);
  const projectType = one(params['type']);
  const sectorParam = one(params['secteur']);
  const countryCode = one(params['pays']);
  const compensation = one(params['conditions']);
  const cursor = unsealCursor(one(params['curseur']));
  const sectorId = sectorParam === null ? null : Number.parseInt(sectorParam, 10);

  const correlationId = newCorrelationId();
  const [viewer, page, sectors, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    scope === 'mine'
      ? loadMyProjects(group, cursor, correlationId)
      : loadProjects(
          {
            scope,
            query,
            projectType,
            sectorId: sectorId !== null && !Number.isNaN(sectorId) ? sectorId : null,
            countryCode,
            compensation,
            status: 'open',
          },
          cursor,
          correlationId,
        ),
    loadSectors(correlationId),
    loadCountries(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROJECT_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-primary font-medium">
        {frProjects.common.collaborate} <span aria-hidden="true">›</span>{' '}
        {frProjects.common.breadcrumb}
      </p>
      <h1 className="text-h1 text-text-primary font-bold">{frProjects.list.title}</h1>
      <p className="text-body text-text-secondary">{frProjects.list.subtitle}</p>
    </div>
  );

  const tabs = (
    <nav aria-label={frProjects.list.title} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {TABS.map((tab) => {
          const isCurrent = tab.id === scope;
          return (
            <li key={tab.id}>
              <Link
                href={`${PROJECT_ROUTES.list}?onglet=${tab.id}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`${TAB_BASE} ${isCurrent ? TAB_CURRENT : TAB_IDLE}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        {tabs}
        <ErrorState
          title={frProjects.common.loadErrorTitle}
          description={`${frProjects.common.loadErrorBody} ${page.error.userMessage}`}
          correlationId={correlationId}
          action={
            <Link href={`${PROJECT_ROUTES.list}?onglet=${scope}`} className={ACTION_LINK}>
              {frProjects.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = page.data.rows;
  const baseParams: Record<string, string> = { onglet: scope };
  if (scope === 'mine') baseParams['groupe'] = group;
  if (query !== null) baseParams['recherche'] = query;
  if (projectType !== null) baseParams['type'] = projectType;
  if (sectorParam !== null) baseParams['secteur'] = sectorParam;
  if (countryCode !== null) baseParams['pays'] = countryCode;
  if (compensation !== null) baseParams['conditions'] = compensation;

  const nextHref =
    page.data.nextCursor === null
      ? null
      : `${PROJECT_ROUTES.list}?${new URLSearchParams({
          ...baseParams,
          curseur: page.data.nextCursor,
        }).toString()}`;

  const card = (project: ProjectCardModel) => {
    const relevance =
      project.relevanceLabel === null
        ? null
        : (frProjects.relevance[
            project.relevanceLabel as 'very_relevant' | 'relevant' | 'close_profile'
          ] ?? null);

    return (
      <li key={project.projectId}>
        <Card className="h-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-caption text-text-secondary font-semibold uppercase">
                {frProjects.projectType[
                  project.projectType as keyof typeof frProjects.projectType
                ] ?? project.projectType}
              </p>
              <h2 className="text-h3 text-text-primary mt-1 font-semibold">
                <Link
                  href={projectRoute(project.projectId)}
                  className="focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {project.title}
                </Link>
              </h2>
            </div>
            {relevance === null ? (
              <Badge tone="neutral">
                {frProjects.status[project.status as keyof typeof frProjects.status] ??
                  project.status}
              </Badge>
            ) : (
              <Badge tone="success">{relevance}</Badge>
            )}
          </div>

          <p className="text-body-sm text-text-secondary mt-3">{project.summary}</p>

          {project.isRestricted ? (
            <p className="text-caption text-text-muted mt-2">{frProjects.detail.restrictedBody}</p>
          ) : null}

          {project.soughtRoles.length > 0 ? (
            <p className="text-caption text-text-secondary mt-4">
              {frProjects.list.soughtRoles} :{' '}
              <span className="text-text-primary font-medium">
                {project.soughtRoles.join(' · ')}
              </span>
            </p>
          ) : null}

          {project.reasons.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1">
              {project.reasons.map((reason) => (
                <li key={reason.code} className="text-caption text-text-secondary">
                  ✓ {reasonLabel(reason.code)}
                  {reason.label === null ? '' : ` — ${reason.label}`}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={CHIP}>
              {frProjects.compensation[
                project.compensationType as keyof typeof frProjects.compensation
              ] ?? project.compensationType}
            </span>
            {project.countries.slice(0, 3).map((country) => (
              <span key={country} className={CHIP}>
                {country}
              </span>
            ))}
          </div>

          <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-caption text-text-muted">
              {project.roleSummary.filledSeats} {frProjects.list.teamProgress}{' '}
              {project.roleSummary.totalSeats}
              {project.applicationDeadline === null
                ? ''
                : ` · ${frProjects.list.deadlineTeam} : ${formatDay(project.applicationDeadline) ?? ''}`}
            </span>
            {project.myMembership?.status === 'active' ? (
              <Badge tone="success">{frProjects.detail.myMembership}</Badge>
            ) : project.myApplication !== null ? (
              <Badge tone="info">{frProjects.list.groupInterests}</Badge>
            ) : null}
            <Link href={projectRoute(project.projectId)} className={`${ACTION_LINK} ml-auto`}>
              {frProjects.list.open}
            </Link>
          </div>
        </Card>
      </li>
    );
  };

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      {scope === 'mine' ? (
        <nav aria-label={frProjects.list.tabMine} className="overflow-x-auto">
          <ul className="flex min-w-max gap-2">
            {MINE_GROUPS.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${PROJECT_ROUTES.list}?onglet=mine&groupe=${item.id}`}
                  aria-current={item.id === group ? 'true' : undefined}
                  className={`rounded-base focus-visible:outline-active-blue text-body-sm inline-flex min-h-[44px] items-center border px-4 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    item.id === group
                      ? 'border-primary text-primary bg-[#EFF6FF] font-semibold'
                      : 'border-border text-text-secondary hover:border-primary'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <form method="get" action={PROJECT_ROUTES.list} className="flex flex-col gap-4">
          <input type="hidden" name="onglet" value={scope} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="recherche-projets" className="sr-only">
              {frProjects.list.searchLabel}
            </label>
            <input
              id="recherche-projets"
              name="recherche"
              type="search"
              defaultValue={query ?? ''}
              placeholder={frProjects.list.searchPlaceholder}
              className={`${FIELD} flex-1`}
            />
            <button type="submit" className={PRIMARY_LINK}>
              {frProjects.list.searchSubmit}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-caption text-text-secondary flex flex-col gap-1">
              {frProjects.list.filterType}
              <select name="type" defaultValue={projectType ?? ''} className={SELECT}>
                <option value="">{frProjects.list.filterAll}</option>
                {Object.entries(frProjects.projectType).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-caption text-text-secondary flex flex-col gap-1">
              {frProjects.list.filterSector}
              <select name="secteur" defaultValue={sectorParam ?? ''} className={SELECT}>
                <option value="">{frProjects.list.filterAll}</option>
                {(sectors.ok ? sectors.data : []).map((sector) => (
                  <option key={sector.id} value={String(sector.id)}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-caption text-text-secondary flex flex-col gap-1">
              {frProjects.list.filterCountry}
              <select name="pays" defaultValue={countryCode ?? ''} className={SELECT}>
                <option value="">{frProjects.list.filterAll}</option>
                {(countries.ok ? countries.data : []).map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-caption text-text-secondary flex flex-col gap-1">
              {frProjects.list.filterCompensation}
              <select name="conditions" defaultValue={compensation ?? ''} className={SELECT}>
                <option value="">{frProjects.list.filterAll}</option>
                <option value="paid">{frProjects.compensation.paid}</option>
                <option value="conditional_on_award">
                  {frProjects.compensation.conditional_on_award}
                </option>
                <option value="volunteer">{frProjects.compensation.volunteer}</option>
                <option value="to_be_defined">{frProjects.compensation.to_be_defined}</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={ACTION_LINK}>
              {frProjects.list.filterApply}
            </button>
            {Object.keys(baseParams).length > 1 ? (
              <Link href={`${PROJECT_ROUTES.list}?onglet=${scope}`} className={ACTION_LINK}>
                {frProjects.list.searchClear}
              </Link>
            ) : null}
          </div>
        </form>
      )}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frProjects.list.title} className="flex min-w-0 flex-col gap-5">
          {rows.length === 0 ? (
            <EmptyState
              title={
                scope === 'for_me'
                  ? frProjects.list.emptyForMeTitle
                  : scope === 'mine'
                    ? frProjects.list.emptyMineTitle
                    : frProjects.list.emptyAllTitle
              }
              description={
                scope === 'for_me'
                  ? frProjects.list.emptyForMeBody
                  : scope === 'mine'
                    ? frProjects.list.emptyMineBody
                    : frProjects.list.emptyAllBody
              }
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href={`${PROJECT_ROUTES.list}?onglet=all`} className={ACTION_LINK}>
                    {frProjects.list.emptyForMeAction}
                  </Link>
                  <Link href={PROFILE_ROUTES.skills} className={ACTION_LINK}>
                    Compléter mes compétences
                  </Link>
                </div>
              }
            />
          ) : (
            <>
              <ul className="grid gap-5 lg:grid-cols-2">{rows.map(card)}</ul>
              {nextHref === null ? (
                <p className="text-caption text-text-muted">{frProjects.common.endOfList}</p>
              ) : (
                <Link href={nextHref} className={`${ACTION_LINK} self-start`}>
                  {frProjects.common.loadMore}
                </Link>
              )}
            </>
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frProjects.relevance.title}>
            {frProjects.list.emptyForMeBody}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.list.noCreationTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frProjects.list.noCreationBody}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.compensation.label}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              Chaque projet indique explicitement s’il est rémunéré, bénévole, ou si la rémunération
              dépend de l’obtention du marché. Un projet ne peut pas masquer une demande de travail
              gratuit.
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
