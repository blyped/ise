import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import {
  loadFeaturedCandidates,
  loadFeaturedOverview,
  loadPublicFeaturedTeaser,
} from '@/lib/cms/queries';
import { formatDate, formatLongDateTime } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader } from '../_components/PageHeader';
import { ActionButton } from '../_components/ActionButton';
import { ExcludeForm, OverrideForm, RulesForm } from './FeaturedForms';
import { toggleAutomationAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.featured.title };

/** Champs repris par le teaser public. Liste FIXE, alignee sur la projection. */
const TEASER_FIELDS = [
  [frCms.featured.fieldName, 'display_name'],
  [frCms.featured.fieldPromotion, 'promotion'],
  [frCms.featured.fieldPosition, 'current_position'],
  [frCms.featured.fieldOrganization, 'current_organization'],
  [frCms.featured.fieldSummary, 'public_summary'],
  [frCms.featured.fieldExpertises, 'expertise_areas'],
] as const;

/**
 * CMS-006 — ISE du jour (ADDENDUM §36).
 *
 * Regles, selection courante, historique, override, exclusion, apercu.
 *
 * L'apercu n'est PAS une reconstitution : il appelle
 * `get_landing_featured_profile()`, la fonction que le site public appelle
 * lui-meme. Si un champ prive apparaissait dans l'apercu, il apparaitrait
 * sur la landing — et reciproquement, ce qui est absent ici est absent
 * la-bas.
 */
export default async function CmsFeaturedProfilePage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();
  const canManage = access.can('cms.featured_profile.manage');

  const [overview, candidates, teaser] = await Promise.all([
    loadFeaturedOverview(correlationId),
    canManage
      ? loadFeaturedCandidates(null, correlationId)
      : Promise.resolve({ ok: true as const, data: [] }),
    loadPublicFeaturedTeaser(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.featuredProfile} screenTitle={frCms.featured.title}>
      {children}
    </CmsShell>
  );

  if (!overview.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.featured.title} subtitle={frCms.featured.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={overview.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const data = overview.data;
  const automationEnabled = data.rules?.isAutomationEnabled ?? false;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.featured.title} subtitle={frCms.featured.subtitle} />

      <section
        aria-label={frCms.featured.automationOn}
        className={`flex flex-col gap-4 rounded-lg border p-6 lg:flex-row lg:items-center lg:justify-between ${
          automationEnabled ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#FDE68A] bg-[#FFFBEB]'
        }`}
      >
        <div className="flex flex-col gap-1">
          <p
            className={`text-body font-semibold ${automationEnabled ? 'text-success' : 'text-warning'}`}
          >
            {automationEnabled ? frCms.featured.automationOn : frCms.featured.automationOff}
          </p>
          <p className="text-caption text-text-secondary">{frCms.featured.automationHelp}</p>
          {automationEnabled ? null : (
            <p className="text-caption text-text-muted">{frCms.featured.resumeNote}</p>
          )}
        </div>
        <ActionButton
          action={toggleAutomationAction}
          fields={{ enabled: automationEnabled ? 'false' : 'true' }}
          label={automationEnabled ? frCms.featured.suspend : frCms.featured.resume}
          variant={automationEnabled ? 'secondary' : 'primary'}
          size="md"
          disabled={!canManage}
          {...(canManage ? {} : { disabledReason: frCms.common.forbidden })}
        />
      </section>

      <section aria-labelledby="ise-du-jour-actuel" className="flex flex-col gap-4">
        <h2 id="ise-du-jour-actuel" className="text-h3 text-text-primary font-semibold">
          {frCms.featured.currentTitle}
        </h2>

        {data.current === null ? (
          <EmptyState
            title={frCms.featured.currentNone}
            description={frCms.featured.currentNoneBody}
          />
        ) : (
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={data.current.displayName} size={64} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-body text-text-primary font-semibold">
                  {data.current.displayName}
                  {data.current.promotion !== null ? ` · ${data.current.promotion}` : ''}
                </p>
                <p className="text-body-sm text-text-secondary">
                  {[data.current.currentPosition, data.current.organization]
                    .filter((value) => value !== null && value.length > 0)
                    .join(' · ') || frCms.common.none}
                </p>
                {data.current.publicSummary !== null ? (
                  <p className="text-body-sm text-text-secondary mt-2 max-w-[70ch]">
                    {data.current.publicSummary}
                  </p>
                ) : null}
                <p className="text-caption text-text-muted mt-2">
                  {formatDate(data.current.featuredDate)} ·{' '}
                  {frCms.selectionMode[data.current.selectionMode] ?? data.current.selectionMode} ·{' '}
                  {frCms.status[data.current.status] ?? data.current.status}
                </p>
              </div>
              <Badge tone={data.current.selectionMode === 'manual' ? 'warning' : 'info'}>
                {frCms.selectionMode[data.current.selectionMode] ?? data.current.selectionMode}
              </Badge>
            </div>
          </Card>
        )}

        <p className="text-caption text-text-muted">
          {data.eligibleCount} {frCms.featured.eligibleCount}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frCms.featured.rulesTitle}</CardTitle>
          </CardHeader>
          <RulesForm rules={data.rules} canManage={canManage} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">{frCms.featured.fieldsTitle}</CardTitle>
          </CardHeader>
          <dl className="flex flex-col gap-3">
            {TEASER_FIELDS.map(([label, field]) => (
              <div key={field} className="flex items-baseline justify-between gap-4">
                <dt className="text-body-sm text-text-primary font-medium">{label}</dt>
                <dd className="text-caption text-text-muted font-mono">{field}</dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-success mt-4 font-medium">{frCms.featured.fieldsNote}</p>
        </Card>
      </div>

      <section aria-labelledby="ise-du-jour-apercu" className="flex flex-col gap-4">
        <h2 id="ise-du-jour-apercu" className="text-h3 text-text-primary font-semibold">
          {frCms.featured.previewTitle}
        </h2>
        <Card>
          {!teaser.ok ? (
            <Alert variant="warning" title="Aperçu indisponible">
              {frCms.common.loadError}
            </Alert>
          ) : teaser.data === null ? (
            <p className="text-body-sm text-text-secondary">{frCms.featured.currentNoneBody}</p>
          ) : (
            <pre className="text-caption text-text-secondary bg-surface-muted overflow-x-auto rounded-md p-4">
              {JSON.stringify(teaser.data, null, 2)}
            </pre>
          )}
          <p className="text-caption text-text-muted mt-3">{frCms.featured.previewNote}</p>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frCms.featured.overrideTitle}</CardTitle>
          </CardHeader>
          <OverrideForm candidates={candidates.ok ? candidates.data : []} canManage={canManage} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">{frCms.featured.excludeTitle}</CardTitle>
          </CardHeader>
          <ExcludeForm candidates={candidates.ok ? candidates.data : []} canManage={canManage} />
        </Card>
      </div>

      <section aria-labelledby="ise-du-jour-overrides" className="flex flex-col gap-4">
        <h2 id="ise-du-jour-overrides" className="text-h3 text-text-primary font-semibold">
          {frCms.featured.overridesTitle}
        </h2>
        {data.overrides.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frCms.featured.overridesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.overrides.map((override) => (
              <li
                key={override.id}
                className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-body-sm text-text-primary font-semibold">
                    {override.displayName ?? frCms.common.none}
                    {' — '}
                    {override.overrideKind === 'pin'
                      ? frCms.featured.overrideTitle
                      : frCms.featured.excludeTitle}
                  </p>
                  <p className="text-caption text-text-muted">
                    {formatDate(override.startsAt)} →{' '}
                    {override.endsAt === null ? '∞' : formatDate(override.endsAt)} ·{' '}
                    {frCms.featured.historyActor} :{' '}
                    {override.createdBy ?? frCms.featured.historySystem}
                  </p>
                  {override.reason !== null ? (
                    <p className="text-caption text-text-secondary">{override.reason}</p>
                  ) : null}
                </div>
                <Badge tone={override.isActive ? 'success' : 'neutral'}>
                  {override.isActive ? frCms.featured.overrideActive : frCms.featured.overrideEnded}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ise-du-jour-historique" className="flex flex-col gap-4">
        <h2 id="ise-du-jour-historique" className="text-h3 text-text-primary font-semibold">
          {frCms.featured.historyTitle}
        </h2>
        {data.history.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frCms.featured.historyEmpty}</p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] border-collapse">
              <caption className="sr-only">{frCms.featured.historyTitle}</caption>
              <thead className="bg-surface-muted">
                <tr>
                  {[
                    frCms.featured.historyDate,
                    frCms.featured.historyProfile,
                    frCms.featured.historyMode,
                    'Statut',
                    frCms.featured.historyActor,
                  ].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="text-caption text-text-secondary px-4 py-3 text-left font-semibold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.history.map((row) => (
                  <tr
                    key={`${row.featuredDate}-${row.profileId}`}
                    className="border-border border-t"
                  >
                    <td className="text-caption text-text-secondary px-4 py-3">
                      {formatDate(row.featuredDate)}
                    </td>
                    <td className="text-body-sm text-text-primary px-4 py-3">
                      {row.displayName}
                      {row.currentPosition !== null ? (
                        <span className="text-caption text-text-muted block">
                          {row.currentPosition}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-caption text-text-secondary px-4 py-3">
                      {frCms.selectionMode[row.selectionMode] ?? row.selectionMode}
                    </td>
                    <td className="text-caption text-text-secondary px-4 py-3">
                      {row.status === 'published' && row.publishedAt !== null
                        ? formatLongDateTime(row.publishedAt)
                        : (frCms.status[row.status] ?? row.status)}
                    </td>
                    <td className="text-caption text-text-secondary px-4 py-3">
                      {row.selectedBy ?? frCms.featured.historySystem}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>,
  );
}
