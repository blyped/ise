import { StateMachine, type Transition } from './machine';

/**
 * Introductions — MASTER PROMPT §24, §25, §54 ; docs/decisions.md D-50.
 * Miroir exact de public.transition_introduction() (migration 0006).
 *
 * Regle cardinale (§25) : ne jamais ecrire « introduction reussie » quand
 * la seule chose constatee est « intermediaire accepte ». Chaque etat
 * correspond a un fait verifiable.
 */
export type IntroductionStatus =
  | 'requested'
  | 'intermediary_accepted'
  | 'intermediary_declined'
  | 'withdrawn'
  | 'expired'
  | 'introduced'
  | 'target_responded'
  | 'completed'
  | 'no_outcome';

export type IntroductionActor = 'requester' | 'intermediary' | 'target' | 'system';

const transitions: readonly Transition<IntroductionStatus, IntroductionActor>[] = [
  {
    from: 'requested',
    to: 'intermediary_accepted',
    actor: 'intermediary',
    label: "Accepter de faire l'introduction",
  },
  { from: 'requested', to: 'intermediary_declined', actor: 'intermediary', label: 'Décliner' },
  { from: 'requested', to: 'withdrawn', actor: 'requester', label: 'Retirer ma demande' },
  { from: 'requested', to: 'expired', actor: 'system', label: 'Expirer' },
  {
    from: 'intermediary_accepted',
    to: 'introduced',
    actor: 'intermediary',
    label: "J'ai fait l'introduction",
  },
  {
    from: 'intermediary_accepted',
    to: 'withdrawn',
    actor: 'requester',
    label: 'Retirer ma demande',
  },
  { from: 'introduced', to: 'target_responded', actor: 'target', label: 'Répondre' },
  { from: 'introduced', to: 'target_responded', actor: 'requester', label: 'Un échange a eu lieu' },
  { from: 'introduced', to: 'no_outcome', actor: 'requester', label: 'Aucune suite' },
  { from: 'target_responded', to: 'completed', actor: 'requester', label: 'Déclarer le résultat' },
  { from: 'target_responded', to: 'completed', actor: 'target', label: 'Déclarer le résultat' },
  { from: 'target_responded', to: 'no_outcome', actor: 'requester', label: 'Aucune suite' },
];

export const introductionMachine = new StateMachine<IntroductionStatus, IntroductionActor>(
  'requested',
  [
    'requested',
    'intermediary_accepted',
    'intermediary_declined',
    'withdrawn',
    'expired',
    'introduced',
    'target_responded',
    'completed',
    'no_outcome',
  ],
  transitions,
);

/**
 * Libelles affiches. Aucun n'affirme un fait non constate (MASTER PROMPT §25).
 */
export const INTRODUCTION_STATUS_LABELS: Readonly<Record<IntroductionStatus, string>> = {
  requested: "Demande envoyée à l'intermédiaire",
  intermediary_accepted: "L'intermédiaire a accepté",
  intermediary_declined: "L'intermédiaire a décliné",
  withdrawn: 'Demande retirée',
  expired: 'Demande expirée',
  introduced: 'Introduction transmise',
  target_responded: 'Échange engagé',
  completed: 'Résultat déclaré',
  no_outcome: 'Sans suite',
};

/** Etapes du suivi (ISE-045) : ce qui est constate, jamais ce qui est suppose. */
export const INTRODUCTION_TIMELINE: readonly IntroductionStatus[] = [
  'requested',
  'intermediary_accepted',
  'introduced',
  'target_responded',
  'completed',
];
