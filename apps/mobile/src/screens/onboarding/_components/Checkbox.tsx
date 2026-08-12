import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouchTarget, rounded, space, textStyle } from '../../../theme/tokens';

/** Case à cocher réutilisée par les étapes 1 et 7 (accusé, confirmation finale). */
export function Checkbox({
  label,
  checked,
  onChange,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string | undefined;
}) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.row}
      >
        <View style={[styles.box, checked ? styles.boxChecked : null]}>
          {checked ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    minHeight: minTouchTarget,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    backgroundColor: colors.actionBlue,
    borderColor: colors.actionBlue,
  },
  check: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    flex: 1,
  },
  error: {
    ...textStyle.caption,
    color: colors.error,
  },
});
