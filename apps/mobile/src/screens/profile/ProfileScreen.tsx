import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';
import { useAuth } from '../../lib/auth/AuthProvider';
import { colors, space, textStyle } from '../../theme/tokens';

/**
 * Moi — D-94. Equivalent mobile de « Mon profil » (ISE-016+) cote web,
 * reduit pour cette premiere tranche a l'identite du compte et a la
 * deconnexion : le formulaire de profil complet reste a construire.
 */
export function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <Text style={styles.heading}>{fr.nav.profile}</Text>

      <View style={styles.card}>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
      </View>

      <View style={styles.signOut}>
        <Button label={fr.common.signOut} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: space[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[6],
  },
  email: {
    ...textStyle.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  signOut: {
    marginTop: space[8],
  },
});
