import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  isDonationProvider,
  isDonationStatus,
  type DonationCurrencyRule,
  type DonationStatus,
  type MyDonation,
} from '@/lib/donations/shared';

/**
 * Lectures du module de don. Serveur uniquement (`next/headers`).
 *
 * Toutes passent par la session du membre : la RLS de 0134 fait le tri
 * (un membre ne voit que ses propres dons, `donations.read` voit tout).
 * Aucune de ces fonctions n'ecrit quoi que ce soit.
 */

export type DonationsResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value.trim() : null;
}

function toRule(row: unknown): DonationCurrencyRule | null {
  const record = asRecord(row);
  const currency = asText(record['currency']);
  const provider = record['provider'];
  const exponent = asInteger(record['minor_unit_exponent']);
  const min = asInteger(record['min_amount_minor']);
  const max = asInteger(record['max_amount_minor']);
  const step = asInteger(record['step_minor']);

  if (
    currency === null ||
    !isDonationProvider(provider) ||
    exponent === null ||
    min === null ||
    max === null ||
    step === null
  ) {
    return null;
  }

  const rawPresets = record['preset_amounts'];
  const presets = Array.isArray(rawPresets)
    ? rawPresets.map(asInteger).filter((value): value is number => value !== null && value > 0)
    : [];

  return {
    currency,
    provider,
    minorUnitExponent: exponent,
    minAmountMinor: min,
    maxAmountMinor: max,
    stepMinor: step,
    presetAmounts: presets,
  };
}

/**
 * Bornes, pas et montants proposes, PAR DEVISE.
 *
 * L'ecran affiche exactement ce que `public.start_donation()` revalide :
 * une seule source, pas deux listes qui pourraient diverger. Une lecture en
 * echec renvoie une liste vide — le formulaire s'annonce alors indisponible
 * plutot que de proposer des montants inventes.
 */
export async function loadDonationCurrencyRules(): Promise<DonationCurrencyRule[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('donation_currency_rules')
    .select(
      'currency, provider, minor_unit_exponent, min_amount_minor, max_amount_minor, step_minor, preset_amounts, sort_order',
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !Array.isArray(data)) return [];
  return data.map(toRule).filter((rule): rule is DonationCurrencyRule => rule !== null);
}

function toMyDonation(row: unknown): MyDonation | null {
  const record = asRecord(row);
  const id = asText(record['id']);
  const reference = asText(record['reference']);
  const provider = record['provider'];
  const amount = asInteger(record['amount_minor']);
  const currency = asText(record['currency']);
  const status = record['status'];
  const createdAt = asText(record['created_at']);

  if (
    id === null ||
    reference === null ||
    !isDonationProvider(provider) ||
    amount === null ||
    currency === null ||
    !isDonationStatus(status) ||
    createdAt === null
  ) {
    return null;
  }

  return {
    id,
    reference,
    provider,
    amountMinor: amount,
    currency,
    status,
    confirmedAt: asText(record['confirmed_at']),
    createdAt,
  };
}

/** Les dons du membre courant. La RLS garantit qu'il ne voit que les siens. */
export async function loadMyDonations(limit = 20): Promise<MyDonation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('donations')
    .select('id, reference, provider, amount_minor, currency, status, confirmed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return [];
  return data.map(toMyDonation).filter((donation): donation is MyDonation => donation !== null);
}

/**
 * Etat REEL d'un don, pour la page de retour.
 *
 * Renvoie `null` si la reference n'existe pas ou n'appartient pas au membre.
 * Ce que la page affichera vient d'ici et de nulle part ailleurs : jamais du
 * parametre d'URL, qui n'est qu'une cle de recherche.
 */
export async function loadDonationByReference(
  reference: string,
  correlationId: string,
): Promise<DonationsResult<MyDonation | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_my_donation', { p_reference: reference });

  if (error) return { ok: false, error: toBusinessError(error, correlationId) };

  const rows = Array.isArray(data) ? data : [];
  const first = rows.length > 0 ? toMyDonation(rows[0]) : null;
  return { ok: true, data: first };
}

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

export interface AdminDonationRow {
  readonly id: string;
  readonly reference: string;
  readonly provider: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: DonationStatus;
  readonly isAnonymous: boolean;
  readonly donorName: string | null;
  readonly createdAt: string;
  readonly confirmedAt: string | null;
}

export interface AdminDonationCurrencyTotal {
  readonly currency: string;
  readonly minorUnitExponent: number;
  readonly donationCount: number;
  readonly totalAmountMinor: number;
}

export interface AdminDonationSummary {
  readonly byCurrency: readonly AdminDonationCurrencyTotal[];
  readonly byStatus: Readonly<Record<string, number>>;
}

/**
 * Registre administratif.
 *
 * DEUX REQUETES PLUTOT QU'UNE JOINTURE IMBRIQUEE : le nom du donateur est
 * lu separement dans `ise_profiles`, sous la RLS des profils. Une personne
 * qui detient `donations.read` sans droit de lecture des profils verra donc
 * les montants sans les noms — c'est le comportement voulu, et l'ecran le
 * dit au lieu d'afficher un vide inexplique.
 */
export async function loadAdminDonations(limit = 100): Promise<AdminDonationRow[] | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('donations')
    .select(
      'id, reference, provider, amount_minor, currency, status, is_anonymous, donor_profile_id, created_at, confirmed_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return null;

  const donorIds = Array.from(
    new Set(
      data
        .map((row) => asText(asRecord(row)['donor_profile_id']))
        .filter((value): value is string => value !== null),
    ),
  );

  const names = new Map<string, string>();
  if (donorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('ise_profiles')
      .select('id, display_name, first_name, last_name')
      .in('id', donorIds);

    if (Array.isArray(profiles)) {
      for (const profile of profiles) {
        const record = asRecord(profile);
        const id = asText(record['id']);
        if (id === null) continue;
        const display =
          asText(record['display_name']) ??
          [asText(record['first_name']), asText(record['last_name'])]
            .filter((part): part is string => part !== null)
            .join(' ');
        if (display.length > 0) names.set(id, display);
      }
    }
  }

  const rows: AdminDonationRow[] = [];
  for (const raw of data) {
    const record = asRecord(raw);
    const id = asText(record['id']);
    const reference = asText(record['reference']);
    const provider = asText(record['provider']);
    const amount = asInteger(record['amount_minor']);
    const currency = asText(record['currency']);
    const status = record['status'];
    const createdAt = asText(record['created_at']);

    if (
      id === null ||
      reference === null ||
      provider === null ||
      amount === null ||
      currency === null ||
      !isDonationStatus(status) ||
      createdAt === null
    ) {
      continue;
    }

    const donorId = asText(record['donor_profile_id']);
    rows.push({
      id,
      reference,
      provider,
      amountMinor: amount,
      currency,
      status,
      isAnonymous: record['is_anonymous'] === true,
      donorName: donorId === null ? null : (names.get(donorId) ?? null),
      createdAt,
      confirmedAt: asText(record['confirmed_at']),
    });
  }

  return rows;
}

/** Totaux des dons REELLEMENT confirmes, par devise. Jamais additionnes entre devises. */
export async function loadAdminDonationSummary(): Promise<AdminDonationSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('admin_donation_summary', {});
  if (error) return null;

  const record = asRecord(data);
  const rawByCurrency = record['by_currency'];
  const byCurrency: AdminDonationCurrencyTotal[] = [];

  if (Array.isArray(rawByCurrency)) {
    for (const entry of rawByCurrency) {
      const line = asRecord(entry);
      const currency = asText(line['currency']);
      const exponent = asInteger(line['minor_unit_exponent']);
      const count = asInteger(line['donation_count']);
      const total = asInteger(line['total_amount_minor']);
      if (currency === null || exponent === null || count === null || total === null) continue;
      byCurrency.push({
        currency,
        minorUnitExponent: exponent,
        donationCount: count,
        totalAmountMinor: total,
      });
    }
  }

  const byStatus: Record<string, number> = {};
  const rawByStatus = asRecord(record['by_status']);
  for (const [key, value] of Object.entries(rawByStatus)) {
    const count = asInteger(value);
    if (count !== null) byStatus[key] = count;
  }

  return { byCurrency, byStatus };
}
