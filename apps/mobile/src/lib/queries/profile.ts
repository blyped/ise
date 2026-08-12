import type { IseProfile, Promotion } from '@ise/db-types';

import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-015 / ISE-016 — Tableau de bord et Mon profil (coquilles mobile).
 *
 * Portage direct de `apps/web/src/lib/queries/profile.ts::loadMemberContext`.
 * La lecture est volontairement identique : memes colonnes explicites, meme
 * RPC pour le score de completion, meme lecture separee de la promotion. Ces
 * deux points ne sont pas un choix de style mais des contraintes de securite
 * qui s'appliquent pareillement au mobile (RLS ne distingue pas le client
 * qui appelle) :
 *
 *  - `ise_profiles` n'accorde plus de privilege `SELECT` au niveau table a
 *    `authenticated` depuis la migration 0028 : un `select('*')` echouerait
 *    (42501). Les colonnes lues doivent rester une liste explicite,
 *    identique a celle deja accordee cote web ;
 *  - `profile_completion` est prive (D-72) : il n'est lisible que via la RPC
 *    `my_profile_completion`, jamais par une colonne selectionnee.
 */
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
  profile_completion: number | null;
};

export type MemberPromotion = Pick<Promotion, 'name' | 'graduation_year' | 'program_code'>;

export interface MemberContext {
  readonly profile: MemberProfile | null;
  readonly promotion: MemberPromotion | null;
  /** `true` si la lecture a echoue : l'ecran affiche alors un etat d'erreur. */
  readonly failed: boolean;
}

const PROFILE_COLUMNS =
  'id, first_name, last_name, display_name, headline, claim_status, verification_status, ' +
  'promotion_id, onboarding_completed_at';

export async function loadMemberContext(userId: string): Promise<MemberContext> {
  const supabase = getSupabaseClient();

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

  const { data: completion } = await supabase.rpc('my_profile_completion');
  const profile: MemberProfile = {
    ...row,
    profile_completion: typeof completion === 'number' ? completion : null,
  };

  if (profile.promotion_id === null) {
    return { profile, promotion: null, failed: false };
  }

  // Lecture separee, comme cote web : `promotions` est un referentiel, pas
  // une donnee membre — elle ne partage ni les colonnes ni les politiques de
  // `ise_profiles`. Un echec ici n'invalide pas le profil deja charge.
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
