'use client';

import { frCms } from '@/i18n/cms';
import { CMS_MEDIA_USAGES, DEFAULT_CMS_MEDIA_USAGE } from '@/lib/cms/image-metadata';
import type { CmsMediaAsset } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import { updateMediaAction, uploadMediaAction } from './actions';

/**
 * Televersement d'un media (CMS-008).
 *
 * Le texte alternatif est OBLIGATOIRE et il est demande AVANT le depot,
 * pas apres : `cms_media_assets.alt_text` est `NOT NULL`, un media sans
 * alternative textuelle n'existe pas en base. Le champ porte donc
 * `required`, et le serveur le revalide.
 *
 * L'EMPLACEMENT est demande lui aussi, et pour une raison de securite, pas
 * de rangement : la politique `ise_landing_media_insert` (0068) refuse tout
 * depot dont le premier segment de chemin n'est pas l'un des quatre usages.
 * Faire deviner ce segment au serveur reviendrait a le choisir a la place du
 * redacteur ; le lui demander rend la regle visible.
 */
export function MediaUploadForm({ canManage }: { canManage: boolean }) {
  return (
    <CmsForm
      action={uploadMediaAction}
      submitLabel={frCms.media.add}
      multipart
      disabled={!canManage}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <CmsField
            name="file"
            label={frCms.media.fieldFile}
            hint={frCms.media.fieldFileHelp}
            required
            error={errors['file']}
          >
            {(props) => (
              <input
                {...props}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className={CMS_INPUT_CLASS}
              />
            )}
          </CmsField>

          <CmsField
            name="usage"
            label={frCms.media.fieldUsage}
            hint={frCms.media.fieldUsageHelp}
            required
            error={errors['usage']}
          >
            {(props) => (
              <select {...props} defaultValue={DEFAULT_CMS_MEDIA_USAGE} className={CMS_INPUT_CLASS}>
                {CMS_MEDIA_USAGES.map((usage) => (
                  <option key={usage} value={usage}>
                    {frCms.media.usages[usage]}
                  </option>
                ))}
              </select>
            )}
          </CmsField>

          <CmsField
            name="altText"
            label={frCms.media.fieldAlt}
            hint={frCms.media.fieldAltHelp}
            required
            error={errors['altText']}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                minLength={3}
                maxLength={300}
                className={CMS_INPUT_CLASS}
              />
            )}
          </CmsField>

          <CmsField name="credit" label={frCms.media.fieldCredit} error={errors['credit']}>
            {(props) => (
              <input {...props} type="text" maxLength={200} className={CMS_INPUT_CLASS} />
            )}
          </CmsField>

          <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-4">
            <p className="text-body-sm text-primary font-semibold">{frCms.media.pipelineTitle}</p>
            <p className="text-caption text-text-secondary mt-1">{frCms.media.pipelineBody}</p>
            <p className="text-caption text-warning mt-2">{frCms.media.pipelineGap}</p>
          </div>
        </>
      )}
    </CmsForm>
  );
}

/** Metadonnees d'un media existant : texte alternatif et credit. */
export function MediaMetadataForm({
  media,
  canManage,
}: {
  media: CmsMediaAsset;
  canManage: boolean;
}) {
  return (
    <CmsForm
      action={updateMediaAction}
      submitLabel={frCms.common.save}
      disabled={!canManage}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <input type="hidden" name="mediaId" value={media.id} />
          <CmsField name="altText" label={frCms.media.fieldAlt} required error={errors['altText']}>
            {(props) => (
              <input
                {...props}
                type="text"
                minLength={3}
                maxLength={300}
                defaultValue={media.altText}
                className={CMS_INPUT_CLASS}
              />
            )}
          </CmsField>
          <CmsField name="credit" label={frCms.media.fieldCredit} error={errors['credit']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={200}
                defaultValue={media.credit ?? ''}
                className={CMS_INPUT_CLASS}
              />
            )}
          </CmsField>
        </>
      )}
    </CmsForm>
  );
}
