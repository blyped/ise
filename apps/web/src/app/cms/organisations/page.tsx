import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadMediaOptions, loadOrganizations } from '@/lib/cms/queries';
import { loadCmsLandingOrganizations } from '@/lib/cms/landing-organizations';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { OrganizationLogoForm } from './OrganizationLogoForm';
import { removeLandingOrganizationAction, setLandingOrganizationAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.landingOrganizations.title };

/**
 * CMS-013 (0133) — « Organisations (logos) ».
 *
 * L'ecran DIT ce que la section est, et ce qu'elle n'est pas : une liste
 * entierement manuelle. Sans cette phrase, un administrateur pourrait croire
 * qu'elle se remplit a partir des employeurs saisis par les membres. Ce n'est
 * pas le cas, et ce serait indesirable — l'argumentaire est dans l'en-tete de
 * la migration 0133.
 *
 * Chaque ligne signale si son logo est REELLEMENT affichable. C'est le seul
 * moyen d'eviter la situation la plus penible du CMS : publier, aller voir la
 * page d'accueil, et n'y rien trouver — sans savoir pourquoi. La projection
 * publique ecarte silencieusement toute ligne sans logo utilisable ; l'ecran
 * le dit AVANT.
 */
export default async function CmsLandingOrganizationsPage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();

  const [rows, organizationsResult, mediaOptionsResult] = await Promise.all([
    loadCmsLandingOrganizations(correlationId),
    loadOrganizations(correlationId),
    loadMediaOptions(correlationId),
  ]);

  const organizations = organizationsResult.ok ? organizationsResult.data : [];
  const mediaOptions = mediaOptionsResult.ok ? mediaOptionsResult.data : [];
  const canEdit = access.can('cms.edit');

  const shell = (children: React.ReactNode) => (
    <CmsShell
      currentPath={CMS_ROUTES.landingOrganizations}
      screenTitle={frCms.landingOrganizations.title}
    >
      {children}
    </CmsShell>
  );

  const header = (
    <PageHeader
      title={frCms.landingOrganizations.title}
      subtitle={frCms.landingOrganizations.subtitle}
    />
  );

  if (!rows.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frCms.common.loadError}
          description={rows.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const listed = rows.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <Alert variant="info" title="Ce que le CMS pilote ici">
        {frCms.landingOrganizations.scopeNote}
      </Alert>

      <section className="border-border bg-surface flex flex-col gap-5 rounded-lg border p-5 max-md:p-4">
        <h2 className="text-h3 text-text-primary font-bold">
          {frCms.landingOrganizations.addTitle}
        </h2>
        <OrganizationLogoForm
          action={setLandingOrganizationAction}
          submitLabel={frCms.landingOrganizations.add}
          organizationId={null}
          organizations={organizations}
          mediaOptions={mediaOptions}
          currentMediaId={null}
          currentOrder={listed.length}
          currentPublished={false}
          canEdit={canEdit}
        />
      </section>

      {listed.length === 0 ? (
        <EmptyState
          title={frCms.landingOrganizations.emptyTitle}
          description={frCms.landingOrganizations.emptyBody}
        />
      ) : (
        <RowList label={frCms.landingOrganizations.title}>
          {listed.map((row) => (
            <RowCard
              key={row.organizationId}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {row.organizationName}
                  <Badge tone={row.logoReady ? 'success' : 'warning'}>
                    {row.logoReady
                      ? frCms.landingOrganizations.logoReady
                      : frCms.landingOrganizations.logoMissing}
                  </Badge>
                </span>
              }
              meta={`${frCms.landingOrganizations.fieldOrder} : ${row.displayOrder}`}
              status={row.isPublished ? 'published' : 'draft'}
              actions={
                <ActionButton
                  action={removeLandingOrganizationAction}
                  fields={{ organizationId: row.organizationId }}
                  label={frCms.landingOrganizations.remove}
                  srLabel={`${frCms.landingOrganizations.remove} — ${row.organizationName}`}
                  disabled={!canEdit}
                  {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                />
              }
            >
              <div className="mt-4">
                <OrganizationLogoForm
                  action={setLandingOrganizationAction}
                  submitLabel={frCms.landingOrganizations.submit}
                  organizationId={row.organizationId}
                  organizations={organizations}
                  mediaOptions={mediaOptions}
                  currentMediaId={row.mediaId}
                  currentOrder={row.displayOrder}
                  currentPublished={row.isPublished}
                  canEdit={canEdit}
                />
              </div>
            </RowCard>
          ))}
        </RowList>
      )}

      {!canEdit ? (
        <Alert variant="info" title="Lecture seule">
          {frCms.common.readOnlyHint}
        </Alert>
      ) : null}
    </div>,
  );
}
