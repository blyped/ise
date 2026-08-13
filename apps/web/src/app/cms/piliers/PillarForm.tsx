'use client';

import { frCms } from '@/i18n/cms';
import type { CmsMediaOption, CmsPillarLinkTarget } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CMS_TEXTAREA_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import type { CmsAction } from '../_components/ActionButton';

const LINK_TARGET_KEYS: readonly CmsPillarLinkTarget[] = [
  'search',
  'calls',
  'projects',
  'opportunities',
  'applications',
];

export interface PillarFormProps {
  action: CmsAction;
  pillarKey: string;
  currentMediaId: string | null;
  currentCaption: string | null;
  currentLinkTarget: string | null;
  mediaOptions: readonly CmsMediaOption[];
  canEdit: boolean;
}

/**
 * CMS-011 (0114) — formulaire d'UN pilier : visuel, légende optionnelle,
 * lien. Repris du patron `CoverMediaForm` (média puisé dans la médiathèque
 * publique, jamais un chemin recopié à la main), avec deux champs de plus
 * puisque les trois voyagent ensemble dans un seul appel à
 * `set_landing_pillar`.
 */
export function PillarForm({
  action,
  pillarKey,
  currentMediaId,
  currentCaption,
  currentLinkTarget,
  mediaOptions,
  canEdit,
}: PillarFormProps) {
  return (
    <CmsForm
      action={action}
      submitLabel={frCms.pillars.submit}
      disabled={!canEdit}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <input type="hidden" name="pillarKey" value={pillarKey} />
          <CmsField
            name="mediaId"
            label={frCms.pillars.fieldMedia}
            hint={frCms.pillars.fieldMediaHint}
            error={errors['mediaId']}
          >
            {(props) => (
              <select {...props} defaultValue={currentMediaId ?? ''} className={CMS_INPUT_CLASS}>
                <option value="">{frCms.pillars.fieldMediaNone}</option>
                {mediaOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.filename} — {option.altText}
                  </option>
                ))}
              </select>
            )}
          </CmsField>

          <CmsField
            name="caption"
            label={frCms.pillars.fieldCaption}
            hint={frCms.pillars.fieldCaptionHint}
            error={errors['caption']}
          >
            {(props) => (
              <textarea
                {...props}
                rows={2}
                maxLength={280}
                defaultValue={currentCaption ?? ''}
                className={CMS_TEXTAREA_CLASS}
              />
            )}
          </CmsField>

          <CmsField
            name="linkTarget"
            label={frCms.pillars.fieldLink}
            error={errors['linkTarget']}
          >
            {(props) => (
              <select
                {...props}
                defaultValue={currentLinkTarget ?? ''}
                className={CMS_INPUT_CLASS}
              >
                <option value="">{frCms.pillars.fieldLinkNone}</option>
                {LINK_TARGET_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {frCms.pillars.linkOptions[key] ?? key}
                  </option>
                ))}
              </select>
            )}
          </CmsField>
        </>
      )}
    </CmsForm>
  );
}
