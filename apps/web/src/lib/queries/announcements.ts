import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { asArray, asObject, str } from '@/lib/network-view';

/**
 * Lecture MEMBRE des annonces du tableau de bord (0145, tache #188).
 *
 * Une seule fonction, `get_active_dashboard_announcements()` : le filtre
 * de fenetre (publiee, dans les bornes starts_at/ends_at) est fait EN
 * BASE, jamais recalcule cote application (memes principes que les
 * projections `get_landing_*`).
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export type AnnouncementSeverity = 'normal' | 'urgent';

export interface DashboardAnnouncement {
  id: string;
  body: string;
  severity: AnnouncementSeverity;
  publishedAt: string | null;
}

function toSeverity(raw: unknown): AnnouncementSeverity {
  return raw === 'urgent' ? 'urgent' : 'normal';
}

function toAnnouncement(raw: unknown): DashboardAnnouncement | null {
  const row = asObject(raw);
  const id = str(row['id']);
  const body = str(row['body']);
  if (id === null || body === null) return null;
  return {
    id,
    body,
    severity: toSeverity(row['severity']),
    publishedAt: str(row['published_at']),
  };
}

/**
 * Annonces actives du tableau de bord, urgentes d'abord (deja triees en
 * base). Consommee par `AnnouncementsBanner` : un echec de lecture ne
 * doit jamais faire planter le tableau de bord (MASTER PROMPT §47) — le
 * composant appelant retombe silencieusement sur "pas de bandeau" quand
 * `ok` est `false`, voir `apps/web/src/app/tableau-de-bord/page.tsx`.
 */
export async function loadActiveAnnouncements(
  correlationId: string,
): Promise<QueryResult<DashboardAnnouncement[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_active_dashboard_announcements', {});

  if (error) {
    console.error('[ISE] annonces du tableau de bord — RPC en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = asArray(data).flatMap((entry) => {
    const mapped = toAnnouncement(entry);
    return mapped === null ? [] : [mapped];
  });
  return { ok: true, data: rows };
}
