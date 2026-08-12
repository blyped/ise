import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AvailabilityScreen } from '../screens/onboarding/AvailabilityScreen';
import { ClaimConfirmScreen } from '../screens/onboarding/ClaimConfirmScreen';
import { CreateAccountScreen } from '../screens/onboarding/CreateAccountScreen';
import { FinalizeScreen } from '../screens/onboarding/FinalizeScreen';
import { ForgotPasswordScreen } from '../screens/onboarding/ForgotPasswordScreen';
import { LocationScreen } from '../screens/onboarding/LocationScreen';
import { MissingPromotionScreen } from '../screens/onboarding/MissingPromotionScreen';
import { PromotionScreen } from '../screens/onboarding/PromotionScreen';
import { ResetPasswordScreen } from '../screens/onboarding/ResetPasswordScreen';
import { SectorsScreen } from '../screens/onboarding/SectorsScreen';
import { SkillsScreen } from '../screens/onboarding/SkillsScreen';
import { VerificationScreen } from '../screens/onboarding/VerificationScreen';
import type { OnboardingStackParamList } from './onboarding-types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Parcours ISE-002 -> ISE-014 : création de compte, réclamation de profil
 * et onboarding en 7 étapes, dans l'ordre des maquettes (D-70/D-110)
 * Vérification -> Promotion -> Compétences -> Secteurs -> Localisation ->
 * Disponibilité -> Finalisation.
 *
 * FICHIER NOUVEAU, NON BRANCHÉ : `RootNavigator.tsx` et `AppTabs.tsx`
 * (fichiers partagés existants, hors du périmètre de ce lot) ne
 * l'importent pas encore. Voir le rapport de livraison pour
 * l'instruction d'intégration exacte — un humain/orchestrateur la posera
 * une fois tous les lots mobiles parallèles terminés, pour éviter toute
 * collision d'écriture sur ces fichiers partagés.
 *
 * La progression (`profile_onboarding_progress`, D-112) est persistée en
 * base à chaque étape (`lib/queries/onboarding.ts::advanceOnboarding`),
 * permettant une reprise fidèle : quel que soit l'écran d'entrée choisi
 * par l'intégration finale, la lecture de `furthest_step` détermine la
 * bonne étape de départ, jamais une valeur mémorisée côté client.
 */
export function OnboardingStack() {
  return (
    <Stack.Navigator
      initialRouteName="OnboardingVerification"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="CreerCompte" component={CreateAccountScreen} />
      <Stack.Screen name="MotDePasseOublie" component={ForgotPasswordScreen} />
      <Stack.Screen name="ReinitialiserMotDePasse" component={ResetPasswordScreen} />
      <Stack.Screen name="ReclamerProfilConfirmer" component={ClaimConfirmScreen} />
      <Stack.Screen name="OnboardingVerification" component={VerificationScreen} />
      <Stack.Screen name="OnboardingPromotion" component={PromotionScreen} />
      <Stack.Screen name="OnboardingPromotionSignaler" component={MissingPromotionScreen} />
      <Stack.Screen name="OnboardingCompetences" component={SkillsScreen} />
      <Stack.Screen name="OnboardingSecteurs" component={SectorsScreen} />
      <Stack.Screen name="OnboardingLocalisation" component={LocationScreen} />
      <Stack.Screen name="OnboardingDisponibilite" component={AvailabilityScreen} />
      <Stack.Screen name="OnboardingFinalisation" component={FinalizeScreen} />
    </Stack.Navigator>
  );
}
