import type { Criterion } from './weights';

export type SkillLevel = 'notion' | 'intermediate' | 'advanced' | 'expert';

/** Libelles qualitatifs exposes a l'interface. Jamais de score chiffre (MASTER PROMPT §15). */
export type RelevanceLabel = 'very_relevant' | 'relevant' | 'close';

export const RELEVANCE_LABELS: Readonly<Record<RelevanceLabel, string>> = {
  very_relevant: 'Très pertinent',
  relevant: 'Pertinent',
  close: 'Profil proche',
};

/**
 * Raison explicite d'une recommandation.
 * MASTER PROMPT §16 : ne jamais produire un matching opaque.
 * D-43 : un candidat sans aucune raison affichable est exclu du resultat.
 */
export interface MatchReason {
  readonly criterion: Criterion;
  /** Phrase affichable telle quelle, en francais. */
  readonly label: string;
  /** Elements concrets cites : noms de competences, de pays, de secteur. */
  readonly evidence: readonly string[];
}

export interface CandidateSkill {
  readonly skillId: number;
  readonly name: string;
  readonly level: SkillLevel | null;
  readonly yearsExperience: number | null;
  readonly isPrimary: boolean;
}

export interface Candidate {
  readonly profileId: string;
  readonly skills: readonly CandidateSkill[];
  readonly sectorIds: readonly number[];
  readonly experienceCountryCodes: readonly string[];
  readonly residenceCountryCode: string | null;
  readonly subregionCode: string | null;
  readonly openAvailabilityTypes: readonly string[];
  readonly hasAnyAvailability: boolean;
  readonly yearsOfExperience: number | null;
  readonly languageCodes: readonly string[];
  readonly promotionId: number | null;
}

export interface MatchCriteria {
  readonly skillIds: readonly number[];
  readonly skillNames: Readonly<Record<number, string>>;
  readonly sectorId: number | null;
  readonly adjacentSectorIds: readonly number[];
  readonly sectorName: string | null;
  readonly countryCode: string | null;
  readonly countryName: string | null;
  readonly subregionCode: string | null;
  readonly subregionName: string | null;
  readonly availabilityType: string | null;
  readonly availabilityLabel: string | null;
  readonly minYearsOfExperience: number | null;
  readonly languageCodes: readonly string[];
  readonly promotionId: number | null;
}

export interface MatchResult {
  readonly profileId: string;
  /** Score interne 0-100, utilise pour le classement. JAMAIS renvoye au client. */
  readonly score: number;
  readonly label: RelevanceLabel;
  readonly reasons: readonly MatchReason[];
}
