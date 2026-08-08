'use client';

import { frCms } from '@/i18n/cms';
import type { CmsFeaturedCandidate, CmsFeaturedRules } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CMS_TEXTAREA_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import { excludeProfileAction, overrideProfileAction, updateRulesAction } from './actions';

const BALANCE_DIMENSIONS = ['none', 'promotion', 'country', 'sector', 'expertise'] as const;

function candidateLabel(candidate: CmsFeaturedCandidate): string {
  const parts = [candidate.displayName];
  if (candidate.promotion !== null) parts.push(candidate.promotion);
  if (candidate.currentPosition !== null) parts.push(candidate.currentPosition);
  return parts.join(' · ');
}

/** Forcer un profil (§22). Le vivier ne contient que des profils eligibles. */
export function OverrideForm({
  candidates,
  canManage,
}: {
  candidates: readonly CmsFeaturedCandidate[];
  canManage: boolean;
}) {
  return (
    <CmsForm
      action={overrideProfileAction}
      submitLabel={frCms.featured.overrideSubmit}
      disabled={!canManage}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <CmsField
            name="profileId"
            label={frCms.featured.overrideProfile}
            hint={frCms.featured.overrideHelp}
            required
            error={errors['profileId']}
          >
            {(props) => (
              <select {...props} defaultValue="" className={CMS_INPUT_CLASS}>
                <option value="" disabled>
                  {candidates.length === 0 ? frCms.featured.candidatesEmpty : '—'}
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidateLabel(candidate)}
                  </option>
                ))}
              </select>
            )}
          </CmsField>

          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="startsAt"
              label={frCms.featured.overrideStart}
              error={errors['startsAt']}
            >
              {(props) => <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />}
            </CmsField>
            <CmsField name="endsAt" label={frCms.featured.overrideEnd} error={errors['endsAt']}>
              {(props) => <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />}
            </CmsField>
          </div>

          <CmsField name="reason" label={frCms.featured.overrideReason} error={errors['reason']}>
            {(props) => <textarea {...props} rows={2} className={CMS_TEXTAREA_CLASS} />}
          </CmsField>
        </>
      )}
    </CmsForm>
  );
}

/** Exclure un profil : acte editorial date et motive (D-122). */
export function ExcludeForm({
  candidates,
  canManage,
}: {
  candidates: readonly CmsFeaturedCandidate[];
  canManage: boolean;
}) {
  return (
    <CmsForm
      action={excludeProfileAction}
      submitLabel={frCms.featured.excludeSubmit}
      disabled={!canManage}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <CmsField
            name="profileId"
            label={frCms.featured.overrideProfile}
            hint={frCms.featured.excludeHelp}
            required
            error={errors['profileId']}
          >
            {(props) => (
              <select {...props} defaultValue="" className={CMS_INPUT_CLASS}>
                <option value="" disabled>
                  {candidates.length === 0 ? frCms.featured.candidatesEmpty : '—'}
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidateLabel(candidate)}
                  </option>
                ))}
              </select>
            )}
          </CmsField>

          <CmsField name="until" label={frCms.featured.excludeUntil} error={errors['until']}>
            {(props) => <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />}
          </CmsField>

          <CmsField name="reason" label={frCms.featured.overrideReason} error={errors['reason']}>
            {(props) => <textarea {...props} rows={2} className={CMS_TEXTAREA_CLASS} />}
          </CmsField>
        </>
      )}
    </CmsForm>
  );
}

/** Regles d'eligibilite. Elles pilotent REELLEMENT la selection quotidienne. */
export function RulesForm({
  rules,
  canManage,
}: {
  rules: CmsFeaturedRules | null;
  canManage: boolean;
}) {
  return (
    <CmsForm
      action={updateRulesAction}
      submitLabel={frCms.common.save}
      disabled={!canManage}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <CmsField
              name="minDaysBetweenFeatures"
              label={frCms.featured.ruleMinDays}
              error={errors['minDaysBetweenFeatures']}
            >
              {(props) => (
                <input
                  {...props}
                  type="number"
                  min={1}
                  max={3650}
                  defaultValue={rules?.minDaysBetweenFeatures ?? 90}
                  className={CMS_INPUT_CLASS}
                />
              )}
            </CmsField>

            <CmsField
              name="balanceDimension"
              label={frCms.featured.ruleBalance}
              error={errors['balanceDimension']}
            >
              {(props) => (
                <select
                  {...props}
                  defaultValue={rules?.balanceDimension ?? 'promotion'}
                  className={CMS_INPUT_CLASS}
                >
                  {BALANCE_DIMENSIONS.map((value) => (
                    <option key={value} value={value}>
                      {frCms.featured.balance[value] ?? value}
                    </option>
                  ))}
                </select>
              )}
            </CmsField>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-body-sm text-text-primary mb-2 font-medium">
              {frCms.featured.rulesTitle}
            </legend>
            {(
              [
                [
                  'requireClaimedProfile',
                  frCms.featured.ruleRequireClaimed,
                  rules?.requireClaimedProfile,
                ],
                ['requireAvatar', frCms.featured.ruleRequireAvatar, rules?.requireAvatar],
                ['requirePromotion', frCms.featured.ruleRequirePromotion, rules?.requirePromotion],
                [
                  'requireExpertiseOrPosition',
                  frCms.featured.ruleRequireExpertise,
                  rules?.requireExpertiseOrPosition,
                ],
              ] as const
            ).map(([name, label, checked]) => (
              <label
                key={name}
                className="text-body-sm text-text-primary flex min-h-[44px] items-center gap-3"
              >
                <input
                  type="checkbox"
                  name={name}
                  value="true"
                  defaultChecked={checked ?? false}
                  className="h-5 w-5"
                />
                {label}
              </label>
            ))}
          </fieldset>

          <p className="text-caption text-text-muted max-w-[80ch]">{frCms.featured.rulesHelp}</p>
        </>
      )}
    </CmsForm>
  );
}
