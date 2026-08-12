/**
 * Paramètres de navigation du parcours ISE-002 -> ISE-014 (compte,
 * réclamation de profil, onboarding en 7 étapes — D-110).
 *
 * Fichier NOUVEAU, séparé de `src/navigation/types.ts` (existant, partagé
 * entre lots mobiles) pour éviter toute collision d'écriture pendant que
 * plusieurs lots avancent en parallèle. Voir le rapport de livraison pour
 * l'intégration exacte dans `RootNavigator.tsx`.
 */
export type OnboardingStackParamList = {
  /** ISE-002 — Créer un compte (flux non authentifié). */
  CreerCompte: undefined;
  /** ISE-003 — Mot de passe oublié (flux non authentifié). */
  MotDePasseOublie: undefined;
  /** ISE-004 — Réinitialiser le mot de passe (session de récupération). */
  ReinitialiserMotDePasse: undefined;
  /** ISE-006 — Confirmer l'association d'un profil référencé. */
  ReclamerProfilConfirmer: { profileId: string };
  /** Étape 1/7 — ISE-007, aucun code envoyé (D-03/D-111). */
  OnboardingVerification: undefined;
  /** Étape 2/7 — ISE-008. */
  OnboardingPromotion: undefined;
  /** ISE-009 — Signaler une promotion absente (sous-écran de l'étape 2). */
  OnboardingPromotionSignaler: undefined;
  /** Étape 3/7 — ISE-010. */
  OnboardingCompetences: undefined;
  /** Étape 4/7 — ISE-011. */
  OnboardingSecteurs: undefined;
  /** Étape 5/7 — ISE-012. */
  OnboardingLocalisation: undefined;
  /** Étape 6/7 — ISE-013. */
  OnboardingDisponibilite: undefined;
  /** Étape 7/7 — ISE-014. */
  OnboardingFinalisation: undefined;
};
