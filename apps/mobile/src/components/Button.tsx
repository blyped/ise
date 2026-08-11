import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, minTouchTarget, rounded, space, textStyle } from '../theme/tokens';

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isDisabled && styles.disabled,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textInverse} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    borderRadius: rounded.base,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
  },
  pressed: {
    backgroundColor: colors.activeBlue,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    ...textStyle.body,
    color: colors.textInverse,
    fontWeight: '600',
  },
});
