import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadSections } from '@/lib/cms/queries';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { SectionEditor } from './SectionEditor';
import {
  publishSectionAction,
  reorderSectionAction,
  rollbackSectionAction,
  toggleSectionAction,
  unpublishSectionAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.sections.title };

/**
 * CMS-003 — Sections d'accueil (ADDENDUM §33).
 *
 * Le squelette de la landing : ordre, visibilite, source, nombre de
 * cartes, titre, CTA, bascule automatique / manuel. Aucune section n'est
 * creee ici — les neuf sections structurelles viennent du seed de `0057`,
 * et en ajouter une n'aurait de sens que si la landing savait la rendre.
 * Un bouton « Ajouter » serait donc decoratif : il n'y en a pas.
 */
export default async function CmsSectionsPage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();
  const sections = await loadSections(correlationId);

  const canEdit = access.can('cms.edit');
  const canPublish = access.can('cms.publish');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.sections} screenTitle={frCms.sections.title}>
      {children}
    </CmsShell>
  );

  if (!sections.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.sections.title} subtitle={frCms.sections.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={sections.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = sections.data;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.sections.title} subtitle={frCms.sections.subtitle} />

      {rows.length === 0 ? (
        <EmptyState title={frCms.sections.emptyTitle} description={frCms.sections.emptyBody} />
      ) : (
        <RowList label={frCms.sections.title}>
          {rows.map((section, index) => {
            const previous = index > 0 ? rows[index - 1] : undefined;
            const next = index < rows.length - 1 ? rows[index + 1] : undefined;
            const label = section.title ?? section.sectionKey;
            const commonFields = {
              sectionId: section.id,
              title: section.title ?? '',
              subtitle: section.subtitle ?? '',
              sourceMode: section.sourceMode,
              maxItems: String(section.maxItems),
              ctaLabel: section.ctaLabel ?? '',
              ctaEntityType: section.ctaEntityType ?? '',
              ctaEntityId: section.ctaEntityId ?? '',
            };

            return (
              <RowCard
                key={section.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {label}
                    {section.isStructural ? (
                      <Badge tone="neutral">{frCms.sections.structural}</Badge>
                    ) : null}
                    {section.isEnabled ? null : <Badge tone="warning">Masquée</Badge>}
                  </span>
                }
                meta={`${frCms.sections.cardsCount(section.maxItems)} · ${
                  frCms.sourceMode[section.sourceMode] ?? section.sourceMode
                } · ${section.sectionKey}`}
                status={section.status}
                period={
                  section.sourceMode === 'automatic'
                    ? frCms.common.realTime
                    : frCms.common.permanent
                }
                notice={
                  section.hasUnpublishedChanges ? (
                    <span className="text-caption text-warning">Modifications non publiées.</span>
                  ) : null
                }
                actions={
                  <>
                    <div className="flex gap-1" role="group" aria-label="Réordonnancement">
                      {previous !== undefined ? (
                        <ActionButton
                          action={reorderSectionAction}
                          fields={{
                            currentId: section.id,
                            currentOrder: String(section.displayOrder),
                            otherId: previous.id,
                            otherOrder: String(previous.displayOrder),
                          }}
                          label="↑"
                          srLabel={`${frCms.actions.moveUp} — ${label}`}
                          disabled={!canEdit}
                          {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                        />
                      ) : null}
                      {next !== undefined ? (
                        <ActionButton
                          action={reorderSectionAction}
                          fields={{
                            currentId: section.id,
                            currentOrder: String(section.displayOrder),
                            otherId: next.id,
                            otherOrder: String(next.displayOrder),
                          }}
                          label="↓"
                          srLabel={`${frCms.actions.moveDown} — ${label}`}
                          disabled={!canEdit}
                          {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                        />
                      ) : null}
                    </div>

                    <ActionButton
                      action={toggleSectionAction}
                      fields={{ ...commonFields, enable: section.isEnabled ? 'false' : 'true' }}
                      label={section.isEnabled ? frCms.actions.disable : frCms.actions.enable}
                      srLabel={`${section.isEnabled ? frCms.actions.disable : frCms.actions.enable} — ${label}`}
                      disabled={!canEdit}
                      {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                    />

                    {section.status === 'published' ? (
                      <ActionButton
                        action={unpublishSectionAction}
                        fields={{ sectionId: section.id }}
                        label={frCms.actions.unpublish}
                        srLabel={`${frCms.actions.unpublish} — ${label}`}
                        disabled={!canPublish}
                        {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                      />
                    ) : (
                      <ActionButton
                        action={publishSectionAction}
                        fields={{ sectionId: section.id }}
                        label={frCms.actions.publish}
                        srLabel={`${frCms.actions.publish} — ${label}`}
                        variant="primary"
                        disabled={!canPublish}
                        {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                      />
                    )}

                    {section.hasPreviousSnapshot ? (
                      <ActionButton
                        action={rollbackSectionAction}
                        fields={{ sectionId: section.id }}
                        label={frCms.actions.rollback}
                        srLabel={`${frCms.actions.rollback} — ${label}`}
                        disabled={!canPublish}
                        {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                      />
                    ) : null}
                  </>
                }
              >
                <SectionEditor section={section} canEdit={canEdit} />
              </RowCard>
            );
          })}
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
