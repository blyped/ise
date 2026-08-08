import { StateMachine, type Transition } from './machine';

/** Relations — MASTER PROMPT §23. Pas de followers/following. */
export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
export type ConnectionActor = 'requester' | 'addressee' | 'system';

const transitions: readonly Transition<ConnectionStatus, ConnectionActor>[] = [
  { from: 'pending', to: 'accepted', actor: 'addressee', label: 'Accepter' },
  { from: 'pending', to: 'declined', actor: 'addressee', label: 'Refuser' },
  { from: 'pending', to: 'withdrawn', actor: 'requester', label: 'Annuler ma demande' },
  { from: 'pending', to: 'expired', actor: 'system', label: 'Expirer' },
];

export const connectionMachine = new StateMachine<ConnectionStatus, ConnectionActor>(
  'pending',
  ['pending', 'accepted', 'declined', 'withdrawn', 'expired'],
  transitions,
);

export const CONNECTION_STATUS_LABELS: Readonly<Record<ConnectionStatus, string>> = {
  pending: 'Demande en attente',
  accepted: 'En relation',
  declined: 'Demande refusée',
  withdrawn: 'Demande annulée',
  expired: 'Demande expirée',
};
