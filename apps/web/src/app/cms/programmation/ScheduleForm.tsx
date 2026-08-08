'use client';

import { frCms } from '@/i18n/cms';
import { CMS_SCHEDULE_ENTITY_TYPES } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import { createScheduleAction } from './actions';

/**
 * Creation d'un ordre de programmation (CMS-009).
 *
 * L'identifiant du contenu est saisi tel quel : le CMS ne propose pas de
 * selecteur universel parce qu'il n'existe pas de liste unique de tous
 * les contenus programmables — actualites, evenements, slides, campagnes
 * et sections vivent dans cinq tables. Les ecrans CMS-004, CMS-005 et
 * CMS-002 proposent chacun leur propre bouton « Programmer », qui remplit
 * l'identifiant pour vous. Ce formulaire-ci est la porte de secours.
 */
export function ScheduleForm({ canSchedule }: { canSchedule: boolean }) {
  return (
    <CmsForm
      action={createScheduleAction}
      submitLabel={frCms.schedule.createSubmit}
      disabled={!canSchedule}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="entityType"
              label={frCms.schedule.entityType}
              required
              error={errors['entityType']}
            >
              {(props) => (
                <select {...props} defaultValue="cms_carousel_item" className={CMS_INPUT_CLASS}>
                  {CMS_SCHEDULE_ENTITY_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {frCms.schedule.entityTypes[value] ?? value}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>

            <CmsField
              name="entityId"
              label={frCms.schedule.entityId}
              required
              error={errors['entityId']}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField name="publishAt" label={frCms.schedule.publishAt} error={errors['publishAt']}>
              {(props) => <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />}
            </CmsField>
            <CmsField
              name="unpublishAt"
              label={frCms.schedule.unpublishAt}
              error={errors['unpublishAt']}
            >
              {(props) => <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />}
            </CmsField>
          </div>

          <p className="text-caption text-text-muted max-w-[80ch]">{frCms.schedule.frontierNote}</p>
        </>
      )}
    </CmsForm>
  );
}
