import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signedAvatarUrl } from './member-profile';

/**
 * Contexte minimal du membre connecte, pour l'en-tete de l'application.
 *
 * Volontairement independant de `lib/queries/profile.ts` : la tranche
 * RECHERCHE ne doit pas dependre du calendrier de la tranche PROFIL.
 * Ne lit que ce dont la topbar a besoin, colonnes ENUMEREES — depuis la
 * migration 0028, `select('*')` sur `ise_profiles` echoue avec 42501.
 */
export interface ViewerContext {
  profileId: string | null;
  displayName: string;
  contextLine: string | undefined;
  /** `true` si le compte n'est rattache a aucun profil ISE. */
  withoutProfile: boolean;
}

const COLUMNS = 'id, first_name, last_name, display_name, promotion_id';

export async function loadViewerContext(
  userId: string,
  fallbackName: string,
): Promise<ViewerContext> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('ise_profiles')
    .select(COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  const row =
    error || !data
      ? null
      : (data as unknown as {
          id: string;
          first_name: string;
          last_name: string;
          display_name: string | null;
          promotion_id: number | null;
        });

  if (row === null) {
    return {
      profileId: null,
      displayName: fallbackName,
      contextLine: undefined,
      withoutProfile: true,
    };
  }

  let contextLine: string | undefined;
  if (row.promotion_id !== null) {
    const { data: promotion } = await supabase
      .from('promotions')
      .select('program_code, graduation_year')
      .eq('id', row.promotion_id)
      .maybeSingle();
    const promotionRow =
      (promotion as unknown as { program_code: string; graduation_year: number } | null) ?? null;
    if (promotionRow) {
      contextLine = `${promotionRow.program_code} ${promotionRow.graduation_year}`;
    }
  }

  return {
    profileId: row.id,
    displayName: row.display_name ?? `${row.first_name} ${row.last_name}`.trim(),
    contextLine,
    withoutProfile: false,
  };
}

/**
 * URL signee de l'avatar du membre CONNECTE (session courante), pour
 * l'en-tete (`Topbar`, dans `AppShell`).
 *
 * Lecture INDEPENDANTE de `loadViewerContext()` / `loadMemberContext()` —
 * meme logique que `readAdminAccess()` : un affichage d'en-tete ne doit pas
 * dependre du calendrier d'une autre tranche, ni forcer chacun des ~15
 * appelants d'`AppShell` a threader une URL de photo. Reutilise
 * `signedAvatarUrl()` (bucket prive `avatars`, deja utilise par
 * `mon-profil/en-tete`). Un echec de lecture ou de signature, ou l'absence
 * de session/photo, retombe silencieusement sur `undefined` — `AccountMenu`
 * affiche alors les initiales : aucune page ne doit casser pour une photo.
 */
export async function loadViewerAvatarUrl(): Promise<string | undefined> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data, error } = await supabase
    .from('ise_profiles')
    .select('avatar_path')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return undefined;
  const avatarPath = (data as unknown as { avatar_path: string | null }).avatar_path;
  return signedAvatarUrl(avatarPath);
}
