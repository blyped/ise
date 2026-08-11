import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fr } from '../i18n/fr';
import { colors, minTouchTarget, rounded, space, textStyle } from '../theme/tokens';

/** Etat d'erreur avec reference de correlation et action « Réessayer » (D-93, D-102). */
export function ErrorState({
  title,
  correlationId,
  onRetry,
}: {
  title: string;
  correlationId?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {correlationId ? (
        <Text style={styles.correlation}>
          {fr.common.correlationLabel} : {correlationId}
        </Text>
      ) : null}
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonLabel}>{fr.common.retry}</Text>
        </Pressable>
      ) : null}
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
  correlation: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  button: {
    marginTop: space[3],
    minHeight: minTouchTarget,
    paddingHorizontal: space[6],
    borderRadius: rounded.base,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    ...textStyle.body,
    color: colors.textInverse,
    fontWeight: '600',
  },
});
