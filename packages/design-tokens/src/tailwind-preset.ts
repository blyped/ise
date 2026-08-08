import { colors, fontFamily, radius, shadow, spacing, breakpoints } from './index';

/**
 * Preset partage entre apps/web (Tailwind) et, par derivation, apps/mobile
 * (NativeWind). Les valeurs proviennent d'une source unique : ce package.
 */
export const isePreset = {
  theme: {
    extend: {
      colors: {
        'deep-navy': colors.deepNavy,
        'dark-navy': colors.darkNavy,
        'action-blue': colors.actionBlue,
        'active-blue': colors.activeBlue,
        'ise-gold': colors.iseGold,
        background: colors.background,
        surface: colors.surface,
        'surface-muted': colors.surfaceMuted,
        'text-primary': colors.textPrimary,
        'text-secondary': colors.textSecondary,
        'text-muted': colors.textMuted,
        border: colors.border,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
        purple: colors.purple,
      },
      fontFamily: { sans: [...fontFamily.sans], mono: [...fontFamily.mono] },
      borderRadius: { ...radius },
      boxShadow: { ...shadow },
      spacing: { ...spacing },
      screens: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v}px`])),
    },
  },
} as const;

export default isePreset;
