import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MutationResult } from './mutations';

/**
 * CMS-013 (0133) — ORGANISATIONS AFFICHEES SUR LA PAGE D'ACCUEIL.
 *
 * Module autonome, sur le patron de `landing-queue.ts` : il transporte les
 * trois fonctions de la migration 0133 qui concernent la section « logos »,
 * sans faire grossir `queries.ts` ni `mutations.ts`.
 *
 * POURQUOI UNE TABLE EDITORIALE PLUTOT QU'UN CALCUL — le raisonnement complet
 * est dans l'en-tete de la migration ; en deux lignes : la demande est « que
 * l'admin seul mettra », un calcul sur `ise_profiles.current_organization_id`
 * publierait le logo de tout employeur saisi par un membre sans que personne
 * l'ait valide, et une organisation n'employant qu'un ISE designerait
 * indirectement une personne sur une page publique.
 *
 * ECRITURES. Elles passent toutes par les fonctions `SECURITY DEFINER` de
 * 0133 (`set_landing_organization`, `remove_landing_organization`) : la table
 * n'a AUCUNE politique RLS d'insertion, de mise a jour ni de suppression.
 * Ecrire directement dedans est donc impossible, y compris depuis ce module.
 */

export interface CmsLandingOrganizationRow {
  organizationId: string;
  organizationName: string;
  /** Media de la mediatheque publique, ou `null` = logo de la fiche organisation. */
  mediaId: string | null;
  displayOrder: number;
  isPublished: boolean;
  /**
   * `true` si un logo est REELLEMENT affichable : media de la mediatheque, ou
   * `organizations.logo_path` resolu dans la mediatheque. La base pose la
   * meme question que la projection publique, pour que l'ecran puisse le dire
   * AVANT publication plutot que de laisser decouvrir une absence.
   */
  logoReady: boolean;
  updatedAt: string;
}

export type LandingOrganizationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: BusinessError };

function organizationFailure<T>(
  raw: unknown,
  correlationId: string,
  what: string,
): LandingOrganizationResult<T> {
  const code = (raw as { code?: string } | null)?.code;
  console.error('[ISE] organisations de la page d’accueil : échec', { correlationId, what, code });
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

type Row = Record<string, unknown>;

const asRow = (value: unknown): Row =>
  typeof value === 'object' && value !== null ? (value as Row) : {};
const asRows = (value: unknown): Row[] => (Array.isArray(value) ? value.map(asRow) : []);
const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const nstr = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Lecture de l'ecran CMS-013. Exige `cms.read`, verifie en base. */
export async function loadCmsLandingOrganizations(
  correlationId: string,
): Promise<LandingOrganizationResult<readonly CmsLandingOrganizationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_cms_landing_organizations');
  if (error) return organizationFailure(error, correlationId, 'list_cms_landing_organizations');

  return {
    ok: true,
    data: asRows(data).map((row) => ({
      organizationId: str(row['organization_id']),
      organizationName: str(row['organization_name']),
      mediaId: nstr(row['media_id']),
      displayOrder: num(row['display_order']),
      isPublished: row['is_published'] === true,
      logoReady: row['logo_ready'] === true,
      updatedAt: str(row['updated_at']),
    })),
  };
}

/**
 * Ajoute ou met a jour une organisation. La fonction de base est un `upsert`
 * sur `organization_id` : le meme appel sert a inscrire une organisation et a
 * corriger son logo, son rang ou sa publication.
 */
export async function setLandingOrganization(
  organizationId: string,
  mediaId: string | null,
  displayOrder: number,
  isPublished: boolean,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_landing_organization', {
    p_organization_id: organizationId,
    p_media_id: mediaId,
    p_display_order: displayOrder,
    p_is_published: isPublished,
  });
  if (error) return organizationFailure(error, correlationId, 'set_landing_organization');
  return { ok: true, data: undefined };
}

/**
 * Retire une organisation de la page d'accueil. L'organisation elle-meme
 * n'est pas touchee : c'est une donnee de referentiel, pas un contenu de
 * vitrine.
 */
export async function removeLandingOrganization(
  organizationId: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('remove_landing_organization', {
    p_organization_id: organizationId,
  });
  if (error) return organizationFailure(error, correlationId, 'remove_landing_organization');
  return { ok: true, data: undefined };
}
