import { describe, expect, it } from 'vitest';
import { experienceSchema, profileHeaderSchema, profileSkillSchema } from './profile';

const VALID_EXPERIENCE = {
  organizationNameRaw: 'Ministère de la Santé',
  positionTitle: 'Chargé de suivi-évaluation',
  startDate: '2019-01-01',
  endDate: '2022-06-30',
};

function issuePaths(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((i) => i.path.join('.'));
}

describe('experienceSchema (ISE-019)', () => {
  it('accepte une expérience cohérente et applique les valeurs par défaut', () => {
    const result = experienceSchema.safeParse(VALID_EXPERIENCE);
    expect(result.success).toBe(true);
    expect(result.data!.isCurrent).toBe(false);
    expect(result.data!.visibility).toBe('members');
  });

  it('rejette une date de fin antérieure à la date de début', () => {
    const result = experienceSchema.safeParse({
      ...VALID_EXPERIENCE,
      startDate: '2022-01-01',
      endDate: '2021-12-31',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('endDate');
    expect(result.error!.issues.map((i) => i.message)).toContain(
      'La date de fin doit suivre la date de début.',
    );
  });

  it('accepte une date de fin égale à la date de début', () => {
    expect(
      experienceSchema.safeParse({
        ...VALID_EXPERIENCE,
        startDate: '2022-01-01',
        endDate: '2022-01-01',
      }).success,
    ).toBe(true);
  });

  it('rejette isCurrent: true accompagné d’une date de fin', () => {
    const result = experienceSchema.safeParse({ ...VALID_EXPERIENCE, isCurrent: true });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('endDate');
    expect(result.error!.issues.map((i) => i.message)).toContain(
      'Un poste en cours ne peut pas avoir de date de fin.',
    );
  });

  it('accepte isCurrent: true sans date de fin', () => {
    const { endDate: _omit, ...ongoing } = VALID_EXPERIENCE;
    expect(experienceSchema.safeParse({ ...ongoing, isCurrent: true }).success).toBe(true);
  });

  it('rejette une expérience sans organisation', () => {
    const { organizationNameRaw: _omit, ...orphan } = VALID_EXPERIENCE;
    const result = experienceSchema.safeParse(orphan);
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('organizationNameRaw');
    expect(result.error!.issues.map((i) => i.message)).toContain("Renseignez l'organisation.");
  });

  it('accepte une organisation référencée par identifiant', () => {
    const { organizationNameRaw: _omit, ...rest } = VALID_EXPERIENCE;
    expect(
      experienceSchema.safeParse({
        ...rest,
        organizationId: '11111111-2222-4333-8444-555555555555',
      }).success,
    ).toBe(true);
  });

  it('rejette un intitulé de poste trop court et une date non ISO', () => {
    expect(experienceSchema.safeParse({ ...VALID_EXPERIENCE, positionTitle: 'X' }).success).toBe(
      false,
    );
    expect(
      experienceSchema.safeParse({ ...VALID_EXPERIENCE, startDate: '01/01/2019' }).success,
    ).toBe(false);
  });

  it('refuse un niveau de visibilité hors échelle D-73', () => {
    expect(experienceSchema.safeParse({ ...VALID_EXPERIENCE, visibility: 'public' }).success).toBe(
      false,
    );
  });
});

describe('profileHeaderSchema (ISE-017)', () => {
  it('exige un prénom et un nom, et rogne les espaces', () => {
    const result = profileHeaderSchema.safeParse({ firstName: '  Awa  ', lastName: 'Diop' });
    expect(result.success).toBe(true);
    expect(result.data!.firstName).toBe('Awa');

    expect(profileHeaderSchema.safeParse({ firstName: '   ', lastName: 'Diop' }).success).toBe(
      false,
    );
  });

  it('refuse une URL LinkedIn invalide mais tolère la chaîne vide', () => {
    expect(
      profileHeaderSchema.safeParse({ firstName: 'Awa', lastName: 'Diop', linkedinUrl: 'nope' })
        .success,
    ).toBe(false);
    expect(
      profileHeaderSchema.safeParse({ firstName: 'Awa', lastName: 'Diop', linkedinUrl: '' })
        .success,
    ).toBe(true);
  });

  it('plafonne le titre et la biographie', () => {
    expect(
      profileHeaderSchema.safeParse({
        firstName: 'Awa',
        lastName: 'Diop',
        headline: 'x'.repeat(161),
      }).success,
    ).toBe(false);
    expect(
      profileHeaderSchema.safeParse({ firstName: 'Awa', lastName: 'Diop', bio: 'x'.repeat(2001) })
        .success,
    ).toBe(false);
  });
});

describe('profileSkillSchema (ISE-023)', () => {
  it('accepte les quatre niveaux déclaratifs et rien d’autre', () => {
    for (const level of ['notion', 'intermediate', 'advanced', 'expert']) {
      expect(profileSkillSchema.safeParse({ skillId: 1, level }).success, level).toBe(true);
    }
    expect(profileSkillSchema.safeParse({ skillId: 1, level: 'guru' }).success).toBe(false);
  });

  it('rend le niveau facultatif et isPrimary faux par défaut', () => {
    const result = profileSkillSchema.safeParse({ skillId: 1 });
    expect(result.success).toBe(true);
    expect(result.data!.level).toBeUndefined();
    expect(result.data!.isPrimary).toBe(false);
  });

  it('borne les années d’expérience', () => {
    expect(profileSkillSchema.safeParse({ skillId: 1, yearsExperience: -1 }).success).toBe(false);
    expect(profileSkillSchema.safeParse({ skillId: 1, yearsExperience: 61 }).success).toBe(false);
  });
});
