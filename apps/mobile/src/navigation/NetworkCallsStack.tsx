import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CloseNetworkCallScreen } from '../screens/network-calls/CloseNetworkCallScreen';
import { CreateNetworkCallScreen } from '../screens/network-calls/CreateNetworkCallScreen';
import { NetworkCallDetailScreen } from '../screens/network-calls/NetworkCallDetailScreen';
import { NetworkCallTrackingScreen } from '../screens/network-calls/NetworkCallTrackingScreen';
import { NetworkCallsScreen } from '../screens/network-calls/NetworkCallsScreen';

/**
 * Pile ISE-047 -> ISE-054 — Appels au reseau.
 *
 * Fichier VOLONTAIREMENT independant de `navigation/types.ts` : ce type de
 * parametres n'appartient qu'a cette tranche, et `RootParamList` /
 * `AppTabParamList` restent hors-perimetre de ce lot (isolation des
 * fichiers partages entre lots mobiles en cours de developpement en
 * parallele).
 *
 * INTEGRATION RESTANTE (a faire par un lot qui a le droit de toucher
 * `navigation/AppTabs.tsx`) : monter ce composant quelque part atteignable
 * depuis les 5 onglets D-94, par exemple en remplacant
 * `<Tab.Screen name="Reseau" component={NetworkScreen} .../>` par
 * `<Tab.Screen name="Reseau" component={NetworkCallsStack} .../>` avec
 * `NetworkScreen` comme premier ecran de cette pile plutot que
 * `NetworkCallsScreen`, OU en ajoutant un onglet/route dedie. Voir le
 * commentaire dans `screens/network/NetworkScreen.tsx`.
 */
export type NetworkCallsStackParamList = {
  AppelsListe: undefined;
  AppelDetail: { callId: string };
  AppelCreer: { callId?: string };
  AppelSuivi: { callId: string };
  AppelCloture: { callId: string };
};

const Stack = createNativeStackNavigator<NetworkCallsStackParamList>();

export function NetworkCallsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AppelsListe" component={NetworkCallsScreen} />
      <Stack.Screen name="AppelDetail" component={NetworkCallDetailScreen} />
      <Stack.Screen name="AppelCreer" component={CreateNetworkCallScreen} />
      <Stack.Screen name="AppelSuivi" component={NetworkCallTrackingScreen} />
      <Stack.Screen name="AppelCloture" component={CloseNetworkCallScreen} />
    </Stack.Navigator>
  );
}
