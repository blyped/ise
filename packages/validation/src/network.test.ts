import { describe, expect, it } from 'vitest';
import { limits } from '@ise/config';
import {
  INTRODUCTION_OUTCOMES,
  connectionRequestSchema,
  connectionResponseSchema,
  introductionOutcomeSchema,
  introductionRequestSchema,
  introductionTransitionSchema,
  searchCriteriaSchema,
} from './network';

const UUID_A = '11111111-2222-4333-8444-555555555555';
const UUID_B = '66666666-7777-4888-8999-000000000000';

const VALID_INTRODUCTION = {
  intermediaryProfileId: UUID_A,
  targetProfileId: UUID_B,
  purpose: 'advice' as const,
  messageToIntermediary: "J'aimerais échanger sur le suivi-évaluation au Sahel.",
};

function issuePaths(result: { error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((i) => i.path.join('.'));
}

describe('introductionRequestSchema (ISE-044)', () => {
  it('accepte une demande motivée', () => {
    expect(introductionRequestSchema.safeParse(VALID_INTRODUCTION).success).toBe(true);
  });

  it('rejette un message de moins de 20 caractères', () => {
    const result = introductionRequestSchema.safeParse({
      ...VALID_INTRODUCTION,
      messageToIntermediary: 'Bonjour, merci.',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('messageToIntermediary');
  });

  it('accepte exactement 20 caractères, refuse 19', () => {
    expect(
      introductionRequestSchema.safeParse({
        ...VALID_INTRODUCTION,
        messageToIntermediary: 'a'.repeat(20),
      }).success,
    ).toBe(true);
    expect(
      introductionRequestSchema.safeParse({
        ...VALID_INTRODUCTION,
        messageToIntermediary: 'a'.repeat(19),
      }).success,
    ).toBe(false);
  });

  it('les espaces ne permettent pas de contourner le minimum', () => {
    const result = introductionRequestSchema.safeParse({
      ...VALID_INTRODUCTION,
      messageToIntermediary: `   ${'a'.repeat(19)}   `,
    });
    expect(result.success).toBe(false);
  });

  it('plafonne le message au maximum configuré', () => {
    const max = limits.text.introductionMessageMax;
    expect(
      introductionRequestSchema.safeParse({
        ...VALID_INTRODUCTION,
        messageToIntermediary: 'a'.repeat(max),
      }).success,
    ).toBe(true);
    expect(
      introductionRequestSchema.safeParse({
        ...VALID_INTRODUCTION,
        messageToIntermediary: 'a'.repeat(max + 1),
      }).success,
    ).toBe(false);
  });

  it('exige des identifiants valides et un motif de la liste', () => {
    expect(
      introductionRequestSchema.safeParse({ ...VALID_INTRODUCTION, targetProfileId: 'abc' })
        .success,
    ).toBe(false);
    expect(
      introductionRequestSchema.safeParse({ ...VALID_INTRODUCTION, purpose: 'curiosité' }).success,
    ).toBe(false);
  });
});

describe('connectionRequestSchema (ISE-038)', () => {
  it('accepte une demande sans message', () => {
    expect(connectionRequestSchema.safeParse({ addresseeProfileId: UUID_A }).success).toBe(true);
  });

  it('plafonne le message d’accroche', () => {
    const max = limits.text.connectionMessageMax;
    expect(
      connectionRequestSchema.safeParse({
        addresseeProfileId: UUID_A,
        message: 'a'.repeat(max + 1),
      }).success,
    ).toBe(false);
  });
});

describe('connectionResponseSchema (ISE-041 / ISE-042)', () => {
  it('accepte les deux seules décisions écrivables', () => {
    expect(
      connectionResponseSchema.safeParse({ requestId: UUID_A, decision: 'declined' }).success,
    ).toBe(true);
    expect(
      connectionResponseSchema.safeParse({ requestId: UUID_A, decision: 'withdrawn' }).success,
    ).toBe(true);
  });

  it('refuse « accepted » : l’acceptation passe par la fonction atomique', () => {
    expect(
      connectionResponseSchema.safeParse({ requestId: UUID_A, decision: 'accepted' }).success,
    ).toBe(false);
  });

  it('refuse « ignored » : ignorer n’écrit rien (D-55)', () => {
    expect(
      connectionResponseSchema.safeParse({ requestId: UUID_A, decision: 'ignored' }).success,
    ).toBe(false);
  });
});

describe('introductionTransitionSchema (ISE-045, D-50)', () => {
  it('accepte les transitions déclenchables depuis l’interface', () => {
    for (const toStatus of [
      'intermediary_accepted',
      'intermediary_declined',
      'withdrawn',
      'introduced',
      'target_responded',
    ]) {
      expect(
        introductionTransitionSchema.safeParse({ introductionId: UUID_A, toStatus }).success,
        toStatus,
      ).toBe(true);
    }
  });

  /*
    MASTER PROMPT §25 : un état terminal suppose un RÉSULTAT DÉCLARÉ.
    Il ne peut donc pas être posé par un simple bouton de transition.
  */
  it('refuse « completed » et « no_outcome » : ils exigent un bilan', () => {
    expect(
      introductionTransitionSchema.safeParse({ introductionId: UUID_A, toStatus: 'completed' })
        .success,
    ).toBe(false);
    expect(
      introductionTransitionSchema.safeParse({ introductionId: UUID_A, toStatus: 'no_outcome' })
        .success,
    ).toBe(false);
  });

  it('refuse « expired » : seul le système expire une demande', () => {
    expect(
      introductionTransitionSchema.safeParse({ introductionId: UUID_A, toStatus: 'expired' })
        .success,
    ).toBe(false);
  });
});

describe('introductionOutcomeSchema (ISE-046)', () => {
  it('accepte les six résultats du référentiel', () => {
    for (const outcome of INTRODUCTION_OUTCOMES) {
      expect(
        introductionOutcomeSchema.safeParse({ introductionId: UUID_A, outcome }).success,
        outcome,
      ).toBe(true);
    }
    expect(INTRODUCTION_OUTCOMES).toHaveLength(6);
  });

  /*
    Aucun libellé de résultat n'affirme une réussite : le vocabulaire
    décrit un fait (un échange, une collaboration envisagée, une
    orientation, une absence de suite).
  */
  it('n’expose aucun résultat du type « réussie »', () => {
    for (const outcome of INTRODUCTION_OUTCOMES) {
      expect(outcome).not.toMatch(/success|succeeded|reussi/i);
    }
  });

  it('refuse un résultat hors référentiel', () => {
    expect(
      introductionOutcomeSchema.safeParse({
        introductionId: UUID_A,
        outcome: 'introduction_reussie',
      }).success,
    ).toBe(false);
  });

  it('plafonne la note libre', () => {
    const max = limits.text.introductionMessageMax;
    expect(
      introductionOutcomeSchema.safeParse({
        introductionId: UUID_A,
        outcome: 'exchange_held',
        note: 'a'.repeat(max),
      }).success,
    ).toBe(true);
    expect(
      introductionOutcomeSchema.safeParse({
        introductionId: UUID_A,
        outcome: 'exchange_held',
        note: 'a'.repeat(max + 1),
      }).success,
    ).toBe(false);
  });
});

describe('searchCriteriaSchema (ISE-034 / ISE-035, D-44)', () => {
  it('applique pageSize = 20 par défaut', () => {
    const result = searchCriteriaSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data!.pageSize).toBe(20);
    expect(result.data!.pageSize).toBe(limits.pageSize.web);
  });

  it('refuse une page au-delà de 50', () => {
    expect(searchCriteriaSchema.safeParse({ pageSize: 50 }).success).toBe(true);
    expect(searchCriteriaSchema.safeParse({ pageSize: 51 }).success).toBe(false);
    expect(searchCriteriaSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    expect(limits.pageSize.max).toBe(50);
  });

  it('refuse une page nulle, négative ou fractionnaire', () => {
    for (const pageSize of [0, -1, 2.5]) {
      expect(searchCriteriaSchema.safeParse({ pageSize }).success, String(pageSize)).toBe(false);
    }
  });

  it('initialise toutes les listes de filtres à vide', () => {
    const data = searchCriteriaSchema.parse({});
    expect(data.skillIds).toEqual([]);
    expect(data.sectorIds).toEqual([]);
    expect(data.countryCodes).toEqual([]);
    expect(data.promotionIds).toEqual([]);
    expect(data.languageCodes).toEqual([]);
    expect(data.availabilityTypes).toEqual([]);
    expect(data.cursor).toBeUndefined();
  });

  it('borne le nombre de filtres cumulables', () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1);
    expect(searchCriteriaSchema.safeParse({ skillIds: ids }).success).toBe(false);
    expect(searchCriteriaSchema.safeParse({ skillIds: ids.slice(0, 10) }).success).toBe(true);
  });

  it('exige des codes pays sur deux caractères', () => {
    expect(searchCriteriaSchema.safeParse({ countryCodes: ['SN'] }).success).toBe(true);
    expect(searchCriteriaSchema.safeParse({ countryCodes: ['SEN'] }).success).toBe(false);
  });

  it('borne les années d’expérience minimales', () => {
    expect(searchCriteriaSchema.safeParse({ minYearsOfExperience: 0 }).success).toBe(true);
    expect(searchCriteriaSchema.safeParse({ minYearsOfExperience: 61 }).success).toBe(false);
  });
});
