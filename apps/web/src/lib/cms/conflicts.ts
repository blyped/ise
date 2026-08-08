import type { CmsScheduleOrder } from './types';

/**
 * DETECTION DE CONFLITS DE PROGRAMMATION (ADDENDUM §40, CMS-009).
 *
 * Fonction PURE, sans acces a la base : elle raisonne sur les ordres deja
 * lus. C'est ce qui la rend testable sans base, et c'est aussi pourquoi
 * elle ne « corrige » rien — elle SIGNALE. La correction est un acte
 * editorial, jamais une decision de l'ecran.
 *
 * Quatre conflits, tous verifiables sur les donnees seules :
 *
 *   `overlap`       deux ordres visent le meme contenu et leurs fenetres
 *                   se recouvrent. Le second gagnerait, silencieusement.
 *   `contradiction` un ordre publie ce contenu a l'instant meme ou un
 *                   autre le depublie. L'issue depend de l'ordre de
 *                   traitement : c'est indeterministe, donc c'est un bug.
 *   `overdue`       la date est passee et l'ordre est toujours `pending` :
 *                   l'ordonnanceur ne l'a pas repris. `pg_cron` tourne
 *                   toutes les 10 minutes ; au-dela, il faut regarder.
 *   `failed`        l'ordre porte un `last_error`. Il reste consultable et
 *                   rejouable, mais il n'a rien fait.
 */

export type CmsConflictKind = 'overlap' | 'contradiction' | 'overdue' | 'failed';

export interface CmsScheduleConflict {
  kind: CmsConflictKind;
  /** Identifiants des ordres impliques. Toujours au moins un. */
  orderIds: readonly string[];
  entityType: string;
  entityId: string;
}

/** Marge au-dela de laquelle un ordre echu devient anormal : deux cycles de cron. */
const OVERDUE_GRACE_MS = 20 * 60 * 1000;

const PLUS_INFINITY = Number.POSITIVE_INFINITY;
const MINUS_INFINITY = Number.NEGATIVE_INFINITY;

function at(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const time = Date.parse(value);
  return Number.isNaN(time) ? fallback : time;
}

/** Fenetre d'exposition demandee par un ordre, en millisecondes. */
function windowOf(order: CmsScheduleOrder): { from: number; to: number } {
  return {
    from: at(order.publishAt, MINUS_INFINITY),
    to: at(order.unpublishAt, PLUS_INFINITY),
  };
}

export function detectScheduleConflicts(
  orders: readonly CmsScheduleOrder[],
  now: Date = new Date(),
): readonly CmsScheduleConflict[] {
  const conflicts: CmsScheduleConflict[] = [];
  const nowMs = now.getTime();

  for (const order of orders) {
    if (order.status === 'failed') {
      conflicts.push({
        kind: 'failed',
        orderIds: [order.id],
        entityType: order.entityType,
        entityId: order.entityId,
      });
      continue;
    }
    if (order.status !== 'pending') continue;

    const earliest = Math.min(
      at(order.publishAt, PLUS_INFINITY),
      at(order.unpublishAt, PLUS_INFINITY),
    );
    if (earliest !== PLUS_INFINITY && earliest < nowMs - OVERDUE_GRACE_MS) {
      conflicts.push({
        kind: 'overdue',
        orderIds: [order.id],
        entityType: order.entityType,
        entityId: order.entityId,
      });
    }
  }

  // Comparaisons deux a deux, uniquement entre ordres en attente sur le
  // meme contenu. Un ordre applique ou annule ne peut plus rien casser.
  const pending = orders.filter((order) => order.status === 'pending');
  for (let i = 0; i < pending.length; i += 1) {
    for (let j = i + 1; j < pending.length; j += 1) {
      const a = pending[i]!;
      const b = pending[j]!;
      if (a.entityType !== b.entityType || a.entityId !== b.entityId) continue;

      // CONTRADICTION D'ABORD, ET INDEPENDAMMENT DE L'INTERSECTION.
      //
      // Defaut trouve par le test « un ordre publie a l'instant ou l'autre
      // depublie » : le predicat d'intersection est a bornes semi-ouvertes
      // (`from < to`), donc il EXCLUT precisement l'instant partage. La
      // contradiction etait alors invisible — le pire cas passait sous le
      // radar du detecteur cense l'attraper.
      //
      // Deux ordres qui demandent l'effet inverse a la MEME milliseconde
      // produisent un resultat indeterministe : il depend de l'ordre dans
      // lequel `publish_scheduled_cms_content()` les ramasse. C'est un
      // conflit, y compris quand les fenetres sont « bout a bout ».
      const aPublish = at(a.publishAt, PLUS_INFINITY);
      const bUnpublish = at(b.unpublishAt, PLUS_INFINITY);
      const bPublish = at(b.publishAt, PLUS_INFINITY);
      const aUnpublish = at(a.unpublishAt, PLUS_INFINITY);
      const contradicts =
        (aPublish !== PLUS_INFINITY && aPublish === bUnpublish) ||
        (bPublish !== PLUS_INFINITY && bPublish === aUnpublish);

      if (contradicts) {
        conflicts.push({
          kind: 'contradiction',
          orderIds: [a.id, b.id],
          entityType: a.entityType,
          entityId: a.entityId,
        });
        continue;
      }

      const wa = windowOf(a);
      const wb = windowOf(b);
      if (wa.from < wb.to && wb.from < wa.to) {
        conflicts.push({
          kind: 'overlap',
          orderIds: [a.id, b.id],
          entityType: a.entityType,
          entityId: a.entityId,
        });
      }
    }
  }

  return conflicts;
}

/** Indexe les conflits par ordre, pour l'affichage ligne a ligne. */
export function conflictsByOrder(
  conflicts: readonly CmsScheduleConflict[],
): ReadonlyMap<string, readonly CmsConflictKind[]> {
  const map = new Map<string, CmsConflictKind[]>();
  for (const conflict of conflicts) {
    for (const id of conflict.orderIds) {
      const existing = map.get(id);
      if (existing === undefined) {
        map.set(id, [conflict.kind]);
      } else if (!existing.includes(conflict.kind)) {
        existing.push(conflict.kind);
      }
    }
  }
  return map;
}
