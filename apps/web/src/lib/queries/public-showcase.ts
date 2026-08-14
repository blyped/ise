import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Lecture de la vitrine publique du membre (révision D-135, migration 0120).
 *
 * `ise_profiles` : colonnes énumérées, jamais `select('*')` (0028). Les six
 * colonnes lues ici ont été explicitement GRANT-ées en SELECT à
 * `authenticated` par la migration 0120 ; les colonnes de portrait sont en
 * lecture seule pour le membre — leur écriture passe par les RPC
 * `set_my_public_photo()` / `clear_my_public_photo()`.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

const SHOWCASE_COLUMNS =
  'id, public_summary, allow_public_feature, allow_public_photo, ' +
  'public_photo_path, public_photo_alt, public_photo_width, public_photo_height, ' +
  'public_photo_set_at';

export interface PublicShowcase {
  profileId: string;
  publicSummary: string | null;
  allowPublicFeature: boolean;
  allowPublicPhoto: boolean;
  photoPath: string | null;
  photoAlt: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  photoSetAt: string | null;
}

export async function loadPublicShowcase(
  profileId: string,
  correlationId: string,
): Promise<Result<PublicShowcase>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('ise_profiles')
    .select(SHOWCASE_COLUMNS)
    .eq('id', profileId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { ok: false, error: toBusinessError(error, correlationId) };

  const row = (data ?? null) as unknown as Record<string, unknown> | null;
  if (!row) {
    return { ok: false, error: toBusinessError(new Error('not_found'), correlationId) };
  }

  return {
    ok: true,
    data: {
      profileId: String(row['id']),
      publicSummary: (row['public_summary'] as string | null) ?? null,
      allowPublicFeature: row['allow_public_feature'] === true,
      allowPublicPhoto: row['allow_public_photo'] === true,
      photoPath: (row['public_photo_path'] as string | null) ?? null,
      photoAlt: (row['public_photo_alt'] as string | null) ?? null,
      photoWidth: (row['public_photo_width'] as number | null) ?? null,
      photoHeight: (row['public_photo_height'] as number | null) ?? null,
      photoSetAt: (row['public_photo_set_at'] as string | null) ?? null,
    },
  };
}
