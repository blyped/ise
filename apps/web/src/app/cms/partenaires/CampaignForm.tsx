'use client';

import { frCms } from '@/i18n/cms';
import {
  CMS_ENTITY_TYPES,
  CMS_PLACEMENTS,
  type CmsOrganizationOption,
  type CmsPartnerCampaign,
} from '@/lib/cms/types';
import { toDateTimeLocalValue } from '@/lib/cms/format';
import { CMS_INPUT_CLASS, CMS_TEXTAREA_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import type { CmsAction } from '../_components/ActionButton';
import type { MediaOption } from '../carrousel/CarouselForm';

export interface CampaignFormProps {
  action: CmsAction;
  submitLabel: string;
  campaign?: CmsPartnerCampaign | undefined;
  organizations: readonly CmsOrganizationOption[];
  mediaOptions: readonly MediaOption[];
  canManage: boolean;
}

/**
 * Formulaire d'une campagne partenaire (CMS-007).
 *
 * La mention de transparence est un champ OBLIGATOIRE, place au meme rang
 * que le nom de la campagne — pas relegue en bas de page. C'est une
 * exigence reglementaire (§26), et la base la fait respecter de toute
 * facon : `sponsored_label` est `NOT NULL`.
 */
export function CampaignForm({
  action,
  submitLabel,
  campaign,
  organizations,
  mediaOptions,
  canManage,
}: CampaignFormProps) {
  return (
    <CmsForm
      action={action}
      submitLabel={submitLabel}
      disabled={!canManage}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          {campaign !== undefined ? (
            <input type="hidden" name="campaignId" value={campaign.id} />
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="organizationId"
              label={frCms.partners.fieldOrganization}
              hint={frCms.partners.fieldOrganizationHelp}
              required
              error={errors['organizationId']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={campaign?.organizationId ?? ''}
                  className={CMS_INPUT_CLASS}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                      {organization.isVerified ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>

            <CmsField
              name="campaignName"
              label={frCms.partners.fieldName}
              required
              error={errors['campaignName']}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  defaultValue={campaign?.campaignName ?? ''}
                  maxLength={160}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>

          <CmsField
            name="sponsoredLabel"
            label={frCms.partners.fieldSponsoredLabel}
            hint={frCms.partners.sponsoredLabelHelp}
            required
            error={errors['sponsoredLabel']}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                defaultValue={campaign?.sponsoredLabel ?? 'Contenu partenaire'}
                maxLength={80}
                className={CMS_INPUT_CLASS}
              />
            )}
          </CmsField>

          <div className="grid gap-5 lg:grid-cols-3">
            <CmsField
              name="placement"
              label={frCms.partners.fieldPlacement}
              hint={frCms.partners.placementFooterHelp}
              error={errors['placement']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={campaign?.placement ?? 'partners_band'}
                  className={CMS_INPUT_CLASS}
                >
                  {CMS_PLACEMENTS.map((value) => (
                    <option key={value} value={value}>
                      {frCms.placement[value] ?? value}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>

            <CmsField
              name="startAt"
              label={frCms.partners.fieldStart}
              required
              error={errors['startAt']}
            >
              {(props) => (
                <input
                  {...props}
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(campaign?.startAt ?? null)}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField name="endAt" label={frCms.partners.fieldEnd} required error={errors['endAt']}>
              {(props) => (
                <input
                  {...props}
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(campaign?.endAt ?? null)}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField name="title" label={frCms.partners.fieldTitle} error={errors['title']}>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  defaultValue={campaign?.title ?? ''}
                  maxLength={160}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField name="ctaLabel" label={frCms.partners.fieldCta} error={errors['ctaLabel']}>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  defaultValue={campaign?.ctaLabel ?? ''}
                  maxLength={60}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>

          <CmsField
            name="description"
            label={frCms.partners.fieldDescription}
            error={errors['description']}
          >
            {(props) => (
              <textarea
                {...props}
                rows={3}
                defaultValue={campaign?.description ?? ''}
                className={CMS_TEXTAREA_CLASS}
              />
            )}
          </CmsField>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="mediaId"
              label={frCms.partners.fieldMedia}
              hint={frCms.partners.fieldMediaHelp}
              error={errors['mediaId']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={campaign?.mediaId ?? ''}
                  className={CMS_INPUT_CLASS}
                >
                  <option value="">{frCms.carousel.noMedia}</option>
                  {mediaOptions.map((media) => (
                    <option key={media.id} value={media.id}>
                      {media.filename} — {media.altText}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>

            <CmsField
              name="mobileMediaId"
              label={frCms.partners.fieldMobileMedia}
              error={errors['mobileMediaId']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={campaign?.mobileMediaId ?? ''}
                  className={CMS_INPUT_CLASS}
                >
                  <option value="">{frCms.carousel.noMedia}</option>
                  {mediaOptions.map((media) => (
                    <option key={media.id} value={media.id}>
                      {media.filename} — {media.altText}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <CmsField
              name="targetUrl"
              label={frCms.partners.fieldTargetUrl}
              hint={frCms.partners.fieldTargetHelp}
              error={errors['targetUrl']}
            >
              {(props) => (
                <input
                  {...props}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  defaultValue={campaign?.targetUrl ?? ''}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField
              name="targetEntityType"
              label={frCms.partners.fieldTargetEntityType}
              error={errors['targetEntityType']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={campaign?.targetEntityType ?? ''}
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
              name="targetEntityId"
              label={frCms.partners.fieldTargetEntityId}
              error={errors['targetEntityId']}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  defaultValue={campaign?.targetEntityId ?? ''}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>
        </>
      )}
    </CmsForm>
  );
}
