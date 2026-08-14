import { donationEnv } from '@/lib/env';
import type { DonationProvider } from './shared';

/**
 * Disponibilite du module de don — SERVEUR UNIQUEMENT.
 *
 * Ce module lit des secrets : il ne doit jamais etre importe par un
 * composant client. Les ecrans recoivent un simple booleen calcule ici,
 * jamais l'objet de configuration.
 *
 * REGLE : un prestataire dont il manque NE SERAIT-CE QU'UNE variable est
 * INDISPONIBLE. Une configuration a moitie posee ferait echouer le
 * paiement en plein parcours, ce qui est bien pire que de ne pas proposer
 * la voie du tout.
 */
export interface DonationAvailability {
  readonly stripe: boolean;
  readonly cinetpay: boolean;
  /** `true` des qu'AU MOINS une voie de paiement est reellement utilisable. */
  readonly any: boolean;
}

export function donationAvailability(): DonationAvailability {
  const env = donationEnv();
  const stripe = env.stripe !== null;
  const cinetpay = env.cinetpay !== null;
  return { stripe, cinetpay, any: stripe || cinetpay };
}

/**
 * `true` si l'entree de menu « Faire un don » doit exister.
 *
 * MASTER PROMPT §113 — rien de decoratif : sans aucune voie de paiement
 * configuree, l'entree disparait plutot que de conduire a un ecran mort.
 */
export function isDonationModuleAvailable(): boolean {
  return donationAvailability().any;
}

export function isProviderAvailable(provider: DonationProvider): boolean {
  const availability = donationAvailability();
  return provider === 'stripe' ? availability.stripe : availability.cinetpay;
}
