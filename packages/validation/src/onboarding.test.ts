import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_MAX_SECTORS,
  ONBOARDING_MAX_SKILLS,
  ONBOARDING_STEPS,
  onboardingAvailabilitySchema,
  onboardingFinalizeSchema,
  onboardingLocationSchema,
  onboardingPromotionSchema,
  onboardingSectorsSchema,
  onboardingSkillsSchema,
  onboardingStepNumber,
  onboardingStepSlug,
  onboardingVerificationSchema,
  promotionSuggestionSchema,
  AVAILABILITY_INTENSITY_MAX_PER_MONTH,
} from './onboarding';

describe('etapes de l onboarding (D-70)', () => {
  it('compte exactement 7 etapes, dans l ordre des maquettes', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'verification',
      'promotion',
      'competences',
      'secteurs',
      'localisation',
      'disponibilite',
      'finalisation',
    ]);
  });

  it('place les secteurs a l etape 4 et la finalisation a l etape 7', () => {
    expect(onboardingStepNumber('secteurs')).toBe(4);
    expect(onboardingStepNumber('localisation')).toBe(5);
    expect(onboardingStepNumber('disponibilite')).toBe(6);
    expect(onboardingStepNumber('finalisation')).toBe(7);
  });

  it('borne la conversion numero -> slug', () => {
    expect(onboardingStepSlug(0)).toBe('verification');
    expect(onboardingStepSlug(1)).toBe('verification');
    expect(onboardingStepSlug(7)).toBe('finalisation');
    expect(onboardingStepSlug(99)).toBe('finalisation');
  });
});

describe('etape 1 — verification', () => {
  it('exige une confirmation explicite', () => {
    expect(onboardingVerificationSchema.safeParse({ acknowledged: 'on' }).success).toBe(true);
    expect(onboardingVerificationSchema.safeParse({ acknowledged: null }).success).toBe(false);
    expect(onboardingVerificationSchema.safeParse({}).success).toBe(false);
  });
});

describe('etape 2 — promotion', () => {
  it('accepte un identifiant de promotion transmis en chaine', () => {
    const result = onboardingPromotionSchema.safeParse({ promotionId: '42' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.promotionId).toBe(42);
  });

  it('refuse une absence de choix', () => {
    expect(onboardingPromotionSchema.safeParse({ promotionId: '' }).success).toBe(false);
    expect(onboardingPromotionSchema.safeParse({ promotionId: '0' }).success).toBe(false);
    expect(onboardingPromotionSchema.safeParse({ promotionId: '-3' }).success).toBe(false);
  });
});

describe('ISE-009 — signalement de promotion absente', () => {
  it('exige un libelle exploitable', () => {
    expect(promotionSuggestionSchema.safeParse({ promotionLabel: 'A' }).success).toBe(false);
    expect(promotionSuggestionSchema.safeParse({ promotionLabel: 'ISE 2006' }).success).toBe(true);
  });

  it('accepte les champs facultatifs vides', () => {
    const result = promotionSuggestionSchema.safeParse({
      promotionLabel: 'ISE 2006',
      institution: '',
      countryCode: '',
      approximateYear: '',
      comment: '',
    });
    expect(result.success).toBe(true);
  });

  it('borne l annee approximative', () => {
    expect(
      promotionSuggestionSchema.safeParse({ promotionLabel: 'ISE', approximateYear: '1800' })
        .success,
    ).toBe(false);
    expect(
      promotionSuggestionSchema.safeParse({ promotionLabel: 'ISE', approximateYear: '2006' })
        .success,
    ).toBe(true);
  });
});

describe('etape 3 — competences', () => {
  it('exige au moins une competence', () => {
    expect(onboardingSkillsSchema.safeParse({ skillIds: [] }).success).toBe(false);
  });

  it('plafonne la selection', () => {
    const tooMany = Array.from({ length: ONBOARDING_MAX_SKILLS + 1 }, (_, i) => String(i + 1));
    expect(onboardingSkillsSchema.safeParse({ skillIds: tooMany }).success).toBe(false);
  });

  it('convertit les identifiants postes en nombres', () => {
    const result = onboardingSkillsSchema.safeParse({ skillIds: ['3', '7'] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.skillIds).toEqual([3, 7]);
  });
});

describe('etape 4 — secteurs', () => {
  it('autorise une selection vide : l etape est passable', () => {
    expect(onboardingSectorsSchema.safeParse({ sectorIds: [] }).success).toBe(true);
  });

  it('plafonne la selection', () => {
    const tooMany = Array.from({ length: ONBOARDING_MAX_SECTORS + 1 }, (_, i) => String(i + 1));
    expect(onboardingSectorsSchema.safeParse({ sectorIds: tooMany }).success).toBe(false);
  });
});

describe('etape 5 — localisation', () => {
  const base = {
    currentCountryCode: 'CI',
    currentCity: 'Abidjan',
    experienceCountryCodes: ['CI', 'SN'],
    cityVisibility: 'members' as const,
  };

  it('accepte une localisation complete', () => {
    expect(onboardingLocationSchema.safeParse(base).success).toBe(true);
  });

  it('accepte l absence de pays et de ville', () => {
    expect(
      onboardingLocationSchema.safeParse({
        ...base,
        currentCountryCode: '',
        currentCity: '',
        experienceCountryCodes: [],
      }).success,
    ).toBe(true);
  });

  it('refuse un niveau de visibilite hors echelle (D-73)', () => {
    expect(onboardingLocationSchema.safeParse({ ...base, cityVisibility: 'public' }).success).toBe(
      false,
    );
  });

  it('refuse un code pays qui n en est pas un', () => {
    expect(
      onboardingLocationSchema.safeParse({ ...base, experienceCountryCodes: ['CIV'] }).success,
    ).toBe(false);
  });
});

describe('etape 6 — disponibilite', () => {
  const base = {
    availabilityTypes: ['mentorship', 'introduction'],
    intensity: 'moderate' as const,
    visibility: 'members' as const,
  };

  it('accepte une declaration complete', () => {
    expect(onboardingAvailabilitySchema.safeParse(base).success).toBe(true);
  });

  it('accepte l absence de forme d aide : l etape est passable', () => {
    expect(onboardingAvailabilitySchema.safeParse({ ...base, availabilityTypes: [] }).success).toBe(
      true,
    );
  });

  it('refuse un niveau de disponibilite inconnu', () => {
    expect(onboardingAvailabilitySchema.safeParse({ ...base, intensity: 'enorme' }).success).toBe(
      false,
    );
  });

  it('associe un plafond mensuel croissant a chaque niveau', () => {
    expect(AVAILABILITY_INTENSITY_MAX_PER_MONTH.low).toBeLessThan(
      AVAILABILITY_INTENSITY_MAX_PER_MONTH.moderate,
    );
    expect(AVAILABILITY_INTENSITY_MAX_PER_MONTH.moderate).toBeLessThan(
      AVAILABILITY_INTENSITY_MAX_PER_MONTH.high,
    );
  });
});

describe('etape 7 — finalisation', () => {
  it('exige la confirmation avant activation', () => {
    expect(onboardingFinalizeSchema.safeParse({ confirmed: 'on' }).success).toBe(true);
    expect(onboardingFinalizeSchema.safeParse({ confirmed: null }).success).toBe(false);
  });
});
