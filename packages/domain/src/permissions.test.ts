import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  isAdminRole,
  type Permission,
  type Role,
} from './permissions';

/**
 * Matrice attendue, RE-SAISIE ICI de facon independante.
 * Elle ne derive pas de ROLE_PERMISSIONS : c'est ce qui permet au test
 * de detecter une permission accordee par erreur ou une faute de frappe.
 */
const EXPECTED: Readonly<Record<Role, readonly Permission[]>> = {
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
  superadmin: [...PERMISSIONS],
};

describe('référentiel des permissions', () => {
  it('compte exactement 21 permissions, sans doublon', () => {
    expect(PERMISSIONS).toHaveLength(21);
    expect(new Set(PERMISSIONS).size).toBe(21);
  });

  it('compte 10 rôles, sans doublon', () => {
    expect(ROLES).toHaveLength(10);
    expect(new Set(ROLES).size).toBe(10);
  });

  it('ROLE_PERMISSIONS couvre tous les rôles déclarés, et eux seuls', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ROLES].sort());
  });

  it('ROLE_PERMISSIONS ne référence que des permissions de PERMISSIONS (pas de faute de frappe)', () => {
    const known = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(known.has(permission), `${role} → « ${permission} » inconnue`).toBe(true);
      }
    }
  });

  it('aucun rôle ne liste deux fois la même permission', () => {
    for (const role of ROLES) {
      const list = ROLE_PERMISSIONS[role];
      expect(new Set(list).size, role).toBe(list.length);
    }
  });

  it('chaque permission est nommée « domaine.action »', () => {
    for (const permission of PERMISSIONS) {
      expect(permission, permission).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });
});

describe('rôles et permissions — matrice exacte (D-30 à D-32)', () => {
  it('superadmin possède les 21 permissions', () => {
    expect(ROLE_PERMISSIONS.superadmin).toHaveLength(21);
    for (const permission of PERMISSIONS) {
      expect(hasPermission(['superadmin'], permission), permission).toBe(true);
    }
  });

  it("member et student n'en possèdent aucune", () => {
    expect(ROLE_PERMISSIONS.member).toEqual([]);
    expect(ROLE_PERMISSIONS.student).toEqual([]);
    for (const permission of PERMISSIONS) {
      expect(hasPermission(['member'], permission), permission).toBe(false);
      expect(hasPermission(['student'], permission), permission).toBe(false);
      expect(hasPermission(['member', 'student'], permission), permission).toBe(false);
    }
  });

  it('la matrice déclarée correspond exactement à la matrice attendue', () => {
    for (const role of ROLES) {
      expect([...ROLE_PERMISSIONS[role]].sort(), role).toEqual([...EXPECTED[role]].sort());
    }
  });

  it('hasPermission est exact sur les 210 combinaisons rôle × permission', () => {
    let checked = 0;
    for (const role of ROLES) {
      const granted = new Set<string>(EXPECTED[role]);
      for (const permission of PERMISSIONS) {
        checked += 1;
        expect(hasPermission([role], permission), `${role} / ${permission}`).toBe(
          granted.has(permission),
        );
      }
    }
    expect(checked).toBe(ROLES.length * PERMISSIONS.length);
  });

  it('aucun rôle non-superadmin ne détient les permissions les plus sensibles', () => {
    const sensitive: readonly Permission[] = [
      'roles.manage',
      'settings.manage',
      'audit.read',
      'profiles.verify',
    ];
    for (const role of ROLES.filter((r) => r !== 'superadmin')) {
      for (const permission of sensitive) {
        if (EXPECTED[role].includes(permission)) continue;
        expect(hasPermission([role], permission), `${role} / ${permission}`).toBe(false);
      }
    }
    expect(hasPermission(['moderator'], 'roles.manage')).toBe(false);
    expect(hasPermission(['analyst'], 'audit.read')).toBe(false);
    expect(hasPermission(['support_agent'], 'settings.manage')).toBe(false);
    expect(hasPermission(['ops'], 'roles.manage')).toBe(false);
  });

  it('un cumul de rôles est une union, jamais davantage', () => {
    for (const permission of PERMISSIONS) {
      const union =
        EXPECTED.analyst.includes(permission) || EXPECTED.content_manager.includes(permission);
      expect(hasPermission(['analyst', 'content_manager'], permission), permission).toBe(union);
    }
  });

  it("l'absence de rôle n'accorde rien", () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission([], permission), permission).toBe(false);
    }
  });
});

describe('rôles d’administration', () => {
  it('ADMIN_ROLES ne contient que des rôles déclarés', () => {
    for (const role of ADMIN_ROLES) expect(ROLES).toContain(role);
  });

  it('member et student ne sont pas des rôles d’administration', () => {
    expect(isAdminRole('member')).toBe(false);
    expect(isAdminRole('student')).toBe(false);
    expect(isAdminRole('promotion_manager')).toBe(false);
  });

  it('isAdminRole est cohérent avec ADMIN_ROLES pour les 10 rôles', () => {
    for (const role of ROLES) {
      expect(isAdminRole(role), role).toBe(ADMIN_ROLES.includes(role));
    }
  });

  it('tout rôle d’administration porte au moins une permission', () => {
    for (const role of ADMIN_ROLES) {
      expect(ROLE_PERMISSIONS[role].length, role).toBeGreaterThan(0);
    }
  });
});
