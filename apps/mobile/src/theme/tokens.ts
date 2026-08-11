import { colors, fontSize, fontWeight, layout, radius, spacing } from '@ise/design-tokens';
import type { Theme as NavigationTheme } from '@react-navigation/native';
import { DefaultTheme } from '@react-navigation/native';

/**
 * Adaptation des jetons partages `@ise/design-tokens` pour React Native.
 *
 * Le package est ecrit pour le web : `spacing` et `radius` y sont des
 * chaines CSS (`"16px"`), alors que les styles React Native attendent des
 * nombres logiques (points independants de la densite). Cette conversion
 * est le SEUL endroit ou cette difference est geree : le reste du code
 * mobile importe `theme` d'ici, jamais `@ise/design-tokens` directement pour
 * les valeurs d'espacement/rayon.
 *
 * Les couleurs et la typographie (tailles, graisses) sont deja des valeurs
 * neutres — reutilisees telles quelles, garantissant que web et mobile
 * restent visuellement alignes (D-90, D-91).
 */
function pxToNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const space = Object.fromEntries(
  Object.entries(spacing).map(([key, value]) => [key, pxToNumber(value)]),
) as Record<keyof typeof spacing, number>;

export const rounded = Object.fromEntries(
  Object.entries(radius).map(([key, value]) => [key, pxToNumber(value)]),
) as Record<keyof typeof radius, number>;

export { colors, fontWeight };

/**
 * Tailles de texte : `fontSize` est deja `[taille, interligne]` en px — un
 * format directement exploitable par `StyleSheet` (`fontSize`, `lineHeight`).
 */
export const textStyle = Object.fromEntries(
  Object.entries(fontSize).map(([key, [size, lineHeight]]) => [
    key,
    { fontSize: size, lineHeight },
  ]),
) as Record<keyof typeof fontSize, { fontSize: number; lineHeight: number }>;

/**
 * D-91 : Geist en principal, Inter en repli. Aucune des deux n'est une
 * police systeme : elles doivent etre chargees via `expo-font` (ou
 * `@expo-google-fonts/inter`) avant d'etre reference ici. Tant que ce
 * chargement n'est pas branche, on utilise la police systeme par defaut
 * (`undefined`) plutot que de referencer une police absente, qui ferait
 * echouer silencieusement le rendu du texte sur Android.
 */
export const fontFamily: string | undefined = undefined;

export const minTouchTarget = layout.minTouchTarget;

/** Theme de navigation (fond, couleurs de bordure) aligne sur la palette ISE. */
export const navigationTheme: NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.actionBlue,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.error,
  },
};
