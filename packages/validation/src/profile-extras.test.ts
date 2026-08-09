import { describe, expect, it } from 'vitest';
import {
  availabilitySettingsSchema,
  positioningSchema,
  profileGeographiesSchema,
  profileLanguagesSchema,
  profileProjectSchema,
  profileToolsSchema,
  recommendationAcceptSchema,
  recommendationModerationSchema,
  recommendationRequestSchema,
} from './profile-extras';

const REQUEST_UUID = '7f3c2a10-1111-4222-8333-444455556666';

describe('ISE-024 — positionnement', () => {
  it('accepte une selection valide avec secteur principal', () => {
    const result = positioningSchema.safeParse({
      sectorIds: [1, 2, 3],
      primarySectorId: 2,
      functionIds: [4],
      expertiseAreaIds: [5, 6],
    });
    expect(result.success).toBe(true);
  });

  it('refuse un secteur principal hors selection', () => {
    const result = positioningSchema.safeParse({
      sectorIds: [1, 2],
      primarySectorId: 9,
      functionIds: [],
      expertiseAreaIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('refuse plus de secteurs que le referentiel n en contient', () => {
    const result = positioningSchema.safeParse({
      sectorIds: Array.from({ length: 36 }, (_, i) => i + 1),
      functionIds: [],
      expertiseAreaIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('ISE-026 — projet', () => {
  const valid = {
    title: 'Refonte du dispositif de suivi-évaluation',
    organizationNameRaw: 'Programme régional',
    role: 'Pilotage méthodologique',
    startDate: '2024-01-01',
    endDate: '2024-12-01',
    summary: 'Conception du cadre de résultats.',
    outcome: 'Reporting mensuel harmonisé dans 6 pays.',
    visibility: 'members' as const,
  };

  it('accepte un projet complet', () => {
    expect(profileProjectSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse une fin anterieure au debut', () => {
    const result = profileProjectSchema.safeParse({
      ...valid,
      startDate: '2024-06-01',
      endDate: '2024-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('refuse un lien invalide et un titre trop court', () => {
    expect(profileProjectSchema.safeParse({ ...valid, linkUrl: 'pas-un-lien' }).success).toBe(
      false,
    );
    expect(profileProjectSchema.safeParse({ ...valid, title: 'ab' }).success).toBe(false);
  });
});

describe('ISE-027 — langues, zones, outils', () => {
  it('accepte des langues aux 5 niveaux reels', () => {
    const result = profileLanguagesSchema.safeParse({
      entries: [
        { languageCode: 'fr', proficiency: 'native' },
        { languageCode: 'en', proficiency: 'professional' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('refuse un niveau inconnu et une langue en double', () => {
    expect(
      profileLanguagesSchema.safeParse({
        entries: [{ languageCode: 'fr', proficiency: 'excellent' }],
      }).success,
    ).toBe(false);
    expect(
      profileLanguagesSchema.safeParse({
        entries: [
          { languageCode: 'fr', proficiency: 'native' },
          { languageCode: 'fr', proficiency: 'basic' },
        ],
      }).success,
    ).toBe(false);
  });

  it('refuse un code pays hors ISO-2 et un doublon', () => {
    expect(profileGeographiesSchema.safeParse({ countryCodes: ['CIV'] }).success).toBe(false);
    expect(profileGeographiesSchema.safeParse({ countryCodes: ['CI', 'CI'] }).success).toBe(false);
    expect(profileGeographiesSchema.safeParse({ countryCodes: ['CI', 'SN'] }).success).toBe(true);
  });

  it('accepte un outil sans niveau (le niveau est declaratif, D-75)', () => {
    expect(profileToolsSchema.safeParse({ entries: [{ toolId: 3 }] }).success).toBe(true);
    expect(profileToolsSchema.safeParse({ entries: [{ toolId: 3 }, { toolId: 3 }] }).success).toBe(
      false,
    );
  });
});

describe('ISE-029 — demande de recommandation', () => {
  const valid = {
    recipientProfileId: REQUEST_UUID,
    relationship: 'project' as const,
    context: 'Projet régional · 2024',
    message: 'Bonjour, pourrais-tu témoigner de ma contribution en suivi-évaluation ?',
  };

  it('accepte une demande contextualisee', () => {
    expect(recommendationRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse un message trop court : jamais un simple like (§19)', () => {
    expect(
      recommendationRequestSchema.safeParse({ ...valid, message: 'Recommande-moi' }).success,
    ).toBe(false);
  });

  it('refuse une nature de relation inconnue', () => {
    expect(recommendationRequestSchema.safeParse({ ...valid, relationship: 'ami' }).success).toBe(
      false,
    );
  });
});

describe('ISE-028 — reponse et moderation', () => {
  it('borne le texte a 40-2000 caracteres comme la base', () => {
    const base = {
      requestId: REQUEST_UUID,
      relationshipContext: 'Collaboration projet',
      visibility: 'members' as const,
    };
    expect(recommendationAcceptSchema.safeParse({ ...base, body: 'Trop court.' }).success).toBe(
      false,
    );
    expect(recommendationAcceptSchema.safeParse({ ...base, body: 'x'.repeat(2001) }).success).toBe(
      false,
    );
    expect(recommendationAcceptSchema.safeParse({ ...base, body: 'x'.repeat(120) }).success).toBe(
      true,
    );
  });

  it('le sujet ne peut que publier ou masquer', () => {
    expect(
      recommendationModerationSchema.safeParse({
        recommendationId: REQUEST_UUID,
        action: 'hide',
      }).success,
    ).toBe(true);
    expect(
      recommendationModerationSchema.safeParse({
        recommendationId: REQUEST_UUID,
        action: 'rewrite',
      }).success,
    ).toBe(false);
  });
});

describe('ISE-033 — disponibilite', () => {
  it('accepte un reglage complet dans les bornes de la base', () => {
    const result = availabilitySettingsSchema.safeParse({
      activeTypes: ['mentorship', 'ad_hoc_expertise'],
      maxPerMonth: 4,
      idealDelayDays: 5,
      preferredChannel: 'message',
      visibility: 'members',
      notes: 'Disponibilité variable selon périodes de mission.',
    });
    expect(result.success).toBe(true);
  });

  it('refuse les valeurs hors bornes de la base (1-60, 1-365)', () => {
    expect(availabilitySettingsSchema.safeParse({ activeTypes: [], maxPerMonth: 0 }).success).toBe(
      false,
    );
    expect(
      availabilitySettingsSchema.safeParse({ activeTypes: [], idealDelayDays: 400 }).success,
    ).toBe(false);
  });

  it('refuse un canal inconnu et un type active en double', () => {
    expect(
      availabilitySettingsSchema.safeParse({ activeTypes: [], preferredChannel: 'fax' }).success,
    ).toBe(false);
    expect(
      availabilitySettingsSchema.safeParse({ activeTypes: ['mentorship', 'mentorship'] }).success,
    ).toBe(false);
  });
});
