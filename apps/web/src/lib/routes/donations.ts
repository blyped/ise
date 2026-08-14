/**
 * Chemins de la tranche FAIRE UN DON (0134).
 *
 * Trois familles, aux regles de securite tres differentes :
 *
 *  1. ESPACE MEMBRE (`/don`, `/don/retour`, `/don/echec`) — session
 *     requise, comme le reste de l'espace membre.
 *
 *  2. NOTIFICATIONS SERVEUR A SERVEUR (`/api/dons/stripe`,
 *     `/api/dons/cinetpay`) — aucune session, jamais : ce sont des appels
 *     machine emis par le prestataire. Leur authenticite ne vient pas d'un
 *     cookie mais d'une SIGNATURE verifiee dans la requete. Elles sont donc
 *     declarees publiques dans `lib/routes.ts`, exactement comme
 *     `/api/cms/revalidation-landing`.
 *
 *  3. PASSERELLE DE RETOUR (`/api/dons/retour`) — publique elle aussi, et
 *     pour une raison precise : CinetPay renvoie le donateur sur
 *     `return_url` par une requete POST INTER-SITES. Les cookies de session
 *     Supabase sont `SameSite=Lax` : ils ne seraient PAS envoyes sur un tel
 *     POST, et le donateur serait rejete vers l'ecran de connexion en plein
 *     retour de paiement. Cette passerelle accepte GET et POST sans
 *     session, ne lit RIEN d'autre que la reference, et redirige en 303
 *     vers `/don/retour` — une navigation GET de premier niveau vers notre
 *     propre origine, ou les cookies repartent normalement.
 *     Elle ne decide d'AUCUN statut : elle ne fait que rediriger.
 */
export const DONATION_ROUTES = {
  /** Ecran de don : choix du montant et de la voie de paiement. */
  home: '/don',
  /** Retour apres passage au guichet. N'affirme jamais un paiement non confirme. */
  return: '/don/retour',
  /** Paiement abandonne ou refuse. */
  failure: '/don/echec',

  /** Notification serveur a serveur de Stripe (signature `Stripe-Signature`). */
  stripeWebhook: '/api/dons/stripe',
  /** Notification serveur a serveur de CinetPay (jeton HMAC `x-token`). */
  cinetpayWebhook: '/api/dons/cinetpay',
  /** Passerelle de retour, cf. commentaire ci-dessus. */
  returnBridge: '/api/dons/retour',
} as const;

/** Nom du parametre portant NOTRE reference de don dans les URL de retour. */
export const DONATION_REFERENCE_PARAM = 'ref';

export function donationReturnRoute(reference: string): string {
  return `${DONATION_ROUTES.return}?${DONATION_REFERENCE_PARAM}=${encodeURIComponent(reference)}`;
}

export function donationFailureRoute(reference: string): string {
  return `${DONATION_ROUTES.failure}?${DONATION_REFERENCE_PARAM}=${encodeURIComponent(reference)}`;
}
