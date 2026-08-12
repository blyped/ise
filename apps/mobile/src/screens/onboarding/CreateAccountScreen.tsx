import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frOnboarding } from '../../i18n/onboarding';
import { signUp } from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, space, textStyle } from '../../theme/tokens';
import { Checkbox } from './_components/Checkbox';
import { InfoBanner } from './_components/InfoBanner';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CreerCompte'>;

/**
 * ISE-002 — Créer un compte.
 *
 * Porte `apps/web/src/app/(auth)/creer-compte` : même schéma
 * (`signUpFormSchema` dans `lib/queries/onboarding.ts`, intersection de
 * `@ise/validation#signUpSchema` avec prénom/nom), même règle — créer un
 * compte ne crée PAS un profil ISE (MASTER PROMPT §6). La réclamation
 * (ISE-005/ISE-006) reste l'étape suivante.
 *
 * Succès : `supabase.auth.signUp` ouvre une session (confirmation e-mail
 * désactivée côté projet, comme sur le web) — `AuthProvider` la détecte et
 * `RootNavigator` bascule automatiquement, aucune navigation manuelle ici.
 */
export function CreateAccountScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState(false);

  async function handleSubmit() {
    setPending(true);
    setFormError(undefined);
    setFieldErrors({});

    const result = await signUp({
      firstName,
      lastName,
      email,
      password,
      passwordConfirmation,
      acceptsTerms,
    });

    setPending(false);
    if (!result.ok) {
      setFormError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    if (!result.hasSession) setConfirmation(true);
    // hasSession === true : RootNavigator bascule seul.
  }

  if (confirmation) {
    return (
      <Screen>
        <InfoBanner
          variant="success"
          title={frOnboarding.auth.signUp.confirmationTitle}
          body={frOnboarding.auth.signUp.confirmationBody}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{frOnboarding.auth.signUp.title}</Text>
        <Text style={styles.subtitle}>{frOnboarding.auth.signUp.subtitle}</Text>
      </View>

      <InfoBanner title={frOnboarding.auth.signUp.claimTitle} body={frOnboarding.auth.signUp.claimBody} />

      <View style={styles.form}>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label={frOnboarding.auth.signUp.firstNameLabel}
              placeholder={frOnboarding.auth.signUp.firstNamePlaceholder}
              value={firstName}
              onChangeText={(next) => {
                setFirstName(next);
                if (fieldErrors['firstName']) setFieldErrors((prev) => ({ ...prev, firstName: '' }));
              }}
              error={fieldErrors['firstName']}
              autoComplete="given-name"
            />
          </View>
          <View style={styles.half}>
            <TextField
              label={frOnboarding.auth.signUp.lastNameLabel}
              placeholder={frOnboarding.auth.signUp.lastNamePlaceholder}
              value={lastName}
              onChangeText={(next) => {
                setLastName(next);
                if (fieldErrors['lastName']) setFieldErrors((prev) => ({ ...prev, lastName: '' }));
              }}
              error={fieldErrors['lastName']}
              autoComplete="family-name"
            />
          </View>
        </View>

        <TextField
          label={frOnboarding.auth.signUp.emailLabel}
          placeholder={frOnboarding.auth.signUp.emailPlaceholder}
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

        <View>
          <TextField
            label={frOnboarding.auth.signUp.passwordLabel}
            value={password}
            onChangeText={(next) => {
              setPassword(next);
              if (fieldErrors['password']) setFieldErrors((prev) => ({ ...prev, password: '' }));
            }}
            error={fieldErrors['password']}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />
          <Text style={styles.hint}>{frOnboarding.auth.signUp.passwordHint}</Text>
        </View>

        <TextField
          label={frOnboarding.auth.signUp.passwordConfirmationLabel}
          value={passwordConfirmation}
          onChangeText={(next) => {
            setPasswordConfirmation(next);
            if (fieldErrors['passwordConfirmation'])
              setFieldErrors((prev) => ({ ...prev, passwordConfirmation: '' }));
          }}
          error={fieldErrors['passwordConfirmation']}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
        />

        <Checkbox
          label={frOnboarding.auth.signUp.termsLabel}
          checked={acceptsTerms}
          onChange={(next) => {
            setAcceptsTerms(next);
            if (fieldErrors['acceptsTerms']) setFieldErrors((prev) => ({ ...prev, acceptsTerms: '' }));
          }}
          error={fieldErrors['acceptsTerms']}
        />

        <Button
          label={pending ? frOnboarding.auth.signUp.submitPending : frOnboarding.auth.signUp.submit}
          onPress={handleSubmit}
          loading={pending}
          disabled={email.length === 0 || password.length === 0}
        />

        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          style={styles.signInLink}
        >
          <Text style={styles.signInLinkLabel}>
            {frOnboarding.auth.signUp.alreadyMember} {frOnboarding.auth.signUp.signInLink}
          </Text>
        </Pressable>

        <Text style={styles.accountNote}>{frOnboarding.auth.signUp.accountNote}</Text>
      </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[2],
    marginBottom: space[5],
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
    paddingBottom: space[9],
  },
  row: {
    flexDirection: 'row',
    gap: space[4],
  },
  half: {
    flex: 1,
  },
  hint: {
    ...textStyle.caption,
    color: colors.textMuted,
    marginTop: space[1],
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
  signInLink: {
    alignItems: 'center',
  },
  signInLinkLabel: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  accountNote: {
    ...textStyle.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
