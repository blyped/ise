import 'react-native-url-polyfill/auto';

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/lib/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationTheme } from './src/theme/tokens';

/**
 * Racine de l'application mobile.
 *
 * `react-native-url-polyfill/auto` doit etre importe avant tout usage de
 * `@supabase/supabase-js` : Hermes ne fournit pas une implementation
 * complete de `URL`, dont le client Supabase depend.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
