import { describe, expect, it, vi } from 'vitest';
import { labelFor, rankCandidates, scoreCandidate, toPublicMatch } from './engine';
import type { Candidate, MatchCriteria, MatchResult, SkillLevel } from './types';
import { RELEVANCE_LABELS } from './types';
import {
  AVAILABILITY_POINTS,
  CRITERION_WEIGHTS,
  GEOGRAPHY_POINTS,
  LEVEL_MULTIPLIERS,
  RELEVANCE_THRESHOLDS,
  SECTOR_POINTS,
} from './weights';

/* -------------------------------------------------------------------------- */
/* Fabriques                                                                   */
/* -------------------------------------------------------------------------- */

const EMPTY_CANDIDATE: Candidate = {
  profileId: 'p-000',
  skills: [],
  sectorIds: [],
  experienceCountryCodes: [],
  residenceCountryCode: null,
  subregionCode: null,
  openAvailabilityTypes: [],
  hasAnyAvailability: false,
  yearsOfExperience: null,
  languageCodes: [],
  promotionId: null,
};

const EMPTY_CRITERIA: MatchCriteria = {
  skillIds: [],
  skillNames: {},
  sectorId: null,
  adjacentSectorIds: [],
  sectorName: null,
  countryCode: null,
  countryName: null,
  subregionCode: null,
  subregionName: null,
  availabilityType: null,
  availabilityLabel: null,
  minYearsOfExperience: null,
  languageCodes: [],
  promotionId: null,
};

function candidate(over: Partial<Candidate> = {}): Candidate {
  return { ...EMPTY_CANDIDATE, ...over };
}

function criteria(over: Partial<MatchCriteria> = {}): MatchCriteria {
  return { ...EMPTY_CRITERIA, ...over };
}

function skill(
  skillId: number,
  level: SkillLevel | null,
  isPrimary = false,
): Candidate['skills'][number] {
  return { skillId, name: `Compétence ${skillId}`, level, yearsExperience: null, isPrimary };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Score attendu : points obtenus rapportes au total des criteres DEMANDES. */
function expectedScore(points: number, requestedMax: number): number {
  return round2((points / requestedMax) * 100);
}

function scored(c: Candidate, k: MatchCriteria): MatchResult {
  const result = scoreCandidate(c, k);
  if (result === null) throw new Error('Le candidat aurait dû être retenu, il a été exclu.');
  return result;
}

/* -------------------------------------------------------------------------- */
/* Determinisme                                                                */
/* -------------------------------------------------------------------------- */

describe('déterminisme (MASTER PROMPT §22)', () => {
  const k = criteria({
    skillIds: [1, 2, 3],
    skillNames: { 1: 'Évaluation', 2: 'Suivi', 3: 'Budget' },
    sectorId: 7,
    adjacentSectorIds: [8],
    sectorName: 'Santé publique',
    countryCode: 'SN',
    countryName: 'Sénégal',
    subregionCode: 'AFO',
    subregionName: 'Afrique de l’Ouest',
    availabilityType: 'mentorship',
    availabilityLabel: 'Mentorat',
    minYearsOfExperience: 8,
    languageCodes: ['fr', 'en'],
    promotionId: 42,
  });

  const c = candidate({
    profileId: 'p-001',
    skills: [skill(1, 'expert', true), skill(2, 'advanced'), skill(3, null)],
    sectorIds: [8],
    experienceCountryCodes: ['SN', 'ML'],
    residenceCountryCode: 'FR',
    subregionCode: 'AFO',
    openAvailabilityTypes: ['mentorship'],
    hasAnyAvailability: true,
    yearsOfExperience: 12,
    languageCodes: ['fr'],
    promotionId: 42,
  });

  it('deux appels identiques produisent exactement le même résultat', () => {
    const a = scoreCandidate(c, k);
    const b = scoreCandidate(c, k);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("n'utilise ni horloge ni générateur aléatoire", () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random est interdit dans le moteur de matching.');
    });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now est interdit dans le moteur de matching.');
    });
    try {
      expect(scoreCandidate(c, k)).not.toBeNull();
      expect(rankCandidates([c], k)).toHaveLength(1);
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });

  it('rankCandidates est stable : à score égal, tri par profileId croissant', () => {
    const shuffled = ['p-c', 'p-a', 'p-d', 'p-b'].map((profileId) =>
      candidate({ profileId, skills: [skill(1, 'expert')], hasAnyAvailability: true }),
    );
    const k2 = criteria({ skillIds: [1], skillNames: { 1: 'Évaluation' } });

    const ranked = rankCandidates(shuffled, k2);
    expect(ranked.map((r) => r.profileId)).toEqual(['p-a', 'p-b', 'p-c', 'p-d']);
    // Tous ex aequo : c'est bien le departage par identifiant qui est teste.
    expect(new Set(ranked.map((r) => r.score)).size).toBe(1);
  });

  it("l'ordre de la liste d'entrée n'influence pas le classement", () => {
    const list = [
      candidate({ profileId: 'p-1', skills: [skill(1, 'expert')] }),
      candidate({ profileId: 'p-2', skills: [skill(1, 'notion')] }),
      candidate({ profileId: 'p-3', skills: [skill(1, 'advanced')] }),
      candidate({ profileId: 'p-4', skills: [skill(1, 'advanced')] }),
    ];
    const k2 = criteria({ skillIds: [1], skillNames: { 1: 'Évaluation' } });

    const forward = rankCandidates(list, k2);
    const backward = rankCandidates([...list].reverse(), k2);
    expect(forward).toEqual(backward);
    expect(forward.map((r) => r.profileId)).toEqual(['p-1', 'p-3', 'p-4', 'p-2']);
  });

  it('classe par score décroissant', () => {
    const k2 = criteria({ skillIds: [1], skillNames: { 1: 'Évaluation' } });
    const ranked = rankCandidates(
      [
        candidate({ profileId: 'p-notion', skills: [skill(1, 'notion')] }),
        candidate({ profileId: 'p-expert', skills: [skill(1, 'expert')] }),
      ],
      k2,
    );
    expect(ranked.map((r) => r.profileId)).toEqual(['p-expert', 'p-notion']);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });
});

/* -------------------------------------------------------------------------- */
/* Renormalisation                                                             */
/* -------------------------------------------------------------------------- */

describe('renormalisation : un critère non demandé ne pénalise pas (D-40)', () => {
  it('un candidat parfait sur TOUS les critères demandés atteint 100', () => {
    const k = criteria({
      skillIds: [1, 2],
      skillNames: { 1: 'Évaluation', 2: 'Suivi' },
      sectorId: 7,
      sectorName: 'Santé publique',
      countryCode: 'SN',
      countryName: 'Sénégal',
      availabilityType: 'mentorship',
      availabilityLabel: 'Mentorat',
      minYearsOfExperience: 10,
      languageCodes: ['fr'],
      promotionId: 42,
    });
    const c = candidate({
      skills: [skill(1, 'expert'), skill(2, 'expert')],
      sectorIds: [7],
      experienceCountryCodes: ['SN'],
      openAvailabilityTypes: ['mentorship'],
      hasAnyAvailability: true,
      yearsOfExperience: 12,
      languageCodes: ['fr'],
      promotionId: 42,
    });
    expect(scored(c, k).score).toBe(100);
  });

  it('aucune langue demandée : le candidat sans langue déclarée atteint quand même 100', () => {
    const k = criteria({ skillIds: [1], skillNames: { 1: 'Évaluation' }, languageCodes: [] });
    const c = candidate({ skills: [skill(1, 'expert')], languageCodes: [] });
    expect(scored(c, k).score).toBe(100);
  });

  it('aucune disponibilité demandée : le candidat parfait atteint 100, disponible ou non', () => {
    const k = criteria({ skillIds: [1], skillNames: { 1: 'Évaluation' }, availabilityType: null });
    expect(
      scored(candidate({ skills: [skill(1, 'expert')], hasAnyAvailability: true }), k).score,
    ).toBe(100);
    expect(
      scored(candidate({ skills: [skill(1, 'expert')], hasAnyAvailability: false }), k).score,
    ).toBe(100);
  });

  it('aucun secteur, pays, promotion ni expérience demandés : le candidat atteint 100', () => {
    const k = criteria({ skillIds: [1, 2], skillNames: { 1: 'a', 2: 'b' } });
    const c = candidate({ skills: [skill(1, 'expert'), skill(2, 'expert')] });
    expect(scored(c, k).score).toBe(100);
  });

  it('aucun critère demandé : le candidat est écarté plutôt que noté arbitrairement', () => {
    expect(scoreCandidate(candidate({ hasAnyAvailability: true }), criteria())).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Ponderations                                                                */
/* -------------------------------------------------------------------------- */

describe('pondérations (D-40 / D-41)', () => {
  it('un candidat qui ne matche QUE les compétences obtient la part skills / total demandé', () => {
    const requestedMax =
      CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.sector + CRITERION_WEIGHTS.language;
    const k = criteria({
      skillIds: [1, 2],
      skillNames: { 1: 'a', 2: 'b' },
      sectorId: 7,
      sectorName: 'Santé publique',
      languageCodes: ['fr', 'en'],
    });
    const c = candidate({
      skills: [skill(1, 'expert'), skill(2, 'expert')],
      sectorIds: [99],
      languageCodes: ['pt'],
    });

    const result = scored(c, k);
    expect(result.score).toBe(expectedScore(CRITERION_WEIGHTS.skills, requestedMax));
    expect(result.reasons.map((r) => r.criterion)).toEqual(['skills']);
  });

  it('secteur exact vaut plus que secteur connexe, qui vaut plus que rien', () => {
    const k = criteria({
      sectorId: 7,
      adjacentSectorIds: [8],
      sectorName: 'Santé publique',
      skillIds: [1],
      skillNames: { 1: 'a' },
    });
    const exact = scored(candidate({ skills: [skill(1, 'expert')], sectorIds: [7] }), k).score;
    const adjacent = scored(candidate({ skills: [skill(1, 'expert')], sectorIds: [8] }), k).score;
    const none = scored(candidate({ skills: [skill(1, 'expert')], sectorIds: [99] }), k).score;

    expect(exact).toBeGreaterThan(adjacent);
    expect(adjacent).toBeGreaterThan(none);

    const total = CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.sector;
    expect(exact).toBe(expectedScore(CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.sector, total));
    expect(adjacent).toBe(
      expectedScore(
        CRITERION_WEIGHTS.skills +
          (SECTOR_POINTS.adjacent / SECTOR_POINTS.exact) * CRITERION_WEIGHTS.sector,
        total,
      ),
    );
  });

  it('géographie : pays d’exercice > pays de résidence > même sous-région > rien', () => {
    const k = criteria({
      countryCode: 'SN',
      countryName: 'Sénégal',
      subregionCode: 'AFO',
      subregionName: 'Afrique de l’Ouest',
      skillIds: [1],
      skillNames: { 1: 'a' },
    });
    const worked = scored(
      candidate({ skills: [skill(1, 'expert')], experienceCountryCodes: ['SN'] }),
      k,
    ).score;
    const resides = scored(
      candidate({ skills: [skill(1, 'expert')], residenceCountryCode: 'SN' }),
      k,
    ).score;
    const subregion = scored(
      candidate({ skills: [skill(1, 'expert')], subregionCode: 'AFO' }),
      k,
    ).score;
    const nothing = scored(candidate({ skills: [skill(1, 'expert')] }), k).score;

    expect(worked).toBeGreaterThan(resides);
    expect(resides).toBeGreaterThan(subregion);
    expect(subregion).toBeGreaterThan(nothing);

    const total = CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.geography;
    const geoPart = (points: number) =>
      (points / GEOGRAPHY_POINTS.experienceCountryExact) * CRITERION_WEIGHTS.geography;
    expect(resides).toBe(
      expectedScore(
        CRITERION_WEIGHTS.skills + geoPart(GEOGRAPHY_POINTS.residenceCountryExact),
        total,
      ),
    );
    expect(subregion).toBe(
      expectedScore(CRITERION_WEIGHTS.skills + geoPart(GEOGRAPHY_POINTS.sameSubregion), total),
    );
  });

  it('disponibilité : type ouvert > disponible sans correspondance > indisponible', () => {
    const k = criteria({
      availabilityType: 'mentorship',
      availabilityLabel: 'Mentorat',
      skillIds: [1],
      skillNames: { 1: 'a' },
    });
    const open = scored(
      candidate({
        skills: [skill(1, 'expert')],
        openAvailabilityTypes: ['mentorship'],
        hasAnyAvailability: true,
      }),
      k,
    ).score;
    const partial = scored(
      candidate({ skills: [skill(1, 'expert')], hasAnyAvailability: true }),
      k,
    ).score;
    const closed = scored(
      candidate({ skills: [skill(1, 'expert')], hasAnyAvailability: false }),
      k,
    ).score;

    expect(open).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(closed);

    const total = CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.availability;
    expect(partial).toBe(
      expectedScore(
        CRITERION_WEIGHTS.skills +
          (AVAILABILITY_POINTS.availableWithoutTypeMatch / AVAILABILITY_POINTS.typeExplicitlyOpen) *
            CRITERION_WEIGHTS.availability,
        total,
      ),
    );
  });

  it('la promotion commune vaut exactement son poids', () => {
    const k = criteria({ skillIds: [1], skillNames: { 1: 'a' }, promotionId: 42 });
    const total = CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.promotion;
    const same = scored(candidate({ skills: [skill(1, 'expert')], promotionId: 42 }), k).score;
    const other = scored(candidate({ skills: [skill(1, 'expert')], promotionId: 7 }), k).score;
    expect(same).toBe(100);
    expect(other).toBe(expectedScore(CRITERION_WEIGHTS.skills, total));
  });

  it('les langues sont proportionnelles au nombre de langues demandées', () => {
    const k = criteria({ skillIds: [1], skillNames: { 1: 'a' }, languageCodes: ['fr', 'en'] });
    const total = CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.language;
    const one = scored(candidate({ skills: [skill(1, 'expert')], languageCodes: ['fr'] }), k).score;
    expect(one).toBe(
      expectedScore(CRITERION_WEIGHTS.skills + CRITERION_WEIGHTS.language / 2, total),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Multiplicateurs de niveau                                                   */
/* -------------------------------------------------------------------------- */

describe('multiplicateurs de niveau déclaré (D-41)', () => {
  const k = criteria({ skillIds: [1], skillNames: { 1: 'Évaluation' } });
  const scoreForLevel = (level: SkillLevel | null): number =>
    scored(candidate({ skills: [skill(1, level)] }), k).score;

  it('notion < intermediate < advanced < expert', () => {
    expect(scoreForLevel('notion')).toBeLessThan(scoreForLevel('intermediate'));
    expect(scoreForLevel('intermediate')).toBeLessThan(scoreForLevel('advanced'));
    expect(scoreForLevel('advanced')).toBeLessThan(scoreForLevel('expert'));
    expect(scoreForLevel('expert')).toBe(100);
  });

  it('un niveau non déclaré vaut 0,75 : entre intermediate et advanced', () => {
    expect(LEVEL_MULTIPLIERS.undeclared).toBe(0.75);
    const undeclared = scoreForLevel(null);
    expect(undeclared).toBeGreaterThan(scoreForLevel('intermediate'));
    expect(undeclared).toBeLessThan(scoreForLevel('advanced'));
  });

  it('chaque niveau restitue exactement son multiplicateur une fois renormalisé', () => {
    expect(scoreForLevel('notion')).toBe(round2(LEVEL_MULTIPLIERS.notion * 100));
    expect(scoreForLevel('intermediate')).toBe(round2(LEVEL_MULTIPLIERS.intermediate * 100));
    expect(scoreForLevel('advanced')).toBe(round2(LEVEL_MULTIPLIERS.advanced * 100));
    expect(scoreForLevel('expert')).toBe(round2(LEVEL_MULTIPLIERS.expert * 100));
    expect(scoreForLevel(null)).toBe(round2(LEVEL_MULTIPLIERS.undeclared * 100));
  });

  it('une compétence principale est valorisée, sans jamais dépasser le plafond', () => {
    const advanced = scored(candidate({ skills: [skill(1, 'advanced')] }), k).score;
    const advancedPrimary = scored(candidate({ skills: [skill(1, 'advanced', true)] }), k).score;
    expect(advancedPrimary).toBeGreaterThan(advanced);
    expect(advancedPrimary).toBeLessThanOrEqual(100);
    expect(scored(candidate({ skills: [skill(1, 'expert', true)] }), k).score).toBe(100);
  });
});

/* -------------------------------------------------------------------------- */
/* Couverture partielle                                                        */
/* -------------------------------------------------------------------------- */

describe('couverture partielle des compétences', () => {
  it('couvrir 2 compétences sur 5 score strictement moins que 2 sur 2', () => {
    const c = candidate({ skills: [skill(1, 'expert'), skill(2, 'expert')] });
    const twoOfFive = scored(
      c,
      criteria({
        skillIds: [1, 2, 3, 4, 5],
        skillNames: { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e' },
      }),
    ).score;
    const twoOfTwo = scored(
      c,
      criteria({ skillIds: [1, 2], skillNames: { 1: 'a', 2: 'b' } }),
    ).score;

    expect(twoOfFive).toBeLessThan(twoOfTwo);
    expect(twoOfTwo).toBe(100);
    expect(twoOfFive).toBe(
      expectedScore(CRITERION_WEIGHTS.skills * (2 / 5), CRITERION_WEIGHTS.skills),
    );
  });

  it('la couverture croît de façon monotone avec le nombre de compétences couvertes', () => {
    const k = criteria({
      skillIds: [1, 2, 3, 4],
      skillNames: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' },
    });
    const scores = [1, 2, 3, 4].map(
      (n) =>
        scored(
          candidate({ skills: Array.from({ length: n }, (_, i) => skill(i + 1, 'expert')) }),
          k,
        ).score,
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
    }
    expect(scores.at(-1)).toBe(100);
  });

  it('une compétence hors périmètre ne rapporte rien', () => {
    const k = criteria({ skillIds: [1, 2], skillNames: { 1: 'a', 2: 'b' } });
    const withNoise = scored(
      candidate({ skills: [skill(1, 'expert'), skill(99, 'expert')] }),
      k,
    ).score;
    const withoutNoise = scored(candidate({ skills: [skill(1, 'expert')] }), k).score;
    expect(withNoise).toBe(withoutNoise);
  });
});

/* -------------------------------------------------------------------------- */
/* Seuils D-42                                                                 */
/* -------------------------------------------------------------------------- */

describe('seuils qualitatifs (D-42)', () => {
  it('labelFor applique exactement les bornes documentées', () => {
    expect(labelFor(100)).toBe('very_relevant');
    expect(labelFor(70)).toBe('very_relevant');
    expect(labelFor(69.99)).toBe('relevant');
    expect(labelFor(45)).toBe('relevant');
    expect(labelFor(44.99)).toBe('close');
    expect(labelFor(25)).toBe('close');
    expect(labelFor(24.9)).toBeNull();
    expect(labelFor(0)).toBeNull();
  });

  it('les bornes viennent bien de RELEVANCE_THRESHOLDS', () => {
    expect(labelFor(RELEVANCE_THRESHOLDS.veryRelevant)).toBe('very_relevant');
    expect(labelFor(RELEVANCE_THRESHOLDS.veryRelevant - 0.01)).toBe('relevant');
    expect(labelFor(RELEVANCE_THRESHOLDS.relevant)).toBe('relevant');
    expect(labelFor(RELEVANCE_THRESHOLDS.relevant - 0.01)).toBe('close');
    expect(labelFor(RELEVANCE_THRESHOLDS.close)).toBe('close');
    expect(labelFor(RELEVANCE_THRESHOLDS.close - 0.01)).toBeNull();
  });

  it('un score exactement au seuil bas est retenu, juste en dessous il est exclu', () => {
    // 1 competence sur 4 demandees : expert -> 25 (retenu) ; advanced -> 22,5 (exclu).
    const k = criteria({ skillIds: [1, 2, 3, 4], skillNames: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' } });
    const atThreshold = scored(candidate({ skills: [skill(1, 'expert')] }), k);
    expect(atThreshold.score).toBe(RELEVANCE_THRESHOLDS.close);
    expect(atThreshold.label).toBe('close');

    expect(scoreCandidate(candidate({ skills: [skill(1, 'advanced')] }), k)).toBeNull();
  });

  it('le libellé du résultat correspond toujours à labelFor(score)', () => {
    const k = criteria({
      skillIds: [1, 2],
      skillNames: { 1: 'a', 2: 'b' },
      sectorId: 7,
      sectorName: 'Santé publique',
      languageCodes: ['fr'],
    });
    const levels: (SkillLevel | null)[] = ['notion', 'intermediate', null, 'advanced', 'expert'];
    for (const level of levels) {
      for (const sectorIds of [[7], [99]]) {
        const result = scoreCandidate(
          candidate({
            skills: [skill(1, level), skill(2, level)],
            sectorIds,
            languageCodes: ['fr'],
          }),
          k,
        );
        if (result !== null) expect(result.label).toBe(labelFor(result.score));
      }
    }
  });

  it('chaque libellé qualitatif a un intitulé français non vide', () => {
    for (const [key, text] of Object.entries(RELEVANCE_LABELS)) {
      expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* D-43 : regle cardinale                                                      */
/* -------------------------------------------------------------------------- */

describe('D-43 — aucune recommandation sans raison affichable', () => {
  // Criteres : disponibilite + experience uniquement.
  // Candidat : disponible mais pas sur le type demande (5/10, aucune raison)
  //            et 6 ans pour 10 demandes (ratio 0,6 -> 6/10, aucune raison).
  const k = criteria({
    availabilityType: 'mentorship',
    availabilityLabel: 'Mentorat',
    minYearsOfExperience: 10,
  });
  const c = candidate({
    profileId: 'p-muet',
    openAvailabilityTypes: ['co_investment'],
    hasAnyAvailability: true,
    yearsOfExperience: 6,
  });

  it('le score brut de ce candidat dépasse pourtant le seuil minimal', () => {
    const availabilityPoints =
      (AVAILABILITY_POINTS.availableWithoutTypeMatch / AVAILABILITY_POINTS.typeExplicitlyOpen) *
      CRITERION_WEIGHTS.availability;
    const experiencePoints = CRITERION_WEIGHTS.experience * (6 / 10);
    const rawScore = expectedScore(
      availabilityPoints + experiencePoints,
      CRITERION_WEIGHTS.availability + CRITERION_WEIGHTS.experience,
    );
    expect(rawScore).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLDS.close);
    expect(labelFor(rawScore)).not.toBeNull();
  });

  it('il est malgré tout exclu, faute de raison', () => {
    expect(scoreCandidate(c, k)).toBeNull();
  });

  it('rankCandidates ne le fait pas apparaître', () => {
    expect(rankCandidates([c], k)).toEqual([]);
  });

  it('le même candidat redevient éligible dès qu’un critère produit une raison', () => {
    const withReason = scoreCandidate({ ...c, openAvailabilityTypes: ['mentorship'] }, k);
    expect(withReason).not.toBeNull();
    expect(withReason!.reasons.map((r) => r.criterion)).toEqual(['availability']);
  });

  it('tout résultat retourné porte au moins une raison', () => {
    const k2 = criteria({
      skillIds: [1, 2],
      skillNames: { 1: 'a', 2: 'b' },
      sectorId: 7,
      adjacentSectorIds: [8],
      sectorName: 'Santé publique',
      countryCode: 'SN',
      countryName: 'Sénégal',
      subregionCode: 'AFO',
      subregionName: 'Afrique de l’Ouest',
      availabilityType: 'mentorship',
      availabilityLabel: 'Mentorat',
      minYearsOfExperience: 5,
      languageCodes: ['fr'],
      promotionId: 42,
    });
    const population: Candidate[] = [];
    for (const level of ['notion', 'intermediate', 'advanced', 'expert', null] as const) {
      for (const sectorIds of [[7], [8], [99]]) {
        for (const years of [0, 3, 5, 20]) {
          population.push(
            candidate({
              profileId: `p-${population.length}`,
              skills: [skill(1, level)],
              sectorIds,
              yearsOfExperience: years,
              hasAnyAvailability: true,
              languageCodes: ['fr'],
              promotionId: 42,
            }),
          );
        }
      }
    }
    const ranked = rankCandidates(population, k2);
    expect(ranked.length).toBeGreaterThan(0);
    for (const r of ranked) expect(r.reasons.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Raisons                                                                     */
/* -------------------------------------------------------------------------- */

describe('raisons explicites (MASTER PROMPT §16)', () => {
  const k = criteria({
    skillIds: [1, 2],
    skillNames: { 1: 'Évaluation', 2: 'Suivi' },
    sectorId: 7,
    sectorName: 'Santé publique',
    countryCode: 'SN',
    countryName: 'Sénégal',
    availabilityType: 'mentorship',
    availabilityLabel: 'Mentorat',
    minYearsOfExperience: 10,
    languageCodes: ['fr'],
    promotionId: 42,
  });
  const perfect = candidate({
    skills: [skill(1, 'expert'), skill(2, 'expert')],
    sectorIds: [7],
    experienceCountryCodes: ['SN'],
    openAvailabilityTypes: ['mentorship'],
    hasAnyAvailability: true,
    yearsOfExperience: 12,
    languageCodes: ['fr'],
    promotionId: 42,
  });

  it('les sept critères savent produire une raison', () => {
    const result = scored(perfect, k);
    expect([...result.reasons].map((r) => r.criterion).sort()).toEqual(
      Object.keys(CRITERION_WEIGHTS).sort(),
    );
  });

  it('chaque raison porte un label français non vide', () => {
    const kWithSubregion = criteria({
      ...k,
      subregionCode: 'AFO',
      subregionName: 'Afrique de l’Ouest',
    });
    const variants: Candidate[] = [
      perfect,
      candidate({ ...perfect, sectorIds: [8] }),
      candidate({ ...perfect, experienceCountryCodes: [], residenceCountryCode: 'SN' }),
      candidate({
        ...perfect,
        experienceCountryCodes: [],
        residenceCountryCode: null,
        subregionCode: 'AFO',
      }),
      candidate({ ...perfect, skills: [skill(1, 'advanced')] }),
    ];

    let seen = 0;
    for (const c of variants) {
      for (const reason of scored(c, kWithSubregion).reasons) {
        seen += 1;
        expect(typeof reason.label).toBe('string');
        expect(reason.label.trim().length).toBeGreaterThan(0);
        expect(reason.label).not.toMatch(/undefined|null|\[object/i);
        // Un libelle affichable : au moins une lettre.
        expect(reason.label).toMatch(/\p{L}/u);
        expect(Array.isArray(reason.evidence)).toBe(true);
        for (const e of reason.evidence) expect(e.trim().length).toBeGreaterThan(0);
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('la raison « compétences » cite les compétences réellement partagées', () => {
    const result = scored(perfect, k);
    const skills = result.reasons.find((r) => r.criterion === 'skills');
    expect(skills?.evidence).toEqual(['Compétence 1', 'Compétence 2']);
    expect(skills?.label).toContain('2 compétences');
  });

  it('les raisons sont identiques d’un appel à l’autre (ordre compris)', () => {
    expect(scored(perfect, k).reasons).toEqual(scored(perfect, k).reasons);
  });
});

/* -------------------------------------------------------------------------- */
/* MASTER PROMPT §15 : jamais de score cote client                             */
/* -------------------------------------------------------------------------- */

describe('MASTER PROMPT §15 — la vue publique ne contient jamais de score', () => {
  const k = criteria({
    skillIds: [1],
    skillNames: { 1: 'Évaluation' },
    sectorId: 7,
    sectorName: 'Santé publique',
  });
  const result = scored(candidate({ skills: [skill(1, 'expert')], sectorIds: [7] }), k);

  /** Recherche recursive de toute propriete nommee `score`, a n'importe quelle profondeur. */
  function findScoreKeys(value: unknown, path = '$'): string[] {
    if (Array.isArray(value)) return value.flatMap((v, i) => findScoreKeys(v, `${path}[${i}]`));
    if (value !== null && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
        key === 'score' ? [`${path}.${key}`] : findScoreKeys(v, `${path}.${key}`),
      );
    }
    return [];
  }

  it('le résultat interne porte bien un score (garde-fou du test lui-même)', () => {
    expect(findScoreKeys(result)).toEqual(['$.score']);
    expect(typeof result.score).toBe('number');
  });

  it('toPublicMatch supprime la propriété score', () => {
    const publicMatch = toPublicMatch(result);
    expect(Object.prototype.hasOwnProperty.call(publicMatch, 'score')).toBe(false);
    expect('score' in publicMatch).toBe(false);
    expect(Object.keys(publicMatch).sort()).toEqual(['label', 'profileId', 'reasons']);
  });

  it('aucune propriété score ne subsiste, à aucune profondeur', () => {
    expect(findScoreKeys(toPublicMatch(result))).toEqual([]);
  });

  it('la sérialisation JSON ne laisse fuir ni score ni pourcentage', () => {
    const serialized = JSON.stringify(toPublicMatch(result));
    expect(serialized).not.toMatch(/"score"/);
    expect(serialized).not.toMatch(/%/);
  });

  it('toutes les vues publiques d’un classement sont expurgées', () => {
    const ranked = rankCandidates(
      [
        candidate({ profileId: 'p-1', skills: [skill(1, 'expert')], sectorIds: [7] }),
        candidate({ profileId: 'p-2', skills: [skill(1, 'notion')], sectorIds: [7] }),
      ],
      k,
    );
    const publicList = ranked.map(toPublicMatch);
    expect(publicList).toHaveLength(2);
    expect(findScoreKeys(publicList)).toEqual([]);
    // Le classement reste porteur d'information : l'ordre, pas le chiffre.
    expect(publicList.map((m) => m.profileId)).toEqual(['p-1', 'p-2']);
  });

  it('ne mute pas le résultat interne', () => {
    const before = JSON.stringify(result);
    toPublicMatch(result);
    expect(JSON.stringify(result)).toBe(before);
    expect(result.score).toBeGreaterThan(0);
  });
});
