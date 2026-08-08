'use client';

import { frCms } from '@/i18n/cms';
import { CMS_ENTITY_TYPES, CMS_SOURCE_MODES, type CmsSection } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import { updateSectionAction } from './actions';

/**
 * Edition d'une section (CMS-003) : ordre, visibilite, source, nombre de
 * cartes, titre, CTA, bascule automatique / manuel.
 *
 * Le formulaire vit dans un `<details>` : il est REPLIE par defaut, ce qui
 * garde la liste lisible sur Mobile, et il s'ouvre au clavier comme a la
 * souris — `<details>` est un element natif, pas un accordeon reconstruit.
 */
export function SectionEditor({ section, canEdit }: { section: CmsSection; canEdit: boolean }) {
  return (
    <details className="border-border mt-4 rounded-lg border p-4">
      <summary className="text-body-sm text-primary min-h-[44px] cursor-pointer list-none font-medium">
        {frCms.actions.edit} — {section.title ?? section.sectionKey}
      </summary>

      <div className="mt-4">
        <CmsForm
          action={updateSectionAction}
          submitLabel={frCms.common.save}
          disabled={!canEdit}
          disabledReason={frCms.common.readOnlyHint}
        >
          {(errors) => (
            <>
              <input type="hidden" name="sectionId" value={section.id} />

              <div className="grid gap-5 lg:grid-cols-2">
                <CmsField name="title" label={frCms.sections.fieldTitle} error={errors['title']}>
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      defaultValue={section.title ?? ''}
                      maxLength={160}
                      className={CMS_INPUT_CLASS}
                    />
                  )}
                </CmsField>

                <CmsField
                  name="subtitle"
                  label={frCms.sections.fieldSubtitle}
                  error={errors['subtitle']}
                >
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      defaultValue={section.subtitle ?? ''}
                      maxLength={240}
                      className={CMS_INPUT_CLASS}
                    />
                  )}
                </CmsField>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <CmsField
                  name="sourceMode"
                  label={frCms.sections.fieldSource}
                  hint={frCms.sections.sourceHelp}
                  error={errors['sourceMode']}
                >
                  {(props) => (
                    <select
                      {...props}
                      defaultValue={section.sourceMode}
                      className={CMS_INPUT_CLASS}
                    >
                      {CMS_SOURCE_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {frCms.sourceMode[mode] ?? mode}
                        </option>
                      ))}
                    </select>
                  )}
                </CmsField>

                <CmsField
                  name="maxItems"
                  label={frCms.sections.fieldMaxItems}
                  error={errors['maxItems']}
                >
                  {(props) => (
                    <input
                      {...props}
                      type="number"
                      min={0}
                      max={24}
                      defaultValue={section.maxItems}
                      className={CMS_INPUT_CLASS}
                    />
                  )}
                </CmsField>

                <div className="flex items-center">
                  <label className="text-body-sm text-text-primary flex min-h-[44px] items-center gap-3">
                    <input
                      type="checkbox"
                      name="isEnabled"
                      value="true"
                      defaultChecked={section.isEnabled}
                      className="h-5 w-5"
                    />
                    {frCms.sections.fieldEnabled}
                  </label>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <CmsField
                  name="ctaLabel"
                  label={frCms.sections.fieldCtaLabel}
                  error={errors['ctaLabel']}
                >
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      defaultValue={section.ctaLabel ?? ''}
                      maxLength={60}
                      className={CMS_INPUT_CLASS}
                    />
                  )}
                </CmsField>

                <CmsField
                  name="ctaEntityType"
                  label={frCms.sections.fieldCtaEntityType}
                  error={errors['ctaEntityType']}
                >
                  {(props) => (
                    <select
                      {...props}
                      defaultValue={section.ctaEntityType ?? ''}
                      className={CMS_INPUT_CLASS}
                    >
                      <option value="">{frCms.common.none}</option>
                      {CMS_ENTITY_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  )}
                </CmsField>

                <CmsField
                  name="ctaEntityId"
                  label={frCms.sections.fieldCtaEntityId}
                  error={errors['ctaEntityId']}
                >
                  {(props) => (
                    <input
                      {...props}
                      type="text"
                      defaultValue={section.ctaEntityId ?? ''}
                      className={CMS_INPUT_CLASS}
                    />
                  )}
                </CmsField>
              </div>

              {section.isStructural ? (
                <p className="text-caption text-text-muted">{frCms.sections.structuralHelp}</p>
              ) : null}
            </>
          )}
        </CmsForm>
      </div>
    </details>
  );
}
