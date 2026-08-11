import { BUSINESS_ERRORS } from '@ise/domain';

import { fr } from '../i18n/fr';

interface SupabaseLikeError {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}

/**
 * Traduit une erreur d'authentification Supabase en message metier francais.
 * Meme logique que `apps/web/src/lib/auth-errors.ts` (ISE-001) : aucune
 * chaine renvoyee par le fournisseur n'est affichee telle quelle (D-102).
 */
export function authErrorMessage(error: SupabaseLikeError | null): string {
  const code = error?.code;

  switch (code) {
    case 'invalid_credentials':
    case 'invalid_grant':
      return fr.auth.signIn.invalidCredentials;
    case 'email_not_confirmed':
      return fr.auth.signIn.emailNotConfirmed;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return BUSINESS_ERRORS.rate_limited;
    case 'session_not_found':
    case 'refresh_token_not_found':
      return BUSINESS_ERRORS.not_authenticated;
    default:
      break;
  }

  if (error?.status === 429) return fr.auth.signIn.tooManyAttempts;
  if (error?.status === 400) return fr.auth.signIn.invalidCredentials;

  return BUSINESS_ERRORS.unknown;
}
