import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { frOnboarding } from '../../../i18n/onboarding';
import { colors, minTouchTarget, space, textStyle } from '../../../theme/tokens';

/**
 * Barre d'actions commune aux formulaires d'onboarding : bouton principal,
 * retour facultatif, « Passer cette étape » facultatif (secteurs,
 * localisation, disponibilité — maquettes D-70).
 */
export function StepActions({
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
  onBack,
  onSkip,
  disabled = false,
}: {
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onSubmit: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.container}>
      <Button
        label={isPending ? pendingLabel : submitLabel}
        onPress={onSubmit}
        loading={isPending}
        disabled={disabled}
      />
      {onBack || onSkip ? (
        <View style={styles.row}>
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" style={styles.link}>
              <Text style={styles.linkLabel}>← {frOnboarding.shell.back}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {onSkip ? (
            <Pressable onPress={onSkip} accessibilityRole="button" style={styles.link}>
              <Text style={styles.linkLabel}>{frOnboarding.shell.skip}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[4],
    marginTop: space[6],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  linkLabel: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
});
