import type { IseProfile, Promotion } from '@ise/db-types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type MemberProfile = Pick<
  IseProfile,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'display_name'
  | 'headline'
  | 'claim_status'
  | 'verification_status'
  | 'promotion_id'
  | 'onboarding_completed_at'
> & {
  /**
   * Score de completion. Lu par RPC et non par `select`, car la colonne
   * `ise_profiles.profile_completion` a ete revoquee au niveau colonne pour
   * `authenticated` : le score est prive et ne doit atteindre personne d'autre
   * que son proprietaire (decision D-72, migration 0028).
   */
  profile_completion: number | null;
};

export type MemberPromotion = Pick<Promotion, 'name' | 'graduation_year' | 'program_code'>;

export interface MemberContext {
  profile: MemberProfile | null;
  promotion: MemberPromotion | null;
  /** `true` si la lecture a echoue : l'ecran affiche alors un `ErrorState`. */
  failed: boolean;
}

/**
 * Colonnes enumerees explicitement : depuis la migration 0028, `authenticated`
 * n'a plus de privilege `SELECT` au niveau table sur `ise_profiles`. Un
 * `select('*')` echouerait avec le code 42501. Toute colonne ajoutee a la table
 * doit etre explicitement accordee dans la migration qui la cree.
 */
const PROFILE_COLUMNS =
  'id, first_name, last_name, display_name, headline, claim_status, verification_status, ' +
  'promotion_id, onboarding_completed_at';

/**
 * Lit le profil ISE rattache au compte connecte, et sa promotion.
 *
 * Les types generes ne sont pas encore disponibles (`@ise/db-types` reste
 * permissif tant que `supabase gen types` n'a pas ete execute) : la ligne est
 * donc convertie explicitement vers l'alias metier ecrit a la main.
 *
 * Aucune valeur n'est inventee : si le compte n'est rattache a aucun profil,
 * la fonction renvoie `null` et l'ecran le dit.
 */
export async function loadMemberContext(userId: string): Promise<MemberContext> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('ise_profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return { profile: null, promotion: null, failed: true };
  }

  const row = (data as unknown as Omit<MemberProfile, 'profile_completion'> | null) ?? null;
  if (!row) {
    return { profile: null, promotion: null, failed: false };
  }

  // Score de completion : lisible uniquement par son proprietaire, via RPC.
  // Une lecture en echec ne doit pas casser l'ecran : on affiche « inconnu ».
  const { data: completion } = await supabase.rpc('my_profile_completion');
  const profile: MemberProfile = {
    ...row,
    profile_completion: typeof completion === 'number' ? completion : null,
  };

  if (profile.promotion_id === null) {
    return { profile, promotion: null, failed: false };
  }

  const { data: promotionRow, error: promotionError } = await supabase
    .from('promotions')
    .select('name, graduation_year, program_code')
    .eq('id', profile.promotion_id)
    .maybeSingle();

  if (promotionError) {
    return { profile, promotion: null, failed: false };
  }

  return {
    profile,
    promotion: (promotionRow as unknown as MemberPromotion | null) ?? null,
    failed: false,
  };
}
