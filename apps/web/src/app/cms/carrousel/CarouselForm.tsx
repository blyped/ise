'use client';

import { frCms } from '@/i18n/cms';
import { CMS_CONTENT_TYPES, CMS_ENTITY_TYPES, type CmsCarouselItem } from '@/lib/cms/types';
import { toDateTimeLocalValue } from '@/lib/cms/format';
import { CMS_INPUT_CLASS, CMS_TEXTAREA_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import type { CmsAction } from '../_components/ActionButton';

export interface MediaOption {
  id: string;
  filename: string;
  altText: string;
}

export interface CampaignOption {
  id: string;
  campaignName: string;
  sponsoredLabel: string;
}

export interface CarouselFormProps {
  action: CmsAction;
  submitLabel: string;
  item?: CmsCarouselItem | undefined;
  mediaOptions: readonly MediaOption[];
  campaignOptions: readonly CampaignOption[];
  canEdit: boolean;
}

/**
 * Formulaire d'une slide (CMS-002).
 *
 * Quatre points meritent d'etre lus :
 *
 *   * DEUX VISUELS DISTINCTS, Desktop et Mobile (§32). Chacun se choisit
 *     dans la mediatheque, ou chaque media porte deja son texte
 *     alternatif — on ne le ressaisit donc pas ici, ce qui creerait deux
 *     verites.
 *   * LA RESSOURCE LIEE se declare par `entity_type` + `entity_id`, jamais
 *     par une URL INTERNE (§10). La route est calculee par l'application.
 *   * LE BOUTON DU CTA (0148) pointe soit cette ressource interne, soit une
 *     adresse EXTERNE saisie dans `targetUrl` (meme forme que
 *     `cms_partner_campaigns.target_url`, §37 : `https://` obligatoire, les
 *     deux etant mutuellement exclusifs). Sans l'une ou l'autre cible, le
 *     bouton ne s'affiche pas sur la landing meme si `ctaLabel` est rempli —
 *     c'etait precisement le bug signale par le porteur.
 *   * LE SPONSOR se choisit parmi les campagnes existantes. Cocher
 *     « sponsorise » sans campagne serait refuse par la contrainte
 *     `cms_carousel_items_sponsored_traceable` : le champ n'existe donc
 *     pas, c'est le choix de la campagne qui EST le choix du sponsor.
 */
export function CarouselForm({
  action,
  submitLabel,
  item,
  mediaOptions,
  campaignOptions,
  canEdit,
}: CarouselFormProps) {
  return (
    <CmsForm
      action={action}
      submitLabel={submitLabel}
      disabled={!canEdit}
      disabledReason={frCms.common.readOnlyHint}
    >
      {(errors) => (
        <>
          {item !== undefined ? <input type="hidden" name="itemId" value={item.id} /> : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="title"
              label={frCms.carousel.fieldTitle}
              required
              error={errors['title']}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  defaultValue={item?.title ?? ''}
                  maxLength={160}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField
              name="subtitle"
              label={frCms.carousel.fieldSubtitle}
              error={errors['subtitle']}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  defaultValue={item?.subtitle ?? ''}
                  maxLength={200}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>

          <CmsField
            name="description"
            label={frCms.carousel.fieldDescription}
            error={errors['description']}
          >
            {(props) => (
              <textarea
                {...props}
                rows={3}
                defaultValue={item?.description ?? ''}
                className={CMS_TEXTAREA_CLASS}
              />
            )}
          </CmsField>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="mediaId"
              label={frCms.carousel.fieldMedia}
              hint={frCms.carousel.fieldMediaHelp}
              error={errors['mediaId']}
            >
              {(props) => (
                <select {...props} defaultValue={item?.mediaId ?? ''} className={CMS_INPUT_CLASS}>
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
              label={frCms.carousel.fieldMobileMedia}
              error={errors['mobileMediaId']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={item?.mobileMediaId ?? ''}
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
              name="contentType"
              label={frCms.carousel.fieldContentType}
              error={errors['contentType']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={item?.contentType ?? 'institutional'}
                  className={CMS_INPUT_CLASS}
                >
                  {CMS_CONTENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>

            <CmsField
              name="entityType"
              label={frCms.carousel.fieldEntityType}
              hint={frCms.carousel.fieldEntityHelp}
              error={errors['entityType']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={item?.entityType ?? ''}
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
              name="entityId"
              label={frCms.carousel.fieldEntityId}
              error={errors['entityId']}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  inputMode="text"
                  defaultValue={item?.entityId ?? ''}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>

          <CmsField
            name="targetUrl"
            label={frCms.carousel.fieldTargetUrl}
            hint={frCms.carousel.fieldTargetUrlHelp}
            error={errors['targetUrl']}
          >
            {(props) => (
              <input
                {...props}
                type="url"
                inputMode="url"
                placeholder="https://"
                defaultValue={item?.targetUrl ?? ''}
                className={CMS_INPUT_CLASS}
              />
            )}
          </CmsField>

          <div className="grid gap-5 lg:grid-cols-3">
            <CmsField name="ctaLabel" label={frCms.carousel.fieldCta} error={errors['ctaLabel']}>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  defaultValue={item?.ctaLabel ?? ''}
                  maxLength={60}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField name="startAt" label={frCms.carousel.fieldStart} error={errors['startAt']}>
              {(props) => (
                <input
                  {...props}
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(item?.startAt ?? null)}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField name="endAt" label={frCms.carousel.fieldEnd} error={errors['endAt']}>
              {(props) => (
                <input
                  {...props}
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(item?.endAt ?? null)}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="textPosition"
              label={frCms.carousel.fieldTextPosition}
              hint={frCms.carousel.fieldTextPositionHelp}
              error={errors['textPosition']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={item?.textPosition ?? 'overlay'}
                  className={CMS_INPUT_CLASS}
                >
                  <option value="overlay">{frCms.carousel.textPositionOverlay}</option>
                  <option value="below">{frCms.carousel.textPositionBelow}</option>
                  <option value="hidden">{frCms.carousel.textPositionHidden}</option>
                </select>
              )}
            </CmsField>

            <CmsField
              name="dimMedia"
              label={frCms.carousel.fieldDimMedia}
              hint={frCms.carousel.fieldDimMediaHelp}
              error={errors['dimMedia']}
            >
              {(props) => (
                <input
                  {...props}
                  type="checkbox"
                  defaultChecked={item?.dimMedia ?? true}
                  className="border-border text-primary focus-visible:outline-active-blue mt-3 h-5 w-5 rounded border focus-visible:outline-2 focus-visible:outline-offset-2"
                />
              )}
            </CmsField>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="priority"
              label={frCms.carousel.fieldPriority}
              error={errors['priority']}
            >
              {(props) => (
                <input
                  {...props}
                  type="number"
                  min={0}
                  max={1000}
                  defaultValue={item?.priority ?? 0}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField
              name="partnerCampaignId"
              label={frCms.carousel.fieldCampaign}
              hint={frCms.carousel.sponsoredHelp}
              error={errors['partnerCampaignId']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={item?.partnerCampaignId ?? ''}
                  className={CMS_INPUT_CLASS}
                >
                  <option value="">Aucune (slide non sponsorisée)</option>
                  {campaignOptions.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.campaignName} — {campaign.sponsoredLabel}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>
          </div>
        </>
      )}
    </CmsForm>
  );
}
