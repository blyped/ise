/**
 * UTILITAIRES CINETPAY — REPRIS TELS QUELS, PAS REECRITS.
 *
 * Source : `_shared/cinetpay/utils.ts`, lui-meme extrait verbatim de
 * l'integration CinetPay v2 DEJA EN SERVICE chez le porteur (Xcollect,
 * `supabase/functions/initiate-cinetpay-payment/index.ts`).
 *
 * POURQUOI RECOPIER PLUTOT QUE REECRIRE : ces quatre fonctions portent des
 * corrections de bogues payees en vrai argent. Les reecrire « proprement »
 * dans le style du depot, ce serait risquer de reintroduire les memes
 * erreurs. Seule la mise en forme (guillemets simples, largeur de ligne) a
 * ete alignee sur Prettier ; AUCUNE expression, AUCUN alias, AUCUN seuil
 * n'a change.
 *
 * Ces fonctions ne lisent aucune variable d'environnement et n'appellent
 * aucun reseau : elles sont pures.
 */

export function asCleanString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Convertit un montant en entier XOF. TRONQUE (jamais d'arrondi) pour ne pas
 * facturer un franc de trop. Gere les decimaux ("300.0") et la virgule FR.
 * Bug historique evite : replace(/[^\d]/g,'') transformait "300.0" en "3000"
 * (x10), ce qui faisait echouer la comparaison de montant.
 * Retourne null si <= 0 ou non numerique.
 */
export function parseAmount(value: unknown): number | null {
  const cleaned = asCleanString(value)
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.trunc(amount);
}

/** Normalise un numero ivoirien au format +225XXXXXXXXXX (requis pour Orange direct_pay). */
export function normalizePhone(value: unknown): string {
  const raw = asCleanString(value);
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('225')) return `+${digits}`;
  if (digits.length === 10) return `+225${digits}`;
  if (raw.startsWith('+')) return raw.replace(/\s/g, '');
  return digits;
}

/** Mappe les libelles operateur vers les codes CinetPay (OM_CI, MTN_CI, MOOV_CI, WAVE_CI). */
export function normalizePaymentMethod(value: unknown): string {
  const raw = asCleanString(value)
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    WAVE: 'WAVE_CI',
    WAVE_CI: 'WAVE_CI',
    OM: 'OM_CI',
    ORANGE: 'OM_CI',
    ORANGE_MONEY: 'OM_CI',
    OM_CI: 'OM_CI',
    MTN: 'MTN_CI',
    MTN_MONEY: 'MTN_CI',
    MTN_CI: 'MTN_CI',
    MOOV: 'MOOV_CI',
    MOOV_MONEY: 'MOOV_CI',
    MOOV_CI: 'MOOV_CI',
  };
  return aliases[raw] ?? raw;
}
