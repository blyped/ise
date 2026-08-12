import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-040 — Mes relations (coquille mobile).
 *
 * Portage direct des lectures RPC de `apps/web/src/lib/queries/network.ts` :
 * `list_my_connections` (migration 0039) et `my_network_summary` (meme
 * migration). Comme sur le web, AUCUN `select` n'est fait sur `ise_profiles`
 * ni sur `connections` : la carte de profil et le compteur sont composes en
 * base, jamais reconstitues cote client (MASTER PROMPT §47). Ce module ne
 * retient qu'un sous-ensemble de champs de la carte — celui affichable sur
 * une liste mobile — le reste (competences, disponibilites…) n'est pas
 * encore utile a cette premiere tranche.
 *
 * Pagination : simple « charger la suite » sur le curseur keyset renvoye par
 * la RPC (D-44), sans scellement cote client — contrairement au web, il n'y
 * a pas de serveur intercalé ici pour sceller/desceller un jeton opaque : le
 * curseur transite tel quel entre l'app et Supabase, sous le meme RLS que
 * toute autre requete authentifiee.
 */

export interface NetworkProfileCard {
  readonly profileId: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly currentPosition: string | null;
  readonly currentOrganization: string | null;
  readonly currentCity: string | null;
  readonly currentCountry: string | null;
  readonly promotionLabel: string | null;
}

export interface ConnectionRow {
  readonly profile: NetworkProfileCard;
  readonly connectedAt: string | null;
  /** Code de `connections.context`, jamais un libelle invente. */
  readonly context: string | null;
}

export interface ConnectionsPage {
  readonly rows: readonly ConnectionRow[];
  /** `null` = fin de liste. */
  readonly nextCursor: string | null;
}

export interface NetworkSummary {
  readonly connections: number;
  readonly promotions: number;
  readonly countries: number;
  readonly availableToHelp: number;
}

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

function toProfileCard(value: unknown): NetworkProfileCard | null {
  const raw = asObject(value);
  const profileId = str(raw['profile_id']);
  if (profileId === null) return null;
  const promotion = asObject(raw['promotion']);

  return {
    profileId,
    displayName: str(raw['display_name']) ?? '',
    headline: str(raw['headline']),
    currentPosition: str(raw['current_position']),
    currentOrganization: str(raw['current_organization']),
    currentCity: str(raw['current_city']),
    currentCountry: str(raw['current_country']),
    promotionLabel: str(promotion['label']),
  };
}

export interface ConnectionsResult {
  readonly page: ConnectionsPage | null;
  readonly failed: boolean;
}

export async function loadConnections(cursor: string | null): Promise<ConnectionsResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('list_my_connections', {
    p_query: null,
    p_cursor: cursor,
    p_limit: 20,
  });

  if (error) {
    return { page: null, failed: true };
  }

  const raw = asObject(data);
  const rows: ConnectionRow[] = asArray(raw['rows']).flatMap((entry) => {
    const profile = toProfileCard(entry);
    if (profile === null) return [];
    const item = asObject(entry);
    return [
      {
        profile,
        connectedAt: str(item['connected_at']),
        context: str(item['context']),
      },
    ];
  });

  return { page: { rows, nextCursor: str(raw['next_cursor']) }, failed: false };
}

export interface NetworkSummaryResult {
  readonly summary: NetworkSummary | null;
  readonly failed: boolean;
}

export async function loadNetworkSummary(): Promise<NetworkSummaryResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('my_network_summary');

  if (error) {
    return { summary: null, failed: true };
  }

  const raw = asObject(data);
  return {
    summary: {
      connections: num(raw['connections']) ?? 0,
      promotions: num(raw['promotions']) ?? 0,
      countries: num(raw['countries']) ?? 0,
      availableToHelp: num(raw['available_to_help']) ?? 0,
    },
    failed: false,
  };
}
