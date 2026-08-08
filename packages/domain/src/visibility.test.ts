import { describe, expect, it } from 'vitest';
import {
  VISIBILITY_LABELS,
  VISIBILITY_LEVELS,
  VISIBILITY_ORDER,
  canSee,
  type ViewerContext,
  type VisibilityLevel,
} from './visibility';

const STRANGER: ViewerContext = {
  isOwner: false,
  isConnected: false,
  sharesPromotion: false,
  isActiveMember: true,
  isBlocked: false,
};

function viewer(over: Partial<ViewerContext> = {}): ViewerContext {
  return { ...STRANGER, ...over };
}

describe('échelle de visibilité (D-73)', () => {
  it('compte exactement 4 niveaux, sans niveau « public web »', () => {
    expect(VISIBILITY_LEVELS).toEqual(['private', 'connections', 'promotion', 'members']);
    expect(VISIBILITY_LEVELS).not.toContain('public');
  });

  it('chaque niveau a un libellé français non vide et un rang', () => {
    for (const level of VISIBILITY_LEVELS) {
      expect(VISIBILITY_LABELS[level].trim().length, level).toBeGreaterThan(0);
      expect(typeof VISIBILITY_ORDER[level], level).toBe('number');
    }
    expect(Object.keys(VISIBILITY_LABELS).sort()).toEqual([...VISIBILITY_LEVELS].sort());
    expect(Object.keys(VISIBILITY_ORDER).sort()).toEqual([...VISIBILITY_LEVELS].sort());
  });

  it('les rangs vont du plus fermé au plus ouvert', () => {
    expect(VISIBILITY_ORDER.private).toBeLessThan(VISIBILITY_ORDER.connections);
    expect(VISIBILITY_ORDER.connections).toBeLessThan(VISIBILITY_ORDER.promotion);
    expect(VISIBILITY_ORDER.promotion).toBeLessThan(VISIBILITY_ORDER.members);
  });
});

describe('canSee — le propriétaire', () => {
  it('voit tout, à tous les niveaux', () => {
    for (const level of VISIBILITY_LEVELS) {
      expect(canSee(level, viewer({ isOwner: true })), level).toBe(true);
    }
  });

  it('voit son propre contenu même sans relation, sans promotion, sans compte actif', () => {
    const owner = viewer({
      isOwner: true,
      isConnected: false,
      sharesPromotion: false,
      isActiveMember: false,
    });
    for (const level of VISIBILITY_LEVELS) expect(canSee(level, owner), level).toBe(true);
  });
});

describe('canSee — le blocage prime sur tout (sauf pour le propriétaire)', () => {
  const blocked = viewer({
    isBlocked: true,
    isConnected: true,
    sharesPromotion: true,
    isActiveMember: true,
  });

  it('un membre bloqué ne voit rien, même le niveau « members »', () => {
    expect(canSee('members', blocked)).toBe(false);
    for (const level of VISIBILITY_LEVELS) expect(canSee(level, blocked), level).toBe(false);
  });

  it('le même contexte non bloqué verrait tout : le blocage est bien la cause', () => {
    const notBlocked = { ...blocked, isBlocked: false };
    for (const level of VISIBILITY_LEVELS) {
      if (level === 'private') continue;
      expect(canSee(level, notBlocked), level).toBe(true);
    }
  });
});

describe('canSee — « private » n’est jamais visible par un tiers', () => {
  it('quelle que soit la relation, la promotion ou le statut', () => {
    for (const isConnected of [true, false]) {
      for (const sharesPromotion of [true, false]) {
        for (const isActiveMember of [true, false]) {
          const context = viewer({ isConnected, sharesPromotion, isActiveMember });
          expect(canSee('private', context), JSON.stringify(context)).toBe(false);
        }
      }
    }
  });
});

describe('canSee — « connections » exige la relation', () => {
  it('accordé à une relation confirmée', () => {
    expect(canSee('connections', viewer({ isConnected: true }))).toBe(true);
  });

  it('refusé sans relation, même à un camarade de promotion actif', () => {
    expect(canSee('connections', viewer({ isConnected: false, sharesPromotion: true }))).toBe(
      false,
    );
  });
});

describe('canSee — « promotion » exige la promotion commune', () => {
  it('accordé à un camarade de promotion', () => {
    expect(canSee('promotion', viewer({ sharesPromotion: true }))).toBe(true);
  });

  it('refusé à une relation qui ne partage pas la promotion', () => {
    expect(canSee('promotion', viewer({ isConnected: true, sharesPromotion: false }))).toBe(false);
  });
});

describe('canSee — « members » exige un compte membre actif', () => {
  it('accordé à un membre actif, refusé sinon', () => {
    expect(canSee('members', viewer({ isActiveMember: true }))).toBe(true);
    expect(canSee('members', viewer({ isActiveMember: false }))).toBe(false);
  });
});

describe('canSee — table de vérité exhaustive', () => {
  /** Reference independante de l'implementation. */
  function expected(level: VisibilityLevel, v: ViewerContext): boolean {
    if (v.isOwner) return true;
    if (v.isBlocked) return false;
    if (level === 'private') return false;
    if (level === 'connections') return v.isConnected;
    if (level === 'promotion') return v.sharesPromotion;
    return v.isActiveMember;
  }

  it('couvre les 4 niveaux × 32 contextes possibles', () => {
    let checked = 0;
    for (const level of VISIBILITY_LEVELS) {
      for (const isOwner of [true, false]) {
        for (const isConnected of [true, false]) {
          for (const sharesPromotion of [true, false]) {
            for (const isActiveMember of [true, false]) {
              for (const isBlocked of [true, false]) {
                const context: ViewerContext = {
                  isOwner,
                  isConnected,
                  sharesPromotion,
                  isActiveMember,
                  isBlocked,
                };
                checked += 1;
                expect(canSee(level, context), `${level} ${JSON.stringify(context)}`).toBe(
                  expected(level, context),
                );
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(VISIBILITY_LEVELS.length * 32);
  });
});
