import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../lib/auth/AuthProvider';
import { colors } from '../theme/tokens';
import { AppTabs } from './AppTabs';
import { AuthStack } from './AuthStack';

/**
 * Racine de navigation : bascule entre `AuthStack` et `AppTabs` selon la
 * session lue par `AuthProvider`.
 *
 * C'est l'equivalent mobile de `apps/web/src/middleware.ts` (D-155) : sur
 * le web, la garde s'execute cote serveur avant que la page ne soit servie,
 * avec redirection vers `/connexion?redirectTo=...` en cas d'absence de
 * session. Sur mobile, il n'y a pas de serveur intercalé : la meme garantie
 * (aucun ecran membre visible sans session) est obtenue en ne montant
 * JAMAIS `AppTabs` tant que `session` est `null` — pas en masquant son
 * contenu apres coup.
 *
 * Le port du `redirectTo` (page demandee avant connexion, D-155) n'a pas
 * d'equivalent utile ici : il n'existe pas de lien profond entrant pour
 * cette premiere tranche (pas encore de deep linking configure dans
 * `app.json`). A construire quand une premiere fonctionnalite en aura besoin
 * (ex. un lien de notification push).
 */
export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.actionBlue} size="large" />
      </View>
    );
  }

  return session ? <AppTabs /> : <AuthStack />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
