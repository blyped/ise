import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frOnboarding } from '../../i18n/onboarding';
import { resetPassword } from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReinitialiserMotDePasse'>;

/**
 * ISE-004 — Réinitialiser le mot de passe.
 *
 * Porte `apps/web/src/app/(auth)/reinitialiser-mot-de-passe`. Suppose une
 * session de récupération déjà ouverte : sur le web, elle vient des
 * cookies posés par le lien e-mail ; sur mobile, elle suppose qu'un deep
 * link (`competences-ise://reinitialiser-mot-de-passe`, voir
 * `lib/queries/onboarding.ts::forgotPassword`) a déjà appelé
 * `supabase.auth.setSession` avant l'affichage de cet écran — câblage du
 * deep link hors de cette tranche (voir rapport de livraison).
 */
export function ResetPasswordScreen({ navigation }: Props) {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setPending(true);
    setFormError(undefined);

    if (password !== passwordConfirmation) {
      setPending(false);
      setFormError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    const result = await resetPassword(password);
    setPending(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <Screen>
        <InfoBanner
          variant="success"
          title={frOnboarding.auth.resetPassword.linkVerifiedTitle}
          body={frOnboarding.auth.resetPassword.redirectHint}
        />
        <View style={styles.doneAction}>
          <Button label={frOnboarding.auth.forgotPassword.backToSignIn} onPress={() => navigation.popToTop()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{frOnboarding.auth.resetPassword.title}</Text>
        <Text style={styles.subtitle}>{frOnboarding.auth.resetPassword.subtitle}</Text>
      </View>

      <InfoBanner
        variant="success"
        title={frOnboarding.auth.resetPassword.linkVerifiedTitle}
        body={frOnboarding.auth.resetPassword.linkVerifiedBody}
      />

      <View style={styles.form}>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <TextField
          label={frOnboarding.auth.resetPassword.passwordLabel}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
        />

        <TextField
          label={frOnboarding.auth.resetPassword.passwordConfirmationLabel}
          value={passwordConfirmation}
          onChangeText={setPasswordConfirmation}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
        />

        <InfoBanner title={frOnboarding.auth.resetPassword.rulesTitle} body={frOnboarding.auth.resetPassword.rulesBody} />

        <Button
          label={pending ? frOnboarding.auth.resetPassword.submitPending : frOnboarding.auth.resetPassword.submit}
          onPress={handleSubmit}
          loading={pending}
          disabled={password.length === 0 || passwordConfirmation.length === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[2],
    marginBottom: space[6],
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
    marginTop: space[5],
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
  doneAction: {
    marginTop: space[6],
  },
});
