import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NetworkScreen } from '../screens/network/NetworkScreen';
import { CloseNetworkCallScreen } from '../screens/network-calls/CloseNetworkCallScreen';
import { CreateNetworkCallScreen } from '../screens/network-calls/CreateNetworkCallScreen';
import { NetworkCallDetailScreen } from '../screens/network-calls/NetworkCallDetailScreen';
import { NetworkCallTrackingScreen } from '../screens/network-calls/NetworkCallTrackingScreen';
import { NetworkCallsScreen } from '../screens/network-calls/NetworkCallsScreen';
import { ConnectScreen } from '../screens/relations/ConnectScreen';
import { ConnectionSentScreen } from '../screens/relations/ConnectionSentScreen';
import { IntroductionOutcomeScreen } from '../screens/relations/IntroductionOutcomeScreen';
import { IntroductionPathScreen } from '../screens/relations/IntroductionPathScreen';
import { IntroductionsScreen } from '../screens/relations/IntroductionsScreen';
import { InvitationDetailScreen } from '../screens/relations/InvitationDetailScreen';
import { InvitationsScreen } from '../screens/relations/InvitationsScreen';
import { RequestIntroductionScreen } from '../screens/relations/RequestIntroductionScreen';
import type { NetworkCallsStackParamList } from './NetworkCallsStack';
import type { RelationsStackParamList } from './RelationsStack';

/**
 * Pile locale de l'onglet « Réseau » : integration finale des tranches
 * mobiles paralleles ISE-040 (deja livre), ISE-038 -> ISE-046 (Relations &
 * introductions) et ISE-047 -> ISE-054 (Appels au reseau).
 *
 * Nichee ICI (nouveau fichier de navigation, pas dans `AppTabs.tsx`) sur
 * le meme modele que la pile locale de `ProfileScreen.tsx` (onglet
 * « Moi ») : `AppTabs.tsx` monte `ReseauStack` a la place de
 * `NetworkScreen` pour l'onglet « Reseau », sans connaitre le detail des
 * ecrans qu'elle contient.
 *
 * FUSION A PLAT (pas d'imbrication de navigateurs) : `NetworkScreen.tsx`
 * navigue directement vers `'Invitations'`, `'Introductions'` et
 * `'AppelsListe'` (`navigate(... as never)`), et chaque ecran de
 * `RelationsStack`/`NetworkCallsStack` navigue lui-meme vers ses propres
 * ecrans voisins (ex. `InvitationsScreen` -> `'InvitationDetail'`). Tous
 * ces ecrans doivent donc partager le MEME navigateur, pas des
 * navigateurs imbriques distincts.
 *
 * COLLISION DE NOM RESOLUE : `NetworkScreen.tsx` appelait a l'origine
 * `navigate('AppelsReseau' as never)`, un nom qui n'existe dans AUCUNE
 * des deux piles (`NetworkCallsStack.tsx` nomme son premier ecran
 * `AppelsListe`). Plutot que de renommer la route dans
 * `NetworkCallsStackParamList` (ce qui casserait la compatibilite de
 * type de `NetworkCallsScreen.tsx`, dont les props sont figees sur
 * `NativeStackScreenProps<NetworkCallsStackParamList, 'AppelsListe'>` —
 * `route.name` est un type litteral, un renommage cote pile romprait
 * l'assignabilite du composant), c'est l'APPELANT qui a ete corrige :
 * `NetworkScreen.tsx` navigue maintenant vers `'AppelsListe'`, le nom
 * reellement declare par `NetworkCallsStack.tsx`. Aucune autre collision
 * de nom entre `RelationsStackParamList` et `NetworkCallsStackParamList`.
 */
export type ReseauStackParamList = RelationsStackParamList &
  NetworkCallsStackParamList & {
    ReseauHome: undefined;
  };

const Stack = createNativeStackNavigator<ReseauStackParamList>();

export function ReseauStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReseauHome" component={NetworkScreen} />

      {/* ISE-038 -> ISE-046 — Relations & introductions. */}
      <Stack.Screen name="Connect" component={ConnectScreen} />
      <Stack.Screen name="ConnectionSent" component={ConnectionSentScreen} />
      <Stack.Screen name="Invitations" component={InvitationsScreen} />
      <Stack.Screen name="InvitationDetail" component={InvitationDetailScreen} />
      <Stack.Screen name="IntroductionPath" component={IntroductionPathScreen} />
      <Stack.Screen name="RequestIntroduction" component={RequestIntroductionScreen} />
      <Stack.Screen name="Introductions" component={IntroductionsScreen} />
      <Stack.Screen name="IntroductionOutcome" component={IntroductionOutcomeScreen} />

      {/* ISE-047 -> ISE-054 — Appels au reseau. */}
      <Stack.Screen name="AppelsListe" component={NetworkCallsScreen} />
      <Stack.Screen name="AppelDetail" component={NetworkCallDetailScreen} />
      <Stack.Screen name="AppelCreer" component={CreateNetworkCallScreen} />
      <Stack.Screen name="AppelSuivi" component={NetworkCallTrackingScreen} />
      <Stack.Screen name="AppelCloture" component={CloseNetworkCallScreen} />
    </Stack.Navigator>
  );
}
