import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '../theme/tokens';

/**
 * Coquille d'ecran commune : fond `colors.background`, marges laterales
 * `space[5]` (16px, D-96 gouttiere mobile), respect des zones sures.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: space[5],
    paddingTop: space[6],
  },
});
