'use client';

import { frAdminData } from '@/i18n/admin-data';
import type { ImportColumnMapping } from '@/lib/admin-data/view';
import {
  DEFAULT_TRANSFORM_BY_TARGET,
  IMPORT_TARGET_FIELDS,
  IMPORT_TARGET_LABELS,
  IMPORT_TRANSFORMS,
  IMPORT_TRANSFORM_LABELS,
  suggestTargetField,
} from '@/lib/admin-data/mapping';
import { ADMIN_INPUT_CLASS, AdminForm } from '../_components/AdminForm';
import { saveMappingAction } from './actions';

const t = frAdminData.imports.detail;

/**
 * SA-041 — Mapping colonne source -> champ cible. Chaque colonne du
 * fichier exige une décision explicite (mapper ou ignorer) : la fonction
 * SQL refuse un mapping incomplet. Les propositions sont déduites des
 * en-têtes ; rien n'est enregistré sans validation de l'opérateur.
 */
export function MappingForm({
  batchId,
  columns,
  existing,
  locked,
}: {
  batchId: string;
  columns: string[];
  existing: ImportColumnMapping[];
  locked: boolean;
}) {
  const byColumn = new Map(existing.map((m) => [m.sourceColumn, m]));

  return (
    <AdminForm
      action={saveMappingAction}
      submitLabel={t.mappingSave}
      disabled={locked}
      disabledReason={t.mappingLocked}
    >
      {() => (
        <div className="flex flex-col gap-4">
          {existing.length === 0 ? (
            <p className="text-caption text-text-muted">{t.noMappingYet}</p>
          ) : null}
          <input type="hidden" name="batchId" value={batchId} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="text-caption text-text-muted border-border border-b">
                  <th scope="col" className="py-2 pr-3">
                    {t.mappingColumn}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t.mappingTarget}
                  </th>
                  <th scope="col" className="py-2">
                    {t.mappingTransform}
                  </th>
                </tr>
              </thead>
              <tbody>
                {columns.map((column) => {
                  const current = byColumn.get(column);
                  const suggested = current?.targetField ?? suggestTargetField(column);
                  const defaultTarget =
                    current?.isIgnored === true ? '__ignore__' : (suggested ?? '__ignore__');
                  const suggestedTransform =
                    suggested === null
                      ? undefined
                      : DEFAULT_TRANSFORM_BY_TARGET[
                          suggested as keyof typeof DEFAULT_TRANSFORM_BY_TARGET
                        ];
                  const defaultTransform = current?.transform ?? suggestedTransform ?? 'none';
                  return (
                    <tr key={column} className="border-border border-b last:border-0">
                      <th
                        scope="row"
                        className="text-body-sm text-text-primary py-2 pr-3 font-medium"
                      >
                        {column}
                        <input type="hidden" name="sourceColumn" value={column} />
                      </th>
                      <td className="py-2 pr-3">
                        <label className="sr-only" htmlFor={`target-${column}`}>
                          {t.mappingTarget} {column}
                        </label>
                        <select
                          id={`target-${column}`}
                          name={`target:${column}`}
                          defaultValue={defaultTarget}
                          disabled={locked}
                          className={ADMIN_INPUT_CLASS}
                        >
                          <option value="__ignore__">{t.mappingIgnore}</option>
                          {IMPORT_TARGET_FIELDS.map((field) => (
                            <option key={field} value={field}>
                              {IMPORT_TARGET_LABELS[field]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <label className="sr-only" htmlFor={`transform-${column}`}>
                          {t.mappingTransform} {column}
                        </label>
                        <select
                          id={`transform-${column}`}
                          name={`transform:${column}`}
                          defaultValue={defaultTransform}
                          disabled={locked}
                          className={ADMIN_INPUT_CLASS}
                        >
                          {IMPORT_TRANSFORMS.map((transform) => (
                            <option key={transform} value={transform}>
                              {IMPORT_TRANSFORM_LABELS[transform]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminForm>
  );
}
