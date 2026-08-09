'use server';

import { redirect } from 'next/navigation';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import { failure, type FormState } from '@/lib/form-state';
import { checkAdminDataPermission } from '@/lib/admin-data/permissions';
import { adminErrorMessage, toAdminError } from '@/lib/admin-data/errors';
import { adminRpc } from '@/lib/admin-data/rpc';
import {
  MAX_IMPORT_FILE_BYTES,
  detectImportFormat,
  fileChecksum,
  parseImportFile,
} from '@/lib/admin-data/files';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { importDetailRoute } from '@/lib/routes/admin-data';

const IMPORTS_BUCKET = 'admin-imports';

/**
 * SA-039/SA-040 — Téléversement d'un fichier d'annuaire (étapes « upload »
 * et « staging » du MASTER PROMPT §37).
 *
 * CE QUI EST RÉELLEMENT FAIT, dans l'ordre :
 *   1. parse serveur du fichier (CSV/XLSX, Windows-1252 accepté) ;
 *   2. empreinte SHA-256 -> `admin_create_import_batch` (0080) refuse un
 *      fichier déjà chargé : l'idempotence est portée par la base ;
 *   3. dépôt de l'ORIGINAL tel quel dans le bucket privé `admin-imports`
 *      (0027, permission imports.execute exigée par la politique) ;
 *   4. `admin_stage_import_rows` : chaque ligne brute part en
 *      `private.import_rows.raw_source_data`, jamais retouchée.
 *
 * AUCUN compte utilisateur n'est créé ici ni plus tard dans le
 * protocole : l'import produit des profils référencés (D-104).
 */
export async function uploadImportAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await checkAdminDataPermission('imports.execute');
  if (access === null) {
    return failure(adminErrorMessage('not_authorized'), correlationId);
  }

  const sourceName = String(formData.get('sourceName') ?? '').trim();
  if (sourceName.length === 0) {
    return failure(frAdminData.common.loadError, correlationId, {
      sourceName: frAdminData.imports.new.sourceName,
    });
  }
  const sourceDateRaw = String(formData.get('sourceDate') ?? '').trim();
  const sourceDate = /^\d{4}-\d{2}-\d{2}$/.test(sourceDateRaw) ? sourceDateRaw : null;
  const isPilot = formData.get('isPilot') === 'on';
  const pilotLabel = String(formData.get('pilotLabel') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return failure(adminErrorMessage('file_empty'), correlationId, {
      file: adminErrorMessage('file_empty'),
    });
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return failure(adminErrorMessage('file_too_large'), correlationId, {
      file: adminErrorMessage('file_too_large'),
    });
  }
  const format = detectImportFormat(file.name);
  if (format === null) {
    return failure(adminErrorMessage('file_format_unsupported'), correlationId, {
      file: adminErrorMessage('file_format_unsupported'),
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseImportFile(file.name, bytes);
  if (!parsed.ok) {
    return failure(adminErrorMessage(parsed.error), correlationId, {
      file: adminErrorMessage(parsed.error),
    });
  }

  const checksum = fileChecksum(bytes);

  // 2. Création du lot — la base refuse une empreinte déjà connue.
  const created = await adminRpc(
    'admin_create_import_batch',
    {
      p_source_name: sourceName,
      p_original_filename: file.name.slice(0, 200),
      p_file_format: parsed.format,
      p_source_date: sourceDate,
      p_file_checksum: checksum,
      p_is_pilot: isPilot,
      p_pilot_label: isPilot ? (pilotLabel ?? frAdminData.imports.new.isPilot) : null,
      p_notes: notes,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => (typeof payload === 'string' ? payload : ''),
  );
  if (!created.ok) return failure(created.error.userMessage, correlationId);
  const batchId = created.data;

  // 3. Conservation de l'original, tel quel, dans le bucket privé.
  const supabase = await createSupabaseServerClient();
  const storagePath = `${batchId}/${encodeURIComponent(file.name.slice(0, 120))}`;
  const uploaded = await supabase.storage.from(IMPORTS_BUCKET).upload(storagePath, bytes, {
    contentType: file.type === '' ? 'application/octet-stream' : file.type,
    upsert: false,
  });
  if (uploaded.error !== null) {
    console.error('[ISE] dépôt du fichier d’import en échec', {
      correlationId,
      code: uploaded.error.message,
    });
    const error = toAdminError({ message: 'file_unreadable' }, correlationId);
    return failure(error.userMessage, correlationId);
  }

  // 4. Staging des lignes brutes.
  const staged = await adminRpc(
    'admin_stage_import_rows',
    {
      p_batch_id: batchId,
      p_storage_path: storagePath,
      p_rows: parsed.rows,
      p_correlation_id: correlationId,
    },
    correlationId,
    (payload) => payload,
  );
  if (!staged.ok) return failure(staged.error.userMessage, correlationId);

  redirect(importDetailRoute(batchId));
}
