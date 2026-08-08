import { describe, expect, it } from 'vitest';
import {
  claimSearchSchema,
  claimSubmitSchema,
  emailSchema,
  passwordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './auth';

const VALID_PASSPHRASE = 'Le Chat Bleu Mange 7 Poissons';

/** Chemins d'erreur signales par Zod, pour verifier QUE le bon champ est en cause. */
function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((i) => i.path.join('.'));
}

describe('passwordSchema (ISE-002)', () => {
  it('rejette un mot de passe de moins de 12 caractères', () => {
    const result = passwordSchema.safeParse('Abcdefgh123');
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toMatch(/12 caractères/);
  });

  it('accepte exactement 12 caractères conformes, refuse 11', () => {
    expect(passwordSchema.safeParse('Abcdefghij12').success).toBe(true);
    expect(passwordSchema.safeParse('Abcdefghi12').success).toBe(false);
  });

  it('rejette un mot de passe sans majuscule', () => {
    const result = passwordSchema.safeParse('motdepasse123');
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.message)).toContain('Ajoutez au moins une majuscule.');
  });

  it('rejette un mot de passe sans chiffre', () => {
    const result = passwordSchema.safeParse('MotDePasseSansChiffre');
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.message)).toContain('Ajoutez au moins un chiffre.');
  });

  it('rejette un mot de passe sans minuscule', () => {
    const result = passwordSchema.safeParse('MOTDEPASSE12345');
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.message)).toContain('Ajoutez au moins une minuscule.');
  });

  it('rejette un mot de passe au-delà de 128 caractères', () => {
    expect(passwordSchema.safeParse(`A1${'a'.repeat(126)}`).success).toBe(true);
    expect(passwordSchema.safeParse(`A1${'a'.repeat(127)}`).success).toBe(false);
  });

  it('accepte une phrase de passe longue et lisible', () => {
    const result = passwordSchema.safeParse(VALID_PASSPHRASE);
    expect(result.success).toBe(true);
    expect(result.data).toBe(VALID_PASSPHRASE);
  });

  it('accepte les accents comme majuscule ou minuscule', () => {
    expect(passwordSchema.safeParse('Été Doux À Dakar 2026').success).toBe(true);
  });

  it("n'exige aucun caractère spécial : la longueur prime", () => {
    expect(passwordSchema.safeParse('Correcthorse7battery').success).toBe(true);
  });
});

describe('emailSchema', () => {
  it('normalise en minuscules et supprime les espaces', () => {
    expect(emailSchema.parse('  Jean.Dupont@ISE.SN  ')).toBe('jean.dupont@ise.sn');
    expect(emailSchema.parse('\tMARIE@Exemple.Org\n')).toBe('marie@exemple.org');
  });

  it('refuse une adresse vide ou uniquement composée d’espaces', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
    expect(emailSchema.safeParse('   ').success).toBe(false);
  });

  it('refuse une adresse mal formée', () => {
    for (const value of ['pas-une-adresse', 'a@', '@ise.sn', 'a b@ise.sn']) {
      expect(emailSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it('la normalisation est idempotente', () => {
    const once = emailSchema.parse('  Jean.Dupont@ISE.SN  ');
    expect(emailSchema.parse(once)).toBe(once);
  });
});

describe('signInSchema (ISE-001)', () => {
  it('normalise l’e-mail et applique rememberMe = false par défaut', () => {
    const result = signInSchema.parse({ email: ' A@B.COM ', password: 'x' });
    expect(result.email).toBe('a@b.com');
    expect(result.rememberMe).toBe(false);
  });

  it('exige un mot de passe non vide', () => {
    const result = signInSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('password');
  });
});

describe('signUpSchema (ISE-002)', () => {
  const base = {
    email: 'Jean.Dupont@ISE.SN',
    password: VALID_PASSPHRASE,
    passwordConfirmation: VALID_PASSPHRASE,
    acceptsTerms: true as const,
  };

  it('accepte une inscription valide et normalise l’e-mail', () => {
    const result = signUpSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.data!.email).toBe('jean.dupont@ise.sn');
  });

  it('rejette deux mots de passe différents, sur le champ de confirmation', () => {
    const result = signUpSchema.safeParse({
      ...base,
      passwordConfirmation: `${VALID_PASSPHRASE} !`,
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('passwordConfirmation');
    expect(result.error!.issues.map((i) => i.message)).toContain(
      'Les deux mots de passe ne correspondent pas.',
    );
  });

  it('rejette acceptsTerms: false', () => {
    const result = signUpSchema.safeParse({ ...base, acceptsTerms: false });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('acceptsTerms');
    expect(result.error!.issues.map((i) => i.message)).toContain(
      "Vous devez accepter les conditions d'utilisation.",
    );
  });

  it('rejette acceptsTerms absent', () => {
    const { acceptsTerms: _omit, ...withoutTerms } = base;
    expect(signUpSchema.safeParse(withoutTerms).success).toBe(false);
  });

  it('applique la politique de mot de passe à l’inscription', () => {
    const result = signUpSchema.safeParse({
      ...base,
      password: 'court1A',
      passwordConfirmation: 'court1A',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('password');
  });
});

describe('claimSearchSchema (ISE-005)', () => {
  it('exige au moins deux caractères de nom', () => {
    expect(claimSearchSchema.safeParse({ lastName: 'M' }).success).toBe(false);
    expect(claimSearchSchema.safeParse({ lastName: 'Ba' }).success).toBe(true);
  });

  it('supprime les espaces autour du nom et du prénom', () => {
    const result = claimSearchSchema.parse({ lastName: '  Mensah ', firstName: ' Koffi ' });
    expect(result.lastName).toBe('Mensah');
    expect(result.firstName).toBe('Koffi');
  });

  it('traite « toutes les promotions » (chaîne vide) comme absence de filtre', () => {
    const result = claimSearchSchema.parse({ lastName: 'Mensah', graduationYear: '' });
    expect(result.graduationYear).toBeUndefined();
  });

  it('convertit une année transmise sous forme de chaîne', () => {
    expect(
      claimSearchSchema.parse({ lastName: 'Mensah', graduationYear: '2012' }).graduationYear,
    ).toBe(2012);
  });

  it('rejette une année hors du référentiel des promotions', () => {
    expect(
      claimSearchSchema.safeParse({ lastName: 'Mensah', graduationYear: '1899' }).success,
    ).toBe(false);
    expect(
      issuePaths(claimSearchSchema.safeParse({ lastName: 'Mensah', graduationYear: 'abc' })),
    ).toContain('graduationYear');
  });
});

describe('claimSubmitSchema (ISE-006)', () => {
  const base = {
    profileId: '3f1d2b6e-6f9a-4a1f-9f0b-6d0f2c7b8a11',
    claimMethod: 'historical_email' as const,
    confirmsIdentity: true as const,
  };

  it('accepte une soumission complète et applique declaredDetails = {}', () => {
    const result = claimSubmitSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.data!.declaredDetails).toEqual({});
  });

  it('exige la confirmation explicite de la maquette ISE-006', () => {
    const result = claimSubmitSchema.safeParse({ ...base, confirmsIdentity: false });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('confirmsIdentity');
  });

  it("refuse la methode `admin` : elle n'est jamais un choix de l'utilisateur", () => {
    expect(claimSubmitSchema.safeParse({ ...base, claimMethod: 'admin' }).success).toBe(false);
  });

  it('refuse un identifiant de profil qui n’est pas un uuid', () => {
    const result = claimSubmitSchema.safeParse({ ...base, profileId: 'koffi-mensah' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('profileId');
  });
});

describe('resetPasswordSchema (ISE-004)', () => {
  it('rejette deux mots de passe différents', () => {
    const result = resetPasswordSchema.safeParse({
      password: VALID_PASSPHRASE,
      passwordConfirmation: 'Autre Phrase De Passe 9',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('passwordConfirmation');
  });

  it('accepte deux mots de passe identiques et conformes', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: VALID_PASSPHRASE,
        passwordConfirmation: VALID_PASSPHRASE,
      }).success,
    ).toBe(true);
  });
});
