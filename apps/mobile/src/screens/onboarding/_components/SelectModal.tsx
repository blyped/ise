import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, minTouchTarget, rounded, space, textStyle } from '../../../theme/tokens';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Équivalent mobile du `<Select>` web (pas de composant natif équivalent
 * en React Native) : un champ pressable qui ouvre une liste filtrable en
 * plein écran. Utilisé pour la promotion (ISE-008), le pays (ISE-009,
 * ISE-012) et le niveau de visibilité (ISE-012, ISE-013).
 */
export function SelectModal({
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  searchable = true,
}: {
  label: string;
  placeholder: string;
  options: readonly SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string | undefined;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    if (!searchable || query.trim().length === 0) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query, searchable]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[styles.field, error ? styles.fieldError : null]}
      >
        <Text style={selected ? styles.fieldValue : styles.fieldPlaceholder}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button">
              <Text style={styles.modalClose}>Fermer</Text>
            </Pressable>
          </View>

          {searchable ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher…"
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              autoCapitalize="none"
            />
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setQuery('');
                }}
                style={styles.option}
                accessibilityRole="button"
              >
                <Text style={item.value === value ? styles.optionLabelSelected : styles.optionLabel}>
                  {item.label}
                </Text>
                {item.value === value ? <Text style={styles.optionCheck}>✓</Text> : null}
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[2],
  },
  label: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  field: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  fieldError: {
    borderColor: colors.error,
  },
  fieldValue: {
    ...textStyle.body,
    color: colors.textPrimary,
  },
  fieldPlaceholder: {
    ...textStyle.body,
    color: colors.textMuted,
  },
  error: {
    ...textStyle.caption,
    color: colors.error,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: space[9],
    paddingHorizontal: space[5],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[5],
  },
  modalTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  search: {
    ...textStyle.body,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    marginBottom: space[4],
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  option: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
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
  optionCheck: {
    color: colors.actionBlue,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
});
