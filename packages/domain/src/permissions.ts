/**
 * Matrice roles x permissions. Miroir TypeScript du seed de la migration 0004.
 * MASTER PROMPT §39 ; docs/decisions.md D-30, D-31, D-32.
 *
 * ATTENTION : cette matrice sert a l'affichage conditionnel de l'interface,
 * JAMAIS a l'autorisation. La source de verite est `private.has_permission()`
 * cote base. Une interface qui masque un bouton ne protege rien.
 */
export const PERMISSIONS = [
  'profiles.read',
  'profiles.edit',
  'profiles.moderate',
  'profiles.verify',
  'promotions.manage',
  'calls.moderate',
  'opportunities.manage',
  'communities.manage',
  'projects.manage',
  'mentorship.manage',
  'events.manage',
  'content.publish',
  'imports.execute',
  'imports.review',
  'support.manage',
  'analytics.read',
  'settings.manage',
  'audit.read',
  'roles.manage',
  'ops.read',
  'ops.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  'member',
  'student',
  'promotion_manager',
  'moderator',
  'content_manager',
  'import_manager',
  'support_agent',
  'analyst',
  'ops',
  'superadmin',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  member: [],
  student: [],
  promotion_manager: ['profiles.verify'],
  moderator: [
    'profiles.read',
    'profiles.moderate',
    'calls.moderate',
    'communities.manage',
    'support.manage',
  ],
  content_manager: ['content.publish', 'events.manage'],
  import_manager: [
    'imports.execute',
    'imports.review',
    'profiles.read',
    'profiles.edit',
    'promotions.manage',
  ],
  support_agent: ['support.manage', 'profiles.read'],
  analyst: ['analytics.read'],
  ops: ['ops.read', 'ops.manage', 'analytics.read'],
  superadmin: PERMISSIONS,
};

export const ADMIN_ROLES: readonly Role[] = [
  'moderator',
  'content_manager',
  'import_manager',
  'support_agent',
  'analyst',
  'ops',
  'superadmin',
];

/** Aide a l'affichage uniquement. L'autorisation reelle est serveur. */
export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}
