import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-055 — Opportunités (coquille mobile).
 *
 * Portage direct de `list_opportunities` (migration 0056 — le fichier porte
 * encore l'en-tete "0053_opportunities_api" mais c'est la seule definition
 * en base), telle qu'appelee par `apps/web/src/lib/queries/opportunities.ts`.
 *
 * Cette premiere tranche mobile se limite au scope `all` / statut `open` —
 * « les offres ouvertes », sans l'onglet « Pour vous » (qui suppose un
 * moteur de matching déjà alimenté) ni les filtres avancés du web : c'est le
 * choix explicite du brief (liste simple titre/type/statut). Les colonnes
 * lues restent un sous-ensemble volontaire de `private.opportunity_card()`.
 */

export interface OpportunityCard {
  readonly opportunityId: string;
  readonly opportunityType: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: string;
  readonly organization: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly remoteAllowed: boolean;
  readonly publishedAt: string | null;
}

export interface OpportunitiesPage {
  readonly rows: readonly OpportunityCard[];
  /** `null` = fin de liste. */
  readonly nextCursor: string | null;
}

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const bool = (value: unknown): boolean => value === true;

function toOpportunityCard(value: unknown): OpportunityCard | null {
  const raw = asObject(value);
  const opportunityId = str(raw['opportunity_id']);
  if (opportunityId === null) return null;

  return {
    opportunityId,
    opportunityType: str(raw['opportunity_type']) ?? 'job',
    title: str(raw['title']) ?? '',
    summary: str(raw['summary']),
    status: str(raw['status']) ?? 'draft',
    organization: str(raw['organization']),
    city: str(raw['city']),
    country: str(raw['country']),
    remoteAllowed: bool(raw['remote_allowed']),
    publishedAt: str(raw['published_at']),
  };
}

export interface OpportunitiesResult {
  readonly page: OpportunitiesPage | null;
  readonly failed: boolean;
}

export async function loadOpportunities(cursor: string | null): Promise<OpportunitiesResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('list_opportunities', {
    p_scope: 'all',
    p_query: null,
    p_opportunity_type: null,
    p_sector_id: null,
    p_country_code: null,
    p_experience_level: null,
    p_remote_only: false,
    p_new_graduates: false,
    p_status: 'open',
    p_cursor: cursor,
    p_limit: 20,
  });

  if (error) {
    return { page: null, failed: true };
  }

  const raw = asObject(data);
  const rows: OpportunityCard[] = asArray(raw['rows']).flatMap((entry) => {
    const card = toOpportunityCard(entry);
    return card === null ? [] : [card];
  });

  return { page: { rows, nextCursor: str(raw['next_cursor']) }, failed: false };
}
