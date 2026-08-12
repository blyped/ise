import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ErrorState } from '../../components/ErrorState';
import { profileManagement as pm } from '../../i18n/profile-management';
import type { VisibilityLevel } from '../../lib/queries/profile-management';
import { colors, minTouchTarget, rounded, space, textStyle } from '../../theme/tokens';

/**
 * Petits blocs d'UI partagés entre les écrans ISE-017 -> ISE-033.
 *
 * Fichier local à `screens/profile-management/` (et non `components/`,
 * hors-limite pour cette tranche par consigne d'isolation) : ces éléments
 * (carte, puce sélectionnable, sélecteur de visibilité à 4 niveaux D-73,
 * recherche modale) sont assez spécifiques à ce lot pour ne pas mériter
 * d'être partagés au-delà, sur le modèle de
 * `screens/opportunities-detail/shared.tsx`.
 */

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Hint({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  return (
    <View style={[styles.hint, HINT_TONE_STYLES[tone]]}>
      <Text style={[styles.hintText, { color: HINT_TONE_STYLES[tone].color as string }]}>{children}</Text>
    </View>
  );
}

const HINT_TONE_STYLES: Record<'info' | 'warning' | 'success', { backgroundColor: string; borderColor: string; color: string }> = {
  info: { backgroundColor: '#EAF1FB', borderColor: colors.info, color: colors.info },
  warning: { backgroundColor: '#FDF3DC', borderColor: colors.warning, color: colors.warning },
  success: { backgroundColor: '#EAF7EF', borderColor: colors.success, color: colors.success },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'info' }) {
  return (
    <View style={[styles.badge, BADGE_TONE_STYLES[tone]]}>
      <Text style={[styles.badgeLabel, { color: BADGE_TONE_STYLES[tone].color as string }]}>{label}</Text>
    </View>
  );
}

const BADGE_TONE_STYLES: Record<'neutral' | 'success' | 'warning' | 'info', { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.textSecondary },
  success: { backgroundColor: '#D6F0DE', color: colors.success },
  warning: { backgroundColor: '#FBE7C6', color: colors.warning },
  info: { backgroundColor: '#DCE8FB', color: colors.info },
};

export function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.pill, selected ? styles.pillSelected : null]}
    >
      <Text style={[styles.pillLabel, selected ? styles.pillLabelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

export function RemovableTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagLabel}>{label}</Text>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={pm.common.delete} hitSlop={8}>
        <Text style={styles.tagRemove}>×</Text>
      </Pressable>
    </View>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string | undefined;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkboxRow}
    >
      <View style={[styles.checkboxBox, checked ? styles.checkboxBoxChecked : null]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <View style={styles.checkboxTextWrap}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        {description ? <Text style={styles.checkboxDescription}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Année extraite d'une date ISO (`AAAA-MM-JJ`), ou chaîne vide si absente/invalide. */
export function yearOf(isoDate: string | null): string {
  if (!isoDate) return '';
  const year = isoDate.slice(0, 4);
  return /^[0-9]{4}$/.test(year) ? year : '';
}

const VISIBILITY_ORDER: VisibilityLevel[] = ['private', 'connections', 'promotion', 'members'];

/** Sélecteur de visibilité à 4 niveaux (D-73) : borné par `allowedLevels` si fourni. */
export function VisibilityPicker({
  value,
  onChange,
  allowedLevels,
}: {
  value: VisibilityLevel;
  onChange: (level: VisibilityLevel) => void;
  allowedLevels?: readonly VisibilityLevel[];
}) {
  const levels = allowedLevels ?? VISIBILITY_ORDER;
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{pm.common.visibilityLabel}</Text>
      <View style={styles.visibilityRow}>
        {VISIBILITY_ORDER.filter((level) => levels.includes(level)).map((level) => (
          <Pill key={level} label={pm.common.visibility[level]} selected={value === level} onPress={() => onChange(level)} />
        ))}
      </View>
    </View>
  );
}

export function SectionRow({
  title,
  hint,
  onPress,
}: {
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.sectionRow}>
      <View style={styles.sectionRowText}>
        <Text style={styles.sectionRowTitle}>{title}</Text>
        <Text style={styles.sectionRowHint}>{hint}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function PrimaryButton({
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
      style={[styles.primaryButton, isDisabled ? styles.primaryButtonDisabled : null]}
    >
      {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryButtonLabel}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.secondaryButton, disabled ? styles.secondaryButtonDisabled : null]}
    >
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function FormActions({
  onCancel,
  onSubmit,
  submitLabel,
  saving,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
}) {
  return (
    <View style={styles.formActions}>
      <View style={styles.formActionCancel}>
        <SecondaryButton label={pm.common.cancel} onPress={onCancel} disabled={saving} />
      </View>
      <View style={styles.formActionSubmit}>
        <PrimaryButton label={submitLabel} onPress={onSubmit} loading={saving} />
      </View>
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.actionBlue} />
    </View>
  );
}

/**
 * Fait correspondre un `block_key` de `profile_completion_rules` à l'écran
 * de cette tranche qui permet d'agir dessus. Mapping best-effort par
 * mots-clés (les `block_key` exacts sont définis en base, hors de portée
 * du code mobile) — retombe sur le menu si aucun mot-clé ne correspond.
 */
export function routeForBlockKey(
  blockKey: string,
): 'HeaderEdit' | 'Experiences' | 'Educations' | 'Skills' | 'Positioning' | 'Projects' | 'LanguagesZones' | 'Recommendations' | 'Availability' | 'ManagementHome' {
  const key = blockKey.toLowerCase();
  if (key.includes('experience')) return 'Experiences';
  if (key.includes('educat') || key.includes('formation') || key.includes('certif')) return 'Educations';
  if (key.includes('skill') || key.includes('competence')) return 'Skills';
  if (key.includes('project') || key.includes('projet')) return 'Projects';
  if (key.includes('language') || key.includes('langue') || key.includes('zone') || key.includes('tool') || key.includes('outil')) {
    return 'LanguagesZones';
  }
  if (key.includes('availab') || key.includes('disponib')) return 'Availability';
  if (key.includes('recommend')) return 'Recommendations';
  if (key.includes('sector') || key.includes('function') || key.includes('expertise') || key.includes('secteur') || key.includes('positioning')) {
    return 'Positioning';
  }
  if (key.includes('header') || key.includes('headline') || key.includes('bio') || key.includes('identit')) return 'HeaderEdit';
  return 'ManagementHome';
}

export function ErrorBanner({
  title,
  correlationId,
  onRetry,
}: {
  title: string;
  correlationId?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <ErrorState
      title={title}
      {...(correlationId !== undefined ? { correlationId } : {})}
      {...(onRetry !== undefined ? { onRetry } : {})}
    />
  );
}

export interface SearchOption {
  readonly key: string;
  readonly label: string;
  readonly sublabel?: string | undefined;
}

/** Modale de recherche/sélection générique — pays, secteurs, compétences, membres, etc. */
export function SearchPickerModal({
  visible,
  title,
  placeholder,
  options,
  query,
  onQueryChange,
  onSelect,
  onClose,
  loading = false,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  options: SearchOption[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (option: SearchOption) => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={pm.common.cancel} hitSlop={8}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.modalSearch}
            autoFocus
          />
          {loading ? <LoadingView /> : null}
          <FlatList
            data={options}
            keyExtractor={(item) => item.key}
            style={styles.modalList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.modalRow} onPress={() => onSelect(item)} accessibilityRole="button">
                <Text style={styles.modalRowLabel}>{item.label}</Text>
                {item.sublabel ? <Text style={styles.modalRowSublabel}>{item.sublabel}</Text> : null}
              </Pressable>
            )}
            ListEmptyComponent={!loading ? <Text style={styles.modalEmpty}>—</Text> : null}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Champ déclencheur d'une `SearchPickerModal` : affiche la valeur choisie ou un placeholder. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.selectFieldContainer}>
      <Text style={styles.selectFieldLabel}>{label}</Text>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.selectFieldInput}>
        <Text style={value ? styles.selectFieldValue : styles.selectFieldPlaceholder}>{value ?? placeholder}</Text>
      </Pressable>
    </View>
  );
}

/** État local d'ouverture/texte pour une `SearchPickerModal`, sans logique de chargement. */
export function useModalState() {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  return {
    visible,
    query,
    setQuery,
    open: () => {
      setQuery('');
      setVisible(true);
    },
    close: () => setVisible(false),
  };
}

const styles = StyleSheet.create({
  container: {
    gap: space[2],
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[2],
  },
  sectionTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hint: {
    borderWidth: 1,
    borderRadius: rounded.base,
    padding: space[4],
  },
  hintText: {
    ...textStyle.bodySm,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: space[4],
    paddingVertical: space[1],
    borderRadius: rounded.full,
    alignSelf: 'flex-start',
  },
  badgeLabel: {
    ...textStyle.caption,
    fontWeight: '700',
  },
  pill: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pillSelected: {
    borderColor: colors.actionBlue,
    borderWidth: 2,
    backgroundColor: colors.surfaceMuted,
  },
  pillLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  pillLabelSelected: {
    color: colors.actionBlue,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.full,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  tagLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  tagRemove: {
    ...textStyle.body,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    backgroundColor: colors.surface,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxMark: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  checkboxTextWrap: {
    flex: 1,
    gap: space[1],
  },
  checkboxLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  checkboxDescription: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  visibilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
  },
  sectionRowText: {
    flex: 1,
    gap: space[1],
  },
  sectionRowTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionRowHint: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  chevron: {
    ...textStyle.h3,
    color: colors.textMuted,
  },
  primaryButton: {
    minHeight: minTouchTarget,
    borderRadius: rounded.base,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    ...textStyle.body,
    color: colors.textInverse,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: minTouchTarget,
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonLabel: {
    ...textStyle.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: space[4],
    marginTop: space[5],
  },
  formActionCancel: {
    flex: 1,
  },
  formActionSubmit: {
    flex: 2,
  },
  loading: {
    paddingVertical: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: rounded.xl,
    borderTopRightRadius: rounded.xl,
    padding: space[5],
    maxHeight: '80%',
    gap: space[4],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    ...textStyle.h4,
    color: colors.textSecondary,
  },
  modalSearch: {
    ...textStyle.body,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: space[1],
  },
  modalRowLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalRowSublabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  modalEmpty: {
    ...textStyle.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: space[5],
  },
  selectFieldContainer: {
    gap: space[2],
  },
  selectFieldLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  selectFieldInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  selectFieldValue: {
    ...textStyle.body,
    color: colors.textPrimary,
  },
  selectFieldPlaceholder: {
    ...textStyle.body,
    color: colors.textMuted,
  },
});
