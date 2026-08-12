import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouchTarget, space, textStyle } from '../theme/tokens';

/**
 * Entete commune aux ecrans de la tranche RELATIONS & INTRODUCTIONS
 * (ISE-038 -> ISE-046) : fleche de retour + titre, sur le modele visuel
 * des maquettes mobiles (bandeau blanc, titre en gras, bordure basse).
 *
 * Nouveau composant partage — n'existait pas encore dans `components/`.
 * Il ne remplace ni ne modifie `Screen.tsx` : il vient s'inserer a
 * l'interieur, comme premiere rangee de chaque ecran de ce lot.
 */
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={8}
        style={styles.back}
      >
        <Text style={styles.backLabel}>←</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingBottom: space[5],
    marginBottom: space[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: minTouchTarget,
    height: minTouchTarget,
    marginLeft: -space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    ...textStyle.h4,
    color: colors.textPrimary,
  },
  title: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
});
