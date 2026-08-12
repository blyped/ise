import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, minTouchTarget, rounded, space, textStyle } from '../../../theme/tokens';

export interface TokenOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string | undefined;
}

/**
 * Sélecteur multiple avec recherche et jetons retirables — équivalent
 * mobile du `TokenPicker` web (`@ise/ui-web`), utilisé pour les
 * compétences (ISE-010), secteurs (ISE-011) et zones d'expérience
 * (ISE-012). Le référentiel est fourni par l'écran (déjà chargé en base) ;
 * ce composant ne fait que filtrer côté client sur le libellé.
 */
export function TokenPicker({
  searchLabel,
  searchPlaceholder,
  options,
  selected,
  onChange,
  max,
  error,
  emptyLabel,
  onSearch,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  options: readonly TokenOption[];
  selected: readonly TokenOption[];
  onChange: (next: readonly TokenOption[]) => void;
  max?: number | undefined;
  error?: string | undefined;
  emptyLabel: string;
  /** Recherche asynchrone facultative (ISE-010 : `search_skills` en base). */
  onSearch?: ((query: string) => Promise<readonly TokenOption[]>) | undefined;
}) {
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<readonly TokenOption[] | null>(null);

  const selectedValues = new Set(selected.map((option) => option.value));
  const atMax = max !== undefined && selected.length >= max;

  const filtered = useMemo(() => {
    const source = remoteResults ?? options;
    if (query.trim().length === 0) return source;
    const needle = query.trim().toLowerCase();
    return source.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query, remoteResults]);

  function toggle(option: TokenOption) {
    if (selectedValues.has(option.value)) {
      onChange(selected.filter((item) => item.value !== option.value));
      return;
    }
    if (atMax) return;
    onChange([...selected, option]);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (!onSearch) return;
    if (next.trim().length === 0) {
      setRemoteResults(null);
      return;
    }
    onSearch(next)
      .then((results) => setRemoteResults(results))
      .catch(() => setRemoteResults([]));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{searchLabel}</Text>
      <TextInput
        value={query}
        onChangeText={handleQueryChange}
        placeholder={searchPlaceholder}
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        autoCapitalize="none"
      />

      {selected.length > 0 ? (
        <View style={styles.chips}>
          {selected.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => toggle(option)}
              style={styles.chip}
              accessibilityRole="button"
            >
              <Text style={styles.chipLabel}>{option.label}</Text>
              <Text style={styles.chipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {max !== undefined ? (
        <Text style={styles.counter}>
          {selected.length} / {max}
        </Text>
      ) : null}

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{emptyLabel}</Text>
        ) : (
          filtered.slice(0, 40).map((option) => {
            const isSelected = selectedValues.has(option.value);
            const disabled = !isSelected && atMax;
            return (
              <Pressable
                key={option.value}
                onPress={() => toggle(option)}
                disabled={disabled}
                style={[styles.option, isSelected ? styles.optionSelected : null, disabled ? styles.optionDisabled : null]}
                accessibilityRole="button"
              >
                <View style={styles.optionTextWrap}>
                  <Text style={isSelected ? styles.optionLabelSelected : styles.optionLabel}>
                    {option.label}
                  </Text>
                  {option.hint ? <Text style={styles.optionHint}>{option.hint}</Text> : null}
                </View>
                <Text style={styles.optionMark}>{isSelected ? '✓' : '+'}</Text>
              </Pressable>
            );
          })
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[3],
  },
  label: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  search: {
    ...textStyle.body,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.actionBlue,
  },
  chipLabel: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  chipRemove: {
    ...textStyle.body,
    color: colors.actionBlue,
    fontWeight: '700',
  },
  counter: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  list: {
    gap: space[2],
  },
  option: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.actionBlue,
    backgroundColor: colors.surfaceMuted,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...textStyle.body,
    color: colors.textPrimary,
  },
  optionLabelSelected: {
    ...textStyle.body,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  optionHint: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  optionMark: {
    ...textStyle.body,
    color: colors.actionBlue,
    fontWeight: '700',
  },
  empty: {
    ...textStyle.bodySm,
    color: colors.textMuted,
  },
  error: {
    ...textStyle.caption,
    color: colors.error,
  },
});
