'use client';

import { frAdminData } from '@/i18n/admin-data';
import type { MaintenanceWindowItem } from '@/lib/admin-data/view';
import {
  ADMIN_INPUT_CLASS,
  AdminActionButton,
  AdminField,
  AdminForm,
} from '../imports/_components/AdminForm';
import { saveMaintenanceAction, transitionMaintenanceAction } from './actions';

const t = frAdminData.settings.maintenance;

/** Conversion ISO -> valeur `datetime-local` (heure locale du poste). */
function toLocalInput(iso: string | null): string {
  if (iso === null) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MaintenanceForm({ existing }: { existing?: MaintenanceWindowItem | undefined }) {
  return (
    <AdminForm
      action={saveMaintenanceAction}
      submitLabel={existing === undefined ? t.newWindow : frAdminData.settings.confirmSave}
    >
      {(errors) => (
        <>
          {existing !== undefined ? <input type="hidden" name="id" value={existing.id} /> : null}
          <AdminField name="title" label={t.titleLabel} required error={errors['title']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={160}
                defaultValue={existing?.title ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField name="startsAt" label={t.startsLabel} required error={errors['startsAt']}>
              {(props) => (
                <input
                  {...props}
                  type="datetime-local"
                  defaultValue={toLocalInput(existing?.startsAt ?? null)}
                  className={ADMIN_INPUT_CLASS}
                />
              )}
            </AdminField>
            <AdminField name="endsAt" label={t.endsLabel} required error={errors['endsAt']}>
              {(props) => (
                <input
                  {...props}
                  type="datetime-local"
                  defaultValue={toLocalInput(existing?.endsAt ?? null)}
                  className={ADMIN_INPUT_CLASS}
                />
              )}
            </AdminField>
          </div>
          <AdminField name="scope" label={t.scopeLabel} error={errors['scope']}>
            {(props) => (
              <select
                {...props}
                defaultValue={existing?.affectedScope ?? 'all'}
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
          <AdminField name="isReadOnly" label={t.readOnlyLabel} error={errors['isReadOnly']}>
            {(props) => (
              <input
                id={props.id}
                name={props.name}
                aria-describedby={props['aria-describedby']}
                type="checkbox"
                defaultChecked={existing?.isReadOnly === true}
                className="border-border h-5 w-5 rounded"
              />
            )}
          </AdminField>
          <AdminField
            name="bannerMessage"
            label={t.bannerLabel}
            hint={t.bannerHint}
            error={errors['bannerMessage']}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={240}
                defaultValue={existing?.bannerMessage ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField name="description" label={t.descriptionLabel} error={errors['description']}>
            {(props) => (
              <textarea
                {...props}
                rows={2}
                maxLength={1000}
                defaultValue={existing?.description ?? ''}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>
          <AdminField
            name="reason"
            label={frAdminData.settings.reasonLabel}
            required
            error={errors['reason']}
          >
            {(props) => (
              <input {...props} type="text" maxLength={300} className={ADMIN_INPUT_CLASS} />
            )}
          </AdminField>
        </>
      )}
    </AdminForm>
  );
}

export function MaintenanceTransitions({ window }: { window: MaintenanceWindowItem }) {
  return (
    <div className="flex flex-wrap gap-3">
      {window.status === 'scheduled' ? (
        <AdminActionButton
          action={transitionMaintenanceAction}
          label={t.start}
          hidden={{ id: window.id, transition: 'start' }}
          variant="primary"
        />
      ) : null}
      {window.status === 'in_progress' ? (
        <AdminActionButton
          action={transitionMaintenanceAction}
          label={t.complete}
          hidden={{ id: window.id, transition: 'complete' }}
          variant="primary"
        />
      ) : null}
      {window.status === 'scheduled' || window.status === 'in_progress' ? (
        <AdminActionButton
          action={transitionMaintenanceAction}
          label={t.cancel}
          hidden={{ id: window.id, transition: 'cancel' }}
          variant="danger"
        />
      ) : null}
    </div>
  );
}
