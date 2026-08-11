import { StyleSheet, Text, View } from 'react-native';

import { colors, space, textStyle } from '../theme/tokens';

/**
 * Etat vide/a-venir generique (D-93). Utilise a la fois pour les onglets
 * encore non construits (Reseau, Opportunites, action centrale) et pour les
 * cas "aucune donnee" d'ecrans deja branches a Supabase (tableau de bord).
 */
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
    gap: space[3],
  },
  title: {
    ...textStyle.h4,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...textStyle.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
