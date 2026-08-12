import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouchTarget, rounded, space, textStyle } from '../../../theme/tokens';

export interface OptionCardItem {
  readonly value: string;
  readonly label: string;
  readonly description?: string | undefined;
}

/**
 * Cartes d'option (case ou radio) — équivalent mobile de `OptionCardGroup`
 * (`@ise/ui-web`), utilisé pour les formes de disponibilité et le niveau
 * d'intensité (ISE-013).
 */
export function OptionCardGroup({
  legend,
  items,
  values,
  onChange,
  mode,
  error,
}: {
  legend: string;
  items: readonly OptionCardItem[];
  values: readonly string[];
  onChange: (next: readonly string[]) => void;
  mode: 'checkbox' | 'radio';
  error?: string | undefined;
}) {
  function toggle(value: string) {
    if (mode === 'radio') {
      onChange([value]);
      return;
    }
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.legend}>{legend}</Text>
      <View style={styles.list}>
        {items.map((item) => {
          const selected = values.includes(item.value);
          return (
            <Pressable
              key={item.value}
              onPress={() => toggle(item.value)}
              accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'}
              accessibilityState={{ selected, checked: selected }}
              style={[styles.card, selected ? styles.cardSelected : null]}
            >
              <View style={[styles.mark, mode === 'radio' ? styles.markRound : null, selected ? styles.markSelected : null]}>
                {selected ? <View style={styles.markDot} /> : null}
              </View>
              <View style={styles.textWrap}>
                <Text style={selected ? styles.labelSelected : styles.label}>{item.label}</Text>
                {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[3],
  },
  legend: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  list: {
    gap: space[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: minTouchTarget,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.actionBlue,
    backgroundColor: colors.surfaceMuted,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRound: {
    borderRadius: rounded.full,
  },
  markSelected: {
    borderColor: colors.actionBlue,
    backgroundColor: colors.actionBlue,
  },
  markDot: {
    width: 10,
    height: 10,
    borderRadius: rounded.full,
    backgroundColor: colors.textInverse,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...textStyle.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  labelSelected: {
    ...textStyle.body,
    color: colors.actionBlue,
    fontWeight: '700',
  },
  description: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  error: {
    ...textStyle.caption,
    color: colors.error,
  },
});
