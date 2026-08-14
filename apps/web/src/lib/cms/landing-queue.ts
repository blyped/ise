import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * FILE DE PASSAGE DES ENCARTS « À LA UNE DU RÉSEAU » (0121).
 *
 * Ce module ne crée aucun concept nouveau côté application : il transporte
 * les quatre fonctions de la migration 0121, qui s'appuient elles-mêmes sur
 * les épinglages datés déjà portés par `cms_content_overrides` depuis 0057.
 *
 * FRONTIÈRE (D-128) : la file pilote UNIQUEMENT l'exposition sur la vitrine
 * — position dans l'encart et `landing_visibility`. Elle n'écrit jamais
 * `news.editorial_status`, `events.status` ni `opportunities.status`. Un
 * article encore en brouillon reste invisible même programmé ; l'écran le
 * DIT (`estPret`) plutôt que de laisser découvrir le trou le jour J.
 */

export type LandingQueueSection = 'news' | 'events' | 'opportunities';
export type LandingQueueEntityType = 'news' | 'event' | 'opportunity';
export type LandingQueueState = 'en_cours' | 'a_venir' | 'termine';

export interface LandingQueueEntry {
  id: string;
  sectionKey: LandingQueueSection;
  entityType: LandingQueueEntityType;
  entityId: string;
  /** Titre du contenu visé, `null` si la ligne pointe vers un contenu disparu. */
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  reason: string | null;
  /** Rang du passage dans sa file, tel que la base le calcule. */
  position: number;
  state: LandingQueueState;
  /** `true` si le contenu est déjà exposé sur la vitrine. */
  isVisible: boolean;
  /** `true` si le contenu satisfait les filtres de la projection publique. */
  isReady: boolean;
}

export type QueueResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function queueFailure<T>(raw: unknown, correlationId: string, what: string): QueueResult<T> {
  const code = (raw as { code?: string } | null)?.code;
  console.error('[ISE] file « à la une » en échec', { correlationId, what, code });
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

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export const LANDING_QUEUE_SECTIONS = ['news', 'events', 'opportunities'] as const;
const ENTITY_TYPES = ['news', 'event', 'opportunity'] as const;
const STATES = ['en_cours', 'a_venir', 'termine'] as const;

/** Type de contenu attendu par la base pour une section donnée. */
export function entityTypeForSection(section: LandingQueueSection): LandingQueueEntityType {
  return section === 'news' ? 'news' : section === 'events' ? 'event' : 'opportunity';
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

/**
 * La file telle que la base la rend, ET la cadence réglée sur chaque encart.
 *
 * Les deux voyagent ensemble parce qu'ils se lisent ensemble : la durée par
 * défaut n'a de sens qu'en regard des passages déjà posés. Depuis 0124, la
 * base ne renvoie plus les passages terminés — ce que l'écran affiche est
 * exactement ce que les flèches « Monter » / « Descendre » manipulent.
 */
export interface LandingQueueView {
  entries: readonly LandingQueueEntry[];
  /** Durée d'un passage ajouté « à la suite », en jours, par encart (0124). */
  defaultPassageDays: Record<LandingQueueSection, number>;
}

export async function loadLandingQueue(
  correlationId: string,
): Promise<QueueResult<LandingQueueView>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('list_landing_queue', { p_section_key: null });
  if (error) return queueFailure(error, correlationId, 'list_landing_queue');

  const root = asRow(data);
  const settings = asRow(root['default_passage_days']);

  return {
    ok: true,
    data: {
      entries: asRows(root['entries']).map((row) => ({
        id: str(row['id']),
        sectionKey: oneOf(row['section_key'], LANDING_QUEUE_SECTIONS, 'news'),
        entityType: oneOf(row['entity_type'], ENTITY_TYPES, 'news'),
        entityId: str(row['entity_id']),
        title: nstr(row['title']),
        startsAt: str(row['starts_at']),
        endsAt: nstr(row['ends_at']),
        reason: nstr(row['reason']),
        position: num(row['position'], 1),
        state: oneOf(row['etat'], STATES, 'a_venir'),
        isVisible: row['est_visible'] === true,
        isReady: row['est_pret'] === true,
      })),
      // 7 est le défaut de la colonne en base : on retombe dessus si la
      // ligne de réglage manquait, plutôt que d'afficher un zéro faux.
      defaultPassageDays: {
        news: num(settings['news'], 7),
        events: num(settings['events'], 7),
        opportunities: num(settings['opportunities'], 7),
      },
    },
  };
}

/**
 * Fréquence de rotation de l'ISE du jour, telle qu'elle est ENREGISTRÉE.
 * Lue dans les règles renvoyées par `get_cms_featured_profile_overview()`,
 * pas devinée : si la colonne manquait, la valeur affichée serait fausse.
 */
export async function loadFeaturedRotation(correlationId: string): Promise<QueueResult<number>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_cms_featured_profile_overview', {
    p_history_limit: 1,
  });
  if (error) return queueFailure(error, correlationId, 'get_cms_featured_profile_overview');

  const rules = asRow(asRow(data)['rules']);
  return { ok: true, data: num(rules['rotation_interval_days'], 1) };
}

/**
 * Diagnostic du vivier de l'ISE du jour (0123).
 *
 * « 0 profil éligible » n'apprend rien à l'administrateur. Ce rapport dit,
 * critère par critère, combien de profils franchissent chaque exigence —
 * donc ce qu'il faut aller chercher pour que la sélection automatique se
 * remette à produire. Les nombres viennent de la base, jamais d'une
 * estimation côté application.
 */
export interface FeaturedEligibilityReport {
  /** Profils actifs, non supprimés, hors comptes de test. */
  base: number;
  allowPublicFeature: number;
  publicSummary: number;
  publicPhoto: number;
  claimed: number;
  promotion: number;
  expertiseOrPosition: number;
  eligibleCount: number;
  requirePublicPhoto: boolean;
  requireClaimedProfile: boolean;
  requirePromotion: boolean;
  requireExpertiseOrPosition: boolean;
}

export async function loadFeaturedEligibilityReport(
  correlationId: string,
): Promise<QueueResult<FeaturedEligibilityReport>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_featured_profile_eligibility_report', {});
  if (error) return queueFailure(error, correlationId, 'get_featured_profile_eligibility_report');

  const root = asRow(data);
  const criteria = asRow(root['criteria']);
  const rules = asRow(root['rules']);

  return {
    ok: true,
    data: {
      base: num(criteria['base']),
      allowPublicFeature: num(criteria['allow_public_feature']),
      publicSummary: num(criteria['public_summary']),
      publicPhoto: num(criteria['public_photo']),
      claimed: num(criteria['claimed']),
      promotion: num(criteria['promotion']),
      expertiseOrPosition: num(criteria['expertise_or_position']),
      eligibleCount: num(root['eligible_count']),
      requirePublicPhoto: rules['require_public_photo'] === true,
      requireClaimedProfile: rules['require_claimed_profile'] === true,
      requirePromotion: rules['require_promotion'] === true,
      requireExpertiseOrPosition: rules['require_expertise_or_position'] === true,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Écritures                                                           */
/* ------------------------------------------------------------------ */

export type QueueMutation = { ok: true; data: undefined } | { ok: false; error: BusinessError };

export async function addLandingQueueEntry(
  entityType: LandingQueueEntityType,
  entityId: string,
  startsAt: string | null,
  endsAt: string | null,
  reason: string | null,
  correlationId: string,
): Promise<QueueMutation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('add_landing_queue_entry', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_reason: reason,
  });
  if (error) return queueFailure(error, correlationId, 'add_landing_queue_entry');
  return { ok: true, data: undefined };
}

export async function moveLandingQueueEntry(
  entryId: string,
  direction: 'up' | 'down',
  correlationId: string,
): Promise<QueueMutation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('move_landing_queue_entry', {
    p_entry_id: entryId,
    p_direction: direction,
  });
  if (error) return queueFailure(error, correlationId, 'move_landing_queue_entry');
  return { ok: true, data: undefined };
}

export async function removeLandingQueueEntry(
  entryId: string,
  correlationId: string,
): Promise<QueueMutation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('remove_landing_queue_entry', { p_entry_id: entryId });
  if (error) return queueFailure(error, correlationId, 'remove_landing_queue_entry');
  return { ok: true, data: undefined };
}

/**
 * Cadence par défaut d'un encart (0124).
 *
 * Ne retouche AUCUN passage déjà programmé : les dates préparées par
 * l'administrateur restent telles quelles, le nouveau réglage ne vaut que
 * pour les ajouts suivants. C'est la base qui garantit cette frontière.
 */
export async function setLandingQueueDefaultDays(
  sectionKey: LandingQueueSection,
  days: number,
  correlationId: string,
): Promise<QueueMutation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_landing_queue_default_days', {
    p_section_key: sectionKey,
    p_days: days,
  });
  if (error) return queueFailure(error, correlationId, 'set_landing_queue_default_days');
  return { ok: true, data: undefined };
}

export async function setFeaturedRotation(
  intervalDays: number,
  correlationId: string,
): Promise<QueueMutation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_featured_profile_rotation', {
    p_interval_days: intervalDays,
  });
  if (error) return queueFailure(error, correlationId, 'set_featured_profile_rotation');
  return { ok: true, data: undefined };
}
