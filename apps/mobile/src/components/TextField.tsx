import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, rounded, space, textStyle } from '../theme/tokens';

export function TextField({
  label,
  error,
  ...inputProps
}: { label: string; error?: string | undefined } & TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
        ]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[2],
  },
  label: {
    ...textStyle.caption,
    color: colors.error,
  },
});
