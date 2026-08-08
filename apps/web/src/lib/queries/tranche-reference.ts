import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Referentiels manquants a `lib/queries/reference.ts` et necessaires aux
 * tranches APPELS AU RESEAU et OPPORTUNITES : outils et langues.
 *
 * Fichier separe pour ne pas modifier un module partage pendant qu'une
 * autre tranche y travaille. Colonnes ENUMEREES, jamais `select('*')`.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export interface ToolOption {
  id: number;
  name: string;
}

export async function loadTools(correlationId: string): Promise<Result<ToolOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tools')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('[ISE] référentiel outils indisponible', { correlationId, code: error.code });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as { id: number; name: string }[];
  return { ok: true, data: rows.map((row) => ({ id: row.id, name: row.name })) };
}

export interface LanguageOption {
  code: string;
  name: string;
}

export async function loadLanguages(correlationId: string): Promise<Result<LanguageOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('languages')
    .select('code, name_fr')
    .order('name_fr', { ascending: true });

  if (error) {
    console.error('[ISE] référentiel langues indisponible', { correlationId, code: error.code });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as { code: string; name_fr: string }[];
  return { ok: true, data: rows.map((row) => ({ code: row.code, name: row.name_fr })) };
}
