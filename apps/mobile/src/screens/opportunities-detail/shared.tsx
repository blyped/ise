import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, rounded, space, textStyle } from '../../theme/tokens';

/**
 * Petits blocs d'UI partagés entre les écrans ISE-056 -> ISE-066.
 *
 * Fichier local à `screens/opportunities-detail/` (et non `components/`,
 * qui reste hors-limite pour cette tranche) : ces éléments sont assez
 * spécifiques (tons de carte, pastilles de statut) pour ne pas mériter
 * d'être partagés au-delà de cette tranche pour l'instant.
 */

export type CardTone = 'default' | 'success' | 'info' | 'warning';

const CARD_TONE_STYLES: Record<CardTone, { backgroundColor: string; borderColor: string }> = {
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  success: { backgroundColor: '#EAF7EF', borderColor: colors.success },
  info: { backgroundColor: '#EAF1FB', borderColor: colors.info },
  warning: { backgroundColor: '#FDF3DC', borderColor: colors.warning },
};

export function Card({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: CardTone;
}) {
  return <View style={[styles.card, CARD_TONE_STYLES[tone]]}>{children}</View>;
}

export function CardTitle({ children, tone = 'default' }: { children: ReactNode; tone?: CardTone }) {
  return <Text style={[styles.cardTitle, tone === 'success' ? styles.cardTitleSuccess : null]}>{children}</Text>;
}

export type BadgeTone = 'neutral' | 'success' | 'info' | 'purple' | 'warning';

const BADGE_TONE_STYLES: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.textSecondary },
  success: { backgroundColor: '#D6F0DE', color: colors.success },
  info: { backgroundColor: '#DCE8FB', color: colors.info },
  purple: { backgroundColor: '#E8E1FA', color: colors.purple },
  warning: { backgroundColor: '#FBE7C6', color: colors.warning },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const toneStyle = BADGE_TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.badgeLabel, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

export function SelectablePill({
  label,
  selected,
  onPress,
  fullWidth = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.pill, selected ? styles.pillSelected : null, fullWidth ? styles.pillFullWidth : null]}
    >
      <Text style={[styles.pillLabel, selected ? styles.pillLabelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
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

export function Avatar({ initials }: { initials: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarLabel}>{initials}</Text>
    </View>
  );
}

/** Initiales à partir d'un nom affiché, ex. « Mariam Koné » -> « MK ». */
export function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Formate une date ISO en `DD mon. AAAA`, sans dépendance externe. */
const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function formatDate(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Nombre de jours entiers avant `iso` (négatif si passé), ou `null`. */
export function daysUntil(iso: string | null): number | null {
  if (iso === null) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((target.getTime() - now.getTime()) / msPerDay);
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[3],
  },
  cardTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardTitleSuccess: {
    color: colors.success,
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
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pillFullWidth: {
    flex: 1,
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
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonLabel: {
    ...textStyle.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...textStyle.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
