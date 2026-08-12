import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ConnectScreen } from '../screens/relations/ConnectScreen';
import { ConnectionSentScreen } from '../screens/relations/ConnectionSentScreen';
import { IntroductionOutcomeScreen } from '../screens/relations/IntroductionOutcomeScreen';
import { IntroductionPathScreen } from '../screens/relations/IntroductionPathScreen';
import { IntroductionsScreen } from '../screens/relations/IntroductionsScreen';
import { InvitationDetailScreen } from '../screens/relations/InvitationDetailScreen';
import { InvitationsScreen } from '../screens/relations/InvitationsScreen';
import { RequestIntroductionScreen } from '../screens/relations/RequestIntroductionScreen';

/**
 * Pile ISE-038 -> ISE-046 — Relations & introductions.
 *
 * NOUVELLE pile, distincte de `AppTabs` / `RootNavigator` (que cette
 * tranche n'a pas le droit de modifier — d'autres lots mobiles y
 * travaillent en parallele). Elle regroupe les 8 ecrans NEUFS de ce lot ;
 * ISE-040 (`NetworkScreen`, deja livre) n'y est pas duplique.
 *
 * INTEGRATION RESTANTE (a faire par la prochaine passe d'assemblage de
 * `AppTabs.tsx`) : monter cette pile pour que ses ecrans deviennent
 * atteignables depuis l'onglet Reseau, par exemple en remplacant
 * `component={NetworkScreen}` par une petite pile locale qui a pour
 * premier ecran `NetworkScreen` (ISE-040) et qui inclut ensuite les
 * ecrans de `RelationsStack`. `NetworkScreen.tsx` expose deja, dans ce
 * commit, deux boutons ("Invitations reçues", "Mes introductions") qui
 * appellent `useNavigation<...>().navigate('Invitations' | 'Introductions')` :
 * ils resteront inertes (avertissement de dev, aucun crash) tant que cette
 * pile n'est pas montee quelque part dans l'arbre de navigation.
 */
export type RelationsStackParamList = {
  /** ISE-038 — Se connecter a un ISE, depuis son profil. */
  Connect: { profileId: string };
  /** ISE-039 — Confirmation d'envoi d'une demande de connexion. */
  ConnectionSent: { requestId: string };
  /** ISE-041 — Invitations recues. */
  Invitations: undefined;
  /** ISE-042 — Detail d'une invitation recue. */
  InvitationDetail: { requestId: string };
  /** ISE-043 — Chemins d'introduction vers un profil cible. */
  IntroductionPath: { profileId: string };
  /** ISE-044 — Demander une introduction via un intermediaire donne. */
  RequestIntroduction: { profileId: string; intermediaryId: string };
  /**
   * ISE-045 — Mes demandes d'introduction. Sans `introductionId` : liste
   * (`list_my_introductions`). Avec : suivi d'une demande precise
   * (`get_introduction_request`) — meme ecran, meme maniere que la pile web
   * distingue `/reseau/introductions` de `/reseau/introductions/[id]`.
   */
  Introductions: { introductionId?: string } | undefined;
  /** ISE-046 — Bilan d'une introduction. */
  IntroductionOutcome: { introductionId: string };
};

const Stack = createNativeStackNavigator<RelationsStackParamList>();

export function RelationsStack() {
  return (
    <Stack.Navigator initialRouteName="Invitations" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Connect" component={ConnectScreen} />
      <Stack.Screen name="ConnectionSent" component={ConnectionSentScreen} />
      <Stack.Screen name="Invitations" component={InvitationsScreen} />
      <Stack.Screen name="InvitationDetail" component={InvitationDetailScreen} />
      <Stack.Screen name="IntroductionPath" component={IntroductionPathScreen} />
      <Stack.Screen name="RequestIntroduction" component={RequestIntroductionScreen} />
      <Stack.Screen name="Introductions" component={IntroductionsScreen} />
      <Stack.Screen name="IntroductionOutcome" component={IntroductionOutcomeScreen} />
    </Stack.Navigator>
  );
}
