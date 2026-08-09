'use client';

import { frAdminData } from '@/i18n/admin-data';
import { ADMIN_INPUT_CLASS, AdminField, AdminForm } from '../_components/AdminForm';
import { uploadImportAction } from './actions';

const t = frAdminData.imports.new;

export function UploadForm() {
  return (
    <AdminForm action={uploadImportAction} submitLabel={t.submit} multipart>
      {(errors) => (
        <>
          <AdminField
            name="file"
            label={t.fileLabel}
            hint={t.fileHint}
            required
            error={errors['file']}
          >
            {(props) => (
              <input
                {...props}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>

          <AdminField name="sourceName" label={t.sourceName} required error={errors['sourceName']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={160}
                placeholder={t.sourceNamePlaceholder}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>

          <AdminField name="sourceDate" label={t.sourceDate} error={errors['sourceDate']}>
            {(props) => <input {...props} type="date" className={ADMIN_INPUT_CLASS} />}
          </AdminField>

          <AdminField name="isPilot" label={t.isPilot} error={errors['isPilot']}>
            {(props) => (
              <input
                id={props.id}
                name={props.name}
                aria-describedby={props['aria-describedby']}
                type="checkbox"
                className="border-border h-5 w-5 rounded"
              />
            )}
          </AdminField>

          <AdminField name="pilotLabel" label={t.pilotLabel} error={errors['pilotLabel']}>
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={80}
                placeholder={t.pilotPlaceholder}
                className={ADMIN_INPUT_CLASS}
              />
            )}
          </AdminField>

          <AdminField name="notes" label={t.notes} error={errors['notes']}>
            {(props) => (
              <textarea {...props} rows={3} maxLength={1000} className={ADMIN_INPUT_CLASS} />
            )}
          </AdminField>
        </>
      )}
    </AdminForm>
  );
}
