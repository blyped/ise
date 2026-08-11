import type { IseProfile } from '@ise/db-types';

import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-015 — Tableau de bord (coquille mobile).
 *
 * Portage direct de `apps/web/src/lib/queries/profile.ts::loadMemberContext`.
 * La lecture est volontairement identique : memes colonnes explicites, meme
 * RPC pour le score de completion. Les deux points ne sont pas un choix de
 * style mais des contraintes de securite qui s'appliquent pareillement au
 * mobile (RLS ne distingue pas le client qui appelle) :
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

export interface MemberContext {
  readonly profile: MemberProfile | null;
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
    return { profile: null, failed: true };
  }

  const row = (data as unknown as Omit<MemberProfile, 'profile_completion'> | null) ?? null;
  if (!row) {
    return { profile: null, failed: false };
  }

  const { data: completion } = await supabase.rpc('my_profile_completion');
  const profile: MemberProfile = {
    ...row,
    profile_completion: typeof completion === 'number' ? completion : null,
  };

  return { profile, failed: false };
}
