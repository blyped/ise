import {
  AVAILABILITY_POINTS,
  CRITERION_WEIGHTS,
  GEOGRAPHY_POINTS,
  LEVEL_MULTIPLIERS,
  RELEVANCE_THRESHOLDS,
  SECTOR_POINTS,
} from './weights';
import type {
  Candidate,
  MatchCriteria,
  MatchReason,
  MatchResult,
  RelevanceLabel,
  SkillLevel,
} from './types';

/**
 * Moteur de matching V1 — UNIQUE moteur de la plateforme (MASTER PROMPT §22).
 * Partage par : profils, appels au reseau, opportunites, mentorat, projets.
 *
 * Proprietes garanties :
 *  - DETERMINISTE : memes entrees, meme sortie, sans horloge ni aleatoire ;
 *  - EXPLICABLE   : chaque resultat porte au moins une raison factuelle ;
 *  - TESTABLE     : fonction pure, aucune dependance externe.
 *
 * Pipeline (MASTER PROMPT §22) :
 *   retrieval (SQL, hors de ce module)
 *   -> filtres d'eligibilite
 *   -> calcul de pertinence
 *   -> raisons
 *   -> classement
 *   -> libelle qualitatif
 *
 * Pas d'IA generative, pas d'embeddings en V1 (MASTER PROMPT §22, §104).
 */

function levelMultiplier(level: SkillLevel | null): number {
  return level ? LEVEL_MULTIPLIERS[level] : LEVEL_MULTIPLIERS.undeclared;
}

interface CriterionOutcome {
  readonly points: number;
  readonly max: number;
  readonly reason: MatchReason | null;
}

function scoreSkills(candidate: Candidate, criteria: MatchCriteria): CriterionOutcome {
  const max = CRITERION_WEIGHTS.skills;
  if (criteria.skillIds.length === 0) return { points: 0, max: 0, reason: null };

  const wanted = new Set(criteria.skillIds);
  const matched = candidate.skills.filter((s) => wanted.has(s.skillId));
  if (matched.length === 0) return { points: 0, max, reason: null };

  // Moyenne ponderee des multiplicateurs de niveau, sur le nombre de
  // competences DEMANDEES : couvrir 2 besoins sur 5 ne vaut pas couvrir 2 sur 2.
  const weighted = matched.reduce((sum, s) => {
    const primaryBonus = s.isPrimary ? 1.1 : 1;
    return sum + Math.min(1, levelMultiplier(s.level) * primaryBonus);
  }, 0);

  const coverage = weighted / criteria.skillIds.length;
  const points = round2(max * Math.min(1, coverage));

  const names = matched
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .slice(0, 4);

  return {
    points,
    max,
    reason: {
      criterion: 'skills',
      label:
        matched.length === 1
          ? `Compétence recherchée : ${names[0]}`
          : `${matched.length} compétences recherchées en commun`,
      evidence: names,
    },
  };
}

function scoreSector(candidate: Candidate, criteria: MatchCriteria): CriterionOutcome {
  const max = CRITERION_WEIGHTS.sector;
  if (criteria.sectorId === null) return { points: 0, max: 0, reason: null };

  const sectors = new Set(candidate.sectorIds);
  if (sectors.has(criteria.sectorId)) {
    return {
      points: normalize(SECTOR_POINTS.exact, SECTOR_POINTS.exact, max),
      max,
      reason: {
        criterion: 'sector',
        label: `Exerce dans le secteur ${criteria.sectorName ?? 'recherché'}`,
        evidence: criteria.sectorName ? [criteria.sectorName] : [],
      },
    };
  }
  if (criteria.adjacentSectorIds.some((id) => sectors.has(id))) {
    return {
      points: normalize(SECTOR_POINTS.adjacent, SECTOR_POINTS.exact, max),
      max,
      reason: {
        criterion: 'sector',
        label: 'Exerce dans un secteur connexe',
        evidence: criteria.sectorName ? [criteria.sectorName] : [],
      },
    };
  }
  return { points: 0, max, reason: null };
}

function scoreGeography(candidate: Candidate, criteria: MatchCriteria): CriterionOutcome {
  const max = CRITERION_WEIGHTS.geography;
  if (criteria.countryCode === null && criteria.subregionCode === null) {
    return { points: 0, max: 0, reason: null };
  }
  const best = GEOGRAPHY_POINTS.experienceCountryExact;

  if (criteria.countryCode && candidate.experienceCountryCodes.includes(criteria.countryCode)) {
    return {
      points: normalize(GEOGRAPHY_POINTS.experienceCountryExact, best, max),
      max,
      reason: {
        criterion: 'geography',
        label: `A déjà travaillé : ${criteria.countryName ?? criteria.countryCode}`,
        evidence: [criteria.countryName ?? criteria.countryCode],
      },
    };
  }
  if (criteria.countryCode && candidate.residenceCountryCode === criteria.countryCode) {
    return {
      points: normalize(GEOGRAPHY_POINTS.residenceCountryExact, best, max),
      max,
      reason: {
        criterion: 'geography',
        label: `Basé : ${criteria.countryName ?? criteria.countryCode}`,
        evidence: [criteria.countryName ?? criteria.countryCode],
      },
    };
  }
  if (criteria.subregionCode && candidate.subregionCode === criteria.subregionCode) {
    return {
      points: normalize(GEOGRAPHY_POINTS.sameSubregion, best, max),
      max,
      reason: {
        criterion: 'geography',
        label: `Même zone : ${criteria.subregionName ?? criteria.subregionCode}`,
        evidence: [criteria.subregionName ?? criteria.subregionCode],
      },
    };
  }
  return { points: 0, max, reason: null };
}

function scoreAvailability(candidate: Candidate, criteria: MatchCriteria): CriterionOutcome {
  const max = CRITERION_WEIGHTS.availability;
  // Critere NON DEMANDE : il sort de la renormalisation (D-40). Sans cette sortie,
  // le poids `availability` resterait au denominateur alors que le maximum
  // atteignable serait `availableWithoutTypeMatch` : un candidat parfait sur les
  // criteres reellement demandes ne pourrait jamais atteindre 100.
  if (criteria.availabilityType === null) return { points: 0, max: 0, reason: null };

  const best = AVAILABILITY_POINTS.typeExplicitlyOpen;

  if (candidate.openAvailabilityTypes.includes(criteria.availabilityType)) {
    return {
      points: normalize(AVAILABILITY_POINTS.typeExplicitlyOpen, best, max),
      max,
      reason: {
        criterion: 'availability',
        // MASTER PROMPT §20 : disponibilite ne vaut jamais obligation d'accepter.
        label: `Se déclare ouvert : ${criteria.availabilityLabel ?? criteria.availabilityType}`,
        evidence: [criteria.availabilityLabel ?? criteria.availabilityType],
      },
    };
  }
  if (candidate.hasAnyAvailability) {
    return {
      points: normalize(AVAILABILITY_POINTS.availableWithoutTypeMatch, best, max),
      max,
      reason: null,
    };
  }
  return { points: 0, max, reason: null };
}

function scoreExperience(candidate: Candidate, criteria: MatchCriteria): CriterionOutcome {
  const max = CRITERION_WEIGHTS.experience;
  if (criteria.minYearsOfExperience === null || candidate.yearsOfExperience === null) {
    return { points: 0, max: 0, reason: null };
  }
  const ratio = candidate.yearsOfExperience / criteria.minYearsOfExperience;
  if (ratio < 0.5) return { points: 0, max, reason: null };

  const points = round2(max * Math.min(1, ratio));
  return {
    points,
    max,
    reason:
      ratio >= 1
        ? {
            criterion: 'experience',
            label: `${Math.floor(candidate.yearsOfExperience)} ans d'expérience`,
            evidence: [],
          }
        : null,
  };
}

function scoreLanguage(candidate: Candidate, criteria: MatchCriteria): CriterionOutcome {
  const max = CRITERION_WEIGHTS.language;
  if (criteria.languageCodes.length === 0) return { points: 0, max: 0, reason: null };

  const shared = criteria.languageCodes.filter((c) => candidate.languageCodes.includes(c));
  if (shared.length === 0) return { points: 0, max, reason: null };

  return {
    points: round2(max * (shared.length / criteria.languageCodes.length)),
    max,
    reason: { criterion: 'language', label: 'Langue de travail commune', evidence: shared },
  };
}

function scorePromotion(candidate: Candidate, criteria: MatchCriteria): CriterionOutcome {
  const max = CRITERION_WEIGHTS.promotion;
  if (criteria.promotionId === null) return { points: 0, max: 0, reason: null };
  if (candidate.promotionId !== criteria.promotionId) return { points: 0, max, reason: null };
  return {
    points: max,
    max,
    reason: { criterion: 'promotion', label: 'Même promotion', evidence: [] },
  };
}

function normalize(points: number, bestPossible: number, weight: number): number {
  if (bestPossible === 0) return 0;
  return round2((points / bestPossible) * weight);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function labelFor(score: number): RelevanceLabel | null {
  if (score >= RELEVANCE_THRESHOLDS.veryRelevant) return 'very_relevant';
  if (score >= RELEVANCE_THRESHOLDS.relevant) return 'relevant';
  if (score >= RELEVANCE_THRESHOLDS.close) return 'close';
  return null;
}

/**
 * Evalue un candidat. Renvoie `null` si le candidat doit etre ecarte :
 * score sous le seuil minimal, ou aucune raison affichable (D-43).
 */
export function scoreCandidate(candidate: Candidate, criteria: MatchCriteria): MatchResult | null {
  const outcomes = [
    scoreSkills(candidate, criteria),
    scoreSector(candidate, criteria),
    scoreGeography(candidate, criteria),
    scoreAvailability(candidate, criteria),
    scoreExperience(candidate, criteria),
    scoreLanguage(candidate, criteria),
    scorePromotion(candidate, criteria),
  ];

  const totalMax = outcomes.reduce((s, o) => s + o.max, 0);
  if (totalMax === 0) return null;

  const totalPoints = outcomes.reduce((s, o) => s + o.points, 0);
  // Renormalisation : un critere non demande ne penalise pas le candidat.
  const score = round2((totalPoints / totalMax) * 100);

  const label = labelFor(score);
  if (label === null) return null;

  const reasons = outcomes.map((o) => o.reason).filter((r): r is MatchReason => r !== null);

  // MASTER PROMPT §16 : pas de recommandation inexplicable.
  if (reasons.length === 0) return null;

  return { profileId: candidate.profileId, score, label, reasons };
}

/**
 * Classe un ensemble de candidats. Tri deterministe : score decroissant,
 * puis identifiant croissant pour stabiliser la pagination par curseur (D-44).
 */
export function rankCandidates(
  candidates: readonly Candidate[],
  criteria: MatchCriteria,
): MatchResult[] {
  return candidates
    .map((c) => scoreCandidate(c, criteria))
    .filter((r): r is MatchResult => r !== null)
    .sort((a, b) => b.score - a.score || a.profileId.localeCompare(b.profileId));
}

/** Vue publique d'un resultat : le score chiffre n'en fait jamais partie. */
export function toPublicMatch(result: MatchResult): Omit<MatchResult, 'score'> {
  const { score: _score, ...rest } = result;
  return rest;
}
