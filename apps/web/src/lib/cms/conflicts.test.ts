import { describe, expect, it } from 'vitest';
import { conflictsByOrder, detectScheduleConflicts } from './conflicts';
import type { CmsScheduleOrder } from './types';

/**
 * Tests de la detection de conflits de programmation (ADDENDUM §40).
 *
 * Fonction pure : aucune base, aucun reseau, aucune horloge implicite —
 * `now` est un parametre, sans quoi le test « ordre echu » deviendrait
 * faux le lendemain de son ecriture.
 */

const NOW = new Date('2026-08-10T12:00:00Z');

function order(overrides: Partial<CmsScheduleOrder> & { id: string }): CmsScheduleOrder {
  return {
    entityType: 'cms_carousel_item',
    entityId: 'e1',
    publishAt: null,
    unpublishAt: null,
    status: 'pending',
    appliedAt: null,
    lastRunAt: null,
    runCount: 0,
    lastError: null,
    createdAt: '2026-08-01T00:00:00Z',
    label: null,
    ...overrides,
  };
}

describe('detectScheduleConflicts', () => {
  it('ne signale rien quand les ordres portent sur des contenus différents', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({ id: 'a', entityId: 'e1', publishAt: '2026-08-12T08:00:00Z' }),
        order({ id: 'b', entityId: 'e2', publishAt: '2026-08-12T08:00:00Z' }),
      ],
      NOW,
    );
    expect(conflicts).toEqual([]);
  });

  it('signale un chevauchement entre deux ordres sur le même contenu', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({
          id: 'a',
          publishAt: '2026-08-12T08:00:00Z',
          unpublishAt: '2026-08-20T08:00:00Z',
        }),
        order({
          id: 'b',
          publishAt: '2026-08-15T08:00:00Z',
          unpublishAt: '2026-08-25T08:00:00Z',
        }),
      ],
      NOW,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('overlap');
    expect(conflicts[0]?.orderIds).toEqual(['a', 'b']);
  });

  it('ne signale rien quand les fenêtres sont disjointes', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({
          id: 'a',
          publishAt: '2026-08-12T08:00:00Z',
          unpublishAt: '2026-08-15T08:00:00Z',
        }),
        order({
          id: 'b',
          publishAt: '2026-08-16T08:00:00Z',
          unpublishAt: '2026-08-20T08:00:00Z',
        }),
      ],
      NOW,
    );
    expect(conflicts).toEqual([]);
  });

  /**
   * Choix assume : deux fenetres « bout a bout » a la MEME milliseconde
   * sont un conflit, pas une continuite. L'ordonnanceur ramasse les ordres
   * echus sans ordre garanti entre eux : le resultat depend du hasard.
   * Decaler la seconde d'une seconde suffit a lever l'ambiguite.
   */
  it('signale deux fenêtres bout à bout sur le même instant', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({
          id: 'a',
          publishAt: '2026-08-12T08:00:00Z',
          unpublishAt: '2026-08-15T08:00:00Z',
        }),
        order({
          id: 'b',
          publishAt: '2026-08-15T08:00:00Z',
          unpublishAt: '2026-08-20T08:00:00Z',
        }),
      ],
      NOW,
    );
    expect(conflicts).toEqual([
      {
        kind: 'contradiction',
        orderIds: ['a', 'b'],
        entityType: 'cms_carousel_item',
        entityId: 'e1',
      },
    ]);
  });

  it('signale une contradiction : un ordre publie à l’instant où l’autre dépublie', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({ id: 'a', publishAt: '2026-08-15T08:00:00Z' }),
        order({
          id: 'b',
          publishAt: '2026-08-12T08:00:00Z',
          unpublishAt: '2026-08-15T08:00:00Z',
        }),
      ],
      NOW,
    );
    expect(conflicts.map((conflict) => conflict.kind)).toContain('contradiction');
  });

  it('signale un ordre échu que l’ordonnanceur n’a pas repris', () => {
    const conflicts = detectScheduleConflicts(
      [order({ id: 'a', publishAt: '2026-08-10T10:00:00Z' })],
      NOW,
    );
    expect(conflicts).toEqual([
      { kind: 'overdue', orderIds: ['a'], entityType: 'cms_carousel_item', entityId: 'e1' },
    ]);
  });

  it('tolère un retard inférieur à deux cycles de cron', () => {
    // 11:55 pour un « maintenant » a 12:00 : le cron passe toutes les 10 min.
    const conflicts = detectScheduleConflicts(
      [order({ id: 'a', publishAt: '2026-08-10T11:55:00Z' })],
      NOW,
    );
    expect(conflicts).toEqual([]);
  });

  it('signale un ordre en échec, sans le compter aussi comme échu', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({
          id: 'a',
          status: 'failed',
          publishAt: '2026-08-01T08:00:00Z',
          lastError: '23514 violation',
        }),
      ],
      NOW,
    );
    expect(conflicts).toEqual([
      { kind: 'failed', orderIds: ['a'], entityType: 'cms_carousel_item', entityId: 'e1' },
    ]);
  });

  it('ignore les ordres appliqués et annulés : ils ne peuvent plus rien casser', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({ id: 'a', status: 'applied', publishAt: '2026-08-01T08:00:00Z' }),
        order({ id: 'b', status: 'cancelled', publishAt: '2026-08-01T08:00:00Z' }),
      ],
      NOW,
    );
    expect(conflicts).toEqual([]);
  });

  it('traite un ordre sans date de fin comme ouvert jusqu’à l’infini', () => {
    const conflicts = detectScheduleConflicts(
      [
        order({ id: 'a', publishAt: '2026-08-12T08:00:00Z' }),
        order({ id: 'b', publishAt: '2026-09-01T08:00:00Z' }),
      ],
      NOW,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('overlap');
  });
});

describe('conflictsByOrder', () => {
  it('indexe chaque conflit sous tous les ordres impliqués, sans doublon', () => {
    const index = conflictsByOrder([
      { kind: 'overlap', orderIds: ['a', 'b'], entityType: 'news', entityId: 'e1' },
      { kind: 'overlap', orderIds: ['a', 'c'], entityType: 'news', entityId: 'e1' },
      { kind: 'overdue', orderIds: ['a'], entityType: 'news', entityId: 'e1' },
    ]);
    expect(index.get('a')).toEqual(['overlap', 'overdue']);
    expect(index.get('b')).toEqual(['overlap']);
    expect(index.get('c')).toEqual(['overlap']);
  });
});
