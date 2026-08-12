import { StyleSheet, Text, View } from 'react-native';

import { colors, rounded, space, textStyle } from '../../../theme/tokens';

export type InfoBannerVariant = 'info' | 'success' | 'warning' | 'error';

const VARIANT_STYLES: Record<InfoBannerVariant, { bg: string; border: string; title: string }> = {
  info: { bg: '#EFF6FF', border: '#BFDBFE', title: colors.info },
  success: { bg: '#F0FDF4', border: '#BBF7D0', title: colors.success },
  warning: { bg: '#FFFBEB', border: '#FDE68A', title: colors.warning },
  error: { bg: '#FEF2F2', border: '#FECACA', title: colors.error },
};

/** Bandeau d'information — équivalent mobile de `<Alert>` (`@ise/ui-web`). */
export function InfoBanner({
  title,
  body,
  variant = 'info',
}: {
  title: string;
  body?: string | undefined;
  variant?: InfoBannerVariant;
}) {
  const palette = VARIANT_STYLES[variant];

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: rounded.base,
    padding: space[5],
    gap: space[1],
  },
  title: {
    ...textStyle.bodySm,
    fontWeight: '700',
  },
  body: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
});
