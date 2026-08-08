'use client';

import { frCms } from '@/i18n/cms';
import { CMS_INPUT_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import type { CmsAction } from '../_components/ActionButton';

export interface EntityScheduleFormProps {
  action: CmsAction;
  idFieldName: string;
  entityId: string;
  label: string;
  canSchedule: boolean;
}

/**
 * Programmation de l'exposition d'un contenu metier (CMS-004, CMS-005).
 *
 * Replie dans un `<details>` : la liste reste lisible, et l'ouverture est
 * native, donc utilisable au clavier sans code supplementaire.
 * Sur Mobile, c'est le geste « programmer » attendu par le §54.
 */
export function EntityScheduleForm({
  action,
  idFieldName,
  entityId,
  label,
  canSchedule,
}: EntityScheduleFormProps) {
  return (
    <details className="border-border mt-4 rounded-lg border p-4">
      <summary className="text-body-sm text-primary min-h-[44px] cursor-pointer list-none font-medium">
        {frCms.news.scheduleLabel} — {label}
      </summary>
      <div className="mt-4">
        <CmsForm
          action={action}
          submitLabel={frCms.schedule.createSubmit}
          disabled={!canSchedule}
          disabledReason={frCms.common.forbidden}
        >
          {(errors) => (
            <>
              <input type="hidden" name={idFieldName} value={entityId} />
              <div className="grid gap-5 lg:grid-cols-2">
                <CmsField
                  name="publishAt"
                  label={frCms.schedule.publishAt}
                  error={errors['publishAt']}
                >
                  {(props) => (
                    <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />
                  )}
                </CmsField>
                <CmsField
                  name="unpublishAt"
                  label={frCms.schedule.unpublishAt}
                  error={errors['unpublishAt']}
                >
                  {(props) => (
                    <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />
                  )}
                </CmsField>
              </div>
              <p className="text-caption text-text-muted">{frCms.schedule.frontierNote}</p>
            </>
          )}
        </CmsForm>
      </div>
    </details>
  );
}
