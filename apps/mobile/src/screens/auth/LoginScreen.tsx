import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { fr } from '../../i18n/fr';
import { useAuth } from '../../lib/auth/AuthProvider';
import { colors, space, textStyle } from '../../theme/tokens';

/**
 * ISE-001 — Connexion (mobile).
 *
 * Porte le meme schema de validation, la meme traduction d'erreurs et la
 * meme regle « pas de detail technique affiche » (D-102) que
 * `apps/web/src/app/(auth)/connexion`. Le mot de passe oublie, la creation
 * de compte et Google OAuth (`GoogleSignInButton` cote web) restent hors de
 * cette premiere tranche — voir `apps/mobile/README.md`.
 */
export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setPending(true);
    setFormError(undefined);
    setFieldErrors({});

    const result = await signIn(email, password);

    setPending(false);
    if (!result.ok) {
      setFormError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
    }
    // Succes : `AuthProvider` met à jour `session`, `RootNavigator` bascule
    // automatiquement vers `AppTabs`. Aucune navigation manuelle ici.
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{fr.auth.signIn.title}</Text>
        <Text style={styles.subtitle}>{fr.auth.signIn.subtitle}</Text>
      </View>

      <View style={styles.form}>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <TextField
          label={fr.auth.signIn.emailLabel}
          placeholder={fr.auth.signIn.emailPlaceholder}
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            if (fieldErrors['email']) setFieldErrors((prev) => ({ ...prev, email: '' }));
          }}
          error={fieldErrors['email']}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <TextField
          label={fr.auth.signIn.passwordLabel}
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            if (fieldErrors['password']) setFieldErrors((prev) => ({ ...prev, password: '' }));
          }}
          error={fieldErrors['password']}
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
        />

        <Button
          label={pending ? fr.auth.signIn.submitPending : fr.auth.signIn.submit}
          onPress={handleSubmit}
          loading={pending}
          disabled={email.length === 0 || password.length === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[2],
    marginBottom: space[8],
  },
  title: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
  },
  form: {
    gap: space[5],
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
