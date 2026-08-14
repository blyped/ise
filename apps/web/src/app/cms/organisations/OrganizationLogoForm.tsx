'use client';

import { frCms } from '@/i18n/cms';
import type { CmsMediaOption, CmsOrganizationOption } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import type { CmsAction } from '../_components/ActionButton';

export interface OrganizationLogoFormProps {
  action: CmsAction;
  submitLabel: string;
  /**
   * `null` en mode AJOUT : l'organisation se choisit dans la liste.
   * Renseigne en mode EDITION : elle est figee, et voyage en champ cache.
   * On ne propose pas de « changer d'organisation » sur une ligne existante —
   * ce serait en realite en retirer une et en ajouter une autre, et le dire
   * ainsi est plus clair que de le deguiser en modification.
   */
  organizationId: string | null;
  organizations: readonly CmsOrganizationOption[];
  mediaOptions: readonly CmsMediaOption[];
  currentMediaId: string | null;
  currentOrder: number;
  currentPublished: boolean;
  canEdit: boolean;
}

/**
 * CMS-013 (0133) — formulaire d'UNE organisation de la section « logos ».
 *
 * Repris du patron `PillarForm` : le media est puise dans la mediatheque
 * publique, jamais recopie a la main, ce qui garantit qu'il porte une
 * alternative textuelle et qu'il vit dans le seul bucket public.
 *
 * Quatre champs, pas un de plus : l'organisation, son logo, son rang, et
 * « est-ce affiche ». La section publique n'affiche rien d'autre qu'un logo :
 * il n'y a donc rien d'autre a regler.
 */
export function OrganizationLogoForm({
  action,
  submitLabel,
  organizationId,
  organizations,
  mediaOptions,
  currentMediaId,
  currentOrder,
  currentPublished,
  canEdit,
}: OrganizationLogoFormProps) {
  const noOrganization = organizationId === null && organizations.length === 0;

  return (
    <CmsForm
      action={action}
      submitLabel={submitLabel}
      disabled={!canEdit || noOrganization}
      disabledReason={
        noOrganization ? frCms.landingOrganizations.fieldOrganizationEmpty : frCms.common.forbidden
      }
    >
      {(errors) => (
        <>
          {organizationId !== null ? (
            <input type="hidden" name="organizationId" value={organizationId} />
          ) : (
            <CmsField
              name="organizationId"
              label={frCms.landingOrganizations.fieldOrganization}
              hint={frCms.landingOrganizations.fieldOrganizationHelp}
              required
              error={errors['organizationId']}
            >
              {(props) => (
                <select {...props} defaultValue="" className={CMS_INPUT_CLASS}>
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
          )}

          <CmsField
            name="mediaId"
            label={frCms.landingOrganizations.fieldMedia}
            hint={frCms.landingOrganizations.fieldMediaHelp}
            error={errors['mediaId']}
          >
            {(props) => (
              <select {...props} defaultValue={currentMediaId ?? ''} className={CMS_INPUT_CLASS}>
                <option value="">{frCms.landingOrganizations.fieldMediaNone}</option>
                {mediaOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.filename} — {option.altText}
                  </option>
                ))}
              </select>
            )}
          </CmsField>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="displayOrder"
              label={frCms.landingOrganizations.fieldOrder}
              hint={frCms.landingOrganizations.fieldOrderHelp}
              error={errors['displayOrder']}
            >
              {(props) => (
                <input
                  {...props}
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  defaultValue={currentOrder}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField
              name="isPublished"
              label={frCms.landingOrganizations.fieldPublished}
              error={errors['isPublished']}
            >
              {(props) => (
                <input
                  {...props}
                  type="checkbox"
                  value="true"
                  defaultChecked={currentPublished}
                  className="h-[24px] w-[24px] self-start"
                />
              )}
            </CmsField>
          </div>
        </>
      )}
    </CmsForm>
  );
}
