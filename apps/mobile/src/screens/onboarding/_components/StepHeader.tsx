import { StyleSheet, Text, View } from 'react-native';

import { frOnboarding, t } from '../../../i18n/onboarding';
import { colors, rounded, space, textStyle } from '../../../theme/tokens';

/**
 * En-tête commun aux 7 étapes de l'onboarding (D-110/D-70) : compteur
 * « n / 7 » et barre de progression, comme sur toutes les maquettes
 * `ISE-007` à `ISE-014` (bandeau haut, `n / 7` en haut à droite).
 */
export function StepHeader({ step, total = 7 }: { step: number; total?: number }) {
  const ratio = Math.min(Math.max(step / total, 0), 1);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.brand}>
          COMPÉTENCES <Text style={styles.brandAccent}>ISE</Text>
        </Text>
        <Text style={styles.counter}>{t(frOnboarding.shell.stepCounter, { current: step, total })}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[3],
    marginBottom: space[6],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.deepNavy,
  },
  brandAccent: {
    color: colors.iseGold,
  },
  counter: {
    ...textStyle.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  track: {
    height: 6,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.actionBlue,
    borderRadius: rounded.full,
  },
});
