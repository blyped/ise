'use client';

import { frAdminData } from '@/i18n/admin-data';
import type { FeatureFlagItem, PlatformSettingItem } from '@/lib/admin-data/view';
import { ADMIN_INPUT_CLASS, AdminField, AdminForm } from '../imports/_components/AdminForm';
import { saveFlagAction, saveSettingAction } from './actions';

const t = frAdminData.settings;

/** Création / modification d'un paramètre. Le motif est journalisé. */
export function SettingForm({ existing }: { existing?: PlatformSettingItem | undefined }) {
  return (
    <AdminForm
      action={saveSettingAction}
      submitLabel={existing === undefined ? t.newSetting : t.confirmSave}
    >
      {(errors) => (
        <>
          <AdminField name="key" label={t.keyLabel} required error={errors['key']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={120}
                defaultValue={existing?.key ?? ''}
                readOnly={existing !== undefined}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="valueKind" label={t.valueKindLabel} error={errors['valueKind']}>
            {(props) => (
              <select
                {...props}
                defaultValue={existing?.valueKind ?? 'string'}
                className={ADMIN_INPUT_CLASS}
              >
                {Object.entries(t.kind).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </AdminField>
          <AdminField name="value" label={t.valueLabel} required error={errors['value']}>
            {(props) => (
              <textarea
                {...props}
                rows={2}
                maxLength={4000}
                defaultValue={existing === undefined ? '' : JSON.stringify(existing.value)}
                className={ADMIN_INPUT_CLASS + ' font-mono'}
              />
            )}
          </AdminField>
          <AdminField name="scope" label={t.scopeLabel} error={errors['scope']}>
            {(props) => (
              <select
                {...props}
                defaultValue={existing?.scope ?? 'admin'}
                className={ADMIN_INPUT_CLASS}
              >
                {Object.entries(t.scope).map(([scope, label]) => (
                  <option key={scope} value={scope}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </AdminField>
          <AdminField
            name="description"
            label={t.descriptionLabel}
            required={existing === undefined}
            error={errors['description']}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={300}
                defaultValue={existing?.description ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="reason" label={t.reasonLabel} required error={errors['reason']}>
            {(props) => (
              <input {...props} type="text" maxLength={300} className={ADMIN_INPUT_CLASS} />
            )}
          </AdminField>
        </>
      )}
    </AdminForm>
  );
}

/** Création / modification d'un feature flag. Le motif est journalisé. */
export function FlagForm({ existing }: { existing?: FeatureFlagItem | undefined }) {
  return (
    <AdminForm
      action={saveFlagAction}
      submitLabel={existing === undefined ? t.newFlag : t.confirmSave}
    >
      {(errors) => (
        <>
          <AdminField name="code" label={t.flagCode} required error={errors['code']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={80}
                defaultValue={existing?.code ?? ''}
                readOnly={existing !== undefined}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="name" label={t.flagName} required error={errors['name']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={160}
                defaultValue={existing?.name ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="isEnabled" label={t.flagEnabled} error={errors['isEnabled']}>
            {(props) => (
              <input
                id={props.id}
                name={props.name}
                aria-describedby={props['aria-describedby']}
                type="checkbox"
                defaultChecked={existing?.isEnabled === true}
                className="border-border h-5 w-5 rounded"
              />
            )}
          </AdminField>
          <AdminField name="strategy" label={t.flagStrategy} error={errors['strategy']}>
            {(props) => (
              <select
                {...props}
                defaultValue={existing?.rolloutStrategy ?? 'off'}
                className={ADMIN_INPUT_CLASS}
              >
                {Object.entries(t.strategy).map(([strategy, label]) => (
                  <option key={strategy} value={strategy}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </AdminField>
          <AdminField name="targetRole" label={t.targetRoleLabel} error={errors['targetRole']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={60}
                defaultValue={existing?.targetRoleCode ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="percentage" label={t.percentageLabel} error={errors['percentage']}>
            {(props) => (
              <input
                {...props}
                type="number"
                min={0}
                max={100}
                defaultValue={existing?.rolloutPercentage ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="description" label={t.descriptionLabel} error={errors['description']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={300}
                defaultValue={existing?.description ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="reason" label={t.reasonLabel} required error={errors['reason']}>
            {(props) => (
              <input {...props} type="text" maxLength={300} className={ADMIN_INPUT_CLASS} />
            )}
          </AdminField>
        </>
      )}
    </AdminForm>
  );
}
