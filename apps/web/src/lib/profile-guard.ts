import { redirect } from 'next/navigation';
import { BUSINESS_ERRORS } from '@ise/domain';
import { ROUTES } from '@/lib/routes';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProfileHeader, type ProfileHeader } from '@/lib/queries/profile-sections';

export interface ProfileContextOk {
  ok: true;
  userId: string;
  profile: ProfileHeader;
  correlationId: string;
}

export interface ProfileContextFailed {
  ok: false;
  correlationId: string;
  message: string;
  /** `true` lorsque le compte existe mais n'est rattache a aucun profil. */
  noProfile: boolean;
}

export type ProfileContext = ProfileContextOk | ProfileContextFailed;

/**
 * Contexte commun aux ecrans ISE-016 -> ISE-023.
 *
 * Un compte sans profil n'est pas une erreur technique : c'est un etat
 * reel du produit (creer un compte ne cree pas un profil ISE). L'ecran le
 * dit et renvoie vers la reclamation, il n'affiche pas une page vide.
 */
export async function requireProfile(): Promise<ProfileContext> {
  const correlationId = newCorrelationId();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense en profondeur : le middleware a deja filtre, on ne s'y fie pas seul.
  if (!user) redirect(ROUTES.sessionExpired);

  const result = await loadProfileHeader(user.id, correlationId);
  if (!result.ok) {
    return { ok: false, correlationId, message: result.error.userMessage, noProfile: false };
  }
  if (result.data === null) {
    return { ok: false, correlationId, message: BUSINESS_ERRORS.not_found, noProfile: true };
  }

  return { ok: true, userId: user.id, profile: result.data, correlationId };
}
