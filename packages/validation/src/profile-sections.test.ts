import { describe, expect, it } from 'vitest';
import {
  educationSchema,
  profileSkillIdSchema,
  profileVisibilityBatchSchema,
  profileVisibilitySchema,
  sectionRowIdSchema,
  visibilitySchema,
} from './profile-sections';

const validEducation = {
  educationType: 'academic' as const,
  institution: 'ENSEA',
  degree: 'Diplôme d’Ingénieur Statisticien Économiste',
  fieldOfStudy: '',
  countryCode: '',
  city: '',
  startYear: '',
  endYear: '',
  credentialUrl: '',
  description: '',
  visibility: 'members' as const,
};

describe('ISE-021 — formation', () => {
  it('accepte une formation minimale', () => {
    expect(educationSchema.safeParse(validEducation).success).toBe(true);
  });

  it('exige l etablissement et l intitule', () => {
    expect(educationSchema.safeParse({ ...validEducation, institution: 'A' }).success).toBe(false);
    expect(educationSchema.safeParse({ ...validEducation, degree: '' }).success).toBe(false);
  });

  it('refuse une annee d obtention anterieure a l annee de debut', () => {
    const result = educationSchema.safeParse({
      ...validEducation,
      startYear: '2005',
      endYear: '2003',
    });
    expect(result.success).toBe(false);
  });

  it('accepte des annees coherentes', () => {
    expect(
      educationSchema.safeParse({ ...validEducation, startYear: '2000', endYear: '2003' }).success,
    ).toBe(true);
  });

  it('refuse un justificatif qui n est pas une adresse', () => {
    expect(
      educationSchema.safeParse({ ...validEducation, credentialUrl: 'pas-une-url' }).success,
    ).toBe(false);
    expect(
      educationSchema.safeParse({ ...validEducation, credentialUrl: 'https://ensea.ci/x' }).success,
    ).toBe(true);
  });

  it('n accepte que les deux types documentes', () => {
    expect(educationSchema.safeParse({ ...validEducation, educationType: 'autre' }).success).toBe(
      false,
    );
    expect(
      educationSchema.safeParse({ ...validEducation, educationType: 'certification' }).success,
    ).toBe(true);
  });
});

describe('visibilite par champ (D-73)', () => {
  it('n admet que les 4 niveaux de l echelle unifiee', () => {
    for (const level of ['private', 'connections', 'promotion', 'members']) {
      expect(visibilitySchema.safeParse(level).success).toBe(true);
    }
    expect(visibilitySchema.safeParse('public').success).toBe(false);
  });

  it('valide un couple champ / niveau', () => {
    expect(
      profileVisibilitySchema.safeParse({ fieldKey: 'bio', visibility: 'connections' }).success,
    ).toBe(true);
    expect(
      profileVisibilitySchema.safeParse({ fieldKey: 'b', visibility: 'members' }).success,
    ).toBe(false);
  });

  it('refuse un lot vide', () => {
    expect(profileVisibilityBatchSchema.safeParse({ entries: [] }).success).toBe(false);
  });

  it('accepte un lot de plusieurs champs', () => {
    const result = profileVisibilityBatchSchema.safeParse({
      entries: [
        { fieldKey: 'bio', visibility: 'members' },
        { fieldKey: 'city', visibility: 'promotion' },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('identifiants de ligne', () => {
  it('exige un uuid pour une section', () => {
    expect(sectionRowIdSchema.safeParse({ id: 'abc' }).success).toBe(false);
    expect(
      sectionRowIdSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001' }).success,
    ).toBe(true);
  });

  it('exige un entier positif pour une competence', () => {
    expect(profileSkillIdSchema.safeParse({ skillId: '12' }).success).toBe(true);
    expect(profileSkillIdSchema.safeParse({ skillId: '0' }).success).toBe(false);
    expect(profileSkillIdSchema.safeParse({ skillId: 'x' }).success).toBe(false);
  });
});
