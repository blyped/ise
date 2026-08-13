'use client';

import { frCms } from '@/i18n/cms';
import type { CmsMediaOption } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CmsField, CmsForm } from './CmsForm';
import type { CmsAction } from './ActionButton';

export interface CoverMediaFormProps {
  action: CmsAction;
  idFieldName: string;
  entityId: string;
  label: string;
  currentMediaId: string | null;
  mediaOptions: readonly CmsMediaOption[];
  fieldLabel: string;
  fieldHint: string;
  noMediaLabel: string;
  submitLabel: string;
  summaryLabel: string;
  canEdit: boolean;
}

/**
 * Visuel de couverture d'un evenement ou d'une opportunite (0113).
 *
 * Repris du patron `EntityScheduleForm` (repli dans un `<details>`, ouverture
 * native) et du champ `mediaId` de `ShowcaseForm` (D-165) : un seul selecteur
 * puise dans la mediatheque PUBLIQUE, jamais un chemin recopie a la main.
 * Partage entre `/cms/evenements` et `/cms/opportunites` : c'est exactement
 * le meme geste sur deux modules differents.
 */
export function CoverMediaForm({
  action,
  idFieldName,
  entityId,
  label,
  currentMediaId,
  mediaOptions,
  fieldLabel,
  fieldHint,
  noMediaLabel,
  submitLabel,
  summaryLabel,
  canEdit,
}: CoverMediaFormProps) {
  return (
    <details className="border-border mt-4 rounded-lg border p-4">
      <summary className="text-body-sm text-primary min-h-[44px] cursor-pointer list-none font-medium">
        {summaryLabel} — {label}
      </summary>
      <div className="mt-4">
        <CmsForm
          action={action}
          submitLabel={submitLabel}
          disabled={!canEdit}
          disabledReason={frCms.common.forbidden}
        >
          {(errors) => (
            <>
              <input type="hidden" name={idFieldName} value={entityId} />
              <CmsField
                name="mediaId"
                label={fieldLabel}
                hint={fieldHint}
                error={errors['mediaId']}
              >
                {(props) => (
                  <select
                    {...props}
                    defaultValue={currentMediaId ?? ''}
                    className={CMS_INPUT_CLASS}
                  >
                    <option value="">{noMediaLabel}</option>
                    {mediaOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.filename} — {option.altText}
                      </option>
                    ))}
                  </select>
                )}
              </CmsField>
            </>
          )}
        </CmsForm>
      </div>
    </details>
  );
}
