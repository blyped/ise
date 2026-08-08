import { toBusinessError, type BusinessError } from '@ise/domain';
import type { ClaimSearchInput } from '@ise/validation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Reclamation de profil (ISE-005 -> ISE-007).
 *
 * Depuis la migration 0028, `authenticated` n'a plus de privilege `SELECT` au
 * niveau table sur `ise_profiles`, et `private.can_see_profile()` renvoie
 * `false` tant que le compte n'est rattache a aucun profil. Un demandeur ne
 * peut donc RIEN lire directement : tout passe par les fonctions RPC de la
 * migration 0029, qui n'exposent que les champs strictement necessaires
 * (MASTER PROMPT §47). Aucun `select('*')` n'apparait ici, et pour cause :
 * aucun `select` du tout.
 */

export interface ClaimableProfileSummary {
  profileId: string;
  displayName: string;
  graduationYear: number | null;
  currentOrganization: string | null;
  /** Indice masque construit en base (`a•••@d•••.com`). Jamais l'adresse. */
  emailHint: string | null;
}

export interface ClaimableProfileDetail extends ClaimableProfileSummary {
  headline: string | null;
  promotionName: string | null;
  currentPosition: string | null;
  currentCity: string | null;
  currentCountry: string | null;
  /** `true` si une adresse historique existe : conditionne la methode e-mail. */
  hasHistoricalEmail: boolean;
}

export type ClaimStatus =
  'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'expired';

export interface MyClaim {
  claimId: string;
  profileId: string;
  status: ClaimStatus;
  claimMethod: string;
  submittedAt: string;
  reviewedAt: string | null;
  /** `true` lorsque l'approbation vient de la verification par e-mail historique. */
  autoApproved: boolean;
  profileDisplayName: string;
  graduationYear: number | null;
}

/** Resultat d'une lecture : soit la donnee, soit une erreur metier traduite. */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

/* ------------------------------------------------------------------ */
/* Conversions — les fonctions RPC renvoient du snake_case non type.   */
/* ------------------------------------------------------------------ */

interface RawSummary {
  profile_id: string;
  display_name: string | null;
  graduation_year: number | null;
  current_organization: string | null;
  email_hint: string | null;
}

interface RawDetail extends RawSummary {
  headline: string | null;
  promotion_name: string | null;
  current_position: string | null;
  current_city: string | null;
  current_country: string | null;
  has_historical_email: boolean | null;
}

interface RawClaim {
  claim_id: string;
  profile_id: string;
  claim_status: string;
  claim_method: string;
  submitted_at: string;
  reviewed_at: string | null;
  auto_approved: boolean | null;
  profile_display_name: string | null;
  graduation_year: number | null;
}

const CLAIM_STATUSES: readonly ClaimStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
  'expired',
];

function toSummary(row: RawSummary): ClaimableProfileSummary {
  return {
    profileId: row.profile_id,
    displayName: row.display_name ?? '',
    graduationYear: row.graduation_year,
    currentOrganization: row.current_organization,
    emailHint: row.email_hint,
  };
}

/* ------------------------------------------------------------------ */
/* ISE-005 — Recherche                                                 */
/* ------------------------------------------------------------------ */

export async function searchClaimableProfiles(
  input: ClaimSearchInput,
  correlationId: string,
): Promise<QueryResult<ClaimableProfileSummary[]>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('search_claimable_profiles', {
    p_last_name: input.lastName,
    p_first_name: input.firstName ?? null,
    p_graduation_year: input.graduationYear ?? null,
  });

  if (error) {
    // Le message brut de PostgreSQL ne sort jamais de cette fonction (D-102).
    console.error('[ISE] recherche de profil reclamable en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as RawSummary[];
  return { ok: true, data: rows.map(toSummary) };
}

/* ------------------------------------------------------------------ */
/* ISE-006 — Recapitulatif d'un profil                                 */
/* ------------------------------------------------------------------ */

export async function getClaimableProfile(
  profileId: string,
  correlationId: string,
): Promise<QueryResult<ClaimableProfileDetail | null>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('get_claimable_profile', {
    p_profile_id: profileId,
  });

  if (error) {
    console.error('[ISE] lecture du profil reclamable en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as RawDetail[];
  const row = rows[0];
  if (!row) return { ok: true, data: null };

  return {
    ok: true,
    data: {
      ...toSummary(row),
      headline: row.headline,
      promotionName: row.promotion_name,
      currentPosition: row.current_position,
      currentCity: row.current_city,
      currentCountry: row.current_country,
      hasHistoricalEmail: row.has_historical_email === true,
    },
  };
}

/* ------------------------------------------------------------------ */
/* ISE-007 — Etat de ma reclamation                                    */
/* ------------------------------------------------------------------ */

export async function loadMyClaim(correlationId: string): Promise<QueryResult<MyClaim | null>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('my_profile_claim');

  if (error) {
    console.error('[ISE] lecture de la reclamation courante en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as RawClaim[];
  const row = rows[0];
  if (!row) return { ok: true, data: null };

  const status = CLAIM_STATUSES.includes(row.claim_status as ClaimStatus)
    ? (row.claim_status as ClaimStatus)
    : 'submitted';

  return {
    ok: true,
    data: {
      claimId: row.claim_id,
      profileId: row.profile_id,
      status,
      claimMethod: row.claim_method,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      autoApproved: row.auto_approved === true,
      profileDisplayName: row.profile_display_name ?? '',
      graduationYear: row.graduation_year,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Referentiel des promotions                                          */
/* ------------------------------------------------------------------ */

/**
 * Annees de promotion REELLEMENT presentes dans le referentiel, du plus
 * recent au plus ancien. Aucune plage n'est fabriquee cote client : si le
 * referentiel est vide, la liste l'est aussi et le filtre disparait
 * (MASTER PROMPT §98 : aucune donnee inventee).
 *
 * `public.promotions` porte la politique `promotions_read_authenticated`
 * (SELECT true, migration 0020) : la lecture directe est legitime ici.
 */
export async function loadGraduationYears(): Promise<number[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('promotions')
    .select('graduation_year')
    .eq('status', 'active')
    .order('graduation_year', { ascending: false });

  if (error || !data) return [];

  const rows = data as unknown as { graduation_year: number }[];
  return [...new Set(rows.map((row) => row.graduation_year))];
}

/* ------------------------------------------------------------------ */
/* Etat du compte courant                                              */
/* ------------------------------------------------------------------ */

/**
 * Un compte deja rattache a un profil n'a plus rien a reclamer (D-20).
 * La verification se fait par `my_profile_claim()` et par la lecture ciblee
 * de `ise_profiles`, colonnes enumerees : depuis 0028, `select('*')` echoue.
 */
export async function accountIsLinkedToProfile(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('ise_profiles')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  return data !== null;
}
