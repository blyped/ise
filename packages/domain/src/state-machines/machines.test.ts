import { describe, expect, it } from 'vitest';
import { StateMachine } from './machine';
import {
  INTRODUCTION_STATUS_LABELS,
  INTRODUCTION_TIMELINE,
  introductionMachine,
  type IntroductionActor,
  type IntroductionStatus,
} from './introduction';
import {
  CONNECTION_STATUS_LABELS,
  connectionMachine,
  type ConnectionActor,
  type ConnectionStatus,
} from './connection';

/* -------------------------------------------------------------------------- */
/* Outillage generique de parcours de graphe                                   */
/* -------------------------------------------------------------------------- */

/** Etats atteignables depuis `from`, en ignorant eventuellement certains etats. */
function reachable<S extends string, A extends string>(
  machine: StateMachine<S, A>,
  from: S,
  forbidden: readonly S[] = [],
): Set<S> {
  const seen = new Set<S>([from]);
  const queue: S[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of machine.transitions) {
      if (t.from !== current) continue;
      if (forbidden.includes(t.to)) continue;
      if (seen.has(t.to)) continue;
      seen.add(t.to);
      queue.push(t.to);
    }
  }
  return seen;
}

/** Tous les chemins simples (sans repetition d'etat) de `from` vers `to`. */
function simplePaths<S extends string, A extends string>(
  machine: StateMachine<S, A>,
  from: S,
  to: S,
): S[][] {
  const paths: S[][] = [];
  const walk = (current: S, path: S[]): void => {
    if (current === to && path.length > 1) {
      paths.push([...path]);
      return;
    }
    for (const t of machine.transitions) {
      if (t.from !== current) continue;
      if (path.includes(t.to)) continue;
      walk(t.to, [...path, t.to]);
    }
  };
  walk(from, [from]);
  return paths;
}

/** Batterie commune : toute machine d'etats du domaine doit la passer. */
function assertWellFormed<S extends string, A extends string>(
  machine: StateMachine<S, A>,
  actors: readonly A[],
  labels: Readonly<Record<S, string>>,
  expectedTerminals: readonly S[],
): void {
  it("l'état initial est un état déclaré", () => {
    expect(machine.states).toContain(machine.initial);
  });

  it('toute transition ne référence que des états déclarés', () => {
    for (const t of machine.transitions) {
      expect(machine.states, `from=${t.from}`).toContain(t.from);
      expect(machine.states, `to=${t.to}`).toContain(t.to);
    }
  });

  it("toute transition ne référence que des acteurs déclarés et n'est pas réflexive", () => {
    for (const t of machine.transitions) {
      expect(actors, `acteur=${t.actor}`).toContain(t.actor);
      expect(t.from, 'aucune transition ne doit boucler sur elle-même').not.toBe(t.to);
    }
  });

  it('aucune transition dupliquée (from, to, acteur)', () => {
    const keys = machine.transitions.map((t) => `${t.from}->${t.to}@${t.actor}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('toute transition porte un libellé français non vide', () => {
    for (const t of machine.transitions) {
      expect(t.label.trim().length, `${t.from}->${t.to}`).toBeGreaterThan(0);
      expect(t.label).toMatch(/\p{L}/u);
    }
  });

  it('chaque état déclaré possède un libellé non vide', () => {
    for (const state of machine.states) {
      expect(labels[state], state).toBeDefined();
      expect(labels[state].trim().length, state).toBeGreaterThan(0);
    }
    expect(Object.keys(labels).sort()).toEqual([...machine.states].sort());
  });

  it("tout état déclaré est atteignable depuis l'état initial", () => {
    const seen = reachable(machine, machine.initial);
    for (const state of machine.states) {
      expect(seen.has(state), `état inatteignable : ${state}`).toBe(true);
    }
  });

  it('les états terminaux sont exactement ceux attendus, sans transition sortante', () => {
    const terminals = machine.states.filter((s) => machine.isTerminal(s));
    expect([...terminals].sort()).toEqual([...expectedTerminals].sort());
    for (const state of expectedTerminals) {
      expect(machine.isTerminal(state), state).toBe(true);
      expect(machine.transitions.filter((t) => t.from === state)).toEqual([]);
      for (const actor of actors) {
        expect(machine.available(state, actor), `${state}/${actor}`).toEqual([]);
        for (const to of machine.states) {
          expect(machine.can(state, to, actor), `${state}->${to}@${actor}`).toBe(false);
        }
      }
    }
  });

  it('`can` est exact : il accorde uniquement les transitions déclarées', () => {
    const declared = new Set(machine.transitions.map((t) => `${t.from}->${t.to}@${t.actor}`));
    let checked = 0;
    for (const from of machine.states) {
      for (const to of machine.states) {
        for (const actor of actors) {
          checked += 1;
          expect(machine.can(from, to, actor), `${from}->${to}@${actor}`).toBe(
            declared.has(`${from}->${to}@${actor}`),
          );
        }
      }
    }
    expect(checked).toBe(machine.states.length ** 2 * actors.length);
  });

  it('`available` est cohérent avec `can`', () => {
    for (const from of machine.states) {
      for (const actor of actors) {
        for (const t of machine.available(from, actor)) {
          expect(t.from).toBe(from);
          expect(t.actor).toBe(actor);
          expect(machine.can(from, t.to, actor)).toBe(true);
        }
      }
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Introductions                                                               */
/* -------------------------------------------------------------------------- */

const INTRODUCTION_ACTORS: readonly IntroductionActor[] = [
  'requester',
  'intermediary',
  'target',
  'system',
];

const INTRODUCTION_TERMINALS: readonly IntroductionStatus[] = [
  'completed',
  'intermediary_declined',
  'withdrawn',
  'expired',
  'no_outcome',
];

describe('introductionMachine — bonne formation du graphe (D-50)', () => {
  assertWellFormed(
    introductionMachine,
    INTRODUCTION_ACTORS,
    INTRODUCTION_STATUS_LABELS,
    INTRODUCTION_TERMINALS,
  );
});

describe('introductionMachine — transitions interdites (MASTER PROMPT §54)', () => {
  const illegal: readonly [IntroductionStatus, IntroductionStatus][] = [
    // Cas cite explicitement par le MASTER PROMPT §54.
    ['withdrawn', 'intermediary_accepted'],
    // On ne saute jamais l'acceptation de l'intermediaire.
    ['requested', 'introduced'],
    // On ne declare jamais un resultat sans introduction constatee (§25).
    ['requested', 'completed'],
    ['intermediary_accepted', 'completed'],
    ['introduced', 'completed'],
    // Un refus, une expiration ou une cloture ne se rejouent pas.
    ['intermediary_declined', 'introduced'],
    ['expired', 'intermediary_accepted'],
    ['completed', 'target_responded'],
    ['no_outcome', 'completed'],
    ['target_responded', 'introduced'],
  ];

  it.each(illegal)('%s → %s est impossible pour tous les acteurs', (from, to) => {
    for (const actor of INTRODUCTION_ACTORS) {
      expect(introductionMachine.can(from, to, actor), `acteur=${actor}`).toBe(false);
    }
  });

  it('au moins six transitions illégales sont couvertes', () => {
    expect(illegal.length).toBeGreaterThanOrEqual(6);
  });

  it('un état inconnu ne débloque rien', () => {
    expect(
      introductionMachine.can('inexistant' as IntroductionStatus, 'completed', 'requester'),
    ).toBe(false);
  });
});

describe('introductionMachine — acteurs autorisés', () => {
  it("seul l'intermédiaire peut passer requested → intermediary_accepted", () => {
    expect(introductionMachine.can('requested', 'intermediary_accepted', 'intermediary')).toBe(
      true,
    );
    expect(introductionMachine.can('requested', 'intermediary_accepted', 'requester')).toBe(false);
    expect(introductionMachine.can('requested', 'intermediary_accepted', 'target')).toBe(false);
    expect(introductionMachine.can('requested', 'intermediary_accepted', 'system')).toBe(false);
  });

  it("seul l'intermédiaire peut décliner", () => {
    expect(introductionMachine.can('requested', 'intermediary_declined', 'intermediary')).toBe(
      true,
    );
    for (const actor of INTRODUCTION_ACTORS.filter((a) => a !== 'intermediary')) {
      expect(introductionMachine.can('requested', 'intermediary_declined', actor)).toBe(false);
    }
  });

  it('seul le demandeur retire sa demande', () => {
    expect(introductionMachine.can('requested', 'withdrawn', 'requester')).toBe(true);
    expect(introductionMachine.can('intermediary_accepted', 'withdrawn', 'requester')).toBe(true);
    for (const actor of INTRODUCTION_ACTORS.filter((a) => a !== 'requester')) {
      expect(introductionMachine.can('requested', 'withdrawn', actor)).toBe(false);
      expect(introductionMachine.can('intermediary_accepted', 'withdrawn', actor)).toBe(false);
    }
  });

  it('seul le système expire une demande', () => {
    expect(introductionMachine.can('requested', 'expired', 'system')).toBe(true);
    for (const actor of INTRODUCTION_ACTORS.filter((a) => a !== 'system')) {
      expect(introductionMachine.can('requested', 'expired', actor)).toBe(false);
    }
  });

  it("seul l'intermédiaire déclare avoir fait l'introduction", () => {
    expect(introductionMachine.can('intermediary_accepted', 'introduced', 'intermediary')).toBe(
      true,
    );
    for (const actor of INTRODUCTION_ACTORS.filter((a) => a !== 'intermediary')) {
      expect(introductionMachine.can('intermediary_accepted', 'introduced', actor)).toBe(false);
    }
  });

  it('les CTA proposés à chaque acteur restent minimaux', () => {
    expect(
      introductionMachine
        .available('requested', 'intermediary')
        .map((t) => t.to)
        .sort(),
    ).toEqual(['intermediary_accepted', 'intermediary_declined']);
    expect(introductionMachine.available('requested', 'requester').map((t) => t.to)).toEqual([
      'withdrawn',
    ]);
    expect(introductionMachine.available('requested', 'target')).toEqual([]);
  });
});

describe('introductionMachine — MASTER PROMPT §25 : « completed » se mérite', () => {
  it('aucune transition directe de intermediary_accepted vers completed', () => {
    for (const actor of INTRODUCTION_ACTORS) {
      expect(introductionMachine.can('intermediary_accepted', 'completed', actor)).toBe(false);
    }
    expect(
      introductionMachine.transitions.some(
        (t) => t.from === 'intermediary_accepted' && t.to === 'completed',
      ),
    ).toBe(false);
  });

  it('tout chemin de intermediary_accepted vers completed passe par introduced puis target_responded', () => {
    const paths = simplePaths(introductionMachine, 'intermediary_accepted', 'completed');
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path, path.join(' → ')).toContain('introduced');
      expect(path, path.join(' → ')).toContain('target_responded');
      expect(path.indexOf('introduced')).toBeLessThan(path.indexOf('target_responded'));
      expect(path.indexOf('target_responded')).toBeLessThan(path.indexOf('completed'));
    }
  });

  it("tout chemin depuis l'état initial vers completed emprunte la même séquence", () => {
    const paths = simplePaths(introductionMachine, introductionMachine.initial, 'completed');
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.slice(0, 5), path.join(' → ')).toEqual([
        'requested',
        'intermediary_accepted',
        'introduced',
        'target_responded',
        'completed',
      ]);
    }
  });

  it('sans introduced, completed devient inatteignable', () => {
    expect(
      reachable(introductionMachine, introductionMachine.initial, ['introduced']).has('completed'),
    ).toBe(false);
  });

  it('sans target_responded, completed devient inatteignable', () => {
    expect(
      reachable(introductionMachine, introductionMachine.initial, ['target_responded']).has(
        'completed',
      ),
    ).toBe(false);
  });

  it('seuls le demandeur et la cible déclarent le résultat, depuis target_responded', () => {
    const toCompleted = introductionMachine.transitions.filter((t) => t.to === 'completed');
    expect(toCompleted.map((t) => t.from)).toEqual(['target_responded', 'target_responded']);
    expect([...toCompleted].map((t) => t.actor).sort()).toEqual(['requester', 'target']);
  });

  it('aucun libellé de statut n’affirme une réussite non constatée (§25)', () => {
    expect(INTRODUCTION_STATUS_LABELS.intermediary_accepted).not.toMatch(/réussi|succès|abouti/i);
    expect(INTRODUCTION_STATUS_LABELS.introduced).not.toMatch(/réussi|succès|abouti/i);
    expect(INTRODUCTION_STATUS_LABELS.completed).not.toMatch(/réussi|succès/i);
  });
});

describe('introductionMachine — chronologie de suivi (ISE-045)', () => {
  it('la timeline ne cite que des états déclarés', () => {
    for (const state of INTRODUCTION_TIMELINE) {
      expect(introductionMachine.states).toContain(state);
    }
  });

  it('la timeline est un chemin réellement praticable du graphe', () => {
    for (let i = 1; i < INTRODUCTION_TIMELINE.length; i += 1) {
      const from = INTRODUCTION_TIMELINE[i - 1]!;
      const to = INTRODUCTION_TIMELINE[i]!;
      expect(
        introductionMachine.transitions.some((t) => t.from === from && t.to === to),
        `${from} → ${to}`,
      ).toBe(true);
    }
  });

  it('elle démarre à l’état initial et finit sur un état terminal', () => {
    expect(INTRODUCTION_TIMELINE[0]).toBe(introductionMachine.initial);
    expect(introductionMachine.isTerminal(INTRODUCTION_TIMELINE.at(-1)!)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

const CONNECTION_ACTORS: readonly ConnectionActor[] = ['requester', 'addressee', 'system'];

const CONNECTION_TERMINALS: readonly ConnectionStatus[] = [
  'accepted',
  'declined',
  'withdrawn',
  'expired',
];

describe('connectionMachine — bonne formation du graphe (MASTER PROMPT §23)', () => {
  assertWellFormed(
    connectionMachine,
    CONNECTION_ACTORS,
    CONNECTION_STATUS_LABELS,
    CONNECTION_TERMINALS,
  );
});

describe('connectionMachine — transitions interdites', () => {
  const illegal: readonly [ConnectionStatus, ConnectionStatus][] = [
    ['accepted', 'pending'],
    ['accepted', 'declined'],
    ['accepted', 'withdrawn'],
    ['declined', 'accepted'],
    ['withdrawn', 'accepted'],
    ['expired', 'accepted'],
    ['declined', 'pending'],
    ['expired', 'pending'],
  ];

  it.each(illegal)('%s → %s est impossible pour tous les acteurs', (from, to) => {
    for (const actor of CONNECTION_ACTORS) {
      expect(connectionMachine.can(from, to, actor), `acteur=${actor}`).toBe(false);
    }
  });

  it('au moins six transitions illégales sont couvertes', () => {
    expect(illegal.length).toBeGreaterThanOrEqual(6);
  });

  it("une relation acceptée est définitive : c'est un état terminal", () => {
    expect(connectionMachine.isTerminal('accepted')).toBe(true);
  });
});

describe('connectionMachine — acteurs autorisés', () => {
  it('seul le destinataire accepte ou refuse', () => {
    expect(connectionMachine.can('pending', 'accepted', 'addressee')).toBe(true);
    expect(connectionMachine.can('pending', 'declined', 'addressee')).toBe(true);
    for (const actor of CONNECTION_ACTORS.filter((a) => a !== 'addressee')) {
      expect(connectionMachine.can('pending', 'accepted', actor)).toBe(false);
      expect(connectionMachine.can('pending', 'declined', actor)).toBe(false);
    }
  });

  it('seul le demandeur annule sa demande, et il ne peut pas s’auto-accepter', () => {
    expect(connectionMachine.can('pending', 'withdrawn', 'requester')).toBe(true);
    expect(connectionMachine.can('pending', 'accepted', 'requester')).toBe(false);
    for (const actor of CONNECTION_ACTORS.filter((a) => a !== 'requester')) {
      expect(connectionMachine.can('pending', 'withdrawn', actor)).toBe(false);
    }
  });

  it('seul le système expire la demande', () => {
    expect(connectionMachine.can('pending', 'expired', 'system')).toBe(true);
    for (const actor of CONNECTION_ACTORS.filter((a) => a !== 'system')) {
      expect(connectionMachine.can('pending', 'expired', actor)).toBe(false);
    }
  });

  it('les CTA disponibles depuis pending sont ceux attendus', () => {
    expect(
      connectionMachine
        .available('pending', 'addressee')
        .map((t) => t.to)
        .sort(),
    ).toEqual(['accepted', 'declined']);
    expect(connectionMachine.available('pending', 'requester').map((t) => t.to)).toEqual([
      'withdrawn',
    ]);
    expect(connectionMachine.available('pending', 'system').map((t) => t.to)).toEqual(['expired']);
  });

  it('tout chemin vers accepted part de pending et fait un seul pas', () => {
    const paths = simplePaths(connectionMachine, connectionMachine.initial, 'accepted');
    expect(paths).toEqual([['pending', 'accepted']]);
  });
});
