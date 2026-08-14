/**
 * Types et formatage du module de don — PARTIE PURE.
 *
 * Ce fichier ne lit AUCUNE variable d'environnement et n'importe rien du
 * serveur : il est le seul du dossier `lib/donations` qu'un composant
 * client puisse importer sans risque d'entrainer un secret dans le bundle
 * du navigateur.
 */

export type DonationProvider = 'stripe' | 'cinetpay';

export type DonationStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

/**
 * Regle de devise, telle qu'elle est en base (`donation_currency_rules`).
 *
 * POLITIQUE DE DEVISES (0134) : une devise = un prestataire, aucune
 * conversion. CinetPay sert le XOF (Afrique de l'Ouest, mobile money,
 * exposant 0, montant multiple de 5) ; Stripe sert l'EUR (cartes
 * internationales, exposant 2, montants en centimes). Aucun taux de change
 * n'est applique nulle part : nous n'en connaissons aucun qui fasse
 * autorite, et en inventer un fausserait la comptabilite du porteur.
 */
export interface DonationCurrencyRule {
  readonly currency: string;
  readonly provider: DonationProvider;
  readonly minorUnitExponent: number;
  readonly minAmountMinor: number;
  readonly maxAmountMinor: number;
  readonly stepMinor: number;
  readonly presetAmounts: readonly number[];
}

export interface MyDonation {
  readonly id: string;
  readonly reference: string;
  readonly provider: DonationProvider;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: DonationStatus;
  readonly confirmedAt: string | null;
  readonly createdAt: string;
}

export function isDonationProvider(value: unknown): value is DonationProvider {
  return value === 'stripe' || value === 'cinetpay';
}

export function isDonationStatus(value: unknown): value is DonationStatus {
  return (
    value === 'pending' ||
    value === 'processing' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

/**
 * Montant en unite minimale -> chaine lisible.
 * `exponent` vient de la base ; il n'est JAMAIS devine ici.
 */
export function formatDonationAmount(
  amountMinor: number,
  currency: string,
  exponent: number,
): string {
  const value = amountMinor / 10 ** exponent;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(value);
  } catch {
    // Devise inconnue d'Intl : on affiche le nombre et le code, plutot que rien.
    return `${value.toLocaleString('fr-FR')} ${currency}`;
  }
}

/**
 * Saisie libre du donateur -> entier en unite minimale.
 *
 * Renvoie `null` des que la saisie n'est pas exploitable. Ce controle est
 * un CONFORT D'INTERFACE : le montant qui fait autorite est recalcule par
 * `public.start_donation()` en base, qui refuse tout ce qui sort des
 * bornes, du pas ou de la devise. Rien de ce qui est calcule ici n'est cru
 * sur parole cote serveur.
 */
export function parseAmountToMinor(raw: string, exponent: number): number | null {
  const normalized = raw.replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,4})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  const minor = Math.round(value * 10 ** exponent);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** Bornes et pas respectes ? Meme remarque : la base tranche pour de bon. */
export function amountMatchesRule(amountMinor: number, rule: DonationCurrencyRule): boolean {
  return (
    Number.isSafeInteger(amountMinor) &&
    amountMinor >= rule.minAmountMinor &&
    amountMinor <= rule.maxAmountMinor &&
    amountMinor % rule.stepMinor === 0
  );
}
