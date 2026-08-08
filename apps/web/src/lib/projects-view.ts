import { asArray, asObject, bool, num, str, strings, toProfileCard } from '@/lib/network-view';
import type { NetworkProfileCard } from '@/lib/network-view';
import { toMatchReasons, type MatchReason, type Page } from '@/lib/communities-view';

/**
 * Types de vue et conversions PURES de la tranche PROJETS &
 * CONSORTIUMS (ISE-088 -> ISE-091).
 *
 * DEUX ETATS QUI NE SE CONFONDENT JAMAIS (MASTER PROMPT §32) :
 *  - `ProjectApplicationRef` = une expression d'interet ;
 *  - `ProjectMembershipRef`  = une appartenance a l'equipe, `active`
 *    seulement lorsque `confirmedAt` est renseigne.
 * Les deux vivent cote a cote sur `ProjectCard` et ne sont jamais
 * derivees l'une de l'autre.
 */

export type { Page, MatchReason };

export type ProjectScope = 'for_me' | 'all' | 'consortiums' | 'mine';

const PROJECT_SCOPES: readonly ProjectScope[] = ['for_me', 'all', 'consortiums', 'mine'];

export function toProjectScope(raw: unknown): ProjectScope {
  return typeof raw === 'string' && (PROJECT_SCOPES as readonly string[]).includes(raw)
    ? (raw as ProjectScope)
    : 'for_me';
}

export type MyProjectGroup =
  'coordinating' | 'participating' | 'invitations' | 'interests' | 'completed';

const MY_PROJECT_GROUPS: readonly MyProjectGroup[] = [
  'coordinating',
  'participating',
  'invitations',
  'interests',
  'completed',
];

export function toMyProjectGroup(raw: unknown): MyProjectGroup {
  return typeof raw === 'string' && (MY_PROJECT_GROUPS as readonly string[]).includes(raw)
    ? (raw as MyProjectGroup)
    : 'participating';
}

export interface ProjectApplicationRef {
  applicationId: string;
  status: string;
  roleId: string | null;
  submittedAt: string | null;
}

export interface ProjectInvitationRef {
  invitationId: string;
  status: string;
  roleId: string | null;
}

export interface ProjectMembershipRef {
  memberId: string;
  status: string;
  membershipRole: string;
  roleId: string | null;
  confirmedAt: string | null;
}

export interface RoleSkill {
  name: string;
  requirement: string;
  minimumLevel: string | null;
}

export interface RoleLanguage {
  code: string;
  name: string;
  isMandatory: boolean;
}

export interface RoleCompensation {
  details: string | null;
  amountMin: number | null;
  amountMax: number | null;
  currency: string | null;
  rateUnit: string | null;
}

export interface ProjectRole {
  roleId: string;
  projectId: string;
  title: string;
  description: string | null;
  seats: number;
  filledSeats: number;
  commitmentType: string | null;
  workloadDays: number | null;
  workloadHoursWeek: number | null;
  commitmentNotes: string | null;
  experienceMinYears: number | null;
  sector: string | null;
  availabilityFrom: string | null;
  availabilityUntil: string | null;
  compensationType: string | null;
  applicationMode: string;
  isKeyExpert: boolean;
  status: string;
  skills: RoleSkill[];
  languages: RoleLanguage[];
  /** `false` tant que le palier de divulgation n'est pas atteint. */
  compensationDisclosed: boolean;
  compensation: RoleCompensation | null;
}

export interface ProjectTeamMember {
  memberId: string;
  membershipRole: string;
  membershipStatus: string;
  roleTitle: string | null;
  confirmedAt: string | null;
  profile: NetworkProfileCard | null;
}

export interface ProjectMilestone {
  milestoneId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  sortOrder: number;
  isMine: boolean;
}

export interface ProjectLink {
  linkId: string;
  label: string;
  url: string;
  linkType: string;
  isConfidential: boolean;
}

export interface ProjectRoleSummary {
  totalSeats: number;
  filledSeats: number;
  openRoles: number;
}

export interface ProjectCard {
  projectId: string;
  title: string;
  isRestricted: boolean;
  projectType: string;
  summary: string;
  expectedOutcome: string | null;
  sector: string | null;
  visibility: string;
  disclosureLevel: string;
  requiresNda: boolean;
  compensationType: string;
  compensationStatement: string | null;
  status: string;
  startDate: string | null;
  applicationDeadline: string | null;
  targetEndDate: string | null;
  publishedAt: string | null;
  teamConfirmedAt: string | null;
  createdAt: string;
  owner: NetworkProfileCard | null;
  isOwner: boolean;
  isMember: boolean;
  countries: string[];
  roleSummary: ProjectRoleSummary;
  soughtRoles: string[];
  relevanceLabel: string | null;
  reasons: MatchReason[];
  myApplication: ProjectApplicationRef | null;
  myInvitation: ProjectInvitationRef | null;
  myMembership: ProjectMembershipRef | null;
}

export interface ProjectClosure {
  outcomeStatus: string;
  expectedOutcomeAchieved: string;
  outcomeCode: string | null;
  deliverableTitle: string | null;
  deliverableUrl: string | null;
  closedAt: string | null;
}

export interface ProjectDetail extends ProjectCard {
  description: string | null;
  qualificationCriteria: string | null;
  tenderReference: string | null;
  sourceType: string | null;
  sourceCommunity: string | null;
  roles: ProjectRole[];
  team: ProjectTeamMember[];
  milestones: ProjectMilestone[];
  links: ProjectLink[];
  closure: ProjectClosure | null;
}

export interface ParticipationImpact {
  membersConfirmed: number;
  rolesFilled: number;
  rolesTotal: number;
  milestonesDone: number;
  milestonesTotal: number;
}

export interface MyParticipation {
  memberId: string;
  membershipRole: string;
  membershipStatus: string;
  confirmedAt: string | null;
  roleTitle: string | null;
}

export interface ProjectParticipation extends ProjectDetail {
  myParticipation: MyParticipation | null;
  myMilestones: ProjectMilestone[];
  nextMilestone: ProjectMilestone | null;
  impact: ParticipationImpact;
}

export interface ProjectFinancials {
  clientName: string | null;
  funderName: string | null;
  budgetEstimate: number | null;
  budgetCurrency: string | null;
  financialNotes: string | null;
  revenueGenerated: number | null;
  revenueCurrency: string | null;
}

/* ------------------------------------------------------------------ */

function toApplicationRef(value: unknown): ProjectApplicationRef | null {
  const raw = asObject(value);
  const applicationId = str(raw['application_id']);
  if (applicationId === null) return null;
  return {
    applicationId,
    status: str(raw['status']) ?? 'submitted',
    roleId: str(raw['role_id']),
    submittedAt: str(raw['submitted_at']),
  };
}

function toInvitationRef(value: unknown): ProjectInvitationRef | null {
  const raw = asObject(value);
  const invitationId = str(raw['invitation_id']);
  if (invitationId === null) return null;
  return {
    invitationId,
    status: str(raw['status']) ?? 'sent',
    roleId: str(raw['role_id']),
  };
}

function toMembershipRef(value: unknown): ProjectMembershipRef | null {
  const raw = asObject(value);
  const memberId = str(raw['member_id']);
  if (memberId === null) return null;
  return {
    memberId,
    status: str(raw['status']) ?? 'pending_confirmation',
    membershipRole: str(raw['membership_role']) ?? 'member',
    roleId: str(raw['role_id']),
    confirmedAt: str(raw['confirmed_at']),
  };
}

export function toProjectRole(value: unknown): ProjectRole | null {
  const raw = asObject(value);
  const roleId = str(raw['role_id']);
  if (roleId === null) return null;
  const compensation = asObject(raw['compensation']);
  const disclosed = bool(raw['compensation_disclosed']);

  return {
    roleId,
    projectId: str(raw['project_id']) ?? '',
    title: str(raw['title']) ?? '',
    description: str(raw['description']),
    seats: num(raw['seats']) ?? 1,
    filledSeats: num(raw['filled_seats']) ?? 0,
    commitmentType: str(raw['commitment_type']),
    workloadDays: num(raw['workload_days']),
    workloadHoursWeek: num(raw['workload_hours_week']),
    commitmentNotes: str(raw['commitment_notes']),
    experienceMinYears: num(raw['experience_min_years']),
    sector: str(raw['sector']),
    availabilityFrom: str(raw['availability_from']),
    availabilityUntil: str(raw['availability_until']),
    compensationType: str(raw['compensation_type']),
    applicationMode: str(raw['application_mode']) ?? 'open',
    isKeyExpert: bool(raw['is_key_expert']),
    status: str(raw['status']) ?? 'open',
    skills: asArray(raw['skills']).flatMap((entry) => {
      const skill = asObject(entry);
      const name = str(skill['name']);
      if (name === null) return [];
      return [
        {
          name,
          requirement: str(skill['requirement']) ?? 'required',
          minimumLevel: str(skill['minimum_level']),
        },
      ];
    }),
    languages: asArray(raw['languages']).flatMap((entry) => {
      const lang = asObject(entry);
      const code = str(lang['code']);
      if (code === null) return [];
      return [{ code, name: str(lang['name']) ?? code, isMandatory: bool(lang['is_mandatory']) }];
    }),
    compensationDisclosed: disclosed,
    compensation: disclosed
      ? {
          details: str(compensation['details']),
          amountMin: num(compensation['amount_min']),
          amountMax: num(compensation['amount_max']),
          currency: str(compensation['currency']),
          rateUnit: str(compensation['rate_unit']),
        }
      : null,
  };
}

export function toProjectCard(value: unknown): ProjectCard | null {
  const raw = asObject(value);
  const projectId = str(raw['project_id']);
  if (projectId === null) return null;
  const summary = asObject(raw['role_summary']);

  return {
    projectId,
    title: str(raw['title']) ?? '',
    isRestricted: bool(raw['is_restricted']),
    projectType: str(raw['project_type']) ?? 'other',
    summary: str(raw['summary']) ?? '',
    expectedOutcome: str(raw['expected_outcome']),
    sector: str(raw['sector']),
    visibility: str(raw['visibility']) ?? 'network',
    disclosureLevel: str(raw['disclosure_level']) ?? 'full',
    requiresNda: bool(raw['requires_nda']),
    compensationType: str(raw['compensation_type']) ?? 'to_be_defined',
    compensationStatement: str(raw['compensation_statement']),
    status: str(raw['status']) ?? 'recruiting',
    startDate: str(raw['start_date']),
    applicationDeadline: str(raw['application_deadline']),
    targetEndDate: str(raw['target_end_date']),
    publishedAt: str(raw['published_at']),
    teamConfirmedAt: str(raw['team_confirmed_at']),
    createdAt: str(raw['created_at']) ?? '',
    owner: toProfileCard(raw['owner']),
    isOwner: bool(raw['is_owner']),
    isMember: bool(raw['is_member']),
    countries: strings(raw['countries']),
    roleSummary: {
      totalSeats: num(summary['total_seats']) ?? 0,
      filledSeats: num(summary['filled_seats']) ?? 0,
      openRoles: num(summary['open_roles']) ?? 0,
    },
    soughtRoles: strings(raw['sought_roles']),
    relevanceLabel: str(raw['relevance_label']),
    reasons: toMatchReasons(raw['reasons']),
    myApplication: toApplicationRef(raw['my_application']),
    myInvitation: toInvitationRef(raw['my_invitation']),
    myMembership: toMembershipRef(raw['my_membership']),
  };
}

function toMilestones(value: unknown): ProjectMilestone[] {
  return asArray(value).flatMap((entry) => {
    const raw = asObject(entry);
    const milestoneId = str(raw['milestone_id']);
    if (milestoneId === null) return [];
    return [
      {
        milestoneId,
        title: str(raw['title']) ?? '',
        description: str(raw['description']),
        dueDate: str(raw['due_date']),
        status: str(raw['status']) ?? 'todo',
        sortOrder: num(raw['sort_order']) ?? 0,
        isMine: bool(raw['is_mine']),
      },
    ];
  });
}

export function toProjectDetail(value: unknown): ProjectDetail | null {
  const card = toProjectCard(value);
  if (card === null) return null;
  const raw = asObject(value);
  const closure = asObject(raw['closure']);
  const outcomeStatus = str(closure['outcome_status']);

  return {
    ...card,
    description: str(raw['description']),
    qualificationCriteria: str(raw['qualification_criteria']),
    tenderReference: str(raw['tender_reference']),
    sourceType: str(raw['source_type']),
    sourceCommunity: str(raw['source_community']),
    roles: asArray(raw['roles']).flatMap((entry) => {
      const role = toProjectRole(entry);
      return role === null ? [] : [role];
    }),
    team: asArray(raw['team']).flatMap((entry) => {
      const member = asObject(entry);
      const memberId = str(member['member_id']);
      if (memberId === null) return [];
      return [
        {
          memberId,
          membershipRole: str(member['membership_role']) ?? 'member',
          membershipStatus: str(member['membership_status']) ?? 'pending_confirmation',
          roleTitle: str(member['role_title']),
          confirmedAt: str(member['confirmed_at']),
          profile: toProfileCard(member['profile']),
        },
      ];
    }),
    milestones: toMilestones(raw['milestones']),
    links: asArray(raw['links']).flatMap((entry) => {
      const link = asObject(entry);
      const linkId = str(link['link_id']);
      if (linkId === null) return [];
      return [
        {
          linkId,
          label: str(link['label']) ?? '',
          url: str(link['url']) ?? '',
          linkType: str(link['link_type']) ?? 'other',
          isConfidential: bool(link['is_confidential']),
        },
      ];
    }),
    closure:
      outcomeStatus === null
        ? null
        : {
            outcomeStatus,
            expectedOutcomeAchieved: str(closure['expected_outcome_achieved']) ?? 'partially',
            outcomeCode: str(closure['outcome_code']),
            deliverableTitle: str(closure['deliverable_title']),
            deliverableUrl: str(closure['deliverable_url']),
            closedAt: str(closure['closed_at']),
          },
  };
}

export function toProjectParticipation(value: unknown): ProjectParticipation | null {
  const detail = toProjectDetail(value);
  if (detail === null) return null;
  const raw = asObject(value);
  const mine = asObject(raw['my_participation']);
  const impact = asObject(raw['impact']);
  const memberId = str(mine['member_id']);
  const next = toMilestones([raw['next_milestone']]);

  return {
    ...detail,
    myParticipation:
      memberId === null
        ? null
        : {
            memberId,
            membershipRole: str(mine['membership_role']) ?? 'member',
            membershipStatus: str(mine['membership_status']) ?? 'pending_confirmation',
            confirmedAt: str(mine['confirmed_at']),
            roleTitle: str(mine['role_title']),
          },
    myMilestones: toMilestones(raw['my_milestones']),
    nextMilestone: next[0] ?? null,
    impact: {
      membersConfirmed: num(impact['members_confirmed']) ?? 0,
      rolesFilled: num(impact['roles_filled']) ?? 0,
      rolesTotal: num(impact['roles_total']) ?? 0,
      milestonesDone: num(impact['milestones_done']) ?? 0,
      milestonesTotal: num(impact['milestones_total']) ?? 0,
    },
  };
}

export function toProjectFinancials(value: unknown): ProjectFinancials | null {
  const raw = asObject(value);
  if (Object.keys(raw).length === 0) return null;
  return {
    clientName: str(raw['client_name']),
    funderName: str(raw['funder_name']),
    budgetEstimate: num(raw['budget_estimate']),
    budgetCurrency: str(raw['budget_currency']),
    financialNotes: str(raw['financial_notes']),
    revenueGenerated: num(raw['revenue_generated']),
    revenueCurrency: str(raw['revenue_currency']),
  };
}
