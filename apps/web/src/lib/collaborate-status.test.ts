import { describe, expect, it } from 'vitest';
import {
  canRecordInternshipResult,
  canSubmitMentorshipFeedback,
  internshipNextSteps,
  internshipOfferType,
  internshipOfferTypeLabel,
  internshipStatusLabel,
  mentorshipRequestStatusLabel,
  mentorshipStatusBadge,
  mentorshipTransitionOptions,
} from './collaborate-status';

/**
 * Ces tests verrouillent les MIROIRS des machines d'etats SQL :
 * un ecart entre l'ecran et la base produirait soit un bouton refuse
 * par `invalid_transition`, soit une etape cachee a l'utilisateur.
 */

describe('internshipNextSteps — miroir de 0071', () => {
  it('n’offre AUCUNE étape depuis to_prepare : seul l’envoi déclaré en sort (D-55)', () => {
    expect(internshipNextSteps('to_prepare')).toEqual([]);
  });

  it('suit exactement la machine SQL pour les états intermédiaires', () => {
    expect(internshipNextSteps('submitted')).toEqual([
      'reviewed',
      'interview',
      'offered',
      'declined',
      'withdrawn',
    ]);
    expect(internshipNextSteps('reviewed')).toEqual([
      'interview',
      'offered',
      'declined',
      'withdrawn',
    ]);
    expect(internshipNextSteps('interview')).toEqual(['offered', 'declined', 'withdrawn']);
    expect(internshipNextSteps('offered')).toEqual(['accepted', 'declined', 'withdrawn']);
  });

  it('rend les états finaux et inconnus sans issue', () => {
    for (const status of ['accepted', 'declined', 'withdrawn', 'inconnu']) {
      expect(internshipNextSteps(status)).toEqual([]);
    }
  });

  it('ne propose jamais « submitted » comme étape : pas de second chemin vers l’envoi', () => {
    for (const status of Object.keys({
      to_prepare: 0,
      submitted: 0,
      reviewed: 0,
      interview: 0,
      offered: 0,
    })) {
      expect(internshipNextSteps(status)).not.toContain('submitted');
    }
  });
});

describe('canRecordInternshipResult — [U 93]', () => {
  it('n’est possible que depuis offered ou accepted, sans placement existant', () => {
    expect(canRecordInternshipResult('offered', false)).toBe(true);
    expect(canRecordInternshipResult('accepted', false)).toBe(true);
    expect(canRecordInternshipResult('submitted', false)).toBe(false);
    expect(canRecordInternshipResult('interview', false)).toBe(false);
    expect(canRecordInternshipResult('accepted', true)).toBe(false);
  });
});

describe('internshipOfferType — les quatre natures distinguées (ISE-073)', () => {
  it('reconnaît les quatre types', () => {
    for (const type of [
      'official_offer',
      'hosting_possibility',
      'introduction_capacity',
      'external_lead',
    ] as const) {
      expect(internshipOfferType(type)).toBe(type);
    }
  });

  it('retombe sur official_offer pour un type inconnu', () => {
    expect(internshipOfferType('mystere')).toBe('official_offer');
  });

  it('donne un libellé distinct à chaque type', () => {
    const labels = new Set(
      ['official_offer', 'hosting_possibility', 'introduction_capacity', 'external_lead'].map(
        internshipOfferTypeLabel,
      ),
    );
    expect(labels.size).toBe(4);
  });
});

describe('internshipStatusLabel — jamais de code brut pour un état connu', () => {
  it('traduit tous les états de la machine', () => {
    for (const status of [
      'to_prepare',
      'submitted',
      'reviewed',
      'interview',
      'offered',
      'accepted',
      'declined',
      'withdrawn',
    ]) {
      expect(internshipStatusLabel(status)).not.toBe(status);
    }
  });
});

describe('mentorshipTransitionOptions — miroir de 0075', () => {
  it('planned : démarrer ou annuler', () => {
    expect(mentorshipTransitionOptions('planned').map((o) => o.to)).toEqual([
      'active',
      'cancelled',
    ]);
  });

  it('active : pause, clôture ou arrêt — jamais « cancelled »', () => {
    const tos = mentorshipTransitionOptions('active').map((o) => o.to);
    expect(tos).toEqual(['paused', 'completed', 'stopped']);
  });

  it('paused : reprise, clôture ou arrêt', () => {
    expect(mentorshipTransitionOptions('paused').map((o) => o.to)).toEqual([
      'active',
      'completed',
      'stopped',
    ]);
  });

  it('états finaux : aucune action', () => {
    for (const status of ['completed', 'stopped', 'cancelled', 'inconnu']) {
      expect(mentorshipTransitionOptions(status)).toEqual([]);
    }
  });

  it('chaque option porte un libellé français non vide', () => {
    for (const status of ['planned', 'active', 'paused']) {
      for (const option of mentorshipTransitionOptions(status)) {
        expect(option.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('canSubmitMentorshipFeedback — bilan uniquement après la fin (0075)', () => {
  it('ouvert sur completed et stopped, une seule fois', () => {
    expect(canSubmitMentorshipFeedback('completed', false)).toBe(true);
    expect(canSubmitMentorshipFeedback('stopped', false)).toBe(true);
    expect(canSubmitMentorshipFeedback('completed', true)).toBe(false);
  });

  it('fermé tant que la relation vit', () => {
    for (const status of ['planned', 'active', 'paused', 'cancelled']) {
      expect(canSubmitMentorshipFeedback(status, false)).toBe(false);
    }
  });
});

describe('libellés d’états mentorat', () => {
  it('traduit tous les états de relation', () => {
    for (const status of ['planned', 'active', 'paused', 'completed', 'stopped', 'cancelled']) {
      expect(mentorshipStatusBadge(status)).not.toBe(status);
    }
  });

  it('traduit tous les états de demande, y compris alternative_proposed (D-54)', () => {
    for (const status of [
      'draft',
      'pending',
      'alternative_proposed',
      'accepted',
      'declined',
      'cancelled',
      'expired',
    ]) {
      expect(mentorshipRequestStatusLabel(status)).not.toBe(status);
    }
  });
});
