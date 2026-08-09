import { frInternships } from '@/i18n/internships';
import { frMentorship } from '@/i18n/mentorship';

/**
 * Logique de vue PURE des tranches STAGES (ISE-073 -> ISE-077) et
 * MENTORAT (ISE-078 -> ISE-083) : correspondances etat -> libelle et
 * miroirs des machines d'etats SQL.
 *
 * POURQUOI CE FICHIER. Les ecrans ne doivent proposer que les etapes
 * que la base acceptera : chaque table de transition ci-dessous est le
 * MIROIR EXACT de la machine d'etats de la migration correspondante
 * (0071 pour les candidatures, 0075 pour les mentorats). La base reste
 * l'arbitre — en cas de divergence, elle repond `invalid_transition`
 * et l'ecran l'affiche telle quelle.
 *
 * Module volontairement pur (aucune dependance serveur) : il est teste
 * par Vitest (`collaborate-status.test.ts`).
 */

/* ------------------------------------------------------------------ */
/* Stages — nature des entrees du vivier                               */
/* ------------------------------------------------------------------ */

export const INTERNSHIP_OFFER_TYPES = [
  'official_offer',
  'hosting_possibility',
  'introduction_capacity',
  'external_lead',
] as const;

export type InternshipOfferType = (typeof INTERNSHIP_OFFER_TYPES)[number];

/** Type inconnu -> `official_offer`, le cas le plus exigeant en clarte. */
export function internshipOfferType(raw: string): InternshipOfferType {
  return (INTERNSHIP_OFFER_TYPES as readonly string[]).includes(raw)
    ? (raw as InternshipOfferType)
    : 'official_offer';
}

export function internshipOfferTypeLabel(raw: string): string {
  return frInternships.offerType[internshipOfferType(raw)];
}

export function internshipOfferTypeHint(raw: string): string {
  return frInternships.offerTypeHint[internshipOfferType(raw)];
}

/* ------------------------------------------------------------------ */
/* Stages — machine d'etats des candidatures (0071, D-55)              */
/* ------------------------------------------------------------------ */

/**
 * Etapes declarables depuis chaque etat. `to_prepare` est VIDE a
 * dessein : le seul chemin qui en sort est la declaration d'envoi
 * (`declare_internship_application_sent`), jamais une « etape ».
 */
const INTERNSHIP_NEXT_STEPS: Record<string, readonly string[]> = {
  to_prepare: [],
  submitted: ['reviewed', 'interview', 'offered', 'declined', 'withdrawn'],
  reviewed: ['interview', 'offered', 'declined', 'withdrawn'],
  interview: ['offered', 'declined', 'withdrawn'],
  offered: ['accepted', 'declined', 'withdrawn'],
  accepted: [],
  declined: [],
  withdrawn: [],
};

export function internshipNextSteps(status: string): readonly string[] {
  return INTERNSHIP_NEXT_STEPS[status] ?? [];
}

export function internshipStatusLabel(status: string): string {
  const catalog: Record<string, string> = frInternships.status;
  return catalog[status] ?? status;
}

/** Le resultat ne s'enregistre que sur une proposition constatee ([U 93]). */
export function canRecordInternshipResult(status: string, hasPlacement: boolean): boolean {
  return !hasPlacement && (status === 'offered' || status === 'accepted');
}

export function internshipChannelLabel(channel: string): string {
  const catalog: Record<string, string> = {
    platform: frInternships.apply.channelPlatform,
    email: frInternships.apply.channelEmail,
    external_site: frInternships.apply.channelExternal,
    via_introduction: frInternships.apply.channelIntroduction,
    other: frInternships.apply.channelOther,
  };
  return catalog[channel] ?? channel;
}

export function internshipWorkModeLabel(mode: string): string {
  const catalog: Record<string, string> = {
    on_site: frInternships.preferences.workModeOnSite,
    hybrid: frInternships.preferences.workModeHybrid,
    remote: frInternships.preferences.workModeRemote,
  };
  return catalog[mode] ?? mode;
}

/* ------------------------------------------------------------------ */
/* Mentorat — machine d'etats des relations (0075)                     */
/* ------------------------------------------------------------------ */

export interface MentorshipTransitionOption {
  to: string;
  label: string;
}

/**
 * Transitions proposees a l'ecran depuis chaque etat. Sous-ensemble
 * exact de la machine SQL : `cancelled` n'est propose que depuis
 * `planned` (avant le premier echange, « arreter » n'a pas de sens).
 */
const MENTORSHIP_TRANSITIONS: Record<string, readonly MentorshipTransitionOption[]> = {
  planned: [
    { to: 'active', label: frMentorship.detail.start },
    { to: 'cancelled', label: frMentorship.detail.cancelPlanned },
  ],
  active: [
    { to: 'paused', label: frMentorship.detail.pause },
    { to: 'completed', label: frMentorship.detail.complete },
    { to: 'stopped', label: frMentorship.detail.stop },
  ],
  paused: [
    { to: 'active', label: frMentorship.detail.resume },
    { to: 'completed', label: frMentorship.detail.complete },
    { to: 'stopped', label: frMentorship.detail.stop },
  ],
  completed: [],
  stopped: [],
  cancelled: [],
};

export function mentorshipTransitionOptions(status: string): readonly MentorshipTransitionOption[] {
  return MENTORSHIP_TRANSITIONS[status] ?? [];
}

export function mentorshipStatusBadge(status: string): string {
  const catalog: Record<string, string> = {
    planned: frMentorship.detail.badgePlanned,
    active: frMentorship.detail.badgeActive,
    paused: frMentorship.detail.badgePaused,
    completed: frMentorship.detail.badgeCompleted,
    stopped: frMentorship.detail.badgeStopped,
    cancelled: frMentorship.detail.badgeCancelled,
  };
  return catalog[status] ?? status;
}

/** Le bilan n'est ouvert qu'apres la fin reelle (0075 : completed/stopped). */
export function canSubmitMentorshipFeedback(status: string, alreadyGiven: boolean): boolean {
  return !alreadyGiven && (status === 'completed' || status === 'stopped');
}

export function mentorshipRequestStatusLabel(status: string): string {
  const catalog: Record<string, string> = {
    draft: frMentorship.requests.statusDraft,
    pending: frMentorship.requests.statusPending,
    alternative_proposed: frMentorship.requests.statusAlternative,
    accepted: frMentorship.requests.statusAccepted,
    declined: frMentorship.requests.statusDeclined,
    cancelled: frMentorship.requests.statusCancelled,
    expired: frMentorship.requests.statusExpired,
  };
  return catalog[status] ?? status;
}

export function mentorshipFormatLabel(format: string): string {
  const catalog: Record<string, string> = frMentorship.format;
  return catalog[format] ?? format;
}

export function mentorshipFrequencyLabel(frequency: string | null): string | null {
  if (frequency === null) return null;
  const catalog: Record<string, string> = frMentorship.frequency;
  return catalog[frequency] ?? frequency;
}

export function mentorshipObjectiveLabel(objectiveType: string): string {
  const catalog: Record<string, string> = frMentorship.objective;
  return catalog[objectiveType] ?? objectiveType;
}

export function mentorshipTopicLabel(topic: string): string {
  const catalog: Record<string, string> = frMentorship.topic;
  return catalog[topic] ?? topic;
}

export function mentorshipExpectationLabel(expectation: string): string {
  const catalog: Record<string, string> = frMentorship.expectation;
  return catalog[expectation] ?? expectation;
}

/** Codes d'objectif dans l'ordre de `mentorship_objective_codes()` (0075). */
export const MENTORSHIP_OBJECTIVE_CODES = Object.keys(
  frMentorship.objective,
) as readonly (keyof typeof frMentorship.objective)[];

export const MENTORSHIP_TOPIC_CODES = Object.keys(
  frMentorship.topic,
) as readonly (keyof typeof frMentorship.topic)[];

export const MENTORSHIP_EXPECTATION_CODES = Object.keys(
  frMentorship.expectation,
) as readonly (keyof typeof frMentorship.expectation)[];

export const MENTORSHIP_FORMAT_CODES = [
  'single_session',
  'one_month',
  'three_months',
  'six_months',
] as const;

/** Etats d'une session (0075 : planned/completed/cancelled/no_show). */
export function mentorshipSessionStatusLabel(status: string): string {
  const catalog: Record<string, string> = {
    planned: frMentorship.detail.nextSessionTitle,
    completed: frMentorship.detail.actionStatusDone,
    cancelled: frMentorship.requests.statusCancelled,
    no_show: 'Non tenu',
  };
  return catalog[status] ?? status;
}

export function mentorshipItemStatusLabel(kind: 'goal' | 'action', status: string): string {
  const goals: Record<string, string> = {
    todo: frMentorship.detail.goalStatusTodo,
    in_progress: frMentorship.detail.goalStatusInProgress,
    done: frMentorship.detail.goalStatusDone,
    abandoned: frMentorship.detail.goalStatusAbandoned,
  };
  const actions: Record<string, string> = {
    todo: frMentorship.detail.actionStatusTodo,
    done: frMentorship.detail.actionStatusDone,
  };
  const catalog = kind === 'goal' ? goals : actions;
  return catalog[status] ?? status;
}
