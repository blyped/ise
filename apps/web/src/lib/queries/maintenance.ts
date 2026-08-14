import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * SYS-003 / SYS-004 — fenetres de maintenance REELLEMENT declarees.
 *
 * Lecture directe de `public.maintenance_windows` sous la politique RLS
 * membre de 0050 : seules les fenetres `scheduled` ou `in_progress` sont
 * visibles — « la banniere doit atteindre tout le monde ». Aucune
 * fonction supplementaire n'est necessaire, donc aucune n'est creee.
 *
 * Un visiteur anonyme ne voit rien : D-125 fige la liste blanche des
 * fonctions `anon`, et aucune table ne lui est ouverte. Les ecrans de
 * maintenance ne s'affichent donc que dans l'espace membre.
 *
 * MASTER PROMPT §44 / §98 : seules les informations DECLAREES par la
 * fenetre sont restituees (titre, periode planifiee, message, perimetre).
 * Jamais de pourcentage de progression ni d'heure de retour estimee.
 */

/**
 * C-08 : le perimetre `messaging` a disparu avec la messagerie ISE<->ISE.
 * La contrainte CHECK de `maintenance_windows.affected_scope` l'accepte
 * encore — elle n'a pas ete rejouee, et aucune fenetre ne l'a jamais
 * porte — mais l'ecran d'administration ne le propose plus et ce type
 * ne l'expose plus. Une eventuelle ligne heritee retomberait sur le
 * libelle brut, `scopeLabel()` ayant un repli.
 */
export type MaintenanceScope = 'all' | 'web' | 'mobile' | 'imports' | 'notifications' | 'search';

export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string | null;
  bannerMessage: string | null;
  affectedScope: MaintenanceScope;
  isReadOnly: boolean;
  status: 'scheduled' | 'in_progress';
  startsAt: string;
  endsAt: string;
}

export interface MaintenanceState {
  /** Fenetre active couvrant toute la plateforme web -> SYS-004. */
  fullOutage: MaintenanceWindow | null;
  /** Fenetres actives limitees a un service -> SYS-003 sur ce service. */
  serviceOutages: MaintenanceWindow[];
  /** Prochaine fenetre annoncee (non commencee) -> banniere informative. */
  upcoming: MaintenanceWindow | null;
}

export type MaintenanceResult =
  | { ok: true; data: MaintenanceState }
  | { ok: false; error: BusinessError };

/**
 * Une fenetre est ACTIVE si son statut est `in_progress` (fait declare
 * par l'equipe via `admin_transition_maintenance_window`), ou si elle est
 * `scheduled` et que l'horloge est dans la periode qu'elle declare : la
 * fenetre annonce elle-meme son intervalle, rien n'est extrapole.
 */
function isActive(window: MaintenanceWindow, now: Date): boolean {
  if (window.status === 'in_progress') return true;
  return new Date(window.startsAt) <= now && now < new Date(window.endsAt);
}

const SERVICE_ROUTE_PREFIXES: Record<string, readonly string[]> = {
  search: ['/rechercher'],
  notifications: ['/notifications'],
};

/** Le chemin courant est-il porte par le service concerne ? */
export function scopeMatchesPath(scope: MaintenanceScope, pathname: string): boolean {
  const prefixes = SERVICE_ROUTE_PREFIXES[scope] ?? [];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function loadMaintenanceState(correlationId: string): Promise<MaintenanceResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('maintenance_windows')
    .select(
      'id, title, description, banner_message, affected_scope, is_read_only, status, starts_at, ends_at',
    )
    .in('status', ['scheduled', 'in_progress'])
    .order('starts_at', { ascending: true })
    .limit(20);

  if (error) return { ok: false, error: toBusinessError(error, correlationId) };

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    description: string | null;
    banner_message: string | null;
    affected_scope: MaintenanceScope;
    is_read_only: boolean;
    status: 'scheduled' | 'in_progress';
    starts_at: string;
    ends_at: string;
  }>;

  const windows: MaintenanceWindow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    bannerMessage: row.banner_message,
    affectedScope: row.affected_scope,
    isReadOnly: row.is_read_only,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));

  const now = new Date();
  const active = windows.filter((window) => isActive(window, now));
  const fullOutage =
    active.find((window) => window.affectedScope === 'all' || window.affectedScope === 'web') ??
    null;
  const serviceOutages = active.filter(
    (window) => window.affectedScope !== 'all' && window.affectedScope !== 'web',
  );
  const upcoming =
    windows.find((window) => !isActive(window, now) && new Date(window.startsAt) > now) ?? null;

  return { ok: true, data: { fullOutage, serviceOutages, upcoming } };
}
