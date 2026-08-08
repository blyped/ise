/**
 * Petite machine d'etats generique, partagee par tous les workflows.
 * MASTER PROMPT §54 : une transition non declaree est impossible,
 * et cette impossibilite est testable.
 */
export interface Transition<S extends string, A extends string> {
  readonly from: S;
  readonly to: S;
  /** Acteur autorise a declencher la transition. */
  readonly actor: A;
  /** Libelle francais de l'action, affichable sur un bouton. */
  readonly label: string;
}

export class StateMachine<S extends string, A extends string> {
  constructor(
    readonly initial: S,
    readonly states: readonly S[],
    readonly transitions: readonly Transition<S, A>[],
  ) {}

  can(from: S, to: S, actor: A): boolean {
    return this.transitions.some((t) => t.from === from && t.to === to && t.actor === actor);
  }

  /** Transitions disponibles pour un acteur donne : pilote l'affichage des CTA. */
  available(from: S, actor: A): readonly Transition<S, A>[] {
    return this.transitions.filter((t) => t.from === from && t.actor === actor);
  }

  isTerminal(state: S): boolean {
    return !this.transitions.some((t) => t.from === state);
  }
}
