import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frOnboarding } from '../../i18n/onboarding';
import { forgotPassword } from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'MotDePasseOublie'>;

/**
 * ISE-003 — Mot de passe oublié.
 *
 * Porte `apps/web/src/app/(auth)/mot-de-passe-oublie` : réponse
 * volontairement identique que l'adresse existe ou non (D-102 — pas
 * d'énumération de comptes).
 */
export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setPending(true);
    await forgotPassword(email);
    setPending(false);
    setSent(true);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{frOnboarding.auth.forgotPassword.title}</Text>
        <Text style={styles.subtitle}>{frOnboarding.auth.forgotPassword.subtitle}</Text>
      </View>

      {sent ? (
        <View style={styles.form}>
          <InfoBanner
            variant="success"
            title={frOnboarding.auth.forgotPassword.sentTitle}
            body={frOnboarding.auth.forgotPassword.sentBody}
          />
          <InfoBanner title={frOnboarding.auth.forgotPassword.spamHint} />
        </View>
      ) : (
        <View style={styles.form}>
          <InfoBanner
            title={frOnboarding.auth.forgotPassword.hintTitle}
            body={frOnboarding.auth.forgotPassword.hintBody}
          />

          <TextField
            label={frOnboarding.auth.forgotPassword.emailLabel}
            placeholder={frOnboarding.auth.forgotPassword.emailPlaceholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />

          <Button
            label={pending ? frOnboarding.auth.forgotPassword.submitPending : frOnboarding.auth.forgotPassword.submit}
            onPress={handleSubmit}
            loading={pending}
            disabled={email.length === 0}
          />
        </View>
      )}

      <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={styles.backLink}>
        <Text style={styles.backLinkLabel}>{frOnboarding.auth.forgotPassword.backToSignIn}</Text>
      </Pressable>
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
  },
  backLink: {
    alignItems: 'center',
    marginTop: space[8],
  },
  backLinkLabel: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
});
